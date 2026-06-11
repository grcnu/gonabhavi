/* ==========================================================================
   GONABHAVI — CORE DATABASE & SYNCHRONIZATION MANAGER (src/db.js)
   ========================================================================== */

// 1. Entities Definition
const ENTITIES = [
  'products', 'customers', 'suppliers', 'invoices', 'invoice_payments',
  'sale_orders', 'purchases', 'expenses', 'payment_ins', 'payment_outs',
  'estimates', 'delivery_challans', 'sales_returns', 'purchase_returns',
  'quotations', 'fund_transfers', 'stock_adjustments', 'audit_logs',
  'business_settings'
];

// 2. Storage & ID Helpers
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getRawCollection(entity) {
  // Fix #11: Wrap in try-catch — corrupted localStorage data used to crash the entire app
  try {
    const data = localStorage.getItem(`gb_${entity}`);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error(`[Gonabhavi] Corrupted storage data for entity "${entity}". Returning empty array. Data will re-sync from cloud on next login.`, err);
    return [];
  }
}

function saveRawCollection(entity, data) {
  // Fix #6: Handle browser storage quota exceeded — previously saves would silently fail
  try {
    localStorage.setItem(`gb_${entity}`, JSON.stringify(data));
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.code === 22) {
      console.error('[Gonabhavi] LocalStorage quota exceeded!', err);
      // Display a persistent critical warning so the user knows the save failed
      const msg = 'STORAGE FULL: Browser storage limit reached. This record may NOT have saved! ' +
                  'Please go to Settings \u2192 Sync & Backup and perform a Cloud Sync immediately to free local space.';
      // Use native alert here (not the toast) because this is truly critical
      setTimeout(() => window.alert && window.alert('Storage Full Warning: ' + msg), 100);
    } else {
      throw err; // Re-throw unexpected errors
    }
  }
}

// 3. Database Operations Interface (CRUD)
export const db = {
  // Get active (non-deleted) records
  get(entity) {
    const list = getRawCollection(entity);
    if (entity === 'business_settings') {
      return list[0] || this.getDefaultSettings();
    }
    return list.filter(item => !item.is_deleted);
  },

  // Get ALL records including soft-deleted ones (for Sync & Backups)
  getAllRaw(entity) {
    return getRawCollection(entity);
  },

  // Find single record by UUID (excludes soft-deleted records)
  find(entity, id) {
    return getRawCollection(entity).find(item => item.id === id && !item.is_deleted);
  },

  // Save/Insert a new record
  insert(entity, record) {
    const list = getRawCollection(entity);
    const timestamp = new Date().toISOString();
    
    const newRecord = {
      id: record.id || generateUUID(),
      user_id: db.getCurrentUserId(),
      created_at: record.created_at || timestamp,
      updated_at: timestamp,
      is_deleted: false,
      ...record
    };

    // Uniqueness validation checks (for critical fields)
    if (entity === 'products' && newRecord.qr) {
      const exists = list.find(p => p.qr === newRecord.qr && !p.is_deleted && p.id !== newRecord.id);
      if (exists) throw new Error(`Product with Barcode/QR code "${newRecord.qr}" already exists.`);
    } else if (entity === 'invoices') {
      const exists = list.find(inv => inv.invoice_number === newRecord.invoice_number && !inv.is_deleted && inv.id !== newRecord.id);
      if (exists) throw new Error(`Invoice number "${newRecord.invoice_number}" is already used.`);
    }

    list.push(newRecord);
    saveRawCollection(entity, list);
    
    if (entity === 'invoices') {
      db.createInvoicePayments(newRecord);
    }
    if (entity === 'payment_outs' && newRecord.bill_id) {
      db.recalculatePurchaseBillBalance(newRecord.bill_id);
    }
    if (entity === 'purchase_returns' && newRecord.purchase_id) {
      db.recalculatePurchaseBillBalance(newRecord.purchase_id);
    }
    if (entity === 'sales_returns' && newRecord.invoice_id) {
      db.recalculateInvoiceBalanceDue(newRecord.invoice_id);
    }
    
    // Invalidate stock cache for entities that affect stock levels
    if (['invoices', 'purchases', 'sales_returns', 'purchase_returns', 'stock_adjustments'].includes(entity)) {
      if (typeof calc !== 'undefined') calc.invalidateStockCache();
      else _stockCache = {}; // fallback before calc is initialized
    }
    
    // Log in Audit Log
    db.logAudit(`Record Added`, `${entity.toUpperCase()}: Created record with ID ${newRecord.id.substring(0,8)}`);
    
    // Auto-sync debouncer trigger
    db.triggerAutoSync(entity, newRecord);
    
    return newRecord;
  },

  // Update an existing record
  update(entity, id, record, skipOverwritePayments = false) {
    const list = getRawCollection(entity);
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) throw new Error(`Record with ID ${id} not found in ${entity}.`);

    const timestamp = new Date().toISOString();
    const updatedRecord = {
      ...list[idx],
      ...record,
      updated_at: timestamp
    };

    // Uniqueness checks on update
    if (entity === 'products' && record.qr) {
      const exists = list.find(p => p.qr === record.qr && !p.is_deleted && p.id !== id);
      if (exists) throw new Error(`Product with Barcode/QR code "${record.qr}" already exists.`);
    } else if (entity === 'invoices' && record.invoice_number) {
      const exists = list.find(inv => inv.invoice_number === record.invoice_number && !inv.is_deleted && inv.id !== id);
      if (exists) throw new Error(`Invoice number "${record.invoice_number}" is already used.`);
    }

    list[idx] = updatedRecord;
    saveRawCollection(entity, list);
    
    if (entity === 'invoices' && !skipOverwritePayments) {
      db.overwriteInvoicePayments(id, updatedRecord);
    }
    if (entity === 'payment_outs' && updatedRecord.bill_id) {
      db.recalculatePurchaseBillBalance(updatedRecord.bill_id);
    }
    if (entity === 'purchase_returns' && updatedRecord.purchase_id) {
      db.recalculatePurchaseBillBalance(updatedRecord.purchase_id);
    }
    
    // Invalidate stock cache for entities that affect stock levels
    if (['invoices', 'purchases', 'sales_returns', 'purchase_returns', 'stock_adjustments', 'products'].includes(entity)) {
      if (typeof calc !== 'undefined') calc.invalidateStockCache();
      else _stockCache = {};
    }
    
    db.logAudit(`Record Updated`, `${entity.toUpperCase()}: Modified record with ID ${id.substring(0,8)}`);
    db.triggerAutoSync(entity, updatedRecord);
    
    return updatedRecord;
  },

  // Soft-Delete a record (Sets is_deleted = true)
  delete(entity, id) {
    const list = getRawCollection(entity);
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return false;

    // Check delete protection constraints
    db.checkDeleteSafety(entity, id);

    const timestamp = new Date().toISOString();
    const deletedRecord = {
      ...list[idx],
      is_deleted: true,
      updated_at: timestamp
    };

    list[idx] = deletedRecord;
    saveRawCollection(entity, list);
    
    // Automatically delete linked payment logs if deleting an invoice
    if (entity === 'invoices') {
      const payments = getRawCollection('payment_ins');
      let paymentsChanged = false;
      payments.forEach(p => {
        if (p.invoice_id === id && !p.is_deleted) {
          p.is_deleted = true;
          p.updated_at = timestamp;
          paymentsChanged = true;
          db.triggerAutoSync('payment_ins', p);
        }
      });
      if (paymentsChanged) {
        saveRawCollection('payment_ins', payments);
        db.logAudit(`Payments Deleted`, `Automatically deleted payments linked to Invoice ID ${id.substring(0,8)}`);
      }

      // Reopen converted Sale Order if applicable
      const inv = deletedRecord;
      if (inv.converted_from_so_id) {
        try {
          const saleOrders = getRawCollection('sale_orders');
          const soIdx = saleOrders.findIndex(so => so.id === inv.converted_from_so_id && !so.is_deleted);
          if (soIdx !== -1) {
            saleOrders[soIdx].status = 'Open';
            saleOrders[soIdx].updated_at = timestamp;
            saveRawCollection('sale_orders', saleOrders);
            db.triggerAutoSync('sale_orders', saleOrders[soIdx]);
            db.logAudit('Sale Order Reopened', `Reopened Sale Order ID ${inv.converted_from_so_id.substring(0,8)} after its linked invoice was deleted.`);
          }
        } catch (soErr) {
          console.error("Failed to reopen Sale Order:", soErr);
        }
      }
    }
    
    // Automatically delete linked payment_outs if deleting a purchase bill
    if (entity === 'purchases') {
      const payouts = getRawCollection('payment_outs');
      let payoutsChanged = false;
      payouts.forEach(p => {
        if (p.bill_id === id && !p.is_deleted) {
          p.is_deleted = true;
          p.updated_at = timestamp;
          payoutsChanged = true;
          db.triggerAutoSync('payment_outs', p);
        }
      });
      if (payoutsChanged) {
        saveRawCollection('payment_outs', payouts);
        db.logAudit(`Payments Deleted`, `Automatically deleted payment-outs linked to Purchase Bill ID ${id.substring(0,8)}`);
      }
    }
    
    // When a payment_in linked to an invoice is deleted, recalculate and update invoice balance_due
    if (entity === 'payment_ins') {
      const deletedPayment = deletedRecord;
      const invoiceId = deletedPayment.invoice_id;
      if (invoiceId) {
        // Fetch all remaining (non-deleted) payments for this invoice
        const allPayments = getRawCollection('payment_ins');
        const remainingPayments = allPayments.filter(p => p.invoice_id === invoiceId && !p.is_deleted);
        let totalCash = 0, totalUpi = 0, totalBank = 0;
        remainingPayments.forEach(p => {
          const amt = parseFloat(p.amount || 0);
          if (p.method === 'Cash') totalCash += amt;
          else if (p.method === 'UPI') totalUpi += amt;
          else if (p.method === 'Bank') totalBank += amt;
        });
        // Update the invoice record with recalculated amounts
        const invoices = getRawCollection('invoices');
        const invIdx = invoices.findIndex(inv => inv.id === invoiceId && !inv.is_deleted);
        if (invIdx !== -1) {
          const inv = invoices[invIdx];
          // If the deleted payment was the initial one, set that field to 0
          if (deletedPayment.is_initial) {
            if (deletedPayment.method === 'Cash') inv.cash_paid = 0;
            else if (deletedPayment.method === 'UPI') inv.upi_paid = 0;
            else if (deletedPayment.method === 'Bank') inv.bank_paid = 0;
          }
          const netTotal = parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0);
          // Deduct sales returns linked to this invoice
          const salesReturns = getRawCollection('sales_returns')
            .filter(r => r.invoice_id === invoiceId && !r.is_deleted)
            .reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);
          inv.balance_due = Math.max(0, netTotal - (totalCash + totalUpi + totalBank) - salesReturns);
          inv.updated_at = timestamp;
          invoices[invIdx] = inv;
          saveRawCollection('invoices', invoices);
          db.triggerAutoSync('invoices', inv);
          db.logAudit('Invoice Balance Updated', `Recalculated balance_due for Invoice ID ${invoiceId.substring(0,8)} after payment deletion.`);
        }
      }
    }

    // When a payment_out linked to a purchase bill is deleted, recalculate and update purchase balance_due
    if (entity === 'payment_outs') {
      const deletedPayment = deletedRecord;
      const billId = deletedPayment.bill_id;
      if (billId) {
        db.recalculatePurchaseBillBalance(billId);
      }
    }

    // When a purchase_return linked to a purchase bill is deleted, recalculate and update purchase balance_due
    if (entity === 'purchase_returns') {
      const deletedReturn = deletedRecord;
      const billId = deletedReturn.purchase_id;
      if (billId) {
        db.recalculatePurchaseBillBalance(billId);
      }
    }

    // When a sales_return linked to an invoice is deleted, recalculate invoice balance_due
    if (entity === 'sales_returns') {
      const deletedReturn = deletedRecord;
      const invoiceId = deletedReturn.invoice_id;
      if (invoiceId) {
        db.recalculateInvoiceBalanceDue(invoiceId);
      }
    }
    
    // Invalidate stock cache for entities that affect stock levels
    if (['invoices', 'purchases', 'sales_returns', 'purchase_returns', 'stock_adjustments'].includes(entity)) {
      if (typeof calc !== 'undefined') calc.invalidateStockCache();
      else _stockCache = {};
    }
    
    db.logAudit(`Record Deleted`, `${entity.toUpperCase()}: Soft-deleted record with ID ${id.substring(0,8)}`);
    db.triggerAutoSync(entity, deletedRecord);
    
    return true;
  },

  // Check delete protection constraints (Section 31 spec)
  checkDeleteSafety(entity, id) {
    if (entity === 'products') {
      // Cannot delete product if referenced in invoices, bills, orders, adjustments, returns, estimates, or challans
      const invs = getRawCollection('invoices').some(inv => !inv.is_deleted && inv.items?.some(it => it.product_id === id));
      const bills = getRawCollection('purchases').some(b => !b.is_deleted && b.items?.some(it => it.product_id === id));
      const orders = getRawCollection('sale_orders').some(so => !so.is_deleted && so.items?.some(it => it.product_id === id));
      const adjs = getRawCollection('stock_adjustments').some(adj => !adj.is_deleted && adj.product_id === id);
      const salesRets = getRawCollection('sales_returns').some(r => !r.is_deleted && r.items?.some(it => it.product_id === id));
      const purchaseRets = getRawCollection('purchase_returns').some(r => !r.is_deleted && r.items?.some(it => it.product_id === id));
      const ests = getRawCollection('estimates').some(e => !e.is_deleted && e.items?.some(it => it.product_id === id));
      const challans = getRawCollection('delivery_challans').some(c => !c.is_deleted && c.items?.some(it => it.product_id === id));
      
      if (invs || bills || orders || adjs || salesRets || purchaseRets || ests || challans) {
        throw new Error("Product cannot be deleted because it has linked transactions (sales, purchases, orders, adjustments, returns, estimates, or delivery challans).");
      }
    }
    
    if (entity === 'customers') {
      const invs = getRawCollection('invoices').some(inv => !inv.is_deleted && inv.customer_id === id);
      const orders = getRawCollection('sale_orders').some(so => !so.is_deleted && so.customer_id === id);
      const payments = getRawCollection('payment_ins').some(p => !p.is_deleted && p.customer_id === id);
      const salesRets = getRawCollection('sales_returns').some(r => !r.is_deleted && r.customer_id === id);
      const ests = getRawCollection('estimates').some(e => !e.is_deleted && e.customer_id === id);
      const challans = getRawCollection('delivery_challans').some(c => !c.is_deleted && c.customer_id === id);
      const customer = this.find('customers', id);
      const openBal = parseFloat(customer?.opening_balance || 0);

      if (invs || orders || payments || salesRets || ests || challans || openBal > 0) {
        throw new Error("Customer cannot be deleted because they have associated transactions (sales, orders, payments, returns, estimates, challans, or a non-zero opening balance).");
      }
    }

    if (entity === 'suppliers') {
      const bills = getRawCollection('purchases').some(b => !b.is_deleted && b.supplier_id === id);
      const payments = getRawCollection('payment_outs').some(p => !p.is_deleted && p.supplier_id === id);
      const purchaseRets = getRawCollection('purchase_returns').some(r => !r.is_deleted && r.supplier_id === id);
      const supplier = this.find('suppliers', id);
      const openBal = parseFloat(supplier?.opening_balance || 0);

      if (bills || payments || purchaseRets || openBal > 0) {
        throw new Error("Supplier cannot be deleted because they have linked purchase bills, payments, returns, or a non-zero opening balance.");
      }
    }

    if (entity === 'invoices') {
      const returns = getRawCollection('sales_returns').some(r => !r.is_deleted && r.invoice_id === id);
      if (returns) {
        throw new Error("Invoice cannot be deleted because it has linked active sales returns. Please delete the returns first.");
      }
    }

    if (entity === 'purchases') {
      const returns = getRawCollection('purchase_returns').some(r => !r.is_deleted && r.purchase_id === id);
      if (returns) {
        throw new Error("Purchase bill cannot be deleted because it has linked active purchase returns. Please delete the returns first.");
      }
    }
  },

  // Log in internal audit log
  logAudit(action, details) {
    const list = getRawCollection('audit_logs');
    // Include user identity for staff accountability
    let userEmail = 'unknown';
    try {
      const session = localStorage.getItem('gb_session');
      if (session) userEmail = JSON.parse(session).email || 'unknown';
    } catch (e) { /* ignore */ }
    const log = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
      user_id: db.getCurrentUserId(),
      user_email: userEmail,
      is_deleted: false
    };
    list.unshift(log); // Newer first
    if (list.length > 2000) list.pop(); // Keep max 2000 entries (~40 days at 50/day)
    saveRawCollection('audit_logs', list);
  },

  getDefaultSettings() {
    return {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      owner_id: null,
      company_name: 'My Business',
      phone: '',
      email: '',
      address: '',
      gstin: '',
      pan: '',
      state_name: '',
      state_code: '',
      bank_name: '',
      bank_account_number: '',
      ifsc_code: '',
      upi_id: '',
      invoice_terms: 'Thank you for your business!',
      invoice_prefix: 'INV',
      invoice_suffix: '',
      invoice_separator: '-',
      invoice_start_number: 1,
      invoice_padding: 4,
      fy_reset: false,
      template_style: 'classic',
      supabase_url: '',
      supabase_key: '',
      account_cash_label: 'Cash',
      account_upi_label: 'UPI',
      account_bank_label: 'Bank',
      staff_users: []
    };
  },

  getCurrentUserId() {
    // Always use owner_id for data consistency across all devices
    try {
      const settings = db.get('business_settings');
      if (settings.owner_id) return settings.owner_id;
    } catch (e) { /* settings not loaded yet, fallback below */ }
    // Fallback to logged-in user (first-time setup or before settings exist)
    const session = localStorage.getItem('gb_session');
    if (session) {
      try { return JSON.parse(session).id; } catch(e) {}
    }
    return 'guest-user-offline';
  },

  getUserRole() {
    const session = localStorage.getItem('gb_session');
    if (!session) return 'guest';
    try { JSON.parse(session); } catch(e) { return 'guest'; }
    const user = JSON.parse(session);
    if (user.id === 'guest-user-offline') return 'owner';

    // Check device-level staff mode (set in Settings per device)
    const staffModeEmail = localStorage.getItem('gb_staff_mode_email');
    if (staffModeEmail) {
      const settings = db.get('business_settings');
      const staffList = settings.staff_users || [];
      if (staffList.some(s => s.email.toLowerCase() === staffModeEmail.toLowerCase())) {
        return 'staff';
      }
    }

    // Also check if the logged-in user IS a staff user (legacy support)
    const settings = db.get('business_settings');
    const staffList = settings.staff_users || [];
    if (staffList.some(s => s.email === user.email)) return 'staff';

    return 'owner';
  },

  getUserPermissions() {
    const role = db.getUserRole();
    if (role !== 'staff') {
      return {
        allow_purchases: true,
        allow_expenses: true,
        allow_reports: true,
        allow_dashboard_balances: true,
        allow_delete_invoices: true,
        allow_fund_transfers: true,
        allow_stock_adjustments: true
      };
    }

    // Determine which staff email to use for permissions
    const staffModeEmail = localStorage.getItem('gb_staff_mode_email');
    let lookupEmail = staffModeEmail;

    if (!lookupEmail) {
      // Legacy: check logged-in user's email
      const session = localStorage.getItem('gb_session');
      if (session) {
        try { lookupEmail = JSON.parse(session).email; } catch(e) {}
      }
    }

    if (!lookupEmail) return {};

    const settings = db.get('business_settings');
    const staffList = settings.staff_users || [];
    const staff = staffList.find(s => s.email.toLowerCase() === lookupEmail.toLowerCase());
    
    return staff?.permissions || {
      allow_purchases: false,
      allow_expenses: false,
      allow_reports: false,
      allow_dashboard_balances: false,
      allow_delete_invoices: false,
      allow_fund_transfers: false,
      allow_stock_adjustments: false
    };
  },

  // Guard alias to prevent crashes if called via db.getPurchaseBillBalance
  getPurchaseBillBalance(billId) {
    if (typeof calc !== 'undefined' && calc.getPurchaseBillBalance) {
      return calc.getPurchaseBillBalance(billId);
    }
    return 0;
  },

  // Re-calculate the stored balance_due on a purchase bill
  recalculatePurchaseBillBalance(billId) {
    const purchases = getRawCollection('purchases');
    const billIdx = purchases.findIndex(b => b.id === billId && !b.is_deleted);
    if (billIdx === -1) return;

    const bill = purchases[billIdx];
    const grandTotal = parseFloat(bill.grand_total || 0);
    const initialPaid = parseFloat(bill.cash_paid || 0)
                      + parseFloat(bill.upi_paid || 0)
                      + parseFloat(bill.bank_paid || 0);
    
    // Sum of active subsequent payments
    const payouts = getRawCollection('payment_outs');
    const totalSubsequent = payouts
      .filter(p => p.bill_id === billId && !p.is_deleted)
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Sum of active purchase returns
    const returns = getRawCollection('purchase_returns');
    const totalReturns = returns
      .filter(r => r.purchase_id === billId && !r.is_deleted)
      .reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);

    const newBalance = Math.max(0, grandTotal - initialPaid - totalSubsequent - totalReturns);
    
    bill.balance_due = parseFloat(newBalance.toFixed(2));
    bill.updated_at = new Date().toISOString();
    purchases[billIdx] = bill;
    saveRawCollection('purchases', purchases);
    db.triggerAutoSync('purchases', bill);
    db.logAudit('Purchase Balance Updated', `Recalculated balance_due for Purchase Bill ID ${billId.substring(0,8)}.`);
  },

  // Recalculate invoice balance_due (mirrors recalculatePurchaseBillBalance)
  // Called when sales_returns or payment_ins are inserted/deleted
  recalculateInvoiceBalanceDue(invoiceId) {
    const invoices = getRawCollection('invoices');
    const invIdx = invoices.findIndex(inv => inv.id === invoiceId && !inv.is_deleted);
    if (invIdx === -1) return;

    const inv = invoices[invIdx];
    const netTotal = parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0);

    // Sum all active payments (initial + subsequent)
    const payments = getRawCollection('payment_ins');
    const totalPaid = payments
      .filter(p => p.invoice_id === invoiceId && !p.is_deleted)
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    // Sum all active sales returns for this invoice
    const returns = getRawCollection('sales_returns');
    const totalReturns = returns
      .filter(r => r.invoice_id === invoiceId && !r.is_deleted)
      .reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);

    const newBalance = Math.max(0, netTotal - totalPaid - totalReturns);
    inv.balance_due = parseFloat(newBalance.toFixed(2));
    inv.updated_at = new Date().toISOString();
    invoices[invIdx] = inv;
    saveRawCollection('invoices', invoices);
    db.triggerAutoSync('invoices', inv);
    db.logAudit('Invoice Balance Updated', `Recalculated balance_due for Invoice ID ${invoiceId.substring(0,8)} (includes sales returns).`);
  }
};

// Fix #5: Stock calculation cache to prevent O(n²) full-table scans.
// Without this, loading 200 products on the billing page would trigger 200 × 5 full loops.
// The cache is cleared automatically whenever invoices, purchases, returns, or adjustments change.
let _stockCache = {};

// 4. Live Calculations Manager
export const calc = {
  // Invalidate cache for one product or all products
  invalidateStockCache(productId = null) {
    if (productId) {
      delete _stockCache[productId];
    } else {
      _stockCache = {}; // Clear entire cache
    }
  },

  // Live stock calculation (Section 33 Spec) — now cached
  getCurrentStock(productId) {
    // Return cached value if available (avoids full scan every call)
    if (_stockCache[productId] !== undefined) {
      return _stockCache[productId];
    }

    const product = db.find('products', productId);
    if (!product) return 0;

    let stock = parseFloat(product.opening_stock || 0);

    // Add purchased quantities
    db.get('purchases').forEach(bill => {
      bill.items?.forEach(it => {
        if (it.product_id === productId) {
          stock += parseFloat(it.qty || 0);
        }
      });
    });

    // Subtract sold quantities
    db.get('invoices').forEach(inv => {
      inv.items?.forEach(it => {
        if (it.product_id === productId) {
          stock -= parseFloat(it.qty || 0);
        }
      });
    });

    // Add sales returns
    db.get('sales_returns').forEach(ret => {
      ret.items?.forEach(it => {
        if (it.product_id === productId) {
          stock += parseFloat(it.qty || 0);
        }
      });
    });

    // Subtract purchase returns
    db.get('purchase_returns').forEach(ret => {
      ret.items?.forEach(it => {
        if (it.product_id === productId) {
          stock -= parseFloat(it.qty || 0);
        }
      });
    });

    // Add net stock adjustments
    db.get('stock_adjustments').forEach(adj => {
      if (adj.product_id === productId) {
        stock += parseFloat(adj.qty_change || 0);
      }
    });

    const result = stock < 0 ? 0 : stock; // Display minimum is 0, warning flagged separately
    _stockCache[productId] = result; // Cache for future calls
    return result;
  },

  // Customer outstanding balance calculation (Section 4 Spec)
  getCustomerBalance(customerId) {
    const customer = db.find('customers', customerId);
    if (!customer) return 0;

    let totalDue = parseFloat(customer.opening_balance || 0);

    // Sum of invoices grand totals (after final discount)
    db.get('invoices').forEach(inv => {
      if (inv.customer_id === customerId) {
        const grandTotal = parseFloat(inv.grand_total || 0);
        const finalDiscount = parseFloat(inv.final_discount || 0);
        totalDue += (grandTotal - finalDiscount);
      }
    });

    // Deduct sales returns
    db.get('sales_returns').forEach(ret => {
      if (ret.customer_id === customerId) {
        totalDue -= parseFloat(ret.grand_total || 0);
      }
    });

    // Sum payments from the payment_ins table (includes standalone and invoice payments)
    let totalPaid = 0;
    db.get('payment_ins').forEach(pay => {
      if (pay.customer_id === customerId) {
        totalPaid += parseFloat(pay.amount || 0);
      }
    });

    // Fix #3: Return actual balance including negative values (credit balances)
    // Previously, credit balances were hidden as ₹0 — now negative = customer has credit
    const bal = totalDue - totalPaid;
    return parseFloat(bal.toFixed(2));
  },

  // Supplier outstanding balance (Section 5 Spec)
  getSupplierBalance(supplierId) {
    const supplier = db.find('suppliers', supplierId);
    if (!supplier) return 0;

    let totalOwed = parseFloat(supplier.opening_balance || 0);

    // Add purchases
    db.get('purchases').forEach(bill => {
      if (bill.supplier_id === supplierId) {
        totalOwed += parseFloat(bill.grand_total || 0);
      }
    });

    // Deduct purchase returns
    db.get('purchase_returns').forEach(ret => {
      if (ret.supplier_id === supplierId) {
        totalOwed -= parseFloat(ret.grand_total || 0);
      }
    });

    // Sum payments made
    let totalPaid = 0;
    db.get('purchases').forEach(bill => {
      if (bill.supplier_id === supplierId) {
        totalPaid += parseFloat(bill.cash_paid || 0) + parseFloat(bill.upi_paid || 0) + parseFloat(bill.bank_paid || 0);
      }
    });

    db.get('payment_outs').forEach(pay => {
      if (pay.supplier_id === supplierId) {
        totalPaid += parseFloat(pay.amount || 0);
      }
    });

    // Fix #4: Return actual balance including negative values (supplier credit/overpaid)
    // Previously, supplier credit balances were silently hidden as ₹0
    const bal = totalOwed - totalPaid;
    return parseFloat(bal.toFixed(2));
  },

  // Live balance due for a single purchase bill (used in Purchase Ledger)
  getPurchaseBillBalance(billId) {
    const bill = db.find('purchases', billId);
    if (!bill) return 0;

    // Start from grand total minus amounts paid when the bill was first saved
    const grandTotal = parseFloat(bill.grand_total || 0);
    const initialPaid = parseFloat(bill.cash_paid || 0)
                      + parseFloat(bill.upi_paid || 0)
                      + parseFloat(bill.bank_paid || 0);
    let balance = grandTotal - initialPaid;

    // Deduct subsequent payment_outs that are linked to this bill
    db.get('payment_outs').forEach(pay => {
      if (pay.bill_id === billId) {
        balance -= parseFloat(pay.amount || 0);
      }
    });

    // Deduct purchase returns that are linked to this bill
    db.get('purchase_returns').forEach(ret => {
      if (ret.purchase_id === billId) {
        balance -= parseFloat(ret.grand_total || 0);
      }
    });

    return parseFloat(Math.max(0, balance).toFixed(2));
  },

  // Live account balances (Section 20 Spec formulas)
  getAccountBalances() {
    let cash = 0;
    let upi = 0;
    let bank = 0;

    // 1. Add all cash/upi/bank receipts from the payment_ins table
    db.get('payment_ins').forEach(pay => {
      const amt = parseFloat(pay.amount || 0);
      const method = (pay.method || '').trim().toLowerCase();
      if (method === 'cash') cash += amt;
      else if (method === 'upi') upi += amt;
      else if (method === 'bank') bank += amt;
    });

    // 1.5. Add active sale order advance payments
    // BUG 36 FIX: Only count sale order advances that have NOT yet generated a payment_ins record.
    // When a sale order is converted to an invoice, db.createInvoicePayments() creates
    // payment_ins entries. If those amounts are already in payment_ins above, counting
    // them here again would double the balance. We only count UNCONVERTED orders.
    // Note: If sale orders are converted and their payment_ins are created, this section
    // is intentionally skipped (Converted orders have payment_ins already counted above).
    db.get('sale_orders').forEach(so => {
      if (so.status !== 'Converted') {
        // Only count advances not yet linked to a payment_ins entry
        const hasLinkedPayment = db.get('payment_ins').some(p => p.invoice_id === so.id);
        if (!hasLinkedPayment) {
          cash += parseFloat(so.cash_paid || 0);
          upi  += parseFloat(so.upi_paid  || 0);
          bank += parseFloat(so.bank_paid || 0);
        }
      }
    });

    // 3. Deduct expenses
    db.get('expenses').forEach(exp => {
      const amt = parseFloat(exp.amount || 0);
      const method = (exp.method || '').trim().toLowerCase();
      if (method === 'cash') cash -= amt;
      else if (method === 'upi') upi -= amt;
      else if (method === 'bank') bank -= amt;
    });

    // 4. Deduct purchase bill supplier payments
    db.get('purchases').forEach(bill => {
      cash -= parseFloat(bill.cash_paid || 0);
      upi -= parseFloat(bill.upi_paid || 0);
      bank -= parseFloat(bill.bank_paid || 0);
    });

    // 5. Deduct Payments-Out
    db.get('payment_outs').forEach(pay => {
      const amt = parseFloat(pay.amount || 0);
      const method = (pay.method || '').trim().toLowerCase();
      if (method === 'cash') cash -= amt;
      else if (method === 'upi') upi -= amt;
      else if (method === 'bank') bank -= amt;
    });

    // 6. Apply Fund Transfers — BUG 38 FIX: Previously always credited Bank regardless of to_account
    db.get('fund_transfers').forEach(tf => {
      const amt     = parseFloat(tf.amount || 0);
      const fromAcc = (tf.from_account || '').trim().toLowerCase();
      const toAcc   = (tf.to_account   || '').trim().toLowerCase();

      // Debit the source account
      if      (fromAcc === 'cash') cash -= amt;
      else if (fromAcc === 'upi')  upi  -= amt;
      else if (fromAcc === 'bank') bank -= amt;

      // Credit the CORRECT destination account (was always crediting Bank before — bug!)
      if      (toAcc === 'cash') cash += amt;
      else if (toAcc === 'upi')  upi  += amt;
      else if (toAcc === 'bank') bank += amt;
    });

    return { cash, upi, bank };
  }
};

// 5. Supabase Dynamic Client Setup & Synchronization Manager
let supabaseClient = null;
let syncDebounceTimer = null;
let lastUsedUrl = null;
let lastUsedKey = null;

export function getSupabase() {
  const settings = db.get('business_settings');
  const url = settings?.supabase_url || import.meta.env.VITE_SUPABASE_URL || '';
  const key = settings?.supabase_key || import.meta.env.VITE_SUPABASE_KEY || '';

  if (!url || !key) {
    supabaseClient = null;
    lastUsedUrl = null;
    lastUsedKey = null;
    return null;
  }

  // Rebuild only if credentials changed or not yet initialized
  if (supabaseClient && url === lastUsedUrl && key === lastUsedKey) {
    return supabaseClient;
  }

  if (window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      lastUsedUrl = url;
      lastUsedKey = key;
      return supabaseClient;
    } catch (err) {
      console.error("Failed to initialize Supabase client", err);
      supabaseClient = null;
      lastUsedUrl = null;
      lastUsedKey = null;
    }
  }
  return null;
}

// Global hook triggered on CRUD saves to debounced auto-sync (Section 30 Spec)
db.triggerAutoSync = function(entity, record) {
  if (entity === 'audit_logs') return; // Do not recursively sync audit logs inside auto-sync
  
  const client = getSupabase();
  if (!client || db.getCurrentUserId() === 'guest-user-offline') return;

  // Add changes to an offline sync queue (stored in LocalStorage)
  const queue = JSON.parse(localStorage.getItem('gb_sync_queue') || '[]');
  
  // Clean duplicates in queue
  const idx = queue.findIndex(q => q.id === record.id && q.entity === entity);
  if (idx !== -1) queue.splice(idx, 1);
  
  queue.push({
    entity,
    id: record.id,
    record,
    timestamp: new Date().getTime()
  });
  localStorage.setItem('gb_sync_queue', JSON.stringify(queue));

  // Debounce sync by 3 seconds
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  
  // Dispatch visual status syncing event
  window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'syncing' }));

  syncDebounceTimer = setTimeout(async () => {
    await db.processSyncQueue();
  }, 3000);
};

// Smart Sync processor (Writes using the JSONB schema mapping)
db.processSyncQueue = async function() {
  const client = getSupabase();
  if (!client) {
    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'local' }));
    return;
  }

  // Validate active auth session in client
  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session && db.getCurrentUserId() !== 'guest-user-offline') {
      window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'local' }));
      return;
    }
  } catch (e) {
    console.warn("Failed to verify sync session:", e);
    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'local' }));
    return;
  }

  const queue = JSON.parse(localStorage.getItem('gb_sync_queue') || '[]');
  if (queue.length === 0) {
    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'connected' }));
    return;
  }

  const failedItems = [];
  const MAX_RETRIES = 10;

  for (const item of queue) {
    try {
      // Upload individual record to matching Supabase table under data JSONB column
      const { error } = await client
        .from(item.entity)
        .upsert({
          id: item.id,
          user_id: db.getCurrentUserId(),
          updated_at: item.record.updated_at,
          is_deleted: item.record.is_deleted || false,
          data: item.record
        });

      if (error) throw error;
    } catch (err) {
      console.error(`Failed to sync ${item.entity} ID ${item.id}`, err);
      item.retryCount = (item.retryCount || 0) + 1;
      if (item.retryCount < MAX_RETRIES) {
        failedItems.push(item);
      } else {
        // Drop permanently failed items and log
        console.warn(`Dropping sync item ${item.entity} ID ${item.id} after ${MAX_RETRIES} retries.`);
        db.logAudit('Sync Item Dropped', `${item.entity} ID ${item.id.substring(0,8)} failed ${MAX_RETRIES} times and was removed from sync queue.`);
      }
    }
  }

  // Preserve items that failed due to network issues (with retry limit)
  localStorage.setItem('gb_sync_queue', JSON.stringify(failedItems));
  
  if (failedItems.length > 0) {
    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'local' }));
  } else {
    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'connected' }));
    db.logAudit("Cloud Sync Successful", "Synchronized offline queue changes to Supabase.");
  }
};

// Smart Full Synchronization (Downloads and parses cloud JSONB data)
db.syncCloudFull = async function() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured. Go to settings to set up connection.");
  
  // Verify session active
  const { data: { session } } = await client.auth.getSession();
  if (!session && db.getCurrentUserId() !== 'guest-user-offline') {
    throw new Error("Active cloud login session not found. Please log in first.");
  }

  window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'syncing' }));
  db.logAudit("Full Sync Started", "Beginning smart sync download and merge with Supabase.");

  try {
    for (const entity of ENTITIES) {
      if (entity === 'audit_logs') continue; // Audit logs can be kept local-only

      // 1. Download ALL records from cloud (paginated to handle >1000 records)
      let rawCloudRecords = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: page, error } = await client
          .from(entity)
          .select('*')
          .eq('user_id', db.getCurrentUserId())
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (page && page.length > 0) {
          rawCloudRecords = rawCloudRecords.concat(page);
          from += PAGE_SIZE;
          hasMore = page.length === PAGE_SIZE; // If we got a full page, there might be more
        } else {
          hasMore = false;
        }
      }

      // Map rows from JSONB columns back to standard records
      const cloudRecords = rawCloudRecords.map(cloud => ({
        ...cloud.data,
        id: cloud.id,
        user_id: cloud.user_id,
        updated_at: cloud.updated_at,
        is_deleted: cloud.is_deleted
      }));

      const localRecords = getRawCollection(entity);
      const mergedList = [...localRecords];

      // 2. Smart Sync Merging (7-case logic from Section 30 Spec)
      for (const cloud of cloudRecords) {
        const localIdx = mergedList.findIndex(l => l.id === cloud.id);

        if (localIdx === -1) {
          // Case 1: Only on cloud -> download
          mergedList.push(cloud);
        } else {
          const local = mergedList[localIdx];
          
          // Special check for business_settings: if local is default/placeholder, always download from cloud
          if (entity === 'business_settings' && (!local.updated_at || local.company_name === 'My Business')) {
            mergedList[localIdx] = cloud;
            continue;
          }

          const localTime = new Date(local.updated_at).getTime();
          const cloudTime = new Date(cloud.updated_at).getTime();

          if (cloud.is_deleted && !local.is_deleted) {
            // Case 6: Deleted on cloud -> delete locally
            local.is_deleted = true;
            local.updated_at = cloud.updated_at;
          } else if (local.is_deleted && !cloud.is_deleted) {
            // Case 7: Deleted locally -> sync deletion to cloud
            await client.from(entity).upsert({
              id: local.id,
              user_id: db.getCurrentUserId(),
              updated_at: local.updated_at,
              is_deleted: local.is_deleted || false,
              data: local
            });
          } else if (cloudTime > localTime) {
            // Case 3: Cloud is newer -> update local
            mergedList[localIdx] = cloud;
          } else if (localTime > cloudTime) {
            // Case 4: Local is newer -> upload to cloud
            await client.from(entity).upsert({
              id: local.id,
              user_id: db.getCurrentUserId(),
              updated_at: local.updated_at,
              is_deleted: local.is_deleted || false,
              data: local
            });
          }
          // Case 5: Same updated_at -> no action
        }
      }

      // Check upload for items existing ONLY on local
      for (const local of localRecords) {
        const cloudExists = cloudRecords.some(c => c.id === local.id);
        if (!cloudExists) {
          // Case 2: Only on local -> upload
          await client.from(entity).upsert({
            id: local.id,
            user_id: db.getCurrentUserId(),
            updated_at: local.updated_at,
            is_deleted: local.is_deleted || false,
            data: local
          });
        }
      }

      // Save the merged data back
      saveRawCollection(entity, mergedList);
    }

    // 3. Invoice Number Uniqueness Conflict Resolution (Section 37 Spec)
    const allInvoices = getRawCollection('invoices').filter(i => !i.is_deleted);
    const invoiceNumGroups = {};
    
    allInvoices.forEach(inv => {
      if (!invoiceNumGroups[inv.invoice_number]) {
        invoiceNumGroups[inv.invoice_number] = [];
      }
      invoiceNumGroups[inv.invoice_number].push(inv);
    });

    for (const [num, group] of Object.entries(invoiceNumGroups)) {
      if (group.length > 1) {
        // Conflict detected! Sort by created_at ascending (older keeps original, newer gets -DUP)
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        for (let i = 1; i < group.length; i++) {
          const conflictInv = group[i];
          const oldNum = conflictInv.invoice_number;
          const newNum = `${oldNum}-DUP`;
          
          conflictInv.invoice_number = newNum;
          conflictInv.updated_at = new Date().toISOString();
          
          // Save updated list
          const list = getRawCollection('invoices');
          const idx = list.findIndex(item => item.id === conflictInv.id);
          if (idx !== -1) {
            list[idx] = conflictInv;
            saveRawCollection('invoices', list);
          }
          
          // Re-upload resolved invoice
          await client.from('invoices').upsert({
            id: conflictInv.id,
            user_id: db.getCurrentUserId(),
            updated_at: conflictInv.updated_at,
            is_deleted: conflictInv.is_deleted || false,
            data: conflictInv
          });
          
          db.logAudit("Duplicate Invoice Resolved", `Invoice #${oldNum} duplicate detected. Reassigned newer invoice to #${newNum}`);
        }
      }
    }

    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'connected' }));
    db.logAudit("Full Sync Completed", "Smart sync successfully completed and merged.");
    // Invalidate stock cache after sync — remote data may have changed stock levels
    _stockCache = {};
    return true;
  } catch (err) {
    console.error("Full Sync error", err);
    window.dispatchEvent(new CustomEvent('gb-sync-status', { detail: 'local' }));
    db.logAudit("Full Sync Failed", `Sync encountered error: ${err.message}`);
    throw err;
  }
};

// Background Auto-Sync Worker Loop (Push queue & Pull updates every 4 seconds)
let lastBackgroundPullTime = 0;

// Fix #12: Slowed background sync from 4s to 30s to reduce unnecessary Supabase API calls.
// Manual saves still sync immediately via the debounce queue (no real-world delay).
// Full pull from other devices now happens every 3 minutes instead of every 12 seconds.
setInterval(async () => {
  try {
    const client = getSupabase();
    if (!client || db.getCurrentUserId() === 'guest-user-offline') return;

    // 1. Process outgoing changes in the queue
    await db.processSyncQueue();

    // 2. Periodically pull incoming changes from other devices (every 3 minutes)
    const now = new Date().getTime();
    if (now - lastBackgroundPullTime > 180000) {
      lastBackgroundPullTime = now;
      await db.syncCloudFull();
      window.dispatchEvent(new CustomEvent('gb-db-change'));
    }
  } catch (err) {
    console.warn("Background cloud sync checker skipped or offline:", err);
  }
}, 30000);

// Database Initializer
(function initDatabase() {
  // 1. Ensure empty arrays exist for all entities
  ENTITIES.forEach(entity => {
    if (!localStorage.getItem(`gb_${entity}`)) {
      localStorage.setItem(`gb_${entity}`, '[]');
    }
  });

  // Fix #13: REMOVED — The old mock-data wipe was DANGEROUS. It checked if any product
  // name contained "Rice" and would wipe ALL data. Any real store selling rice products
  // would lose everything on next app load. This code has been permanently removed.

  // 3. Prepopulate business settings with defaults
  let settingsList = JSON.parse(localStorage.getItem('gb_business_settings') || '[]');
  
  // Migrate legacy invalid UUID if present
  let migrated = false;
  settingsList = settingsList.map(s => {
    if (s.id === 'default-settings-uuid') {
      s.id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      migrated = true;
    }
    return s;
  });
  if (migrated) {
    localStorage.setItem('gb_business_settings', JSON.stringify(settingsList));
  }

  if (settingsList.length === 0) {
    settingsList.push(db.getDefaultSettings());
    localStorage.setItem('gb_business_settings', JSON.stringify(settingsList));
  }

  // 4. Auto-reconcile invoice payments into the payments ledger
  reconcileInvoicePayments();

  db.logAudit("Database Initialized", "Gonabhavi clean database initialized. Ready for furnishing transactions.");
})();

function reconcileInvoicePayments() {
  const invoices = getRawCollection('invoices');
  const payments = getRawCollection('payment_ins');
  let changesMade = false;

  invoices.forEach(inv => {
    if (inv.is_deleted) return;
    
    // Check if there are already payments linked to this invoice
    const linkedPayments = payments.filter(p => p.invoice_id === inv.id && !p.is_deleted);
    
    if (linkedPayments.length === 0) {
      const cashAmt = parseFloat(inv.cash_paid || 0);
      const upiAmt = parseFloat(inv.upi_paid || 0);
      const bankAmt = parseFloat(inv.bank_paid || 0);
      const timestamp = inv.created_at || new Date().toISOString();
      
      if (cashAmt > 0) {
        payments.push({
          id: generateUUID(),
          user_id: inv.user_id || 'guest-user-offline',
          created_at: timestamp,
          updated_at: timestamp,
          is_deleted: false,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          customer_id: inv.customer_id || null,
          date: inv.date,
          amount: cashAmt,
          method: 'Cash',
          is_initial: true,
          note: `Auto-reconciled initial Cash payment for Invoice #${inv.invoice_number}`
        });
        changesMade = true;
      }
      if (upiAmt > 0) {
        payments.push({
          id: generateUUID(),
          user_id: inv.user_id || 'guest-user-offline',
          created_at: timestamp,
          updated_at: timestamp,
          is_deleted: false,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          customer_id: inv.customer_id || null,
          date: inv.date,
          amount: upiAmt,
          method: 'UPI',
          is_initial: true,
          note: `Auto-reconciled initial UPI payment for Invoice #${inv.invoice_number}`
        });
        changesMade = true;
      }
      if (bankAmt > 0) {
        payments.push({
          id: generateUUID(),
          user_id: inv.user_id || 'guest-user-offline',
          created_at: timestamp,
          updated_at: timestamp,
          is_deleted: false,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          customer_id: inv.customer_id || null,
          date: inv.date,
          amount: bankAmt,
          method: 'Bank',
          is_initial: true,
          note: `Auto-reconciled initial Bank payment for Invoice #${inv.invoice_number}`
        });
        changesMade = true;
      }
    }
  });

  if (changesMade) {
    localStorage.setItem('gb_payment_ins', JSON.stringify(payments));
    db.logAudit("Database Reconciled", "Automatically generated payment ledger records for historical invoices.");
  }
}

// Global Helper to format date strings/objects to dd.mm.yy
export function formatDateToDDMMYY(dateInput) {
  if (!dateInput) return '';
  let dateObj;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const parts = trimmed.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0].substring(2)}`;
      }
      // Handle date string with time e.g., YYYY-MM-DDTHH:mm...
      if (/^\d{4}-\d{2}-\d{2}T.*/.test(trimmed)) {
        const datePart = trimmed.split('T')[0];
        const parts = datePart.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0].substring(2)}`;
      }
    }
    dateObj = new Date(dateInput);
  }
  if (isNaN(dateObj.getTime())) return String(dateInput);
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yy = String(dateObj.getFullYear()).substring(2);
  return `${dd}.${mm}.${yy}`;
}

// Global Helper to get YYYY-MM-DD in local timezone
export function getLocalYYYYMMDD(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Global Helper to format ISO timestamp or numeric timestamp into HH:MM AM/PM
export function formatTimeFromTimestamp(timestampStr) {
  if (!timestampStr) return '';
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '';
  }
}

db.createInvoicePayments = function(inv) {
  const payments = getRawCollection('payment_ins');
  const timestamp = inv.created_at || new Date().toISOString();
  let changesMade = false;
  
  const cashAmt = parseFloat(inv.cash_paid || 0);
  const upiAmt = parseFloat(inv.upi_paid || 0);
  const bankAmt = parseFloat(inv.bank_paid || 0);
  
  if (cashAmt > 0) {
    payments.push({
      id: generateUUID(),
      user_id: inv.user_id || 'guest-user-offline',
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || null,
      date: inv.date,
      amount: cashAmt,
      method: 'Cash',
      is_initial: true,
      note: `Initial Cash payment for Invoice #${inv.invoice_number}`
    });
    changesMade = true;
  }
  if (upiAmt > 0) {
    payments.push({
      id: generateUUID(),
      user_id: inv.user_id || 'guest-user-offline',
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || null,
      date: inv.date,
      amount: upiAmt,
      method: 'UPI',
      is_initial: true,
      note: `Initial UPI payment for Invoice #${inv.invoice_number}`
    });
    changesMade = true;
  }
  if (bankAmt > 0) {
    payments.push({
      id: generateUUID(),
      user_id: inv.user_id || 'guest-user-offline',
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || null,
      date: inv.date,
      amount: bankAmt,
      method: 'Bank',
      is_initial: true,
      note: `Initial Bank payment for Invoice #${inv.invoice_number}`
    });
    changesMade = true;
  }
  
  if (changesMade) {
    saveRawCollection('payment_ins', payments);
    // Sync the new records
    payments.forEach(p => {
      if (p.invoice_id === inv.id && !p.is_deleted && p.created_at === timestamp) {
        db.triggerAutoSync('payment_ins', p);
      }
    });
  }
};

db.overwriteInvoicePayments = function(invoiceId, inv) {
  const payments = getRawCollection('payment_ins');
  let changesMade = false;
  const timestamp = new Date().toISOString();
  
  // 1. Soft-delete ONLY the initial payments linked to this invoice
  payments.forEach(p => {
    if (p.invoice_id === invoiceId && p.is_initial && !p.is_deleted) {
      p.is_deleted = true;
      p.updated_at = timestamp;
      changesMade = true;
      db.triggerAutoSync('payment_ins', p);
    }
  });
  
  // 2. Re-create new initial payments from current invoice fields
  const cashAmt = parseFloat(inv.cash_paid || 0);
  const upiAmt = parseFloat(inv.upi_paid || 0);
  const bankAmt = parseFloat(inv.bank_paid || 0);
  
  if (cashAmt > 0) {
    payments.push({
      id: generateUUID(),
      user_id: inv.user_id || 'guest-user-offline',
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || null,
      date: inv.date,
      amount: cashAmt,
      method: 'Cash',
      is_initial: true,
      note: `Updated Cash payment for Invoice #${inv.invoice_number}`
    });
    changesMade = true;
  }
  if (upiAmt > 0) {
    payments.push({
      id: generateUUID(),
      user_id: inv.user_id || 'guest-user-offline',
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || null,
      date: inv.date,
      amount: upiAmt,
      method: 'UPI',
      is_initial: true,
      note: `Updated UPI payment for Invoice #${inv.invoice_number}`
    });
    changesMade = true;
  }
  if (bankAmt > 0) {
    payments.push({
      id: generateUUID(),
      user_id: inv.user_id || 'guest-user-offline',
      created_at: timestamp,
      updated_at: timestamp,
      is_deleted: false,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || null,
      date: inv.date,
      amount: bankAmt,
      method: 'Bank',
      is_initial: true,
      note: `Updated Bank payment for Invoice #${inv.invoice_number}`
    });
    changesMade = true;
  }
  
  if (changesMade) {
    saveRawCollection('payment_ins', payments);
    // Sync the new records
    payments.forEach(p => {
      if (p.invoice_id === invoiceId && !p.is_deleted && p.updated_at === timestamp) {
        db.triggerAutoSync('payment_ins', p);
      }
    });
  }
};


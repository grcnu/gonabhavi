/* ==========================================================================
   GONABHAVI — SUPPLIER PURCHASES MANAGEMENT (src/views/purchases.js)
   ========================================================================== */

import { db, calc, generateUUID, getLocalYYYYMMDD, formatDateToDDMMYY, formatTimeFromTimestamp } from '../db.js';
import { showSupplierAddModal } from './suppliers.js';
import { showProductAddModal } from './products.js';
import { updateHeaderBadges } from '../app.js';

let activeBill = {
  id: null,
  bill_number: '',
  date: '',
  supplier_id: '',
  supplier_name: '',
  items: [],
  cash_paid: 0,
  upi_paid: 0,
  bank_paid: 0
};

// Main Export: Purchase Bill Creation Form
export default async function renderPurchases(container, billToEdit = null) {
  if (billToEdit) {
    activeBill = JSON.parse(JSON.stringify(billToEdit));
  } else {
    resetActiveBill();
  }

  renderPurchaseLayout(container);
}

function resetActiveBill() {
  activeBill = {
    id: generateUUID(),
    bill_number: generateNextPurchaseNumber(),
    date: getLocalYYYYMMDD(),
    supplier_id: '',
    supplier_name: '',
    items: [],
    cash_paid: 0,
    upi_paid: 0,
    bank_paid: 0
  };
}

function generateNextPurchaseNumber() {
  const bills = db.getAllRaw('purchases');
  let maxSeq = 0;
  
  bills.forEach(b => {
    const match = b.bill_number?.match(/^PUR-(\d+)/);
    if (match) {
      const seqVal = parseInt(match[1]);
      if (seqVal > maxSeq) maxSeq = seqVal;
    }
  });

  const nextSeq = maxSeq + 1;
  const padded = String(nextSeq).padStart(4, '0');
  return `PUR-${padded}`;
}

function renderPurchaseLayout(container) {
  const suppliers = db.get('suppliers');
  const settings = db.get('business_settings');


  container.innerHTML = `
    <div class="billing-main-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start;">
      
      <!-- Left Column: Bill items & Form grid -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Header details Card -->
        <div class="view-card" style="padding: 16px;">
          <div class="form-grid" style="margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label">Purchase Bill Number</label>
              <input type="text" class="form-control" id="pur-number-input" value="${activeBill.bill_number}">
            </div>
            <div class="form-group">
              <label class="form-label">Bill Date</label>
              <input type="date" class="form-control" id="pur-date-input" value="${activeBill.date}">
            </div>
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                Supplier *
                <a href="javascript:void(0)" id="btn-quick-add-sup-pur" style="font-size: 0.75rem; text-decoration: none; color: hsl(var(--primary));">+ Register New</a>
              </label>
              <select class="form-control" id="pur-supplier-select">
                <option value="">-- Select Supplier --</option>
                ${suppliers.map(s => `
                  <option value="${s.id}" ${activeBill.supplier_id === s.id ? 'selected' : ''}>${s.name}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Add Purchase item Card -->
        <div class="view-card" style="padding: 16px;">
          <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
            
            <!-- Searchable Product Input (same as invoice) -->
            <div class="form-group" style="flex: 2; min-width: 200px; margin-bottom: 0; position: relative;">
              <label class="form-label">Search Product</label>
              <input type="text" class="form-control" id="pur-product-search"
                placeholder="Type product name to search..." autocomplete="off" maxlength="100">
              <div id="pur-product-suggestions" style="display:none; position:absolute; top:calc(100% + 2px); left:0; right:0; z-index:9999; background:hsl(var(--bg-primary)); border:1px solid hsl(var(--border-color)); border-radius:var(--radius-sm); max-height:220px; overflow-y:auto; box-shadow:0 6px 20px rgba(0,0,0,0.18);"></div>
            </div>

            <div class="form-group" style="width: 140px; margin-bottom: 0;">
              <label class="form-label">Purchase Rate (Excl. GST)</label>
              <input type="number" step="0.01" class="form-control" id="pur-rate-input" placeholder="₹ Rate" min="0">
            </div>

            <div class="form-group" style="width: 90px; margin-bottom: 0;">
              <label class="form-label">Quantity</label>
              <input type="number" class="form-control" id="pur-qty-input" value="1" min="1">
            </div>

            <div class="form-group" style="width: 100px; margin-bottom: 0;">
              <label class="form-label">GST Tax %</label>
              <select class="form-control" id="pur-gst-select">
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>

            <button class="btn btn-primary" id="btn-add-item-purchase" style="height: 38px; display: flex; align-items: center; gap: 6px;"><i data-lucide="plus"></i> Add Item</button>

          </div>

          <!-- Inline New Product Quick-Add Panel (hidden by default) -->
          <div id="pur-new-product-panel" style="display:none; margin-top:12px; padding:12px 14px; background:hsl(220 80% 40% / 0.06); border:1px solid hsl(220 80% 40% / 0.25); border-radius:var(--radius-sm);">
            <div style="font-size:0.82rem; font-weight:700; color:hsl(220,70%,38%); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="package-plus" style="width:14px;height:14px;"></i> New Product — Quick Add to Catalogue
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
              <div class="form-group" style="margin:0; flex:2; min-width:140px;">
                <label class="form-label" style="font-size:0.75rem;">Product Name *</label>
                <input type="text" class="form-control" id="pur-new-prod-name" maxlength="100" style="height:34px; font-size:0.85rem;">
              </div>
              <div class="form-group" style="margin:0; flex:1; min-width:100px;">
                <label class="form-label" style="font-size:0.75rem;">Purchase Rate ₹ *</label>
                <input type="number" step="0.01" min="0" class="form-control" id="pur-new-prod-rate" placeholder="0.00" style="height:34px; font-size:0.85rem;">
              </div>
              <div class="form-group" style="margin:0; flex:1; min-width:90px;">
                <label class="form-label" style="font-size:0.75rem;">Sale Price ₹ *</label>
                <input type="number" step="0.01" min="0" class="form-control" id="pur-new-prod-sale" placeholder="0.00" style="height:34px; font-size:0.85rem;">
              </div>
              <div class="form-group" style="margin:0; min-width:72px;">
                <label class="form-label" style="font-size:0.75rem;">GST %</label>
                <select class="form-control" id="pur-new-prod-gst" style="height:34px; font-size:0.85rem; padding:4px 6px;">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div class="form-group" style="margin:0; min-width:55px;">
                <label class="form-label" style="font-size:0.75rem;">Qty</label>
                <input type="number" min="1" value="1" class="form-control" id="pur-new-prod-qty" style="height:34px; font-size:0.85rem;">
              </div>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-primary" id="pur-btn-confirm-new-prod" style="height:34px; padding:0 12px; font-size:0.85rem; display:flex; align-items:center; gap:4px;"><i data-lucide="check" style="width:14px;height:14px;"></i> Add to Bill</button>
                <button class="btn btn-secondary" id="pur-btn-cancel-new-prod" style="height:34px; padding:0 10px; font-size:0.85rem;">Cancel</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Purchase Bill Items table grid -->
        <div class="view-card" style="margin-bottom: 0;">
          <h3 class="card-title" style="margin-bottom: 12px;"><i data-lucide="boxes"></i> Items Invoiced</h3>
          <div class="table-responsive" style="margin-top: 0; border: none;">
            <table class="app-table">
              <thead>
                <tr>
                  <th>Product Description</th>
                  <th style="width: 80px; text-align: center;">Qty</th>
                  <th style="width: 130px;">Rate (Before Tax)</th>
                  <th style="width: 90px; text-align: center;">GST %</th>
                  <th style="width: 130px;">GST Amount</th>
                  <th style="width: 130px;">Line Total</th>
                  <th style="width: 50px;"></th>
                </tr>
              </thead>
              <tbody id="purchase-items-body">
                <!-- Dynamic Populate -->
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Right Column: Bill Totals & Split Payments -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Unified Summary & Checkout Card -->
        <div class="view-card" style="padding: 16px; margin-bottom: 0;">
          <h3 class="card-title" style="margin-bottom: 12px;"><i data-lucide="receipt"></i> Purchase Summary</h3>
          
          <!-- Compact Totals List -->
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; margin-bottom: 12px; background: hsl(var(--bg-tertiary) / 0.4); padding: 10px; border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: hsl(var(--text-secondary));">Subtotal:</span>
              <span id="pur-subtotal-val" style="font-weight: 500;">₹0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: hsl(var(--text-secondary));">GST Tax:</span>
              <span id="pur-gst-val" style="font-weight: 500;">₹0.00</span>
            </div>
          </div>

          <!-- Grand Total Display -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: hsl(var(--danger-transparent)); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 12px;">
            <span style="font-weight: 700; font-size: 1.02rem; color: hsl(var(--danger));">Grand Total:</span>
            <span id="pur-grandtotal-val" style="font-weight: 800; font-size: 1.25rem; color: hsl(var(--danger));">₹0.00</span>
          </div>

          <!-- Record Payments Subtitle -->
          <h4 style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: hsl(var(--text-secondary)); display: flex; align-items: center; gap: 6px;">
            <i data-lucide="wallet" style="width: 14px; height: 14px;"></i> Payments Made (Split)
          </h4>

          <!-- Split Payment inputs (Side-by-Side Flex Rows) -->
          <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">${settings.account_cash_label || 'Cash'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control" id="pur-cash-input" value="${activeBill.cash_paid || 0}" style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">${settings.account_upi_label || 'UPI'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control" id="pur-upi-input" value="${activeBill.upi_paid || 0}" style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">${settings.account_bank_label || 'Bank'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control" id="pur-bank-input" value="${activeBill.bank_paid || 0}" style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid hsl(var(--border-color) / 0.5); margin: 8px 0;">

          <!-- Balance Due -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 700; font-size: 1rem;">
            <span>Balance Due:</span>
            <span id="pur-balancedue-val" class="text-danger">₹0.00</span>
          </div>

          <!-- Action buttons -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-danger" id="btn-save-purchase-bill" style="padding: 10px; font-weight: 600; justify-content: center; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;"><i data-lucide="save"></i> Save Purchase Bill</button>
            <button class="btn btn-secondary" id="btn-reset-purchase" style="padding: 8px; justify-content: center; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;"><i data-lucide="refresh-cw"></i> Reset Form</button>
          </div>

        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Attach interactive listeners
  document.getElementById('pur-number-input').addEventListener('input', (e) => activeBill.bill_number = e.target.value);
  document.getElementById('pur-date-input').addEventListener('input', (e) => activeBill.date = e.target.value);

  const supplierSelect = document.getElementById('pur-supplier-select');
  supplierSelect.addEventListener('change', (e) => {
    activeBill.supplier_id = e.target.value;
    const selectedText = supplierSelect.options[supplierSelect.selectedIndex]?.text;
    activeBill.supplier_name = e.target.value ? selectedText : '';
  });

  // Quick Supplier triggers
  document.getElementById('btn-quick-add-sup-pur').addEventListener('click', () => {
    showSupplierAddModal(null, (newSup) => {
      const list = db.get('suppliers');
      supplierSelect.innerHTML = `<option value="">-- Select Supplier --</option>` + list.map(s => `
        <option value="${s.id}" ${newSup.id === s.id ? 'selected' : ''}>${s.name}</option>
      `).join('');
      activeBill.supplier_id = newSup.id;
      activeBill.supplier_name = newSup.name;
    });
  });

  // ── Searchable Product Input — Live Suggestions ───────────────────────
  let _selectedProdId = null; // tracks product picked from dropdown
  const purSearchInput   = document.getElementById('pur-product-search');
  const purSuggestBox    = document.getElementById('pur-product-suggestions');

  purSearchInput.addEventListener('input', () => {
    _selectedProdId = null; // clear selection when user types again
    const query = purSearchInput.value.trim().toLowerCase();
    if (query.length < 1) { purSuggestBox.style.display = 'none'; return; }

    const allProds = db.get('products');
    const matches  = allProds.filter(p => p.name.toLowerCase().includes(query)).slice(0, 8);

    let html = '';
    matches.forEach(p => {
      const stock = calc.getCurrentStock(p.id);
      html += `<div class="pur-sug-item" data-id="${p.id}" data-rate="${p.purchase_price || 0}" data-gst="${p.gst_rate || 0}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid hsl(var(--border-color)/0.4); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:500; font-size:0.9rem;">${p.name}</span>
        <span style="font-size:0.78rem; color:hsl(var(--text-secondary)); white-space:nowrap; margin-left:8px;">Cost: ₹${p.purchase_price || 0} | Stk: ${stock}</span>
      </div>`;
    });

    // Show "Add as new" option when no exact name match
    const exactMatch = allProds.find(p => p.name.toLowerCase() === query);
    if (!exactMatch) {
      const displayName = purSearchInput.value.trim();
      html += `<div id="pur-sug-add-new" style="padding:8px 12px; cursor:pointer; color:hsl(220,75%,38%); font-weight:600; font-size:0.87rem; display:flex; align-items:center; gap:6px; border-top:1px solid hsl(var(--border-color)/0.4);">
        <span style="font-size:1.15rem; font-weight:800; color:hsl(220,75%,38%);">+</span> Add as new product: <em style="font-style:normal; color:hsl(var(--text-primary));">&quot;${displayName}&quot;</em>
      </div>`;
    }

    if (!html) {
      html = `<div style="padding:10px 12px; color:hsl(var(--text-muted)); font-size:0.85rem; text-align:center;">No products found.</div>`;
    }

    purSuggestBox.innerHTML = html;
    purSuggestBox.style.display = 'block';

    // Existing product — click selects it and fills rate/gst fields
    purSuggestBox.querySelectorAll('.pur-sug-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'hsl(var(--bg-secondary))');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _selectedProdId = item.getAttribute('data-id');
        const prodRate = parseFloat(item.getAttribute('data-rate') || 0);
        const prodGst  = parseInt(item.getAttribute('data-gst') || 0);
        purSearchInput.value = item.querySelector('span').textContent;
        document.getElementById('pur-rate-input').value = prodRate;
        document.getElementById('pur-gst-select').value = prodGst;
        purSuggestBox.style.display = 'none';
        document.getElementById('pur-rate-input').focus();
      });
    });

    // "Add as new product" — show inline quick-add panel
    const sugNew = document.getElementById('pur-sug-add-new');
    if (sugNew) {
      sugNew.addEventListener('mouseenter', () => sugNew.style.background = 'hsl(220 75% 38% / 0.08)');
      sugNew.addEventListener('mouseleave', () => sugNew.style.background = '');
      sugNew.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const typedName = purSearchInput.value.trim();
        purSuggestBox.style.display = 'none';
        const panel = document.getElementById('pur-new-product-panel');
        document.getElementById('pur-new-prod-name').value = typedName;
        document.getElementById('pur-new-prod-rate').value = '';
        document.getElementById('pur-new-prod-sale').value = '';
        document.getElementById('pur-new-prod-qty').value  = document.getElementById('pur-qty-input').value || '1';
        panel.style.display = 'block';
        if (window.lucide) window.lucide.createIcons();
        document.getElementById('pur-new-prod-rate').focus();
      });
    }
  });

  // Hide suggestions on blur
  purSearchInput.addEventListener('blur', () => {
    setTimeout(() => { purSuggestBox.style.display = 'none'; }, 200);
  });

  // New product panel — confirm: create product and add to bill
  document.getElementById('pur-btn-confirm-new-prod').addEventListener('click', () => {
    const nameVal = (document.getElementById('pur-new-prod-name').value || '').trim();
    const rateVal = parseFloat(document.getElementById('pur-new-prod-rate').value || 0);
    const saleVal = parseFloat(document.getElementById('pur-new-prod-sale').value || 0);
    const gstVal  = parseInt(document.getElementById('pur-new-prod-gst').value || 0);
    const qtyVal  = parseInt(document.getElementById('pur-new-prod-qty').value || 1);

    if (!nameVal)               { alert('Product name is required.');                  return; }
    if (isNaN(rateVal) || rateVal < 0) { alert('Purchase rate cannot be negative.');   return; }
    if (isNaN(qtyVal) || qtyVal < 1)   { alert('Quantity must be at least 1.');         return; }

    try {
      const newProd = db.insert('products', {
        name:             nameVal,
        sale_price:       saleVal || 0,
        purchase_price:   rateVal,
        gst_rate:         gstVal,
        default_discount: 0,
        qr:               '',
        hsn_code:         '',
        unit:             'Pcs',
        description:      ''
      });

      activeBill.items.push({
        product_id:   newProd.id,
        product_name: newProd.name,
        qty:          qtyVal,
        rate:         rateVal,
        gst_rate:     gstVal
      });

      document.getElementById('pur-new-product-panel').style.display = 'none';
      purSearchInput.value = '';
      _selectedProdId = null;
      purSearchInput.focus();
      refreshPurchaseGrid();
      alert(`"${nameVal}" saved to catalogue and added to purchase bill.`);
    } catch (err) {
      alert(`Failed to add product: ${err.message}`);
    }
  });

  // New product panel — cancel
  document.getElementById('pur-btn-cancel-new-prod').addEventListener('click', () => {
    document.getElementById('pur-new-product-panel').style.display = 'none';
    purSearchInput.value = '';
    _selectedProdId = null;
    purSearchInput.focus();
  });

  // Add Item to Bill (button click after selecting from typeahead)
  document.getElementById('btn-add-item-purchase').addEventListener('click', () => {
    const rate = parseFloat(document.getElementById('pur-rate-input').value);
    const qty  = parseInt(document.getElementById('pur-qty-input').value || 1);
    const gst  = parseInt(document.getElementById('pur-gst-select').value || 0);

    if (!_selectedProdId) {
      alert('Please search and select a product first.');
      purSearchInput.focus();
      return;
    }
    if (isNaN(rate) || rate < 0) {
      alert('Purchase rate cannot be negative.');
      return;
    }

    const p = db.find('products', _selectedProdId);
    if (!p) {
      alert('Selected product was not found. It may have been deleted. Please search again.');
      purSearchInput.value = '';
      _selectedProdId = null;
      return;
    }

    // Warn on zero-rate items
    if (rate === 0 || isNaN(rate)) {
      const proceed = window.confirm(`Purchase rate is ₹0.00 for "${p.name}". Is this intentional (free item)?`);
      if (!proceed) return;
    }

    // Check duplicate inside active bill
    const existing = activeBill.items.find(it => it.product_id === _selectedProdId);
    if (existing) {
      existing.qty += qty;
      existing.rate = isNaN(rate) ? 0 : rate;
      existing.gst_rate = gst;
    } else {
      activeBill.items.push({
        product_id:   _selectedProdId,
        product_name: p.name,
        qty:          qty,
        rate:         isNaN(rate) ? 0 : rate,
        gst_rate:     gst
      });
    }

    // Reset search for next item
    purSearchInput.value = '';
    _selectedProdId = null;
    document.getElementById('pur-rate-input').value = '';
    document.getElementById('pur-qty-input').value  = '1';
    document.getElementById('pur-gst-select').value = '0';
    purSuggestBox.style.display = 'none';
    purSearchInput.focus();

    refreshPurchaseGrid();
  });

  // Payments input
  document.getElementById('pur-cash-input').addEventListener('input', (e) => {
    // BUG 24 FIX: Clamp to 0 — negative payment values were allowed, corrupting supplier balances
    activeBill.cash_paid = Math.max(0, parseFloat(e.target.value || 0));
    if (parseFloat(e.target.value) < 0) e.target.value = 0;
    recalculatePurchaseTotals();
  });
  document.getElementById('pur-upi-input').addEventListener('input', (e) => {
    activeBill.upi_paid = Math.max(0, parseFloat(e.target.value || 0));
    if (parseFloat(e.target.value) < 0) e.target.value = 0;
    recalculatePurchaseTotals();
  });
  document.getElementById('pur-bank-input').addEventListener('input', (e) => {
    activeBill.bank_paid = Math.max(0, parseFloat(e.target.value || 0));
    if (parseFloat(e.target.value) < 0) e.target.value = 0;
    recalculatePurchaseTotals();
  });

  // Form Reset
  document.getElementById('btn-reset-purchase').addEventListener('click', () => {
    const confirm = window.confirm("Clear items and reset purchase form?");
    if (confirm) {
      resetActiveBill();
      renderPurchaseLayout(container);
    }
  });

  // Save Bill
  document.getElementById('btn-save-purchase-bill').addEventListener('click', () => savePurchaseBill());

  // Render list
  refreshPurchaseGrid();
}

function recalculatePurchaseTotals() {
  let subtotal = 0;
  let totalGst = 0;
  let grandTotal = 0;

  activeBill.items.forEach(it => {
    const gross = it.qty * it.rate;
    const gstAmt = gross * (it.gst_rate / 100);
    const lineTotal = gross + gstAmt;

    subtotal += gross;
    totalGst += gstAmt;
    grandTotal += lineTotal;
  });

  const paid = (activeBill.cash_paid || 0) + (activeBill.upi_paid || 0) + (activeBill.bank_paid || 0);
  const balDue = grandTotal - paid;

  document.getElementById('pur-subtotal-val').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('pur-gst-val').textContent = `₹${totalGst.toFixed(2)}`;
  document.getElementById('pur-grandtotal-val').textContent = `₹${grandTotal.toFixed(2)}`;
  
  const balDueElem = document.getElementById('pur-balancedue-val');
  balDueElem.textContent = `₹${balDue.toFixed(2)}`;
  
  if (balDue > 0.05) {
    balDueElem.className = 'text-danger';
  } else {
    balDueElem.className = 'text-success';
  }
}

function refreshPurchaseGrid() {
  const tbody = document.getElementById('purchase-items-body');

  if (activeBill.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No purchase items added yet.</td></tr>`;
    recalculatePurchaseTotals();
    return;
  }

  tbody.innerHTML = activeBill.items.map((it, idx) => {
    const gross = it.qty * it.rate;
    const gstAmt = gross * (it.gst_rate / 100);
    const total = gross + gstAmt;

    return `
      <tr data-index="${idx}">
        <td style="font-weight: 500;">${it.product_name}</td>
        <td>
          <input type="number" class="form-control item-qty-edit" value="${it.qty}" min="1" style="padding: 4px 8px; text-align: center;">
        </td>
        <td>
          <input type="number" step="0.01" class="form-control item-rate-edit" value="${it.rate}" min="0" style="padding: 4px 8px;">
        </td>
        <td>
          <select class="form-control item-gst-edit" style="padding: 4px; font-size: 0.85rem;">
            <option value="0" ${it.gst_rate === 0 ? 'selected' : ''}>0%</option>
            <option value="5" ${it.gst_rate === 5 ? 'selected' : ''}>5%</option>
            <option value="12" ${it.gst_rate === 12 ? 'selected' : ''}>12%</option>
            <option value="18" ${it.gst_rate === 18 ? 'selected' : ''}>18%</option>
            <option value="28" ${it.gst_rate === 28 ? 'selected' : ''}>28%</option>
          </select>
        </td>
        <td>₹${gstAmt.toFixed(2)}</td>
        <td style="font-weight: 600;">₹${total.toFixed(2)}</td>
        <td>
          <button class="btn-delete-item" style="color: hsl(var(--danger)); cursor: pointer;" title="Remove"><i data-lucide="trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  tbody.querySelectorAll('tr').forEach(row => {
    const idx = parseInt(row.getAttribute('data-index'));
    const item = activeBill.items[idx];

    row.querySelector('.item-qty-edit').addEventListener('change', (e) => {
      item.qty = parseInt(e.target.value || 1);
      refreshPurchaseGrid();
    });

    row.querySelector('.item-rate-edit').addEventListener('change', (e) => {
      item.rate = parseFloat(e.target.value || 0);
      refreshPurchaseGrid();
    });

    row.querySelector('.item-gst-edit').addEventListener('change', (e) => {
      item.gst_rate = parseInt(e.target.value);
      refreshPurchaseGrid();
    });

    row.querySelector('.btn-delete-item').addEventListener('click', () => {
      activeBill.items.splice(idx, 1);
      refreshPurchaseGrid();
    });
  });

  recalculatePurchaseTotals();
}

function savePurchaseBill() {
  if (!activeBill.bill_number) {
    alert("Bill number cannot be blank.");
    return;
  }
  if (!activeBill.supplier_id) {
    alert("Supplier must be selected.");
    return;
  }
  if (activeBill.items.length === 0) {
    alert("At least one purchase item is required to save.");
    return;
  }

  // Double check calculations
  let subtotal = 0;
  let totalGst = 0;
  let grandTotal = 0;

  activeBill.items.forEach(it => {
    const gross = it.qty * it.rate;
    const gstAmt = gross * (it.gst_rate / 100);
    subtotal += gross;
    totalGst += gstAmt;
    grandTotal += (gross + gstAmt);
  });

  const paid = (activeBill.cash_paid || 0) + (activeBill.upi_paid || 0) + (activeBill.bank_paid || 0);
  if (paid > grandTotal + 0.05) {
    alert("Total paid cannot exceed purchase bill grand total.");
    return;
  }

  const billRecord = {
    bill_number: activeBill.bill_number,
    date: activeBill.date,
    supplier_id: activeBill.supplier_id,
    supplier_name: activeBill.supplier_name,
    items: activeBill.items,
    grand_total: grandTotal,
    cash_paid: activeBill.cash_paid,
    upi_paid: activeBill.upi_paid,
    bank_paid: activeBill.bank_paid,
    balance_due: grandTotal - paid
  };

  try {
    // BUG 22 FIX: Previously matched soft-deleted records as edits, silently un-deleting them.
    // Now only match ACTIVE (non-deleted) records as editable.
    const isEdit = db.getAllRaw('purchases').some(b => b.id === activeBill.id && !b.is_deleted);
    
    if (isEdit) {
      db.update('purchases', activeBill.id, billRecord);
      alert("Purchase Bill updated successfully.");
    } else {
      billRecord.id = activeBill.id;
      db.insert('purchases', billRecord);
      alert("Purchase Bill saved successfully.");
    }

    // SECTION 3 RULE: Auto-update product's stored last-known purchase rate (before tax) from purchase bill
    activeBill.items.forEach(it => {
      try {
        db.update('products', it.product_id, { purchase_price: it.rate });
      } catch (err) {
        console.error("Failed to auto-update product purchase rate", err);
      }
    });

    // Reset Form
    resetActiveBill();
    updateHeaderBadges();
    
    // Redirect to inventory or reports to review
    window.location.hash = '#inventory';
  } catch (err) {
    alert(`Save failed: ${err.message}`);
  }
}

// Named Export: Purchase Bills Creation View
export async function PurchaseBillView(container) {
  renderPurchases(container);
}

// Tracking sort state for Purchase Ledger
let plSortField = 'date';
let plSortAsc = false;

/**
 * NAMED EXPORT: PURCHASE LEDGER VIEW
 * Full register of saved purchase bills with Pay / Edit / Delete actions.
 */
export async function PurchaseLedgerView(container) {
  container.innerHTML = `
    <!-- Filters bar -->
    <div class="view-card no-print" style="margin-bottom: 20px; padding: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
        <div style="display: flex; flex-wrap: wrap; gap: 12px; flex: 1;">
          <input type="text" class="form-control" id="pl-search-input" placeholder="Search Bill No or Supplier..." style="max-width: 280px;">
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="form-label" style="margin-bottom: 0; white-space: nowrap;">From:</span>
            <input type="date" class="form-control" id="pl-from-date">
            <span class="form-label" style="margin-bottom: 0; white-space: nowrap;">To:</span>
            <input type="date" class="form-control" id="pl-to-date">
          </div>
          <select class="form-control" id="pl-status-filter" style="max-width: 150px;">
            <option value="all">All Statuses</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <button class="btn btn-danger" onclick="window.location.hash = '#purchase-bill'">
          <i data-lucide="plus"></i> New Purchase Bill
        </button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div id="pl-stats-bar" class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 20px;"></div>

    <!-- Table -->
    <div class="view-card no-print" style="margin-bottom: 0;">
      <div class="table-responsive" style="margin-top: 0; border: none;">
        <table class="app-table">
          <thead>
            <tr>
              <th id="pl-sort-number" style="cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 6px;">Bill No <span id="pl-icon-number" style="display: inline-flex; align-items: center;"></span></div>
              </th>
              <th id="pl-sort-date" style="cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 6px;">Date <span id="pl-icon-date" style="display: inline-flex; align-items: center;"></span></div>
              </th>
              <th id="pl-sort-supplier" style="cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 6px;">Supplier <span id="pl-icon-supplier" style="display: inline-flex; align-items: center;"></span></div>
              </th>
              <th id="pl-sort-total" style="cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 6px;">Total / Balance <span id="pl-icon-total" style="display: inline-flex; align-items: center;"></span></div>
              </th>
              <th>Status</th>
              <th class="no-print" style="width: 130px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody id="pl-table-body"></tbody>
        </table>
      </div>
    </div>

    <!-- Payment Modal Container -->
    <div id="pl-modal-container"></div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Attach filter/sort listeners
  document.getElementById('pl-search-input').addEventListener('input', refreshPurchaseLedger);
  document.getElementById('pl-from-date').addEventListener('change', refreshPurchaseLedger);
  document.getElementById('pl-to-date').addEventListener('change', refreshPurchaseLedger);
  document.getElementById('pl-status-filter').addEventListener('change', refreshPurchaseLedger);

  document.getElementById('pl-sort-number').addEventListener('click', () => plHandleSort('bill_number'));
  document.getElementById('pl-sort-date').addEventListener('click', () => plHandleSort('date'));
  document.getElementById('pl-sort-supplier').addEventListener('click', () => plHandleSort('supplier_name'));
  document.getElementById('pl-sort-total').addEventListener('click', () => plHandleSort('grand_total'));

  refreshPurchaseLedger();

  function plHandleSort(field) {
    if (plSortField === field) plSortAsc = !plSortAsc;
    else { plSortField = field; plSortAsc = false; }
    refreshPurchaseLedger();
  }

  function refreshPurchaseLedger() {
    const query = document.getElementById('pl-search-input').value.toLowerCase();
    const fromDate = document.getElementById('pl-from-date').value;
    const toDate = document.getElementById('pl-to-date').value;
    const statusFilter = document.getElementById('pl-status-filter').value;
    const tbody = document.getElementById('pl-table-body');
    const statsBar = document.getElementById('pl-stats-bar');
    const settings = db.get('business_settings');

    const bills = db.get('purchases');

    // Attach live balance to each bill
    const enriched = bills.map(b => ({
      ...b,
      _liveDue: calc.getPurchaseBillBalance(b.id)
    }));

    // Filter
    const filtered = enriched.filter(b => {
      const suppName = b.supplier_name || '';
      const matchSearch = (b.bill_number || '').toLowerCase().includes(query) ||
                          suppName.toLowerCase().includes(query);
      if (!matchSearch) return false;
      if (fromDate && b.date < fromDate) return false;
      if (toDate && b.date > toDate) return false;

      const due = b._liveDue;
      const total = parseFloat(b.grand_total || 0);
      const initialPaid = parseFloat(b.cash_paid || 0) + parseFloat(b.upi_paid || 0) + parseFloat(b.bank_paid || 0);
      const totalPaid = total - due; // total - live balance = total paid

      if (statusFilter === 'paid') return due <= 0.05;
      if (statusFilter === 'partial') return due > 0.05 && totalPaid > 0.05;
      if (statusFilter === 'pending') return due >= total - 0.05 && due > 0.05;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let valA, valB;
      if (plSortField === 'bill_number') {
        return plSortAsc
          ? a.bill_number.localeCompare(b.bill_number, undefined, { numeric: true })
          : b.bill_number.localeCompare(a.bill_number, undefined, { numeric: true });
      } else if (plSortField === 'date') {
        valA = new Date(a.date).getTime() || 0;
        valB = new Date(b.date).getTime() || 0;
      } else if (plSortField === 'supplier_name') {
        valA = (a.supplier_name || '').toLowerCase();
        valB = (b.supplier_name || '').toLowerCase();
        return plSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (plSortField === 'grand_total') {
        valA = parseFloat(a.grand_total || 0);
        valB = parseFloat(b.grand_total || 0);
      } else {
        return 0;
      }
      if (valA < valB) return plSortAsc ? -1 : 1;
      if (valA > valB) return plSortAsc ? 1 : -1;
      return 0;
    });

    // Update sort icons
    const iconMap = { bill_number: 'pl-icon-number', date: 'pl-icon-date', supplier_name: 'pl-icon-supplier', grand_total: 'pl-icon-total' };
    Object.entries(iconMap).forEach(([field, iconId]) => {
      const el = document.getElementById(iconId);
      if (!el) return;
      if (field === plSortField) {
        el.innerHTML = plSortAsc
          ? '<i data-lucide="chevron-up" style="width:12px;height:12px;"></i>'
          : '<i data-lucide="chevron-down" style="width:12px;height:12px;"></i>';
      } else {
        el.innerHTML = '<i data-lucide="chevrons-up-down" style="width:12px;height:12px;opacity:0.4;"></i>';
      }
    });

    // Stats summary
    const totalBillCount = filtered.length;
    const totalGrand = filtered.reduce((s, b) => s + parseFloat(b.grand_total || 0), 0);
    const totalDue = filtered.reduce((s, b) => s + b._liveDue, 0);
    const totalPaidSum = totalGrand - totalDue;
    statsBar.innerHTML = `
      <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
        <div class="stat-info">
          <span class="stat-label" style="font-size: 0.75rem;">Total Bills</span>
          <span class="stat-value" style="font-size: 1.4rem; color: hsl(var(--text-primary));">${totalBillCount}</span>
        </div>
        <div class="stat-icon color-primary" style="width:38px;height:38px;"><i data-lucide="file-text" style="width:18px;height:18px;"></i></div>
      </div>
      <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
        <div class="stat-info">
          <span class="stat-label" style="font-size: 0.75rem;">Total Purchase Value</span>
          <span class="stat-value" style="font-size: 1.4rem; color: hsl(var(--text-primary));">₹${totalGrand.toFixed(2)}</span>
        </div>
        <div class="stat-icon color-warning" style="width:38px;height:38px;"><i data-lucide="indian-rupee" style="width:18px;height:18px;"></i></div>
      </div>
      <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
        <div class="stat-info">
          <span class="stat-label" style="font-size: 0.75rem;">Amount Paid</span>
          <span class="stat-value" style="font-size: 1.4rem; color: hsl(var(--success));">₹${totalPaidSum.toFixed(2)}</span>
        </div>
        <div class="stat-icon color-success" style="width:38px;height:38px;"><i data-lucide="check-circle" style="width:18px;height:18px;"></i></div>
      </div>
      <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
        <div class="stat-info">
          <span class="stat-label" style="font-size: 0.75rem;">Balance Outstanding</span>
          <span class="stat-value" style="font-size: 1.4rem; color: hsl(var(--danger));">₹${totalDue.toFixed(2)}</span>
        </div>
        <div class="stat-icon color-danger" style="width:38px;height:38px;"><i data-lucide="alert-circle" style="width:18px;height:18px;"></i></div>
      </div>
    `;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 40px 20px;">No purchase bills found. <a href="#purchase-bill" style="color: hsl(var(--primary));">Create one</a></td></tr>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map(bill => {
      const total = parseFloat(bill.grand_total || 0);
      const due = bill._liveDue;
      const totalPaid = total - due;

      let badgeClass = 'badge-success';
      let statusText = 'Paid';
      if (due > 0.05 && totalPaid > 0.05) {
        badgeClass = 'badge-warning';
        statusText = 'Partial';
      } else if (due >= total - 0.05 && due > 0.05) {
        badgeClass = 'badge-danger';
        statusText = 'Pending';
      }

      const canPay = due > 0.05;

      return `
        <tr data-id="${bill.id}">
          <td style="font-family: var(--font-mono); font-weight: 600;">${bill.bill_number}</td>
          <td>
            <div>${formatDateToDDMMYY(bill.date)}</div>
            ${bill.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(bill.created_at)}</div>` : ''}
          </td>
          <td style="font-weight: 500;">${bill.supplier_name || '—'}</td>
          <td style="font-weight: 600;">
            <div>₹${total.toFixed(2)}</div>
            ${due > 0.05
              ? `<div style="font-size: 0.72rem; color: hsl(var(--danger)); margin-top: 2px; font-weight: 500;">Due: ₹${due.toFixed(2)}</div>`
              : `<div style="font-size: 0.72rem; color: hsl(var(--success)); margin-top: 2px; font-weight: 500;">Fully Paid</div>`
            }
          </td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
          <td class="no-print" style="text-align: center;">
            <div style="display: inline-flex; gap: 6px; justify-content: center; align-items: center;">
              ${canPay
                ? `<button class="btn btn-secondary pl-btn-pay" title="Record Payment" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs);"><i data-lucide="hand-coins" style="width: 14px; height: 14px; color: hsl(var(--success));"></i></button>`
                : `<button class="btn btn-secondary" disabled title="Fully Paid" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs); opacity: 0.35;"><i data-lucide="hand-coins" style="width: 14px; height: 14px;"></i></button>`
              }
              <button class="btn btn-secondary pl-btn-edit" title="Edit Bill" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs);"><i data-lucide="pencil" style="width: 14px; height: 14px; color: hsl(var(--primary));"></i></button>
              <button class="btn btn-secondary text-danger pl-btn-delete" title="Delete Bill" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs);"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach row button handlers
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
      const billId = row.getAttribute('data-id');
      const bill = db.find('purchases', billId);
      if (!bill) return;

      const payBtn = row.querySelector('.pl-btn-pay');
      if (payBtn) {
        payBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showPurchasePayModal(billId, refreshPurchaseLedger);
        });
      }

      const editBtn = row.querySelector('.pl-btn-edit');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const parentContainer = document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild;
          renderPurchases(parentContainer, bill);
        });
      }

      const deleteBtn = row.querySelector('.pl-btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!confirm(`Delete Purchase Bill "${bill.bill_number}"? This will also remove linked payments and restore stock levels.`)) return;
          try {
            db.delete('purchases', billId);
            updateHeaderBadges();
            refreshPurchaseLedger();
          } catch (err) {
            alert(`Delete blocked: ${err.message}`);
          }
        });
      }
    });
  }
}

/**
 * Internal: Show "Record Payment" modal for a Purchase Bill
 */
function showPurchasePayModal(billId, onSuccess) {
  const modalContainer = document.getElementById('pl-modal-container');
  const bill = db.find('purchases', billId);
  if (!bill) return;

  const settings = db.get('business_settings');
  const total = parseFloat(bill.grand_total || 0);
  const due = calc.getPurchaseBillBalance(billId);

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="pl-pay-modal-backdrop">
      <div class="modal-card" style="max-width: 420px;">
        <div class="modal-header">
          <h3><i data-lucide="hand-coins"></i> Record Supplier Payment</h3>
          <button class="modal-close-btn" id="pl-pay-close-btn"><i data-lucide="x"></i></button>
        </div>
        <form id="pl-pay-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Bill / Supplier Reference</label>
            <input type="text" class="form-control" value="${bill.bill_number} — ${bill.supplier_name || 'Unknown Supplier'}" disabled>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Grand Total / Balance Due</label>
            <input type="text" class="form-control" value="Total: ₹${total.toFixed(2)} | Due: ₹${due.toFixed(2)}" disabled style="font-weight: 600; color: hsl(var(--danger));">
          </div>
          <div style="border: 1px solid hsl(var(--border-color)); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px; background: hsl(var(--bg-primary) / 0.3);">
            <h4 style="font-size: 0.85rem; margin-bottom: 10px; font-weight: 600;">Split Payment to Supplier:</h4>
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.8rem;">${settings.account_cash_label || 'Cash'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control pl-pay-split" name="cash" value="0.00" min="0">
            </div>
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.8rem;">${settings.account_upi_label || 'UPI'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control pl-pay-split" name="upi" value="0.00" min="0">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">${settings.account_bank_label || 'Bank'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control pl-pay-split" name="bank" value="0.00" min="0">
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span class="form-label">Total Entered:</span>
            <span id="pl-pay-total" style="font-weight: 700; font-size: 1.1rem; color: hsl(var(--text-muted));">₹0.00</span>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Remarks / Note</label>
            <input type="text" class="form-control" id="pl-pay-note" placeholder="Payment reference, remarks...">
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="pl-pay-cancel">Cancel</button>
            <button type="submit" class="btn btn-success" id="pl-pay-confirm" disabled><i data-lucide="check"></i> Record Payment</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('pl-pay-close-btn').addEventListener('click', closeModal);
  document.getElementById('pl-pay-cancel').addEventListener('click', closeModal);

  const inputs = modalContainer.querySelectorAll('.pl-pay-split');
  const totalLabel = document.getElementById('pl-pay-total');
  const confirmBtn = document.getElementById('pl-pay-confirm');

  const updateSum = () => {
    let sum = 0;
    inputs.forEach(inp => sum += parseFloat(inp.value || 0));
    totalLabel.textContent = `₹${sum.toFixed(2)}`;
    if (sum > 0.01 && sum <= due + 0.05) {
      confirmBtn.disabled = false;
      totalLabel.style.color = 'hsl(var(--success))';
    } else {
      confirmBtn.disabled = true;
      totalLabel.style.color = sum > due + 0.05 ? 'hsl(var(--danger))' : 'hsl(var(--text-muted))';
    }
  };
  updateSum();
  inputs.forEach(inp => {
    inp.addEventListener('input', updateSum);
    inp.addEventListener('change', () => {
      if (isNaN(parseFloat(inp.value)) || parseFloat(inp.value) < 0) inp.value = '0.00';
      updateSum();
    });
  });

  document.getElementById('pl-pay-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const cashAmt = parseFloat(formData.get('cash') || 0);
    const upiAmt = parseFloat(formData.get('upi') || 0);
    const bankAmt = parseFloat(formData.get('bank') || 0);
    const sum = cashAmt + upiAmt + bankAmt;
    const note = document.getElementById('pl-pay-note').value || `Payment for ${bill.bill_number}`;
    const localDate = getLocalYYYYMMDD();

    if (sum <= 0.01) { alert('Payment amount must be greater than ₹0.'); return; }
    if (sum > due + 0.05) { alert(`Cannot pay more than outstanding balance ₹${due.toFixed(2)}.`); return; }

    try {
      // Insert one payment_out per method used, all linked to this bill
      if (cashAmt > 0) {
        db.insert('payment_outs', {
          supplier_id: bill.supplier_id,
          bill_id: billId,
          date: localDate,
          amount: cashAmt,
          method: 'Cash',
          note: `${note} (Cash)`
        });
      }
      if (upiAmt > 0) {
        db.insert('payment_outs', {
          supplier_id: bill.supplier_id,
          bill_id: billId,
          date: localDate,
          amount: upiAmt,
          method: 'UPI',
          note: `${note} (UPI)`
        });
      }
      if (bankAmt > 0) {
        db.insert('payment_outs', {
          supplier_id: bill.supplier_id,
          bill_id: billId,
          date: localDate,
          amount: bankAmt,
          method: 'Bank',
          note: `${note} (Bank)`
        });
      }

      closeModal();
      window.dispatchEvent(new CustomEvent('gb-db-change'));
      if (onSuccess) onSuccess();
      alert(`Payment of ₹${sum.toFixed(2)} recorded for ${bill.bill_number}.`);
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    }
  });
}

/* ==========================================================================
   GONABHAVI — BILLING SCREEN & INVOICES REGISTER (src/views/billing.js)
   ========================================================================== */

import { db, calc, generateUUID, formatDateToDDMMYY, getLocalYYYYMMDD, formatTimeFromTimestamp } from '../db.js';
import { showCustomerAddModal } from './customers.js';
import { showProductAddModal } from './products.js';
import { updateHeaderBadges } from '../app.js';

// State of currently active billing form
let activeInvoice = {
  id: null,
  invoice_number: '',
  date: '',
  customer_id: '',
  customer_name: '',
  items: [],
  final_discount: 0,
  cash_paid: 0,
  upi_paid: 0,
  bank_paid: 0,
  converted_from_so_id: null
};

// Store a reference to the active billing view container
let billingContainer = null;

// Store sorting states
let invoiceSortField = 'date';
let invoiceSortAsc = false;

// Default Export: Sale Invoice Billing Screen
export default async function renderBilling(container, invoiceToEdit = null) {
  billingContainer = container;
  
  if (!invoiceToEdit && window.location.hash.includes('?')) {
    const queryStr = window.location.hash.split('?')[1];
    const params = new URLSearchParams(queryStr);
    const editId = params.get('edit') || params.get('id');
    if (editId) {
      const inv = db.find('invoices', editId);
      if (inv) {
        invoiceToEdit = inv;
      }
    }
  }

  if (invoiceToEdit) {
    activeInvoice = JSON.parse(JSON.stringify(invoiceToEdit)); // Deep copy
  } else {
    resetActiveInvoice();
  }

  renderBillingFormLayout(container);
}

function resetActiveInvoice() {
  const settings = db.get('business_settings');
  const convertDataRaw = localStorage.getItem('gb_convert_doc');
  let convertData = null;
  if (convertDataRaw) {
    try {
      convertData = JSON.parse(convertDataRaw);
      localStorage.removeItem('gb_convert_doc');
    } catch (e) {
      console.error("Failed to parse converted document", e);
    }
  }

  activeInvoice = {
    id: generateUUID(),
    invoice_number: generateNextInvoiceNumber(),
    date: getLocalYYYYMMDD(),
    customer_id: convertData ? (convertData.customer_id || '') : '',
    customer_name: convertData ? (convertData.customer_name || 'Walk-in Customer') : '',
    items: convertData ? (convertData.items || []) : [],
    final_discount: convertData ? (convertData.final_discount || 0) : 0,
    cash_paid: convertData ? (convertData.cash_paid || 0) : 0,
    upi_paid: convertData ? (convertData.upi_paid || 0) : 0,
    bank_paid: convertData ? (convertData.bank_paid || 0) : 0,
    converted_from_so_id: convertData ? (convertData.converted_from_so_id || null) : null
  };
}

function generateNextInvoiceNumber() {
  const settings = db.get('business_settings');
  const invoices = db.getAllRaw('invoices'); // Count all including deleted to get highest sequence
  
  const prefix = settings.invoice_prefix || 'INV';
  const sep = settings.invoice_separator || '-';
  const padding = settings.invoice_padding || 4;
  const startNum = settings.invoice_start_number || 1;
  const suffix = settings.invoice_suffix || '';
  // Fix #1: Device prefix prevents duplicate invoice numbers when 2 shops run simultaneously.
  // Stored in browser localStorage ONLY (not synced) so each computer keeps its own value.
  // Set it in: Settings → Invoice Sequences → "This Computer's Invoice Prefix"
  const devicePrefixRaw = (localStorage.getItem('gb_device_prefix') || '').trim().toUpperCase();
  const devicePrefix = devicePrefixRaw ? `${devicePrefixRaw}${sep}` : '';

  // Extract sequence numbers
  let maxSeq = startNum - 1;
  
  invoices.forEach(inv => {
    // Try to extract sequence from inv number (handles both A-INV-0005 and INV-0005)
    const regex = new RegExp(`^(?:[A-Z]${sep})?${prefix}${sep}(\\d+)${suffix ? suffix : ''}`);
    const match = inv.invoice_number?.match(regex);
    if (match) {
      const seqVal = parseInt(match[1]);
      if (seqVal > maxSeq) maxSeq = seqVal;
    }
  });

  const nextSeq = maxSeq + 1;
  const paddedSeq = String(nextSeq).padStart(padding, '0');
  
  return `${devicePrefix}${prefix}${sep}${paddedSeq}${suffix}`;
}

function renderBillingFormLayout(container) {
  const customers = db.get('customers');
  const products = db.get('products');
  const settings = db.get('business_settings');
  const isEditMode = activeInvoice.id && db.getAllRaw('invoices').some(inv => inv.id === activeInvoice.id);

  container.innerHTML = `
    <div class="billing-main-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start;">
      
      <!-- Left Column: Invoice Items Selector & Grid -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Header Info Card -->
        <div class="view-card" style="padding: 16px;">
          <div class="billing-header-grid" style="display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 16px; margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label">Invoice Number</label>
              <input type="text" class="form-control" id="bill-number-input" value="${activeInvoice.invoice_number}">
            </div>
            <div class="form-group">
              <label class="form-label">Invoice Date</label>
              <input type="date" class="form-control" id="bill-date-input" value="${activeInvoice.date}">
            </div>
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                Customer 
                <a href="javascript:void(0)" id="btn-quick-add-cust-billing" style="font-size: 0.75rem; text-decoration: none; color: hsl(var(--primary));">+ Add New</a>
              </label>
              <select class="form-control" id="bill-customer-select">
                <option value="">Walk-in / Cash Customer</option>
                ${customers.map(c => `
                  <option value="${c.id}" ${activeInvoice.customer_id === c.id ? 'selected' : ''}>
                    ${c.name} (${c.phone ? c.phone : 'No Phone'})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Add Items / Barcode Scanner Card -->
        <div class="view-card" style="padding: 16px;">
          <div class="billing-product-bar-grid">
            
            <!-- Searchable Product Input (Vyapar-style) -->
            <div class="form-group" style="margin-bottom: 0; position: relative;">
              <label class="form-label">Search Product</label>
              <input type="text" class="form-control" id="bill-product-search"
                placeholder="Type product name..." autocomplete="off" maxlength="100">
              <div id="bill-product-suggestions" style="display:none; position:absolute; top:calc(100% + 2px); left:0; right:0; z-index:9999; background:hsl(var(--bg-primary)); border:1px solid hsl(var(--border-color)); border-radius:var(--radius-sm); max-height:220px; overflow-y:auto; box-shadow:0 6px 20px rgba(0,0,0,0.18);"></div>
            </div>

            <!-- Manual QR input / Scanner triggers -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Barcode / QR Input</label>
              <div style="display: flex; gap: 6px;">
                <input type="text" class="form-control" id="bill-qr-manual-input" placeholder="Type & Enter">
                <button class="btn btn-secondary" id="btn-billing-camera-scan" title="Scan with Camera" style="padding: 10px; height: 38px; display: flex; align-items: center; justify-content: center;"><i data-lucide="scan-barcode"></i></button>
              </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Qty</label>
              <input type="number" class="form-control" id="bill-qty-input" value="1" min="1">
            </div>

            <button class="btn btn-primary" id="btn-add-item-billing" style="height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px;"><i data-lucide="shopping-bag"></i> Add</button>
          </div>

          <!-- ── Inline New Product Quick-Add Panel (hidden by default) ── -->
          <div id="bill-new-product-panel" style="display:none; margin-top:12px; padding:12px 14px; background:hsl(220 80% 40% / 0.06); border:1px solid hsl(220 80% 40% / 0.25); border-radius:var(--radius-sm);">
            <div style="font-size:0.82rem; font-weight:700; color:hsl(220,70%,38%); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="package-plus" style="width:14px;height:14px;"></i> New Product — Quick Add to Catalogue
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
              <div class="form-group" style="margin:0; flex:2; min-width:130px;">
                <label class="form-label" style="font-size:0.75rem;">Product Name *</label>
                <input type="text" class="form-control" id="new-prod-name" maxlength="100" style="height:34px; font-size:0.85rem;">
              </div>
              <div class="form-group" style="margin:0; flex:1; min-width:90px;">
                <label class="form-label" style="font-size:0.75rem;">Sale Price ₹ *</label>
                <input type="number" step="0.01" min="0.01" class="form-control" id="new-prod-price" placeholder="0.00" style="height:34px; font-size:0.85rem;">
              </div>
              <div class="form-group" style="margin:0; min-width:72px;">
                <label class="form-label" style="font-size:0.75rem;">GST %</label>
                <select class="form-control" id="new-prod-gst" style="height:34px; font-size:0.85rem; padding:4px 6px;">
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div class="form-group" style="margin:0; min-width:65px;">
                <label class="form-label" style="font-size:0.75rem;">Disc %</label>
                <input type="number" step="0.1" min="0" max="100" value="0" class="form-control" id="new-prod-disc" style="height:34px; font-size:0.85rem;">
              </div>
              <div class="form-group" style="margin:0; min-width:55px;">
                <label class="form-label" style="font-size:0.75rem;">Qty</label>
                <input type="number" min="1" value="1" class="form-control" id="new-prod-qty" style="height:34px; font-size:0.85rem;">
              </div>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-primary" id="btn-confirm-new-prod" style="height:34px; padding:0 12px; font-size:0.85rem; display:flex; align-items:center; gap:4px;"><i data-lucide="check" style="width:14px;height:14px;"></i> Add to Invoice</button>
                <button class="btn btn-secondary" id="btn-cancel-new-prod" style="height:34px; padding:0 10px; font-size:0.85rem;">Cancel</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Items Grid Table -->
        <div class="view-card" style="margin-bottom: 0;">
          <h3 class="card-title" style="margin-bottom: 12px;"><i data-lucide="shopping-cart"></i> Invoiced Items</h3>
          
          <!-- Desktop View Table -->
          <div class="desktop-items-table-container table-responsive" style="margin-top: 0; border: none;">
            <table class="app-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th style="width: 65px; text-align: center;">Qty</th>
                  <th style="width: 95px;">Rate (MRP)</th>
                  <th style="width: 55px; text-align: center;">Disc %</th>
                  <th style="width: 80px; display: none;">GST %</th>
                  <th style="width: 120px;">Line Total</th>
                  <th style="width: 50px;"></th>
                </tr>
              </thead>
              <tbody id="billing-items-body">
                <!-- Dynamically Populated -->
              </tbody>
            </table>
          </div>

          <!-- Mobile View List (Vyapar style cards) -->
          <div class="mobile-items-list-container" id="billing-items-mobile-list" style="display: none;">
            <!-- Dynamically Populated Cards -->
          </div>
        </div>

      </div>

      <!-- Right Column: Totals & Split Payments (Acts as drawer bottom sheet on Mobile) -->
      <div class="billing-checkout-sidebar" id="billing-checkout-sidebar" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Unified Summary & Checkout Card -->
        <div class="view-card" style="padding: 16px; margin-bottom: 0;">
          
          <!-- Mobile Drawer Header -->
          <div class="mobile-drawer-header" style="display: none; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid hsl(var(--border-color)); margin-bottom: 12px;">
            <span style="font-weight: 700; font-size: 1.05rem; color: hsl(var(--text-primary)); display: flex; align-items: center; gap: 6px;"><i data-lucide="receipt"></i> Invoice Summary</span>
            <button class="btn-close-drawer" id="btn-close-checkout-drawer" style="background: none; border: none; color: hsl(var(--text-secondary)); cursor: pointer; padding: 4px; display: flex; align-items: center;"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
          </div>

          <h3 class="card-title no-mobile" style="margin-bottom: 12px;"><i data-lucide="receipt"></i> Invoice Summary</h3>
          
          <!-- Compact Totals List -->
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; margin-bottom: 12px; background: hsl(var(--bg-tertiary) / 0.4); padding: 10px; border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: hsl(var(--text-secondary));">Subtotal:</span>
              <span id="bill-subtotal-val" style="font-weight: 500;">₹0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: hsl(var(--text-secondary));">GST Tax:</span>
              <span id="bill-gst-val" style="font-weight: 500;">₹0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: hsl(var(--text-secondary));">Discount:</span>
              <span class="text-success" id="bill-discount-val" style="font-weight: 500;">-₹0.00</span>
            </div>
            <hr style="border: none; border-top: 1px solid hsl(var(--border-color) / 0.5); margin: 4px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.05rem;">
              <span>Grand Total:</span>
              <span id="bill-grandtotal-val">₹0.00</span>
            </div>
          </div>

          <!-- Final Discount Input (Side-by-Side Flex Row) -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
            <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">Final Discount (₹)</label>
            <input type="number" step="0.01" class="form-control" id="bill-final-discount-input" value="${activeInvoice.final_discount || 0}" min="0" style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
          </div>

          <!-- Net Payable Display -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: hsl(var(--primary-transparent)); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 12px;">
            <span style="font-weight: 700; font-size: 1.02rem; color: hsl(var(--primary));">Net Payable:</span>
            <span id="bill-netpayable-val" style="font-weight: 800; font-size: 1.25rem; color: hsl(var(--primary));">₹0.00</span>
          </div>

          <!-- Record Payments Subtitle -->
          <h4 style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: hsl(var(--text-secondary)); display: flex; align-items: center; gap: 6px;">
            <i data-lucide="wallet" style="width: 14px; height: 14px;"></i> Payments Received (Split)
          </h4>

          ${isEditMode ? `<div style="font-size: 0.72rem; color: hsl(var(--danger)); margin-bottom: 8px; font-weight: 500; text-align: center; background: hsl(var(--danger) / 0.1); padding: 6px; border-radius: var(--radius-xs);">Payments are locked on edit screen. Manage them via Payment History.</div>` : ''}

          <!-- Split Payment inputs (Side-by-Side Flex Rows) -->
          <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">${settings.account_cash_label || 'Cash'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control" id="bill-cash-input" value="${activeInvoice.cash_paid || 0}" ${isEditMode ? 'disabled' : ''} style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">${settings.account_upi_label || 'UPI'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control" id="bill-upi-input" value="${activeInvoice.upi_paid || 0}" ${isEditMode ? 'disabled' : ''} style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0; white-space: nowrap;">${settings.account_bank_label || 'Bank'} Paid (₹)</label>
              <input type="number" step="0.01" class="form-control" id="bill-bank-input" value="${activeInvoice.bank_paid || 0}" ${isEditMode ? 'disabled' : ''} style="padding: 4px 8px; height: 28px; width: 110px; font-size: 0.85rem;">
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid hsl(var(--border-color) / 0.5); margin: 8px 0;">

          <!-- Balance Due -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 700; font-size: 1rem;">
            <span>Balance Due:</span>
            <span id="bill-balancedue-val" class="text-danger">₹0.00</span>
          </div>

          <!-- Action buttons -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px; width: 100%;">
              <button class="btn btn-success" id="btn-save-print-billing" style="padding: 10px; font-weight: 600; justify-content: center; font-size: 0.95rem; display: flex; align-items: center; gap: 6px; flex: 1;"><i data-lucide="printer"></i> Print & Save</button>
              <button class="btn btn-primary" id="btn-save-only-billing" style="padding: 10px; font-weight: 600; justify-content: center; font-size: 0.95rem; display: flex; align-items: center; gap: 6px; flex: 1;"><i data-lucide="save"></i> Save</button>
            </div>
            <button class="btn btn-secondary" id="btn-reset-billing" style="padding: 8px; justify-content: center; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; width: 100%;"><i data-lucide="refresh-cw"></i> Reset Form</button>
          </div>

        </div>

      </div>
    </div>

    <!-- Mobile Sticky Footer Bar -->
    <div class="mobile-billing-footer">
      <div class="mobile-billing-footer-total">
        <span class="label">Net Payable</span>
        <span class="value" id="mobile-bill-netpayable-val">₹0.00</span>
      </div>
      <div class="mobile-billing-footer-actions">
        <button class="btn btn-primary" id="btn-mobile-review-checkout" style="min-height: 40px; height: 40px; padding: 0 14px; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;"><i data-lucide="wallet" style="width: 16px; height: 16px;"></i> Pay / Save</button>
      </div>
    </div>

    <!-- Mobile Drawer Overlay -->
    <div class="billing-checkout-overlay" id="billing-checkout-overlay"></div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Attach interactive listeners
  document.getElementById('bill-number-input').addEventListener('input', (e) => activeInvoice.invoice_number = e.target.value);
  document.getElementById('bill-date-input').addEventListener('input', (e) => activeInvoice.date = e.target.value);
  
  const customerSelect = document.getElementById('bill-customer-select');
  customerSelect.addEventListener('change', (e) => {
    activeInvoice.customer_id = e.target.value;
    const selectedText = customerSelect.options[customerSelect.selectedIndex]?.text;
    activeInvoice.customer_name = e.target.value ? selectedText.split('(')[0].trim() : 'Walk-in Customer';
  });

  // Quick Customer triggers
  document.getElementById('btn-quick-add-cust-billing').addEventListener('click', () => {
    showCustomerAddModal(null, (newCust) => {
      // Refresh dropdown and auto-select
      const list = db.get('customers');
      customerSelect.innerHTML = `<option value="">Walk-in / Cash Customer</option>` + list.map(c => `
        <option value="${c.id}" ${newCust.id === c.id ? 'selected' : ''}>${c.name} (${c.phone ? c.phone : 'No Phone'})</option>
      `).join('');
      activeInvoice.customer_id = newCust.id;
      activeInvoice.customer_name = newCust.name;
    });
  });

  // ── Searchable Product Input — Live Suggestions (Vyapar-style) ───────────
  const prodSearchInput = document.getElementById('bill-product-search');
  const prodSuggestBox  = document.getElementById('bill-product-suggestions');

  prodSearchInput.addEventListener('input', () => {
    const query = prodSearchInput.value.trim().toLowerCase();
    if (query.length < 1) { prodSuggestBox.style.display = 'none'; return; }

    const allProds = db.get('products');
    const matches  = allProds.filter(p => p.name.toLowerCase().includes(query)).slice(0, 8);

    let html = '';
    matches.forEach(p => {
      const stock = calc.getCurrentStock(p.id);
      html += `<div class="prod-sug-item" data-id="${p.id}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid hsl(var(--border-color)/0.4); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:500; font-size:0.9rem;">${p.name}</span>
        <span style="font-size:0.78rem; color:hsl(var(--text-secondary)); white-space:nowrap; margin-left:8px;">₹${p.sale_price} | Stk: ${stock}</span>
      </div>`;
    });

    // Show "Add as new" option only when no exact name match exists
    const exactMatch = allProds.find(p => p.name.toLowerCase() === query);
    if (!exactMatch) {
      const displayName = prodSearchInput.value.trim();
      html += `<div id="sug-add-new" style="padding:8px 12px; cursor:pointer; color:hsl(220,75%,38%); font-weight:600; font-size:0.87rem; display:flex; align-items:center; gap:6px; border-top:1px solid hsl(var(--border-color)/0.4);">
        <span style="font-size:1.15rem; font-weight:800; color:hsl(220,75%,38%);">+</span> Add as new product: <em style="font-style:normal; color:hsl(var(--text-primary));">&quot;${displayName}&quot;</em>
      </div>`;
    }

    if (!html) {
      html = `<div style="padding:10px 12px; color:hsl(var(--text-muted)); font-size:0.85rem; text-align:center;">No products found.</div>`;
    }

    prodSuggestBox.innerHTML = html;
    prodSuggestBox.style.display = 'block';

    // Existing product — click adds to invoice immediately
    prodSuggestBox.querySelectorAll('.prod-sug-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background = 'hsl(var(--bg-secondary))');
      item.addEventListener('mouseleave', () => item.style.background = '');
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keep focus on input until we're done
        const pid = item.getAttribute('data-id');
        const qty = parseInt(document.getElementById('bill-qty-input').value || 1);
        addProductToInvoiceById(pid, qty);
        prodSearchInput.value = '';
        prodSuggestBox.style.display = 'none';
        prodSearchInput.focus();
      });
    });

    // "Add as new product" — show inline panel
    const sugNew = document.getElementById('sug-add-new');
    if (sugNew) {
      sugNew.addEventListener('mouseenter', () => sugNew.style.background = 'hsl(220 75% 38% / 0.08)');
      sugNew.addEventListener('mouseleave', () => sugNew.style.background = '');
      sugNew.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const typedName = prodSearchInput.value.trim();
        prodSuggestBox.style.display = 'none';
        const panel = document.getElementById('bill-new-product-panel');
        document.getElementById('new-prod-name').value  = typedName;
        document.getElementById('new-prod-price').value = '';
        document.getElementById('new-prod-disc').value  = '0';
        document.getElementById('new-prod-qty').value   = document.getElementById('bill-qty-input').value || '1';
        panel.style.display = 'block';
        if (window.lucide) window.lucide.createIcons();
        document.getElementById('new-prod-price').focus();
      });
    }
  });

  // Hide suggestions when input loses focus
  prodSearchInput.addEventListener('blur', () => {
    setTimeout(() => { prodSuggestBox.style.display = 'none'; }, 200);
  });

  // New product panel — confirm and save to catalogue + add to invoice
  document.getElementById('btn-confirm-new-prod').addEventListener('click', () => {
    const nameVal  = (document.getElementById('new-prod-name').value  || '').trim();
    const priceVal = parseFloat(document.getElementById('new-prod-price').value || 0);
    const gstVal   = parseInt(document.getElementById('new-prod-gst').value    || 0);
    const discVal  = parseFloat(document.getElementById('new-prod-disc').value  || 0);
    const qtyVal   = parseInt(document.getElementById('new-prod-qty').value     || 1);

    if (!nameVal)                                        { alert('Product name is required.');                    return; }
    if (!priceVal || priceVal <= 0)                      { alert('Sale price must be greater than ₹0.');           return; }
    if (isNaN(discVal) || discVal < 0 || discVal > 100)  { alert('Discount must be between 0 and 100.');           return; }
    if (isNaN(qtyVal)  || qtyVal < 1)                    { alert('Quantity must be at least 1.');                  return; }

    try {
      const newProd = db.insert('products', {
        name:             nameVal,
        sale_price:       priceVal,
        purchase_price:   0,
        gst_rate:         gstVal,
        default_discount: discVal,
        qr:               '',
        hsn_code:         '',
        unit:             'Pcs',
        description:      ''
      });

      activeInvoice.items.push({
        product_id:    newProd.id,
        product_name:  newProd.name,
        description:   '',
        qty:           qtyVal,
        rate:          priceVal,
        discount_rate: discVal,
        gst_rate:      gstVal
      });

      document.getElementById('bill-new-product-panel').style.display = 'none';
      prodSearchInput.value = '';
      prodSearchInput.focus();
      refreshItemsGrid();
      alert(`"${nameVal}" saved to product catalogue and added to invoice.`);
    } catch (err) {
      alert(`Failed to add product: ${err.message}`);
    }
  });

  // New product panel — cancel
  document.getElementById('btn-cancel-new-prod').addEventListener('click', () => {
    document.getElementById('bill-new-product-panel').style.display = 'none';
    prodSearchInput.value = '';
    prodSearchInput.focus();
  });

  // ── QR / Barcode Input — USB Scanner Auto-Add ─────────────────────────
  const qrInput    = document.getElementById('bill-qr-manual-input');
  let _qrAutoTimer = null;
  let _qrScanStart = null;

  qrInput.addEventListener('focus', () => { _qrScanStart = null; });

  // Input event: detect scanner (fast chars) vs manual typing (slow chars)
  qrInput.addEventListener('input', () => {
    if (_qrScanStart === null) _qrScanStart = Date.now();
    clearTimeout(_qrAutoTimer);
    _qrAutoTimer = setTimeout(() => {
      const code = qrInput.value.trim();
      if (!code) return;
      // Scanner sends all chars in < 50ms avg per char; human types > 150ms avg
      const avgPerChar = (Date.now() - _qrScanStart) / code.length;
      if (avgPerChar < 50) {
        addProductToInvoiceByQR(code);
        qrInput.value = '';
        _qrScanStart  = null;
        qrInput.focus();
      }
      // Slow typing — user must press Enter manually
    }, 200);
  });

  // Enter key always triggers — fallback for all scanner types + manual
  qrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(_qrAutoTimer);
      const code = qrInput.value.trim();
      if (code) {
        addProductToInvoiceByQR(code);
        qrInput.value = '';
        _qrScanStart  = null;
        qrInput.focus();
      }
    }
  });

  // Camera scan trigger
  document.getElementById('btn-billing-camera-scan').addEventListener('click', () => showCameraScannerModal());

  // Add button — triggers QR add if QR field has value, otherwise hints user
  document.getElementById('btn-add-item-billing').addEventListener('click', () => {
    clearTimeout(_qrAutoTimer);
    const code = (qrInput.value || '').trim();
    if (code) {
      addProductToInvoiceByQR(code);
      qrInput.value = '';
      _qrScanStart  = null;
      qrInput.focus();
    } else {
      alert('Search by product name in the search box, or scan a barcode in the QR field.');
    }
  });

  // Totals calculations listeners
  document.getElementById('bill-final-discount-input').addEventListener('input', (e) => {
    activeInvoice.final_discount = parseFloat(e.target.value || 0);
    recalculateInvoiceTotals();
  });

  // Split payments listeners
  document.getElementById('bill-cash-input').addEventListener('input', (e) => {
    activeInvoice.cash_paid = parseFloat(e.target.value || 0);
    recalculateInvoiceTotals();
  });
  document.getElementById('bill-upi-input').addEventListener('input', (e) => {
    activeInvoice.upi_paid = parseFloat(e.target.value || 0);
    recalculateInvoiceTotals();
  });
  document.getElementById('bill-bank-input').addEventListener('input', (e) => {
    activeInvoice.bank_paid = parseFloat(e.target.value || 0);
    recalculateInvoiceTotals();
  });

  // Reset form
  document.getElementById('btn-reset-billing').addEventListener('click', () => {
    const confirm = window.confirm("Clear all items and reset billing form?");
    if (confirm) {
      resetActiveInvoice();
      renderBillingFormLayout(container);
    }
  });

  // Save invoice triggers
  document.getElementById('btn-save-print-billing').addEventListener('click', () => saveBillingInvoice(true));
  document.getElementById('btn-save-only-billing').addEventListener('click', () => saveBillingInvoice(false));

  // Mobile Checkout Drawer Interactions
  const overlay = document.getElementById('billing-checkout-overlay');
  const sidebar = document.getElementById('billing-checkout-sidebar');
  const openBtn = document.getElementById('btn-mobile-review-checkout');
  const closeBtn = document.getElementById('btn-close-checkout-drawer');

  if (openBtn && sidebar && overlay) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.add('show');
      overlay.classList.add('show');
    });
  }

  const hideDrawer = () => {
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
  };

  if (overlay) overlay.addEventListener('click', hideDrawer);
  if (closeBtn) closeBtn.addEventListener('click', hideDrawer);

  // Initial draw
  refreshItemsGrid();

  // Auto-focus QR input for rapid scanning
  setTimeout(() => {
    const qrInp = document.getElementById('bill-qr-manual-input');
    if (qrInp) qrInp.focus();
  }, 100);
}

// Recalculate Totals (Section 6 formulas)
function recalculateInvoiceTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalGst = 0;
  let grandTotal = 0;

  activeInvoice.items.forEach(it => {
    const gross = it.qty * it.rate;
    const discAmt = gross * (it.discount_rate / 100);
    const afterDisc = gross - discAmt;
    const taxable = afterDisc / (1 + it.gst_rate / 100);
    const gstAmt = afterDisc - taxable;

    subtotal += taxable;
    totalDiscount += discAmt;
    totalGst += gstAmt;
    grandTotal += afterDisc;
  });

  const finalDisc = activeInvoice.final_discount || 0;
  const netPayable = grandTotal - finalDisc;
  const paid = (activeInvoice.cash_paid || 0) + (activeInvoice.upi_paid || 0) + (activeInvoice.bank_paid || 0);
  const balDue = netPayable - paid;

  // Render UI updates
  document.getElementById('bill-subtotal-val').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('bill-discount-val').textContent = `-₹${totalDiscount.toFixed(2)}`;
  document.getElementById('bill-gst-val').textContent = `₹${totalGst.toFixed(2)}`;
  document.getElementById('bill-grandtotal-val').textContent = `₹${grandTotal.toFixed(2)}`;
  document.getElementById('bill-netpayable-val').textContent = `₹${netPayable.toFixed(2)}`;
  
  const mobNetPay = document.getElementById('mobile-bill-netpayable-val');
  if (mobNetPay) mobNetPay.textContent = `₹${netPayable.toFixed(2)}`;
  
  const balDueElem = document.getElementById('bill-balancedue-val');
  balDueElem.textContent = `₹${balDue.toFixed(2)}`;
  
  if (balDue > 0.05) {
    balDueElem.className = 'text-danger';
  } else {
    balDueElem.className = 'text-success';
  }
}

// Helper for attaching shared listeners
function attachCommonListeners(container, item, idx) {
  container.querySelector('.item-desc-edit').addEventListener('change', (e) => {
    item.description = e.target.value;
    refreshItemsGrid();
  });

  container.querySelector('.item-qty-edit').addEventListener('change', (e) => {
    item.qty = parseInt(e.target.value || 1);
    refreshItemsGrid();
  });

  container.querySelector('.item-rate-edit').addEventListener('change', (e) => {
    item.rate = parseFloat(e.target.value || 0);
    refreshItemsGrid();
  });

  container.querySelector('.item-disc-edit').addEventListener('change', (e) => {
    item.discount_rate = parseFloat(e.target.value || 0);
    refreshItemsGrid();
  });

  const gstEdit = container.querySelector('.item-gst-edit');
  if (gstEdit) {
    gstEdit.addEventListener('change', (e) => {
      item.gst_rate = parseInt(e.target.value);
      refreshItemsGrid();
    });
  }

  container.querySelector('.btn-delete-item').addEventListener('click', () => {
    activeInvoice.items.splice(idx, 1);
    refreshItemsGrid();
  });
}

// Refresh items grid
function refreshItemsGrid() {
  const tbody = document.getElementById('billing-items-body');
  const mobileList = document.getElementById('billing-items-mobile-list');
  
  if (activeInvoice.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">No items added yet. Search by product name above, or scan a barcode.</td></tr>`;
    if (mobileList) {
      mobileList.innerHTML = `<div style="text-align: center; padding: 24px; color: hsl(var(--text-secondary)); font-size: 0.85rem;">No items added yet. Search by product name above, or scan a barcode.</div>`;
    }
    recalculateInvoiceTotals();
    return;
  }

  // 1. Render Desktop Table Body
  tbody.innerHTML = activeInvoice.items.map((it, idx) => {
    const gross = it.qty * it.rate;
    const disc = gross * (it.discount_rate / 100);
    const total = gross - disc;

    return `
      <tr data-index="${idx}">
        <td style="font-weight: 500;">
          <div>${it.product_name}</div>
          <input type="text" class="form-control item-desc-edit" value="${it.description || ''}" placeholder="Size / description details..." style="padding: 2px 6px; font-size: 0.75rem; height: 22px; margin-top: 4px; width: 100%; border: 1px dashed hsl(var(--border-color)); background: transparent;">
        </td>
        <td>
          <input type="number" class="form-control item-qty-edit" value="${it.qty}" min="1" style="padding: 4px; text-align: center; width: 55px;">
        </td>
        <td>
          <input type="number" step="0.01" class="form-control item-rate-edit" value="${it.rate}" min="0" style="padding: 4px; width: 85px;">
        </td>
        <td>
          <input type="number" step="0.1" class="form-control item-disc-edit" value="${it.discount_rate}" min="0" max="100" style="padding: 4px; text-align: center; width: 45px;">
        </td>
        <td style="display: none;">
          <select class="form-control item-gst-edit" style="padding: 4px; font-size: 0.85rem;">
            <option value="0" ${it.gst_rate === 0 ? 'selected' : ''}>0%</option>
            <option value="5" ${it.gst_rate === 5 ? 'selected' : ''}>5%</option>
            <option value="12" ${it.gst_rate === 12 ? 'selected' : ''}>12%</option>
            <option value="18" ${it.gst_rate === 18 ? 'selected' : ''}>18%</option>
            <option value="28" ${it.gst_rate === 28 ? 'selected' : ''}>28%</option>
          </select>
        </td>
        <td style="font-weight: 600;">₹${total.toFixed(2)}</td>
        <td>
          <button class="btn-delete-item" style="color: hsl(var(--danger)); cursor: pointer;" title="Remove"><i data-lucide="trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  // 2. Render Mobile Cards List
  if (mobileList) {
    mobileList.innerHTML = activeInvoice.items.map((it, idx) => {
      const gross = it.qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const total = gross - disc;

      return `
        <div class="mobile-item-card" data-index="${idx}">
          <div class="mobile-item-card-header">
            <span class="mobile-item-card-name">${it.product_name}</span>
            <button class="btn-delete-item" style="background: none; border: none; color: hsl(var(--danger)); cursor: pointer; padding: 4px; display: flex; align-items: center;" title="Remove"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
          </div>
          
          <div class="mobile-item-card-grid">
            <div class="mobile-item-card-field">
              <label>Qty</label>
              <div class="qty-stepper">
                <button class="qty-btn btn-minus">-</button>
                <input type="number" class="form-control item-qty-edit" value="${it.qty}" min="1">
                <button class="qty-btn btn-plus">+</button>
              </div>
            </div>
            <div class="mobile-item-card-field">
              <label>Rate (MRP)</label>
              <input type="number" step="0.01" class="form-control item-rate-edit" value="${it.rate}" min="0">
            </div>
            <div class="mobile-item-card-field">
              <label>Disc %</label>
              <input type="number" step="0.1" class="form-control item-disc-edit" value="${it.discount_rate}" min="0" max="100">
            </div>
            <div class="mobile-item-card-field" style="display: none;">
              <label>GST %</label>
              <select class="form-control item-gst-edit">
                <option value="0" ${it.gst_rate === 0 ? 'selected' : ''}>0%</option>
                <option value="5" ${it.gst_rate === 5 ? 'selected' : ''}>5%</option>
                <option value="12" ${it.gst_rate === 12 ? 'selected' : ''}>12%</option>
                <option value="18" ${it.gst_rate === 18 ? 'selected' : ''}>18%</option>
                <option value="28" ${it.gst_rate === 28 ? 'selected' : ''}>28%</option>
              </select>
            </div>
            <div class="mobile-item-card-total">
              <label>Total</label>
              <span class="total-value">₹${total.toFixed(2)}</span>
            </div>
          </div>
          
          <div style="margin-top: 8px;">
            <input type="text" class="form-control item-desc-edit" value="${it.description || ''}" placeholder="Add descriptions / size..." style="font-size: 0.78rem; min-height: 28px; padding: 4px 8px; border: 1px dashed hsl(var(--border-color)); background: transparent; width: 100%;">
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) window.lucide.createIcons();

  // 3. Attach Live Editing Observers (Desktop Table)
  tbody.querySelectorAll('tr').forEach(row => {
    const idx = parseInt(row.getAttribute('data-index'));
    const item = activeInvoice.items[idx];
    attachCommonListeners(row, item, idx);
  });

  // 4. Attach Live Editing Observers (Mobile List + Stepper buttons)
  if (mobileList) {
    mobileList.querySelectorAll('.mobile-item-card').forEach(card => {
      const idx = parseInt(card.getAttribute('data-index'));
      const item = activeInvoice.items[idx];
      attachCommonListeners(card, item, idx);
      
      // Mobile-only stepper listeners
      const qtyInput = card.querySelector('.item-qty-edit');
      card.querySelector('.btn-minus').addEventListener('click', () => {
        const val = parseInt(qtyInput.value || 1);
        if (val > 1) {
          item.qty = val - 1;
          refreshItemsGrid();
        }
      });
      card.querySelector('.btn-plus').addEventListener('click', () => {
        const val = parseInt(qtyInput.value || 1);
        item.qty = val + 1;
        refreshItemsGrid();
      });
    });
  }

  recalculateInvoiceTotals();
}

// Add product by barcode scan lookup
function addProductToInvoiceByQR(qrCode) {
  const p = db.get('products').find(prod => prod.qr === qrCode);
  if (p) {
    // Check if already in active invoice
    const existing = activeInvoice.items.find(it => it.product_id === p.id);
    if (existing) {
      existing.qty++;
    } else {
      activeInvoice.items.push({
        product_id: p.id,
        product_name: p.name,
        description: p.description || '',
        qty: 1,
        rate: parseFloat(p.sale_price || 0),
        discount_rate: parseFloat(p.default_discount || 0),
        gst_rate: parseInt(p.gst_rate || 0)
      });
    }
    
    // Play sound notification
    document.getElementById('sound-success').play().catch(() => {});
    refreshItemsGrid();
  } else {
    document.getElementById('sound-error').play().catch(() => {});
    alert(`Product with barcode "${qrCode}" was not found in catalog.`);
  }
}

function addProductToInvoiceById(prodId, qty = 1) {
  const p = db.find('products', prodId);
  if (p) {
    const existing = activeInvoice.items.find(it => it.product_id === p.id);
    if (existing) {
      existing.qty += qty;
    } else {
      activeInvoice.items.push({
        product_id: p.id,
        product_name: p.name,
        description: p.description || '',
        qty: qty,
        rate: parseFloat(p.sale_price || 0),
        discount_rate: parseFloat(p.default_discount || 0),
        gst_rate: parseInt(p.gst_rate || 0)
      });
    }
    refreshItemsGrid();
  }
}

// 4. Save Invoice Form Rules Validations
function saveBillingInvoice(shouldPrint = false) {
  // Save check rules
  if (!activeInvoice.invoice_number) {
    alert("Invoice number cannot be left blank.");
    return;
  }
  if (activeInvoice.items.length === 0) {
    alert("At least one product item line is required to save.");
    return;
  }

  // Calculate totals
  let grandTotal = 0;
  activeInvoice.items.forEach(it => {
    const gross = it.qty * it.rate;
    const disc = gross * (it.discount_rate / 100);
    grandTotal += (gross - disc);
  });

  const finalDisc = activeInvoice.final_discount || 0;
  const netPayable = grandTotal - finalDisc;

  if (netPayable <= 0) {
    alert("Invoice total is ₹0 or negative. Cannot save a zero-amount invoice.");
    return;
  }

  // Query subsequent payments if we are editing an invoice
  let subsequentPaid = 0;
  const isEdit = db.getAllRaw('invoices').some(inv => inv.id === activeInvoice.id);
  if (isEdit) {
    const payments = db.get('payment_ins').filter(p => p.invoice_id === activeInvoice.id && !p.is_deleted);
    subsequentPaid = payments
      .filter(p => !p.is_initial)
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  }

  const paid = (activeInvoice.cash_paid || 0) + (activeInvoice.upi_paid || 0) + (activeInvoice.bank_paid || 0);
  const totalPaid = paid + subsequentPaid;

  // Fix #2: Tolerance tightened from 0.05 to 0.001 — previous value allowed 5 paise overpayment
  // The tiny 0.001 tolerance exists only to absorb floating-point rounding errors, nothing more
  if (totalPaid > netPayable + 0.001) {
    alert(`Total payment (including subsequent payments of ₹${subsequentPaid.toFixed(2)}) exceeds net payable total. Overpayments are blocked.`);
    return;
  }

  // Deduct sales returns linked to this invoice
  const salesReturnsTotal = db.get('sales_returns')
    .filter(r => r.invoice_id === activeInvoice.id && !r.is_deleted)
    .reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);
  const balDue = netPayable - totalPaid - salesReturnsTotal;

  // Reconcile updates
  const invoiceRecord = {
    invoice_number: activeInvoice.invoice_number,
    date: activeInvoice.date,
    customer_id: activeInvoice.customer_id || null,
    customer_name: activeInvoice.customer_name || 'Walk-in Customer',
    items: activeInvoice.items,
    grand_total: grandTotal,
    final_discount: finalDisc,
    cash_paid: activeInvoice.cash_paid,
    upi_paid: activeInvoice.upi_paid,
    bank_paid: activeInvoice.bank_paid,
    balance_due: balDue < 0 ? 0 : parseFloat(balDue.toFixed(2)),
    converted_from_so_id: activeInvoice.converted_from_so_id || null
  };

  try {
    const savedInvoiceId = activeInvoice.id;
    
    if (isEdit) {
      db.update('invoices', activeInvoice.id, invoiceRecord, false);
      alert(`Invoice ${activeInvoice.invoice_number} updated successfully.`);
    } else {
      invoiceRecord.id = activeInvoice.id;
      db.insert('invoices', invoiceRecord);
      alert(`Invoice ${activeInvoice.invoice_number} saved successfully.`);
    }

    // Mark source Sale Order as Converted if applicable
    if (activeInvoice.converted_from_so_id) {
      try {
        db.update('sale_orders', activeInvoice.converted_from_so_id, { status: 'Converted' });
      } catch (soErr) {
        console.error("Failed to mark Sale Order as Converted:", soErr);
      }
    }

    updateHeaderBadges();

    // Reset active invoice / increment sequences for the form first
    resetActiveInvoice();
    if (billingContainer) {
      renderBillingFormLayout(billingContainer);
    }

    // Now trigger printing directly
    if (shouldPrint) {
      printInvoiceDirectly(savedInvoiceId);
    }
  } catch (err) {
    alert(`Save failed: ${err.message}`);
  }
}

// Background receipts direct printing wrapper
export function printInvoiceDirectly(invoiceId) {
  const inv = db.find('invoices', invoiceId);
  const settings = db.get('business_settings');
  if (!inv) return;

  // Create temporary container
  let printDiv = document.createElement('div');
  printDiv.className = 'invoice-print-container-temp';
  printDiv.innerHTML = generateInvoicePrintableHtml(inv, settings);

  document.body.appendChild(printDiv);
  document.body.classList.add('printing-receipt');

  // Trigger print dialog
  setTimeout(() => {
    window.print();
    // Clean up
    document.body.classList.remove('printing-receipt');
    printDiv.remove();
  }, 100);
}

// 5. Camera scanner dialog using Html5Qrcode (Section 35)
function showCameraScannerModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="scanner-modal-backdrop">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <h3><i data-lucide="scan-barcode"></i> Camera Barcode Scanner</h3>
          <button class="modal-close-btn" id="btn-close-scanner-modal"><i data-lucide="x"></i></button>
        </div>
        <div style="padding: 10px; background: #000; border-radius: var(--radius-sm); margin-bottom: 16px; position: relative;">
          <div id="camera-reader-viewport" style="width: 100%; min-height: 280px; background: #111;"></div>
        </div>
        <p style="font-size: 0.8rem; text-align: center; color: hsl(var(--text-secondary));">Place the product barcode in front of the camera to scan.</p>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().catch(err => console.error(err));
    }
    modalContainer.innerHTML = '';
  };
  
  document.getElementById('btn-close-scanner-modal').addEventListener('click', closeModal);

  // Initialize Scanner (supporting QR, EAN-13, and Code-128 formats)
  const html5QrcodeScanner = new Html5Qrcode("camera-reader-viewport");
  
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    {
      fps: 15,
      qrbox: { width: 280, height: 160 }
    },
    (decodedText) => {
      // Success! Barcode detected
      addProductToInvoiceByQR(decodedText);
      closeModal();
    },
    (errorMessage) => {
      // Scanning failures are common while adjusting camera focus, keep scanning silently
    }
  ).catch(err => {
    console.error("Camera access failed", err);
    alert("Unable to open camera. Check permissions or secure HTTP/Localhost contexts.");
    closeModal();
  });
}

// ==========================================================================
// NAMED EXPORT: INVOICES REGISTER / LIST VIEW
// ==========================================================================
export async function InvoicesListView(container) {
  // Check hash parameters for search pre-fill (e.g. from converted Sale Order link)
  const hash = window.location.hash;
  let prefillSearch = '';
  if (hash.includes('?')) {
    const queryStr = hash.split('?')[1];
    const params = new URLSearchParams(queryStr);
    prefillSearch = params.get('search') || '';
  }

  container.innerHTML = `
    <!-- Top Filters bar -->
    <div class="view-card no-print" style="margin-bottom: 20px; padding: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
        
        <div style="display: flex; flex-wrap: wrap; gap: 12px; flex: 1;">
          <input type="text" class="form-control" id="invoice-search-input" placeholder="Search Invoice No or customer name..." style="max-width: 320px;" value="${prefillSearch}">
          
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="form-label" style="margin-bottom: 0; white-space: nowrap;">From:</span>
            <input type="date" class="form-control" id="invoice-from-date">
            <span class="form-label" style="margin-bottom: 0; white-space: nowrap;">To:</span>
            <input type="date" class="form-control" id="invoice-to-date">
          </div>

          <select class="form-control" id="invoice-status-filter" style="max-width: 150px;">
            <option value="all">All Statuses</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <button class="btn btn-primary" onclick="window.location.hash = '#billing'"><i data-lucide="plus"></i> New Invoice</button>

      </div>
    </div>

    <div class="invoice-list-layout-grid">
      
      <!-- Invoices List Table -->
      <div class="view-card no-print" style="margin-bottom: 0;">
        <div class="table-responsive" style="margin-top: 0; border: none;">
          <table class="app-table">
            <thead>
              <tr>
                <th id="sort-invoice-number" style="cursor: pointer; user-select: none;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    Invoice No <span class="sort-icon-container" style="display: inline-flex; align-items: center;"></span>
                  </div>
                </th>
                <th id="sort-invoice-date" style="cursor: pointer; user-select: none;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    Date <span class="sort-icon-container" style="display: inline-flex; align-items: center;"></span>
                  </div>
                </th>
                <th id="sort-invoice-customer" style="cursor: pointer; user-select: none;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    Customer <span class="sort-icon-container" style="display: inline-flex; align-items: center;"></span>
                  </div>
                </th>
                <th id="sort-invoice-payable" style="cursor: pointer; user-select: none;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    Total Payable <span class="sort-icon-container" style="display: inline-flex; align-items: center;"></span>
                  </div>
                </th>
                <th>Status</th>
                <th class="no-print" style="width: 140px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody id="invoices-list-table-body">
              <!-- Injected dynamically -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Live Receipt Printable Template Preview Card -->
      <div class="view-card" style="margin-bottom: 0; position: sticky; top: 90px;" id="invoice-preview-card">
        <div style="text-align: center; padding: 40px 20px; color: hsl(var(--text-secondary));">
          <i data-lucide="receipt" style="width: 48px; height: 48px; margin-bottom: 12px; color: hsl(var(--text-muted));"></i>
          <p>Select any invoice on the left to see live receipt branding layouts and trigger print commands.</p>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Attach search listeners
  document.getElementById('invoice-search-input').addEventListener('input', refreshInvoiceRegister);
  document.getElementById('invoice-from-date').addEventListener('change', refreshInvoiceRegister);
  document.getElementById('invoice-to-date').addEventListener('change', refreshInvoiceRegister);
  document.getElementById('invoice-status-filter').addEventListener('change', refreshInvoiceRegister);

  // Attach sorting listeners
  const handleSortClick = (field) => {
    if (invoiceSortField === field) {
      invoiceSortAsc = !invoiceSortAsc;
    } else {
      invoiceSortField = field;
      invoiceSortAsc = false;
    }
    refreshInvoiceRegister();
  };

  document.getElementById('sort-invoice-number').addEventListener('click', () => handleSortClick('invoice_number'));
  document.getElementById('sort-invoice-date').addEventListener('click', () => handleSortClick('date'));
  document.getElementById('sort-invoice-customer').addEventListener('click', () => handleSortClick('customer_name'));
  document.getElementById('sort-invoice-payable').addEventListener('click', () => handleSortClick('payable'));

  // Initial draw
  refreshInvoiceRegister();
}

function refreshInvoiceRegister() {
  const query = document.getElementById('invoice-search-input').value.toLowerCase();
  const fromDate = document.getElementById('invoice-from-date').value;
  const toDate = document.getElementById('invoice-to-date').value;
  const statusFilter = document.getElementById('invoice-status-filter').value;
  const invoices = db.get('invoices');
  const tbody = document.getElementById('invoices-list-table-body');

  const filtered = invoices.filter(inv => {
    const custName = inv.customer_name || 'Walk-in Customer';
    const matchesSearch = inv.invoice_number.toLowerCase().includes(query) || 
                          custName.toLowerCase().includes(query);
    
    if (!matchesSearch) return false;

    // Date Range checks
    if (fromDate && inv.date < fromDate) return false;
    if (toDate && inv.date > toDate) return false;

    // Status checks
    const total = parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0);
    const due = parseFloat(inv.balance_due || 0);

    if (statusFilter === 'paid') return due <= 0.05;
    if (statusFilter === 'partial') return due > 0.05 && due < total;
    if (statusFilter === 'pending') return due >= total && total > 0;

    return true;
  });

  // Sort based on selected column
  filtered.sort((a, b) => {
    let valA, valB;
    if (invoiceSortField === 'invoice_number') {
      valA = a.invoice_number || '';
      valB = b.invoice_number || '';
      return invoiceSortAsc ? valA.localeCompare(valB, undefined, {numeric: true, sensitivity: 'base'}) : valB.localeCompare(valA, undefined, {numeric: true, sensitivity: 'base'});
    } else if (invoiceSortField === 'date') {
      valA = new Date(a.date).getTime() || 0;
      valB = new Date(b.date).getTime() || 0;
    } else if (invoiceSortField === 'customer_name') {
      valA = (a.customer_name || 'Walk-in Customer').toLowerCase();
      valB = (b.customer_name || 'Walk-in Customer').toLowerCase();
      return invoiceSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (invoiceSortField === 'payable') {
      valA = parseFloat(a.grand_total || 0) - parseFloat(a.final_discount || 0);
      valB = parseFloat(b.grand_total || 0) - parseFloat(b.final_discount || 0);
    }

    if (valA < valB) return invoiceSortAsc ? -1 : 1;
    if (valA > valB) return invoiceSortAsc ? 1 : -1;
    return 0;
  });

  // Update headers sort icons
  updateSortHeaderIcons();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No matching invoices found in register.</td></tr>`;
    document.getElementById('invoice-preview-card').innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: hsl(var(--text-secondary));">
        <i data-lucide="receipt" style="width: 48px; height: 48px; margin-bottom: 12px; color: hsl(var(--text-muted));"></i>
        <p>No invoices available to preview.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const custName = inv.customer_name || 'Walk-in Customer';
    const total = parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0);
    const due = parseFloat(inv.balance_due || 0);
    
    let badgeClass = 'badge-success';
    let statusText = 'Paid';
    if (due > 0.05 && due < total) {
      badgeClass = 'badge-warning';
      statusText = 'Partial';
    } else if (due >= total && total > 0) {
      badgeClass = 'badge-danger';
      statusText = 'Pending';
    }

    const showPay = due > 0.05;

    return `
      <tr data-id="${inv.id}" style="cursor: pointer;" class="invoice-row-select">
        <td style="font-family: var(--font-mono); font-weight: 600;">${inv.invoice_number}</td>
        <td>
          <div>${formatDateToDDMMYY(inv.date)}</div>
          ${inv.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(inv.created_at)}</div>` : ''}
        </td>
        <td style="font-weight: 500;">${custName}</td>
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
            ${showPay 
              ? `<button class="btn btn-secondary btn-collect-pay" title="Collect Payment" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs);"><i data-lucide="hand-coins" style="width: 14px; height: 14px; color: hsl(var(--success));"></i></button>` 
              : `<button class="btn btn-secondary" disabled title="Fully Paid" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs); opacity: 0.35;"><i data-lucide="hand-coins" style="width: 14px; height: 14px;"></i></button>`
            }
            <button class="btn btn-secondary btn-edit-row" title="Edit Invoice" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs);"><i data-lucide="pencil" style="width: 14px; height: 14px; color: hsl(var(--primary));"></i></button>
            <button class="btn btn-secondary text-danger btn-delete-row" title="Delete Invoice" style="padding: 6px 10px; min-height: unset; height: 32px; border-radius: var(--radius-xs);"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach clicking row to view receipt template
  tbody.querySelectorAll('.invoice-row-select').forEach(row => {
    row.addEventListener('click', () => {
      // Highlight selected row
      tbody.querySelectorAll('.invoice-row-select').forEach(r => r.classList.remove('active-row'));
      row.classList.add('active-row');
      
      const id = row.getAttribute('data-id');
      renderInvoiceReceiptTemplate(id);
    });

    const id = row.getAttribute('data-id');

    // Collect Payment Button Event Listener
    const collectBtn = row.querySelector('.btn-collect-pay');
    if (collectBtn) {
      collectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showCollectPaymentModal(id);
      });
    }

    // Edit Row Button Event Listener
    const editBtn = row.querySelector('.btn-edit-row');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const inv = db.find('invoices', id);
        const parentContainer = document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild;
        renderBilling(parentContainer, inv);
      });
    }

    // Delete Row Button Event Listener
    const deleteBtn = row.querySelector('.btn-delete-row');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const permissions = db.getUserPermissions();
        if (!permissions.allow_delete_invoices) {
          alert("Permission Denied: Deleting invoices is restricted for your account.");
          return;
        }

        const confirm = window.confirm("Are you sure you want to permanently delete this invoice? This will restore stock levels.");
        if (confirm) {
          try {
            db.delete('invoices', id);
            updateHeaderBadges();
            alert("Invoice successfully soft-deleted.");
            InvoicesListView(document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild);
          } catch (err) {
            alert(`Delete blocked: ${err.message}`);
          }
        }
      });
    }
  });

  if (window.lucide) window.lucide.createIcons();

  // Pre-select first invoice
  if (filtered.length > 0) {
    tbody.querySelector('.invoice-row-select').click();
  }
}

// Update Lucide indicator icons on active table headers
function updateSortHeaderIcons() {
  const fields = {
    'invoice_number': 'sort-invoice-number',
    'date': 'sort-invoice-date',
    'customer_name': 'sort-invoice-customer',
    'payable': 'sort-invoice-payable'
  };

  for (const [field, id] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const container = el.querySelector('.sort-icon-container');
    if (!container) continue;

    if (invoiceSortField === field) {
      const iconName = invoiceSortAsc ? 'arrow-up' : 'arrow-down';
      container.innerHTML = `<i data-lucide="${iconName}" style="width: 14px; height: 14px; color: hsl(var(--primary));"></i>`;
    } else {
      container.innerHTML = `<i data-lucide="arrow-up-down" style="width: 14px; height: 14px; opacity: 0.35;"></i>`;
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

// 6. Draw printable layout invoice panel (Section 36 Print layout specifications)
function renderInvoiceReceiptTemplate(invoiceId) {
  const inv = db.find('invoices', invoiceId);
  const settings = db.get('business_settings');
  const container = document.getElementById('invoice-preview-card');
  if (!inv) return;

  const payments = db.get('payment_ins').filter(p => p.invoice_id === invoiceId && !p.is_deleted);
  
  let paymentsHtml = '';
  if (payments.length > 0) {
    paymentsHtml = `
      <div class="no-print" style="margin-top: 24px; border-top: 1px solid hsl(var(--border-color)); padding-top: 16px;">
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="history" style="width: 16px; height: 16px;"></i> Payment History
        </h4>
        <div class="table-responsive" style="margin-top: 0; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm);">
          <table class="app-table" style="font-size: 0.8rem; margin: 0;">
            <thead>
              <tr style="background: hsl(var(--bg-secondary));">
                <th style="padding: 6px 8px;">Date</th>
                <th style="padding: 6px 8px;">Method</th>
                <th style="padding: 6px 8px; text-align: right;">Amount</th>
                <th style="padding: 6px 8px;">Note</th>
                <th style="padding: 6px 8px; text-align: center; width: 80px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr data-payment-id="${p.id}">
                  <td style="padding: 6px 8px; white-space: nowrap;">
                    <div>${formatDateToDDMMYY(p.date)}</div>
                    ${p.created_at ? `<div style="font-size: 0.7rem; color: hsl(var(--text-secondary)); margin-top: 1px;">${formatTimeFromTimestamp(p.created_at)}</div>` : ''}
                  </td>
                  <td style="padding: 6px 8px;">
                    <span class="badge badge-secondary" style="font-size: 0.7rem; padding: 2px 6px;">${p.method}</span>
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: 600;">₹${parseFloat(p.amount).toFixed(2)}</td>
                  <td style="padding: 6px 8px; font-size: 0.75rem; color: hsl(var(--text-secondary)); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.note || ''}">${p.note || '—'}</td>
                  <td style="padding: 6px 8px; text-align: center;">
                    <div style="display: inline-flex; gap: 4px;">
                      <button class="btn btn-secondary btn-edit-payment" style="padding: 4px; min-height: unset; height: 24px; width: 24px; border-radius: var(--radius-xs);" title="Edit Payment"><i data-lucide="pencil" style="width: 12px; height: 12px; color: hsl(var(--primary));"></i></button>
                      <button class="btn btn-secondary text-danger btn-delete-payment" style="padding: 4px; min-height: unset; height: 24px; width: 24px; border-radius: var(--radius-xs);" title="Delete Payment"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    paymentsHtml = `
      <div class="no-print" style="margin-top: 24px; border-top: 1px solid hsl(var(--border-color)); padding-top: 16px; text-align: center; color: hsl(var(--text-secondary)); font-size: 0.8rem;">
        <p>No payments recorded for this invoice yet.</p>
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Control Action Buttons -->
    <div style="display: flex; gap: 8px; margin-bottom: 20px;" class="no-print">
      <button class="btn btn-primary" id="btn-print-active-invoice" style="flex: 1;"><i data-lucide="printer"></i> Print Invoice</button>
      <button class="btn btn-secondary" id="btn-edit-active-invoice"><i data-lucide="pencil"></i> Edit</button>
      <button class="btn btn-secondary text-danger" id="btn-delete-active-invoice" title="Delete"><i data-lucide="trash-2"></i> Delete</button>
    </div>

    ${generateInvoicePrintableHtml(inv, settings)}

    ${paymentsHtml}
  `;

  if (window.lucide) window.lucide.createIcons();

  // Attach payment action listeners
  container.querySelectorAll('.btn-edit-payment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tr = btn.closest('tr');
      const paymentId = tr.getAttribute('data-payment-id');
      showEditPaymentModal(paymentId, invoiceId);
    });
  });

  container.querySelectorAll('.btn-delete-payment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tr = btn.closest('tr');
      const paymentId = tr.getAttribute('data-payment-id');
      const confirm = window.confirm("Are you sure you want to delete this payment? This will update the invoice balance.");
      if (confirm) {
        try {
          db.delete('payment_ins', paymentId);
          
          const currentInv = db.find('invoices', invoiceId);
          if (currentInv) {
            const payments = db.get('payment_ins').filter(p => p.invoice_id === invoiceId && !p.is_deleted);
            let totalCashPaid = 0;
            let totalUpiPaid = 0;
            let totalBankPaid = 0;
            let initialCash = 0;
            let initialUpi = 0;
            let initialBank = 0;
            payments.forEach(p => {
              const amt = parseFloat(p.amount || 0);
              if (p.method === 'Cash') {
                totalCashPaid += amt;
                if (p.is_initial) initialCash += amt;
              } else if (p.method === 'UPI') {
                totalUpiPaid += amt;
                if (p.is_initial) initialUpi += amt;
              } else if (p.method === 'Bank') {
                totalBankPaid += amt;
                if (p.is_initial) initialBank += amt;
              }
            });

            currentInv.cash_paid = initialCash;
            currentInv.upi_paid = initialUpi;
            currentInv.bank_paid = initialBank;

            const currentTotal = parseFloat(currentInv.grand_total || 0) - parseFloat(currentInv.final_discount || 0);
            const currentPaidSum = totalCashPaid + totalUpiPaid + totalBankPaid;
            // Deduct sales returns linked to this invoice
            const salesReturnsTotal = db.get('sales_returns')
              .filter(r => r.invoice_id === invoiceId && !r.is_deleted)
              .reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);
            currentInv.balance_due = Math.max(0, currentTotal - currentPaidSum - salesReturnsTotal);

            db.update('invoices', invoiceId, currentInv, true);
          }
          
          alert("Payment deleted successfully.");
          const parentViewport = document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild;
          InvoicesListView(parentViewport);
        } catch (err) {
          alert(`Failed to delete payment: ${err.message}`);
        }
      }
    });
  });

  // Print button listener
  document.getElementById('btn-print-active-invoice').addEventListener('click', () => {
    window.print();
  });

  // Edit active invoice
  document.getElementById('btn-edit-active-invoice').addEventListener('click', () => {
    const parentContainer = document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild;
    renderBilling(parentContainer, inv);
  });

  // Delete invoice
  document.getElementById('btn-delete-active-invoice').addEventListener('click', () => {
    const permissions = db.getUserPermissions();
    if (!permissions.allow_delete_invoices) {
      alert("Permission Denied: Deleting invoices is restricted for your account.");
      return;
    }

    const confirm = window.confirm("Are you sure you want to permanently delete this invoice? This will restore stocks.");
    if (confirm) {
      try {
        db.delete('invoices', invoiceId);
        updateHeaderBadges();
        alert("Invoice successfully soft-deleted.");
        
        // Reload list register
        InvoicesListView(document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild);
      } catch (err) {
        alert(`Delete blocked: ${err.message}`);
      }
    }
  });
}

// Helper to generate the exact printable A5 document content layout for direct print & preview card
function generateInvoicePrintableHtml(inv, settings) {
  const finalDisc = parseFloat(inv.final_discount || 0);
  const total = inv.grand_total - finalDisc;
  // Sum ALL payments (initial + subsequent) from payment_ins records
  const allPayments = db.get('payment_ins').filter(p => p.invoice_id === inv.id && !p.is_deleted);
  const paid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const due = parseFloat(inv.balance_due || 0);

  // Dynamic UPI QR code generation (UPI deep link)
  const upiId = settings.upi_id ? settings.upi_id.trim() : '';
  let upiQrHtml = '';
  if (upiId && due > 0.05) {
    const payeeName = (settings.company_name || 'Merchant')
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '+');
    const amount = due.toFixed(2);
    // Simplified UPI URL with only the UPI ID (pa) and Payee Name (pn).
    // Removing the pre-filled amount (am) and note (tn) avoids verification errors for personal UPI accounts.
    const upiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&cu=INR`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUrl)}`;

    upiQrHtml = `
      <div style="margin-top: 14px; display: flex; align-items: center; gap: 10px; border: 1px solid #ddd; padding: 6px; border-radius: 4px; max-width: 250px; background-color: #fafafa; page-break-inside: avoid;" class="upi-qr-container">
        <img src="${qrImageUrl}" alt="UPI QR Code" style="width: 100px; height: 100px; display: block; image-rendering: -webkit-optimize-contrast;">
        <div>
          <p style="font-size: 0.72rem; font-weight: 700; margin: 0 0 2px 0; color: #111;">Scan to Pay</p>
          <p style="font-size: 0.72rem; color: #2563eb; margin: 0 0 2px 0; font-family: var(--font-mono); font-weight: 700;">Enter: ₹${amount}</p>
          <p style="font-size: 0.55rem; color: #555; margin: 0; line-height: 1.2;">Using GPay, PhonePe, Paytm, BHIM</p>
        </div>
      </div>
    `;
  }

  // Split calculations back
  let totalTaxable = 0;
  let totalGst = 0;
  inv.items.forEach(it => {
    const gross = it.qty * it.rate;
    const disc = gross * (it.discount_rate / 100);
    const afterDisc = gross - disc;
    const taxable = afterDisc / (1 + it.gst_rate / 100);
    totalTaxable += taxable;
    totalGst += (afterDisc - taxable);
  });

  // Indian GST Compliance split checks
  const vendorGst = settings.gstin ? settings.gstin.trim() : '';
  const customerGst = (() => {
    if (!inv.customer_id) return '';
    const c = db.find('customers', inv.customer_id);
    return c && c.gstin ? c.gstin.trim() : '';
  })();
  const vendorStateCode = vendorGst.substring(0, 2);
  const customerStateCode = customerGst.substring(0, 2);
  const isInterstate = vendorStateCode && customerStateCode && (vendorStateCode !== customerStateCode);

  return `
    <!-- Printable Receipt Layout Frame -->
    <div class="invoice-print-container" style="border: 1px solid hsl(var(--border-color)); padding: 16px; border-radius: var(--radius-sm); background: white; color: black !important;">
      
      <!-- Company Branding Header -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: start;">
        <div>
          ${settings.logo_base64 
            ? `<div style="margin-bottom: 6px;">
                 <img src="${settings.logo_base64}" alt="Logo" style="max-height: 45px; display: block; margin-bottom: 4px;">
                 <h2 style="font-family: var(--font-brand); font-weight: 800; color: #1e1b4b; margin: 0; font-size: 1.1rem; line-height: 1.2;">${settings.company_name}</h2>
               </div>` 
            : `<h2 style="font-family: var(--font-brand); font-weight: 800; color: #1e1b4b; margin-bottom: 4px; font-size: 1.2rem;">${settings.company_name}</h2>`
          }
          <p style="font-size: 0.75rem; color: #555; line-height: 1.3; margin-bottom: 2px;">${settings.address || 'Company Address Line'}</p>
          <p style="font-size: 0.75rem; color: #555; margin-bottom: 2px;">Phone: ${settings.phone || '—'} | Email: ${settings.email || '—'}</p>
          ${settings.gstin ? `<p style="font-size: 0.75rem; font-weight: 600; color: #111; margin-bottom: 2px;">GSTIN: ${settings.gstin}</p>` : ''}
        </div>

        <div style="text-align: right;">
          <h2 style="font-family: var(--font-brand); font-weight: 700; color: #1e1b4b; text-transform: uppercase; margin-bottom: 2px; font-size: 1.15rem;">Tax Invoice</h2>
          <p style="font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem; margin-bottom: 2px;">No: ${inv.invoice_number}</p>
          <p style="font-size: 0.75rem; color: #555; margin-bottom: 2px;">Date: ${formatDateToDDMMYY(inv.date)}</p>
        </div>
      </div>

      <hr style="border: none; border-top: 1.5px solid #000; margin: 10px 0;">

      <!-- Customer Reference Info -->
      <div style="margin-bottom: 12px;">
        <h4 style="text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; color: #666; margin-bottom: 4px;">Billed To Customer:</h4>
        <p style="font-weight: 700; font-size: 0.85rem; color: #111; margin-bottom: 2px;">${inv.customer_name}</p>
        ${inv.customer_id ? `
          <!-- Fetch customer metadata -->
          ${(() => {
            const c = db.find('customers', inv.customer_id);
            if (!c) return '';
            return `
              <p style="font-size: 0.75rem; color: #555; line-height: 1.2; margin-bottom: 2px;">${c.address || ''}</p>
              <p style="font-size: 0.75rem; color: #555; margin-bottom: 2px;">Phone: ${c.phone || '—'} ${c.gstin ? `| GSTIN: ${c.gstin}` : ''}</p>
            `;
          })()}
        ` : `<p style="font-size: 0.75rem; color: #555; margin-bottom: 2px;">Counter Sales Receipt</p>`}
      </div>

      <!-- Invoiced Items Table -->
      <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 0.75rem;">
        <thead>
          <tr style="border-bottom: 1.5px solid #000; text-align: left;">
            <th style="padding: 5px 4px; font-weight: 700;">Product Name / Description</th>
            <th style="padding: 5px 4px; font-weight: 700; text-align: center; width: 45px;">Qty</th>
            <th style="padding: 5px 4px; font-weight: 700; text-align: right; width: 75px;">Rate</th>
            <th style="padding: 5px 4px; font-weight: 700; text-align: center; width: 50px;">Disc %</th>
            <th style="padding: 5px 4px; font-weight: 700; text-align: right; width: 80px;">After Disc</th>
            <th style="padding: 5px 4px; font-weight: 700; text-align: right; width: 85px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${inv.items.map(it => {
            const discPrice = it.rate * (1 - it.discount_rate / 100);
            const rowTotal = it.qty * discPrice;
            const desc = it.description || (() => {
              const p = db.find('products', it.product_id);
              return p ? p.description : '';
            })();
            return `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 5px 4px; font-weight: 600;">
                  <div>${it.product_name}</div>
                  ${desc ? `<div class="print-item-desc" style="font-size: 0.68rem; font-weight: 400; color: #555; margin-top: 1px; line-height: 1.1;">${desc}</div>` : ''}
                </td>
                <td style="padding: 5px 4px; text-align: center;">${it.qty}</td>
                <td style="padding: 5px 4px; text-align: right;">₹${it.rate.toFixed(2)}</td>
                <td style="padding: 5px 4px; text-align: center;">${it.discount_rate > 0 ? `${it.discount_rate}%` : '—'}</td>
                <td style="padding: 5px 4px; text-align: right;">₹${discPrice.toFixed(2)}</td>
                <td style="padding: 5px 4px; text-align: right; font-weight: 600;">₹${rowTotal.toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Grand Calculations summary block -->
      <div class="invoice-print-summary" style="display: flex; justify-content: space-between; font-size: 0.75rem; align-items: start;">
        
        <!-- Terms and payment splits detail -->
        <div style="max-width: 240px;">
          <h4 style="text-transform: uppercase; font-size: 0.65rem; color: #666; margin-bottom: 2px;">Terms:</h4>
          <p style="font-size: 0.7rem; color: #555; line-height: 1.25; margin-bottom: 8px;">${settings.invoice_terms}</p>
          
          <h4 style="text-transform: uppercase; font-size: 0.65rem; color: #666; margin-bottom: 2px;">Payment Split details:</h4>
          <ul style="list-style: none; font-size: 0.7rem; color: #444; line-height: 1.2; padding-left: 0; margin: 0 0 8px 0;">
            ${inv.cash_paid > 0 ? `<li>${settings.account_cash_label || 'Cash'}: ₹${parseFloat(inv.cash_paid).toFixed(2)}</li>` : ''}
            ${inv.upi_paid > 0 ? `<li>${settings.account_upi_label || 'UPI'}: ₹${parseFloat(inv.upi_paid).toFixed(2)}</li>` : ''}
            ${inv.bank_paid > 0 ? `<li>${settings.account_bank_label || 'Bank'}: ₹${parseFloat(inv.bank_paid).toFixed(2)}</li>` : ''}
          </ul>

          ${(() => {
            if (settings.bank_name || settings.bank_account_number || settings.ifsc_code || settings.upi_id) {
              return `
                <div style="margin-top: 10px; border: 1px dashed #ccc; padding: 6px; border-radius: 4px; background-color: #fafafa; font-size: 0.7rem; color: #333;" class="print-bank-details">
                  <h4 style="text-transform: uppercase; font-size: 0.62rem; color: #666; margin: 0 0 4px 0; font-weight: 700;">Bank Details:</h4>
                  ${settings.bank_name ? `<p style="margin: 0 0 2px 0;"><b>Bank:</b> ${settings.bank_name}</p>` : ''}
                  ${settings.bank_account_number ? `<p style="margin: 0 0 2px 0;"><b>A/C No:</b> ${settings.bank_account_number}</p>` : ''}
                  ${settings.ifsc_code ? `<p style="margin: 0 0 2px 0;"><b>IFSC:</b> ${settings.ifsc_code}</p>` : ''}
                  ${settings.upi_id ? `<p style="margin: 0;"><b>UPI:</b> ${settings.upi_id}</p>` : ''}
                </div>
              `;
            }
            return '';
          })()}
        </div>

        <!-- Calculations -->
        <div style="width: 190px; display: flex; flex-direction: column; gap: 3px; text-align: right;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666;">Taxable Subtotal:</span>
            <span>₹${totalTaxable.toFixed(2)}</span>
          </div>
          ${isInterstate ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">IGST (Interstate):</span>
              <span>₹${totalGst.toFixed(2)}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">CGST (Central Tax):</span>
              <span>₹${(totalGst / 2).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">SGST (State Tax):</span>
              <span>₹${(totalGst / 2).toFixed(2)}</span>
            </div>
          `}
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>Grand Total:</span>
            <span>₹${(total + finalDisc).toFixed(2)}</span>
          </div>
          ${finalDisc > 0 ? `
            <div style="display: flex; justify-content: space-between; color: green; font-weight: 600;">
              <span>Extra Final Disc:</span>
              <span>-₹${finalDisc.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: 800; border-top: 1px solid #000; padding-top: 3px;">
            <span>Net Billed Total:</span>
            <span>₹${total.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #1e1b4b; font-weight: 600;">
            <span>Amount Settled:</span>
            <span>₹${paid.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: red; font-weight: 700; border-top: 1.5px dashed #000; padding-top: 3px;">
            <span>Balance Outstanding:</span>
            <span>₹${due.toFixed(2)}</span>
          </div>
        </div>

      </div>

      <!-- Signature Dropzone -->
      ${settings.sig_base64 ? `
        <div class="invoice-print-signature" style="text-align: right; margin-top: 40px;">
          <img src="${settings.sig_base64}" alt="Authorized Signature" style="max-height: 45px; margin-bottom: 4px;">
          <p style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #111;">Authorized Signatory</p>
        </div>
      ` : ''}

    </div>
  `;
}

function showCollectPaymentModal(invoiceId) {
  const modalContainer = document.getElementById('modal-container');
  const inv = db.find('invoices', invoiceId);
  if (!inv) return;

  const settings = db.get('business_settings');
  const total = parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0);
  const due = parseFloat(inv.balance_due || 0);

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="collect-payment-modal-backdrop">
      <div class="modal-card" style="max-width: 420px;">
        <div class="modal-header">
          <h3><i data-lucide="hand-coins"></i> Collect Pending Payment</h3>
          <button class="modal-close-btn" id="btn-close-collect-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="collect-payment-submit-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Invoice / Customer Reference</label>
            <input type="text" class="form-control" value="${inv.invoice_number} — ${inv.customer_name}" disabled>
          </div>
          
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Total Payable / Balance Due</label>
            <input type="text" class="form-control" value="Payable: ₹${total.toFixed(2)} | Due: ₹${due.toFixed(2)}" disabled style="font-weight: 600; color: hsl(var(--danger));">
          </div>

          <div style="border: 1px solid hsl(var(--border-color)); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px; background: hsl(var(--bg-primary) / 0.3);">
            <h4 style="font-size: 0.85rem; margin-bottom: 10px; font-weight: 600;">Split Receipt Collection:</h4>
            
            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.8rem;">${settings.account_cash_label || 'Cash'} Received (₹)</label>
              <input type="number" step="0.01" class="form-control collect-split" name="cash" value="0.00" min="0">
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.8rem;">${settings.account_upi_label || 'UPI'} Received (₹)</label>
              <input type="number" step="0.01" class="form-control collect-split" name="upi" value="0.00" min="0">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">${settings.account_bank_label || 'Bank'} Received (₹)</label>
              <input type="number" step="0.01" class="form-control collect-split" name="bank" value="0.00" min="0">
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <span class="form-label">Total Entered:</span>
            <span id="collect-total-label" style="font-weight: 700; font-size: 1.1rem; color: hsl(var(--success));">₹0.00</span>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-collect">Cancel</button>
            <button type="submit" class="btn btn-success" id="btn-confirm-collect" disabled><i data-lucide="check"></i> Save Collection</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-collect-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-collect').addEventListener('click', closeModal);

  // Live Math updates
  const inputs = modalContainer.querySelectorAll('.collect-split');
  const totalLabel = document.getElementById('collect-total-label');
  const confirmBtn = document.getElementById('btn-confirm-collect');

  const updateEnteredSum = () => {
    let sum = 0;
    inputs.forEach(inp => {
      sum += parseFloat(inp.value || 0);
    });
    totalLabel.textContent = `₹${sum.toFixed(2)}`;

    if (sum > 0.01 && sum <= due + 0.05) {
      confirmBtn.disabled = false;
      totalLabel.style.color = 'hsl(var(--success))';
    } else {
      confirmBtn.disabled = true;
      if (sum > due + 0.05) {
        totalLabel.style.color = 'hsl(var(--danger))';
      } else {
        totalLabel.style.color = 'hsl(var(--text-muted))';
      }
    }
  };

  updateEnteredSum();

  inputs.forEach(inp => {
    inp.addEventListener('input', updateEnteredSum);
    inp.addEventListener('change', () => {
      if (parseFloat(inp.value) < 0 || isNaN(parseFloat(inp.value))) {
        inp.value = "0.00";
      }
      updateEnteredSum();
    });
  });

  document.getElementById('collect-payment-submit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const cashAmt = parseFloat(formData.get('cash') || 0);
    const upiAmt = parseFloat(formData.get('upi') || 0);
    const bankAmt = parseFloat(formData.get('bank') || 0);
    const sum = cashAmt + upiAmt + bankAmt;

    if (sum <= 0.01) {
      alert("Collection amount must be greater than 0.");
      return;
    }
    if (sum > due + 0.05) {
      alert(`Invalid Amount! Collection cannot exceed outstanding balance of ₹${due.toFixed(2)}`);
      return;
    }

    try {
      // Fetch latest record to avoid race conditions
      const currentInv = db.find('invoices', invoiceId);
      if (!currentInv) throw new Error("Invoice not found.");

      const timestamp = new Date().toISOString();
      const localDate = getLocalYYYYMMDD();

      // 1. Insert new payment records for each method with amount > 0
      if (cashAmt > 0) {
        db.insert('payment_ins', {
          invoice_id: currentInv.id,
          invoice_number: currentInv.invoice_number,
          customer_id: currentInv.customer_id || null,
          date: localDate,
          amount: cashAmt,
          method: 'Cash',
          note: `Part payment (Cash) for Invoice #${currentInv.invoice_number}`
        });
      }
      if (upiAmt > 0) {
        db.insert('payment_ins', {
          invoice_id: currentInv.id,
          invoice_number: currentInv.invoice_number,
          customer_id: currentInv.customer_id || null,
          date: localDate,
          amount: upiAmt,
          method: 'UPI',
          note: `Part payment (UPI) for Invoice #${currentInv.invoice_number}`
        });
      }
      if (bankAmt > 0) {
        db.insert('payment_ins', {
          invoice_id: currentInv.id,
          invoice_number: currentInv.invoice_number,
          customer_id: currentInv.customer_id || null,
          date: localDate,
          amount: bankAmt,
          method: 'Bank',
          note: `Part payment (Bank) for Invoice #${currentInv.invoice_number}`
        });
      }

      // 2. Query all active payments for this invoice to recalculate totals
      const payments = db.get('payment_ins').filter(p => p.invoice_id === invoiceId && !p.is_deleted);
      let totalCashPaid = 0;
      let totalUpiPaid = 0;
      let totalBankPaid = 0;
      let initialCash = 0;
      let initialUpi = 0;
      let initialBank = 0;
      payments.forEach(p => {
        const amt = parseFloat(p.amount || 0);
        if (p.method === 'Cash') {
          totalCashPaid += amt;
          if (p.is_initial) initialCash += amt;
        } else if (p.method === 'UPI') {
          totalUpiPaid += amt;
          if (p.is_initial) initialUpi += amt;
        } else if (p.method === 'Bank') {
          totalBankPaid += amt;
          if (p.is_initial) initialBank += amt;
        }
      });

      currentInv.cash_paid = initialCash;
      currentInv.upi_paid = initialUpi;
      currentInv.bank_paid = initialBank;

      const currentTotal = parseFloat(currentInv.grand_total || 0) - parseFloat(currentInv.final_discount || 0);
      const currentPaidSum = totalCashPaid + totalUpiPaid + totalBankPaid;
      // Deduct sales returns linked to this invoice
      const salesReturnsTotal = db.get('sales_returns')
        .filter(r => r.invoice_id === invoiceId && !r.is_deleted)
        .reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0);
      currentInv.balance_due = Math.max(0, currentTotal - currentPaidSum - salesReturnsTotal);

      // 3. Update the invoice with skipOverwritePayments = true
      db.update('invoices', invoiceId, currentInv, true);
      closeModal();
      
      // Reload UI register
      const container = document.querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild;
      if (container) {
        InvoicesListView(container);
      }
      alert(`Successfully collected ₹${sum.toFixed(2)} payment on Invoice ${currentInv.invoice_number}.`);
    } catch (err) {
      alert(`Payment Collection failed: ${err.message}`);
    }
  });
}

function showEditPaymentModal(paymentId, invoiceId) {
  const modalContainer = document.getElementById('modal-container');
  const payment = db.find('payment_ins', paymentId);
  const inv = db.find('invoices', invoiceId);
  if (!payment || !inv) return;

  const settings = db.get('business_settings');
  const dueWithoutThisPayment = parseFloat(inv.balance_due || 0) + parseFloat(payment.amount || 0);

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="edit-payment-modal-backdrop">
      <div class="modal-card" style="max-width: 400px;">
        <div class="modal-header">
          <h3><i data-lucide="pencil"></i> Edit Payment</h3>
          <button class="modal-close-btn" id="btn-close-edit-pay-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="edit-payment-submit-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Method</label>
            <select class="form-control" name="method" required>
              <option value="Cash" ${payment.method === 'Cash' ? 'selected' : ''}>${settings.account_cash_label || 'Cash'}</option>
              <option value="UPI" ${payment.method === 'UPI' ? 'selected' : ''}>${settings.account_upi_label || 'UPI'}</option>
              <option value="Bank" ${payment.method === 'Bank' ? 'selected' : ''}>${settings.account_bank_label || 'Bank'}</option>
            </select>
          </div>
          
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Amount (₹)</label>
            <input type="number" step="0.01" class="form-control" name="amount" value="${parseFloat(payment.amount).toFixed(2)}" min="0.01" required>
            <div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 4px;">Max allowed: ₹${dueWithoutThisPayment.toFixed(2)} (including current amount)</div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Note / Reference</label>
            <input type="text" class="form-control" name="note" value="${payment.note || ''}">
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-edit-pay">Cancel</button>
            <button type="submit" class="btn btn-success"><i data-lucide="check"></i> Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-edit-pay-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-edit-pay').addEventListener('click', closeModal);

  document.getElementById('edit-payment-submit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount') || 0);
    const method = formData.get('method');
    const note = formData.get('note');

    if (amount <= 0.01) {
      alert("Amount must be greater than 0.");
      return;
    }
    if (amount > dueWithoutThisPayment + 0.05) {
      alert(`Amount cannot exceed the total remaining balance of ₹${dueWithoutThisPayment.toFixed(2)}`);
      return;
    }

    try {
      // 1. Update payment record
      payment.amount = amount;
      payment.method = method;
      payment.note = note;
      db.update('payment_ins', paymentId, payment);

      // 2. Recalculate invoice totals
      const currentInv = db.find('invoices', invoiceId);
      if (currentInv) {
        const payments = db.get('payment_ins').filter(p => p.invoice_id === invoiceId && !p.is_deleted);
        let totalCashPaid = 0;
        let totalUpiPaid = 0;
        let totalBankPaid = 0;
        let initialCash = 0;
        let initialUpi = 0;
        let initialBank = 0;
        payments.forEach(p => {
          const amt = parseFloat(p.amount || 0);
          if (p.method === 'Cash') {
            totalCashPaid += amt;
            if (p.is_initial) initialCash += amt;
          } else if (p.method === 'UPI') {
            totalUpiPaid += amt;
            if (p.is_initial) initialUpi += amt;
          } else if (p.method === 'Bank') {
            totalBankPaid += amt;
            if (p.is_initial) initialBank += amt;
          }
        });

        currentInv.cash_paid = initialCash;
        currentInv.upi_paid = initialUpi;
        currentInv.bank_paid = initialBank;

        const currentTotal = parseFloat(currentInv.grand_total || 0) - parseFloat(currentInv.final_discount || 0);
        const currentPaidSum = totalCashPaid + totalUpiPaid + totalBankPaid;
        currentInv.balance_due = Math.max(0, currentTotal - currentPaidSum);

        db.update('invoices', invoiceId, currentInv, true);
      }

      closeModal();
      
      // Reload UI register
      const parentViewport = document.getElementById('app-viewport').querySelector('.view-container') || document.getElementById('app-viewport').firstElementChild;
      InvoicesListView(parentViewport);
      alert("Payment updated successfully.");
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  });
}

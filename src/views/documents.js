/* ==========================================================================
   GONABHAVI — DOCUMENTS MANAGER (src/views/documents.js)
   ========================================================================== */

import { db, generateUUID, formatDateToDDMMYY, getLocalYYYYMMDD } from '../db.js';
import { showCustomerAddModal } from './customers.js';

// Base helper to render lists and creators for Estimates, Quotations, Sale Orders, and Delivery Challans
function renderDocumentModule({
  container,
  title,
  icon,
  prefix,
  entity,
  hasPricing = true,
  hasExpiry = false
}) {
  const list = db.get(entity);
  const customers = db.get('customers');
  const products = db.get('products');

  // Sort newest first
  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Render main screen (register list + preview frame)
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start;">
      
      <!-- Left side: List Register -->
      <div class="view-card animate-fade-in" style="margin-bottom: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
          <h2 class="card-title" style="margin-bottom: 0;">
            <i data-lucide="${icon}" style="color: hsl(var(--primary));"></i>
            ${title}s Register
          </h2>
          <button id="doc-btn-new" class="btn btn-primary">
            <i data-lucide="plus"></i> New ${title}
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 0; border: none;">
          <table class="app-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Customer</th>
                ${hasPricing ? `<th class="text-right">Total Amount</th>` : ''}
                ${hasExpiry ? `<th>Valid Until</th>` : ''}
                <th class="text-center" style="width: 50px;"></th>
              </tr>
            </thead>
            <tbody id="doc-table-body">
              ${list.length === 0 ? `
                <tr>
                  <td colspan="${hasPricing ? (hasExpiry ? 5 : 4) : (hasExpiry ? 4 : 3)}" class="text-center text-muted" style="padding: 40px 20px;">
                    <i data-lucide="${icon}" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p>No ${title.toLowerCase()}s recorded yet.</p>
                  </td>
                </tr>
              ` : list.map((doc, idx) => {
                const isExpired = hasExpiry && doc.valid_until && new Date(doc.valid_until) < new Date(new Date().setHours(0,0,0,0));
                return `
                  <tr class="doc-row-select" data-id="${doc.id}" style="cursor: pointer;">
                    <td style="font-family: var(--font-mono); font-weight: 600;">${doc.document_number}</td>
                    <td>${formatDateToDDMMYY(doc.date)}</td>
                    <td style="font-weight: 500;">${doc.customer_name || 'Walk-in Customer'}</td>
                    ${hasPricing ? `<td class="text-right" style="font-weight: 600;">₹${parseFloat(doc.total_amount || 0).toFixed(2)}</td>` : ''}
                    ${hasExpiry ? `
                      <td>
                        <span class="badge ${isExpired ? 'color-danger' : 'color-success'}">
                          ${formatDateToDDMMYY(doc.valid_until)} ${isExpired ? '(Expired)' : ''}
                        </span>
                      </td>
                    ` : ''}
                    <td class="text-center">
                      <button class="btn btn-danger btn-sm doc-delete-btn" data-id="${doc.id}" style="padding: 6px; border-radius: 50%;" title="Delete">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right side: Detailed Printable Preview & Conversion Actions -->
      <div class="view-card animate-fade-in" id="doc-preview-card" style="margin-bottom: 0; position: sticky; top: 90px;">
        <div style="text-align: center; padding: 50px 20px; color: hsl(var(--text-secondary));">
          <i data-lucide="file-text" style="width: 64px; height: 64px; stroke-width: 1; margin-bottom: 16px; color: hsl(var(--text-muted));"></i>
          <h3>Document Preview</h3>
          <p style="margin-top: 8px;">Select a ${title.toLowerCase()} from the register to display details, print layout, or convert into a live invoice.</p>
        </div>
      </div>

    </div>

    <!-- Modal Form Backdrop -->
    <div id="doc-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>
    
    <!-- Large Modal Form for Creator -->
    <div id="doc-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 95%; max-width: 850px; max-height: 90vh; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002; overflow: hidden;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 20px;">
        <h3 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="${icon}" style="color: hsl(var(--primary));"></i>
          Create New ${title}
        </h3>
        <button id="doc-modal-close-btn" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
      </div>

      <form id="doc-creator-form" style="flex: 1; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
        
        <!-- Header Info -->
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 0;">
          <div class="form-group">
            <label class="form-label">${title} Number</label>
            <input type="text" id="doc-form-number" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" id="doc-form-date" class="form-control" required>
          </div>
          ${hasExpiry ? `
            <div class="form-group">
              <label class="form-label">Valid Until</label>
              <input type="date" id="doc-form-expiry" class="form-control" required>
            </div>
          ` : ''}
          <div class="form-group">
            <label class="form-label">Customer</label>
            <select id="doc-form-customer" class="form-control">
              <option value="">Walk-in Customer</option>
              ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Add Items Row -->
        <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; background-color: hsl(var(--bg-primary)); padding: 12px; border-radius: var(--radius-sm);">
          <div class="form-group" style="flex: 2; min-width: 200px;">
            <label class="form-label">Product</label>
            <select id="doc-add-product" class="form-control">
              <option value="">-- Select Product --</option>
              ${products.map(p => `<option value="${p.id}">${p.name} (${hasPricing ? `MRP: ₹${p.sale_price}` : `Barcode: ${p.qr}`})</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="width: 100px;">
            <label class="form-label">Quantity</label>
            <input type="number" id="doc-add-qty" class="form-control" min="1" value="1">
          </div>
          <button type="button" id="doc-add-item-btn" class="btn btn-secondary" style="padding: 10px 18px;">
            <i data-lucide="plus"></i> Add Item
          </button>
        </div>

        <!-- Scrollable Items Grid -->
        <div style="flex: 1; overflow-y: auto; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm);">
          <table class="app-table">
            <thead>
              <tr style="background-color: hsl(var(--bg-primary));">
                <th>Product Description</th>
                <th style="width: 100px; text-align: center;">Qty</th>
                ${hasPricing ? `
                  <th style="width: 120px; text-align: right;">Rate</th>
                  <th style="width: 100px; text-align: center;">Disc %</th>
                  <th style="width: 100px; text-align: center;">GST %</th>
                  <th style="width: 120px; text-align: right;">Line Total</th>
                ` : ''}
                <th style="width: 50px;"></th>
              </tr>
            </thead>
            <tbody id="doc-form-items-body">
              <!-- Dynamically populated items -->
            </tbody>
          </table>
        </div>

        <!-- Notes and Totals Row -->
        <div style="display: flex; gap: 20px; justify-content: space-between; align-items: flex-end; flex-wrap: wrap;">
          <div class="form-group" style="flex: 1; min-width: 250px;">
            <label class="form-label">Internal Notes / Terms</label>
            <textarea id="doc-form-notes" class="form-control" rows="2" placeholder="Provide extra billing specifications..."></textarea>
          </div>
          
          ${hasPricing ? `
            <div style="display: flex; flex-direction: column; gap: 4px; font-weight: 600; text-align: right; min-width: 180px;">
              <div style="color: hsl(var(--text-secondary)); font-size: 0.85rem;">Grand Total:</div>
              <div id="doc-form-grandtotal" style="font-family: var(--font-brand); font-size: 1.6rem; font-weight: 700; color: hsl(var(--primary));">₹0.00</div>
            </div>
          ` : ''}
        </div>

        <!-- Dialog Footer Actions -->
        <div style="display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid hsl(var(--border-color)); padding-top: 16px;">
          <button type="button" id="doc-form-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save ${title}</button>
        </div>
      </form>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Dialog State and Form variables
  const modal = document.getElementById('doc-modal');
  const backdrop = document.getElementById('doc-modal-backdrop');
  const creatorForm = document.getElementById('doc-creator-form');
  const itemsBody = document.getElementById('doc-form-items-body');
  
  let formItems = [];

  // 1. Generate Next Serial Number
  function getNextSerialNumber() {
    const rawAll = db.getAllRaw(entity);
    let max = 0;
    rawAll.forEach(d => {
      const match = d.document_number?.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const val = parseInt(match[1]);
        if (val > max) max = val;
      }
    });
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  // 2. Open creator modal
  document.getElementById('doc-btn-new').addEventListener('click', () => {
    document.getElementById('doc-form-number').value = getNextSerialNumber();
    document.getElementById('doc-form-date').value = getLocalYYYYMMDD();
    if (hasExpiry) {
      // 30 days default expiry
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      document.getElementById('doc-form-expiry').value = getLocalYYYYMMDD(thirtyDays);
    }
    document.getElementById('doc-form-customer').value = '';
    document.getElementById('doc-form-notes').value = '';
    formItems = [];
    refreshFormItemsGrid();
    
    modal.style.display = 'flex';
    backdrop.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  });

  // 3. Close creator modal
  function closeCreator() {
    modal.style.display = 'none';
    backdrop.classList.remove('show');
  }
  document.getElementById('doc-modal-close-btn').addEventListener('click', closeCreator);
  document.getElementById('doc-form-cancel-btn').addEventListener('click', closeCreator);
  backdrop.addEventListener('click', closeCreator);

  // 4. Add items into creator grid
  document.getElementById('doc-add-item-btn').addEventListener('click', () => {
    const prodId = document.getElementById('doc-add-product').value;
    const qty = parseInt(document.getElementById('doc-add-qty').value || 1);
    if (!prodId) {
      alert("Please select a product first.");
      return;
    }

    const prod = db.find('products', prodId);
    if (prod) {
      // Add to array
      const existing = formItems.find(it => it.product_id === prod.id);
      if (existing) {
        existing.qty += qty;
      } else {
        formItems.push({
          product_id: prod.id,
          product_name: prod.name,
          qty: qty,
          rate: hasPricing ? parseFloat(prod.sale_price || 0) : 0,
          discount_rate: hasPricing ? parseFloat(prod.default_discount || 0) : 0,
          gst_rate: hasPricing ? parseInt(prod.gst_rate || 0) : 0
        });
      }
      refreshFormItemsGrid();
      // Reset selector
      document.getElementById('doc-add-product').value = '';
      document.getElementById('doc-add-qty').value = '1';
    }
  });

  // 5. Refresh Creator items table
  function refreshFormItemsGrid() {
    if (formItems.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="${hasPricing ? 7 : 3}" class="text-center text-muted" style="padding: 20px;">No product items added. Select a product above.</td></tr>`;
      if (hasPricing) document.getElementById('doc-form-grandtotal').textContent = '₹0.00';
      return;
    }

    let grandTotal = 0;

    itemsBody.innerHTML = formItems.map((it, idx) => {
      const gross = it.qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const total = gross - disc;
      grandTotal += total;

      return `
        <tr data-index="${idx}">
          <td style="font-weight: 500;">${it.product_name}</td>
          <td>
            <input type="number" class="form-control doc-qty-edit text-center" value="${it.qty}" min="1" style="padding: 4px; font-size: 0.85rem;">
          </td>
          ${hasPricing ? `
            <td>
              <input type="number" step="0.01" class="form-control doc-rate-edit" value="${it.rate}" min="0" style="padding: 4px; font-size: 0.85rem;">
            </td>
            <td>
              <input type="number" step="0.1" class="form-control doc-disc-edit text-center" value="${it.discount_rate}" min="0" max="100" style="padding: 4px; font-size: 0.85rem;">
            </td>
            <td>
              <select class="form-control doc-gst-edit" style="padding: 4px; font-size: 0.85rem;">
                <option value="0" ${it.gst_rate === 0 ? 'selected' : ''}>0%</option>
                <option value="5" ${it.gst_rate === 5 ? 'selected' : ''}>5%</option>
                <option value="12" ${it.gst_rate === 12 ? 'selected' : ''}>12%</option>
                <option value="18" ${it.gst_rate === 18 ? 'selected' : ''}>18%</option>
                <option value="28" ${it.gst_rate === 28 ? 'selected' : ''}>28%</option>
              </select>
            </td>
            <td class="text-right" style="font-weight: 600;">₹${total.toFixed(2)}</td>
          ` : ''}
          <td class="text-center">
            <button type="button" class="doc-item-del-btn" style="color: hsl(var(--danger)); cursor: pointer;"><i data-lucide="x" style="width: 16px; height: 16px;"></i></button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    if (hasPricing) {
      document.getElementById('doc-form-grandtotal').textContent = `₹${grandTotal.toFixed(2)}`;
    }

    // Attach row events
    itemsBody.querySelectorAll('tr').forEach(row => {
      const idx = parseInt(row.getAttribute('data-index'));
      const it = formItems[idx];

      row.querySelector('.doc-qty-edit').addEventListener('change', (e) => {
        it.qty = parseInt(e.target.value || 1);
        refreshFormItemsGrid();
      });

      if (hasPricing) {
        row.querySelector('.doc-rate-edit').addEventListener('change', (e) => {
          it.rate = parseFloat(e.target.value || 0);
          refreshFormItemsGrid();
        });
        row.querySelector('.doc-disc-edit').addEventListener('change', (e) => {
          it.discount_rate = parseFloat(e.target.value || 0);
          refreshFormItemsGrid();
        });
        row.querySelector('.doc-gst-edit').addEventListener('change', (e) => {
          it.gst_rate = parseInt(e.target.value);
          refreshFormItemsGrid();
        });
      }

      row.querySelector('.doc-item-del-btn').addEventListener('click', () => {
        formItems.splice(idx, 1);
        refreshFormItemsGrid();
      });
    });
  }

  // 6. Form Save Event
  creatorForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const num = document.getElementById('doc-form-number').value.trim();
    const date = document.getElementById('doc-form-date').value;
    const expiry = hasExpiry ? document.getElementById('doc-form-expiry').value : null;
    const custId = document.getElementById('doc-form-customer').value;
    const notes = document.getElementById('doc-form-notes').value;

    if (formItems.length === 0) {
      alert("At least one product item row is required to save.");
      return;
    }

    // Validation checks
    const exists = db.getAllRaw(entity).find(d => d.document_number === num && !d.is_deleted);
    if (exists) {
      alert(`The document number "${num}" is already used by another active ${title.toLowerCase()}.`);
      return;
    }

    // Calculation total
    let totalAmt = 0;
    if (hasPricing) {
      formItems.forEach(it => {
        const gross = it.qty * it.rate;
        const disc = gross * (it.discount_rate / 100);
        totalAmt += (gross - disc);
      });
    }

    const selectedCust = customers.find(c => c.id === custId);

    const docRecord = {
      document_number: num,
      date,
      valid_until: expiry,
      customer_id: custId || null,
      customer_name: selectedCust ? selectedCust.name : 'Walk-in Customer',
      items: formItems,
      total_amount: totalAmt,
      notes
    };

    try {
      db.insert(entity, docRecord);
      closeCreator();
      // Reload module view
      renderDocumentModule({ container, title, icon, prefix, entity, hasPricing, hasExpiry });
    } catch (err) {
      alert(err.message);
    }
  });

  // 7. Show Document Printable Preview
  function renderInvoiceReceiptTemplate(docId) {
    const doc = db.find(entity, docId);
    const previewArea = document.getElementById('doc-preview-card');
    if (!doc) return;

    const company = db.get('business_settings');
    const isExpired = hasExpiry && doc.valid_until && new Date(doc.valid_until) < new Date(new Date().setHours(0,0,0,0));

    let taxSum = 0;
    let discSum = 0;
    let subSum = 0;

    if (hasPricing) {
      doc.items.forEach(it => {
        const gross = it.qty * it.rate;
        const disc = gross * (it.discount_rate / 100);
        const taxable = (gross - disc) / (1 + it.gst_rate / 100);
        
        discSum += disc;
        taxSum += ((gross - disc) - taxable);
        subSum += taxable;
      });
    }

    previewArea.innerHTML = `
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 16px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 12px;" class="no-print">
        <button id="doc-btn-print" class="btn btn-secondary" style="padding: 8px 12px;">
          <i data-lucide="printer"></i> Print / PDF
        </button>
        <button id="doc-btn-convert" class="btn btn-success" style="padding: 8px 12px;">
          <i data-lucide="refresh-cw"></i> Convert to Invoice
        </button>
      </div>

      <!-- Printable Area -->
      <div id="doc-print-area" class="print-layout" style="font-family: inherit; font-size: 0.9rem; color: #000; background: #fff; padding: 24px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color));">
        
        <!-- Document Type Banner -->
        <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            ${company.logo_base64 ? `<img src="${company.logo_base64}" alt="Logo" style="max-height: 45px; margin-bottom: 6px;"><br>` : ''}
            <h2 style="font-size: 1.5rem; margin-bottom: 4px; font-weight: 800;">${company.company_name || 'Gonabhavi Business'}</h2>
            <div style="font-size: 0.8rem; color: #555; line-height: 1.4;">
              ${company.address ? `${company.address}<br>` : ''}
              ${company.phone ? `Phone: ${company.phone}` : ''} 
              ${company.gstin ? ` | GSTIN: ${company.gstin}` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <h1 style="font-size: 1.8rem; color: hsl(var(--primary)); text-transform: uppercase; font-weight: 800; font-family: var(--font-brand);">${title}</h1>
            <div style="font-size: 0.85rem; font-weight: bold; margin-top: 4px;">Number: ${doc.document_number}</div>
            <div style="font-size: 0.8rem; color: #555;">Date: ${formatDateToDDMMYY(doc.date)}</div>
            ${hasExpiry ? `<div style="font-size: 0.8rem; font-weight: bold; color: ${isExpired ? '#e11d48' : '#059669'}; margin-top: 4px;">Valid Until: ${formatDateToDDMMYY(doc.valid_until)} ${isExpired ? '(Expired)' : ''}</div>` : ''}
          </div>
        </div>

        <!-- Party Billing -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px;">Billing To:</div>
          <div style="font-weight: 700; font-size: 1.05rem;">${doc.customer_name}</div>
          <div id="preview-customer-details" style="font-size: 0.8rem; color: #555; line-height: 1.4; margin-top: 2px;">
            <!-- Fetched dynamically below -->
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #333; font-weight: 700; background-color: #f9fafb;">
              <th style="padding: 8px;">Product Description</th>
              <th style="padding: 8px; text-align: center; width: 80px;">Qty</th>
              ${hasPricing ? `
                <th style="padding: 8px; text-align: right; width: 100px;">Rate</th>
                <th style="padding: 8px; text-align: center; width: 80px;">Disc %</th>
                <th style="padding: 8px; text-align: center; width: 80px;">GST %</th>
                <th style="padding: 8px; text-align: right; width: 110px;">Total</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>
            ${doc.items.map(it => {
              const rowTotal = it.qty * it.rate - (it.qty * it.rate * (it.discount_rate / 100));
              return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px; font-weight: 600;">${it.product_name}</td>
                  <td style="padding: 8px; text-align: center;">${it.qty}</td>
                  ${hasPricing ? `
                    <td style="padding: 8px; text-align: right;">₹${parseFloat(it.rate).toFixed(2)}</td>
                    <td style="padding: 8px; text-align: center;">${it.discount_rate}%</td>
                    <td style="padding: 8px; text-align: center;">${it.gst_rate}%</td>
                    <td style="padding: 8px; text-align: right; font-weight: 600;">₹${rowTotal.toFixed(2)}</td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Totals & Terms -->
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 200px;">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px;">Terms / Notes:</div>
            <div style="font-size: 0.8rem; color: #555; font-style: italic; white-space: pre-line; margin-bottom: 10px;">${doc.notes || 'This is a quotation proposal document valid as per terms.'}</div>
            
            ${(() => {
              if (company.bank_name || company.bank_account_number || company.ifsc_code || company.upi_id) {
                return `
                  <div style="margin-top: 10px; border: 1px dashed #ccc; padding: 6px; border-radius: 4px; background-color: #fafafa; font-size: 0.7rem; color: #333; max-width: 240px;" class="print-bank-details">
                    <h4 style="text-transform: uppercase; font-size: 0.62rem; color: #666; margin: 0 0 4px 0; font-weight: 700;">Bank Details:</h4>
                    ${company.bank_name ? `<p style="margin: 0 0 2px 0;"><b>Bank:</b> ${company.bank_name}</p>` : ''}
                    ${company.bank_account_number ? `<p style="margin: 0 0 2px 0;"><b>A/C No:</b> ${company.bank_account_number}</p>` : ''}
                    ${company.ifsc_code ? `<p style="margin: 0 0 2px 0;"><b>IFSC:</b> ${company.ifsc_code}</p>` : ''}
                    ${company.upi_id ? `<p style="margin: 0;"><b>UPI:</b> ${company.upi_id}</p>` : ''}
                  </div>
                `;
              }
              return '';
            })()}
          </div>
          
          ${hasPricing ? `
            <div style="width: 250px; font-size: 0.85rem; line-height: 1.6;">
              <div style="display: flex; justify-content: space-between;">
                <span>Taxable Value:</span>
                <span>₹${subSum.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Total Discount:</span>
                <span style="color: #059669;">-₹${discSum.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>GST Tax Collected:</span>
                <span>₹${taxSum.toFixed(2)}</span>
              </div>
              <hr style="border: none; border-top: 1px solid #ccc; margin: 6px 0;">
              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.1rem; color: #000;">
                <span>Grand Total:</span>
                <span>₹${parseFloat(doc.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Authorized Signature -->
        ${company.authorized_signature ? `
          <div style="display: flex; justify-content: flex-end; margin-top: 30px; text-align: center;">
            <div style="width: 180px;">
              <img src="${company.authorized_signature}" style="max-height: 60px; max-width: 150px; margin-bottom: 4px;">
              <div style="border-top: 1px solid #333; font-size: 0.75rem; font-weight: bold; padding-top: 4px;">Authorized Signatory</div>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Populate customer details in preview
    const cust = db.find('customers', doc.customer_id);
    if (cust) {
      document.getElementById('preview-customer-details').innerHTML = `
        ${cust.address ? `${cust.address}<br>` : ''}
        ${cust.phone ? `Phone: ${cust.phone}` : ''}
        ${cust.gstin ? ` | GSTIN: ${cust.gstin}` : ''}
      `;
    }

    // Print Action
    document.getElementById('doc-btn-print').addEventListener('click', () => {
      const printContents = document.getElementById('doc-print-area').innerHTML;
      
      document.body.innerHTML = `
        <style>
          @page {
            size: A5 portrait;
            margin: 5mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0;
            padding: 0;
          }
          #doc-print-area {
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            font-size: 11px !important;
          }
        </style>
        <div style="padding: 10px; background: #fff; color: #000;">
          ${printContents}
        </div>
      `;
      window.print();
      
      // Reload route back
      window.location.reload();
    });

    // Convert Action (Section 8 / 15 / 38 rules)
    document.getElementById('doc-btn-convert').addEventListener('click', () => {
      // Package into temporary conversion store
      const convertPackage = {
        customer_id: doc.customer_id,
        customer_name: doc.customer_name,
        items: doc.items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          qty: it.qty,
          rate: hasPricing ? it.rate : parseFloat(db.find('products', it.product_id)?.sale_price || 0),
          discount_rate: hasPricing ? it.discount_rate : parseFloat(db.find('products', it.product_id)?.default_discount || 0),
          gst_rate: hasPricing ? it.gst_rate : parseInt(db.find('products', it.product_id)?.gst_rate || 0)
        })),
        final_discount: 0
      };
      
      localStorage.setItem('gb_convert_doc', JSON.stringify(convertPackage));
      db.logAudit(`Converted Document`, `${title}: Converted serial #${doc.document_number} into a live sales invoice.`);
      
      // Redirect to billing screen
      window.location.hash = '#billing';
    });
  }

  // Row selection trigger
  document.querySelectorAll('.doc-row-select').forEach(row => {
    row.addEventListener('click', (e) => {
      // Do not open details if delete was clicked
      if (e.target.closest('.doc-delete-btn')) return;

      document.querySelectorAll('.doc-row-select').forEach(r => r.classList.remove('active-row'));
      row.classList.add('active-row');
      
      const id = row.getAttribute('data-id');
      renderInvoiceReceiptTemplate(id);
    });
  });

  // Table Row Delete Action
  document.querySelectorAll('.doc-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm(`Are you sure you want to delete this ${title.toLowerCase()}?`)) {
        db.delete(entity, id);
        renderDocumentModule({ container, title, icon, prefix, entity, hasPricing, hasExpiry });
      }
    });
  });

  // Auto pre-select first row if exists
  if (list.length > 0) {
    const firstRow = document.querySelector('.doc-row-select');
    if (firstRow) firstRow.click();
  }
}

/**
 * NAMED EXPORT: SALE ORDERS REGISTER
 */
export async function SaleOrderView(container) {
  const entity = 'sale_orders';
  const prefix = 'SO';
  const title = 'Sale Order';
  const icon = 'shopping-bag';
  
  // Local state
  let list = db.get(entity);
  let customers = db.get('customers');
  let products = db.get('products');
  let activeSO = {
    id: null,
    document_number: '',
    date: '',
    customer_id: '',
    customer_name: '',
    items: [],
    cash_paid: 0,
    upi_paid: 0,
    bank_paid: 0,
    notes: '',
    status: 'Open'
  };
  
  function refreshList() {
    list = db.get(entity);
    // Sort newest first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    drawRegister();
  }

  function drawRegister() {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start;">
        
        <!-- Left side: List Register -->
        <div class="view-card animate-fade-in" style="margin-bottom: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
            <h2 class="card-title" style="margin-bottom: 0;">
              <i data-lucide="${icon}" style="color: hsl(var(--primary));"></i>
              Sale Orders Register
            </h2>
            <button id="so-btn-new" class="btn btn-primary">
              <i data-lucide="plus"></i> New Sale Order
            </button>
          </div>

          <div class="table-responsive" style="margin-top: 0; border: none;">
            <table class="app-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th class="text-right">Total Amount</th>
                  <th>Status</th>
                  <th class="text-center" style="width: 80px;"></th>
                </tr>
              </thead>
              <tbody id="so-table-body">
                ${list.length === 0 ? `
                  <tr>
                    <td colspan="6" class="text-center text-muted" style="padding: 40px 20px;">
                      <i data-lucide="${icon}" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
                      <p>No sale orders recorded yet.</p>
                    </td>
                  </tr>
                ` : list.map((doc) => {
                  const isConverted = doc.status === 'Converted';
                  const statusClass = isConverted ? 'badge-success' : 'badge-warning';
                  const statusLabel = doc.status || 'Open';
                  
                  let actionButtons = '';
                  if (isConverted) {
                    const linkedInvoice = db.get('invoices').find(inv => !inv.is_deleted && inv.converted_from_so_id === doc.id);
                    if (linkedInvoice) {
                      actionButtons = `
                        <a href="#invoices?search=${linkedInvoice.invoice_number}" class="btn btn-secondary btn-sm so-link-invoice-btn" style="padding: 6px;" title="Go to Linked Invoice: ${linkedInvoice.invoice_number}">
                          <i data-lucide="receipt" style="width: 13px; height: 13px; color: hsl(var(--success));"></i>
                        </a>
                      `;
                    } else {
                      actionButtons = `
                        <button class="btn btn-secondary btn-sm so-link-invoice-btn" disabled style="padding: 6px; opacity: 0.5;" title="Linked invoice deleted">
                          <i data-lucide="receipt" style="width: 13px; height: 13px;"></i>
                        </button>
                      `;
                    }
                  } else {
                    actionButtons = `
                      <button class="btn btn-secondary btn-sm so-edit-btn" data-id="${doc.id}" style="padding: 6px;" title="Edit">
                        <i data-lucide="pencil" style="width: 13px; height: 13px; color: hsl(var(--primary));"></i>
                      </button>
                      <button class="btn btn-danger btn-sm so-delete-btn" data-id="${doc.id}" style="padding: 6px;" title="Delete">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                      </button>
                    `;
                  }

                  return `
                    <tr class="so-row-select" data-id="${doc.id}" style="cursor: pointer;">
                      <td style="font-family: var(--font-mono); font-weight: 600;">${doc.document_number}</td>
                      <td>${formatDateToDDMMYY(doc.date)}</td>
                      <td style="font-weight: 500;">${doc.customer_name || 'Walk-in Customer'}</td>
                      <td class="text-right" style="font-weight: 600;">₹${parseFloat(doc.total_amount || 0).toFixed(2)}</td>
                      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                      <td class="text-center no-print">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                          ${actionButtons}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right side: Detailed Printable Preview & Conversion Actions -->
        <div class="view-card animate-fade-in" id="so-preview-card" style="margin-bottom: 0; position: sticky; top: 90px;">
          <div style="text-align: center; padding: 50px 20px; color: hsl(var(--text-secondary));">
            <i data-lucide="file-text" style="width: 64px; height: 64px; stroke-width: 1; margin-bottom: 16px; color: hsl(var(--text-muted));"></i>
            <h3>Sale Order Preview</h3>
            <p style="margin-top: 8px;">Select a sale order from the register to display details, print layout, or convert into a live invoice.</p>
          </div>
        </div>

      </div>

      <!-- Modal Form Backdrop -->
      <div id="so-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>
      
      <!-- Large Modal Form for Creator/Editor -->
      <div id="so-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 95%; max-width: 850px; max-height: 90vh; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002; overflow: hidden;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 20px;">
          <h3 class="card-title" style="margin-bottom: 0;">
            <i data-lucide="${icon}" style="color: hsl(var(--primary));"></i>
            <span id="so-modal-title-text">Create New Sale Order</span>
          </h3>
          <button id="so-modal-close-btn" type="button" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
        </div>

        <form id="so-creator-form" style="flex: 1; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
          
          <!-- Header Info -->
          <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label">Sale Order Number</label>
              <input type="text" id="so-form-number" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" id="so-form-date" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                Customer
                <a href="javascript:void(0)" id="so-quick-add-customer" style="font-size: 0.75rem; text-decoration: none; color: hsl(var(--primary));">+ Add New</a>
              </label>
              <select id="so-form-customer" class="form-control">
                <option value="">Walk-in Customer</option>
                ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Add Items Row -->
          <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; background-color: hsl(var(--bg-primary)); padding: 12px; border-radius: var(--radius-sm);">
            <div class="form-group" style="flex: 2; min-width: 200px;">
              <label class="form-label">Product</label>
              <select id="so-add-product" class="form-control">
                <option value="">-- Select Product --</option>
                ${products.map(p => `<option value="${p.id}">${p.name} (MRP: ₹${p.sale_price})</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="width: 100px;">
              <label class="form-label">Quantity</label>
              <input type="number" id="so-add-qty" class="form-control" min="1" value="1">
            </div>
            <button type="button" id="so-add-item-btn" class="btn btn-secondary" style="padding: 10px 18px;">
              <i data-lucide="plus"></i> Add Item
            </button>
          </div>

          <!-- Scrollable Items Grid -->
          <div style="flex: 1; overflow-y: auto; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm);">
            <table class="app-table">
              <thead>
                <tr style="background-color: hsl(var(--bg-primary));">
                  <th>Product Description</th>
                  <th style="width: 100px; text-align: center;">Qty</th>
                  <th style="width: 120px; text-align: right;">Rate</th>
                  <th style="width: 100px; text-align: center;">Disc %</th>
                  <th style="width: 100px; text-align: center;">GST %</th>
                  <th style="width: 120px; text-align: right;">Line Total</th>
                  <th style="width: 50px;"></th>
                </tr>
              </thead>
              <tbody id="so-form-items-body">
                <!-- Dynamically populated items -->
              </tbody>
            </table>
          </div>

          <!-- Split Advance Payment Inputs -->
          <div style="background-color: hsl(var(--bg-primary)); padding: 12px; border-radius: var(--radius-sm);">
            <h4 style="font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; color: hsl(var(--text-secondary)); display: flex; align-items: center; gap: 6px;">
              <i data-lucide="wallet" style="width: 14px; height: 14px;"></i> Record Advance Payment (Split)
            </h4>
            <div class="form-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 0;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Cash Received (₹)</label>
                <input type="number" step="0.01" id="so-form-cash" class="form-control" value="0" min="0">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">UPI Received (₹)</label>
                <input type="number" step="0.01" id="so-form-upi" class="form-control" value="0" min="0">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Bank Received (₹)</label>
                <input type="number" step="0.01" id="so-form-bank" class="form-control" value="0" min="0">
              </div>
            </div>
          </div>

          <!-- Notes and Totals Row -->
          <div style="display: flex; gap: 20px; justify-content: space-between; align-items: flex-end; flex-wrap: wrap;">
            <div class="form-group" style="flex: 1; min-width: 250px; margin-bottom: 0;">
              <label class="form-label">Internal Notes / Terms</label>
              <textarea id="so-form-notes" class="form-control" rows="2" placeholder="Provide extra billing specifications..."></textarea>
            </div>
            
            <div style="display: flex; gap: 30px; text-align: right; min-width: 320px;">
              <div style="display: flex; flex-direction: column; gap: 4px; font-weight: 600;">
                <div style="color: hsl(var(--text-secondary)); font-size: 0.85rem;">Total Advance:</div>
                <div id="so-form-advancetotal" style="font-size: 1.25rem; font-weight: 700; color: hsl(var(--success));">₹0.00</div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px; font-weight: 600; flex: 1;">
                <div style="color: hsl(var(--text-secondary)); font-size: 0.85rem;">Grand Total:</div>
                <div id="so-form-grandtotal" style="font-family: var(--font-brand); font-size: 1.6rem; font-weight: 700; color: hsl(var(--primary));">₹0.00</div>
              </div>
            </div>
          </div>

          <!-- Dialog Footer Actions -->
          <div style="display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid hsl(var(--border-color)); padding-top: 16px;">
            <button type="button" id="so-form-cancel-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save Sale Order</button>
          </div>
        </form>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Attach list triggers
    attachListListeners();
  }

  function attachListListeners() {
    const modal = document.getElementById('so-modal');
    const backdrop = document.getElementById('so-modal-backdrop');
    
    // New button
    document.getElementById('so-btn-new').addEventListener('click', () => {
      openCreatorModal(null);
    });

    // Close button modal
    function closeCreator() {
      modal.style.display = 'none';
      backdrop.classList.remove('show');
    }
    document.getElementById('so-modal-close-btn').addEventListener('click', closeCreator);
    document.getElementById('so-form-cancel-btn').addEventListener('click', closeCreator);
    backdrop.addEventListener('click', closeCreator);

    // Add item inside creator
    document.getElementById('so-add-item-btn').addEventListener('click', () => {
      const prodId = document.getElementById('so-add-product').value;
      const qty = parseInt(document.getElementById('so-add-qty').value || 1);
      if (!prodId) {
        alert("Please select a product first.");
        return;
      }
      const prod = db.find('products', prodId);
      if (prod) {
        const existing = activeSO.items.find(it => it.product_id === prod.id);
        if (existing) {
          existing.qty += qty;
        } else {
          activeSO.items.push({
            product_id: prod.id,
            product_name: prod.name,
            qty: qty,
            rate: parseFloat(prod.sale_price || 0),
            discount_rate: parseFloat(prod.default_discount || 0),
            gst_rate: parseInt(prod.gst_rate || 0)
          });
        }
        refreshFormItemsGrid();
        document.getElementById('so-add-product').value = '';
        document.getElementById('so-add-qty').value = '1';
      }
    });

    // Quick customer on the fly creation inside modal
    document.getElementById('so-quick-add-customer').addEventListener('click', () => {
      showCustomerAddModal(null, (newCust) => {
        // Refresh customer list state and DOM dropdown selector
        customers = db.get('customers');
        const select = document.getElementById('so-form-customer');
        if (select) {
          select.innerHTML = `<option value="">Walk-in Customer</option>` + customers.map(c => `
            <option value="${c.id}" ${newCust.id === c.id ? 'selected' : ''}>${c.name}</option>
          `).join('');
          activeSO.customer_id = newCust.id;
          activeSO.customer_name = newCust.name;
        }
      });
    });

    // Dynamic updates for split payment inputs
    ['so-form-cash', 'so-form-upi', 'so-form-bank'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        activeSO.cash_paid = parseFloat(document.getElementById('so-form-cash').value || 0);
        activeSO.upi_paid = parseFloat(document.getElementById('so-form-upi').value || 0);
        activeSO.bank_paid = parseFloat(document.getElementById('so-form-bank').value || 0);
        
        const totalAdv = activeSO.cash_paid + activeSO.upi_paid + activeSO.bank_paid;
        document.getElementById('so-form-advancetotal').textContent = `₹${totalAdv.toFixed(2)}`;
      });
    });

    // Handle form submit
    document.getElementById('so-creator-form').addEventListener('submit', (e) => {
      e.preventDefault();
      
      const num = document.getElementById('so-form-number').value.trim();
      const date = document.getElementById('so-form-date').value;
      const custId = document.getElementById('so-form-customer').value;
      const notes = document.getElementById('so-form-notes').value;

      if (activeSO.items.length === 0) {
        alert("At least one product item row is required to save.");
        return;
      }

      // Check number uniqueness
      const exists = db.getAllRaw(entity).find(d => d.document_number === num && !d.is_deleted && d.id !== activeSO.id);
      if (exists) {
        alert(`The order number "${num}" is already used.`);
        return;
      }

      // Calculate grand total
      let grandTotal = 0;
      activeSO.items.forEach(it => {
        const gross = it.qty * it.rate;
        const disc = gross * (it.discount_rate / 100);
        grandTotal += (gross - disc);
      });

      const selectedCust = customers.find(c => c.id === custId);
      
      const soRecord = {
        document_number: num,
        date,
        customer_id: custId || null,
        customer_name: selectedCust ? selectedCust.name : 'Walk-in Customer',
        items: activeSO.items,
        total_amount: grandTotal,
        cash_paid: activeSO.cash_paid,
        upi_paid: activeSO.upi_paid,
        bank_paid: activeSO.bank_paid,
        advance_paid: activeSO.cash_paid + activeSO.upi_paid + activeSO.bank_paid,
        notes,
        status: activeSO.status || 'Open'
      };

      try {
        if (activeSO.id) {
          db.update(entity, activeSO.id, soRecord);
          alert(`Sale Order ${num} updated successfully.`);
        } else {
          db.insert(entity, soRecord);
          alert(`Sale Order ${num} saved successfully.`);
        }
        closeCreator();
        refreshList();
      } catch (err) {
        alert(err.message);
      }
    });

    // Register selection triggers
    document.querySelectorAll('.so-row-select').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.so-delete-btn') || e.target.closest('.so-edit-btn') || e.target.closest('.so-link-invoice-btn')) return;
        
        document.querySelectorAll('.so-row-select').forEach(r => r.classList.remove('active-row'));
        row.classList.add('active-row');
        
        const id = row.getAttribute('data-id');
        showOrderPreview(id);
      });
    });

    // Delete Sale Order
    document.querySelectorAll('.so-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm("Are you sure you want to permanently delete this sale order?")) {
          db.delete(entity, id);
          refreshList();
        }
      });
    });

    // Edit Sale Order
    document.querySelectorAll('.so-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openCreatorModal(id);
      });
    });

    // Pre-select first order if exists
    if (list.length > 0) {
      const firstRow = document.querySelector('.so-row-select');
      if (firstRow) firstRow.click();
    }
  }

  function getNextSerialNumber() {
    const rawAll = db.getAllRaw(entity);
    let max = 0;
    rawAll.forEach(d => {
      const match = d.document_number?.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const val = parseInt(match[1]);
        if (val > max) max = val;
      }
    });
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  function openCreatorModal(editId = null) {
    const modal = document.getElementById('so-modal');
    const backdrop = document.getElementById('so-modal-backdrop');
    
    if (editId) {
      const original = db.find(entity, editId);
      activeSO = JSON.parse(JSON.stringify(original));
      document.getElementById('so-modal-title-text').textContent = 'Edit Sale Order';
    } else {
      activeSO = {
        id: null,
        document_number: getNextSerialNumber(),
        date: getLocalYYYYMMDD(),
        customer_id: '',
        customer_name: 'Walk-in Customer',
        items: [],
        cash_paid: 0,
        upi_paid: 0,
        bank_paid: 0,
        notes: '',
        status: 'Open'
      };
      document.getElementById('so-modal-title-text').textContent = 'Create New Sale Order';
    }

    // Populate modal controls
    document.getElementById('so-form-number').value = activeSO.document_number;
    document.getElementById('so-form-date').value = activeSO.date;
    document.getElementById('so-form-customer').value = activeSO.customer_id || '';
    document.getElementById('so-form-notes').value = activeSO.notes || '';
    document.getElementById('so-form-cash').value = activeSO.cash_paid || 0;
    document.getElementById('so-form-upi').value = activeSO.upi_paid || 0;
    document.getElementById('so-form-bank').value = activeSO.bank_paid || 0;
    
    const totalAdv = (activeSO.cash_paid || 0) + (activeSO.upi_paid || 0) + (activeSO.bank_paid || 0);
    document.getElementById('so-form-advancetotal').textContent = `₹${totalAdv.toFixed(2)}`;

    refreshFormItemsGrid();

    modal.style.display = 'flex';
    backdrop.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  }

  function refreshFormItemsGrid() {
    const itemsBody = document.getElementById('so-form-items-body');
    if (activeSO.items.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 20px;">No product items added. Select a product above.</td></tr>`;
      document.getElementById('so-form-grandtotal').textContent = '₹0.00';
      return;
    }

    let grandTotal = 0;
    itemsBody.innerHTML = activeSO.items.map((it, idx) => {
      const gross = it.qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const total = gross - disc;
      grandTotal += total;

      return `
        <tr data-index="${idx}">
          <td style="font-weight: 500;">${it.product_name}</td>
          <td>
            <input type="number" class="form-control so-qty-edit text-center" value="${it.qty}" min="1" style="padding: 4px; font-size: 0.85rem; width: 60px;">
          </td>
          <td>
            <input type="number" step="0.01" class="form-control so-rate-edit" value="${it.rate}" min="0" style="padding: 4px; font-size: 0.85rem; width: 90px;">
          </td>
          <td>
            <input type="number" step="0.1" class="form-control so-disc-edit text-center" value="${it.discount_rate}" min="0" max="100" style="padding: 4px; font-size: 0.85rem; width: 60px;">
          </td>
          <td>
            <select class="form-control so-gst-edit" style="padding: 4px; font-size: 0.85rem; width: 70px;">
              <option value="0" ${it.gst_rate === 0 ? 'selected' : ''}>0%</option>
              <option value="5" ${it.gst_rate === 5 ? 'selected' : ''}>5%</option>
              <option value="12" ${it.gst_rate === 12 ? 'selected' : ''}>12%</option>
              <option value="18" ${it.gst_rate === 18 ? 'selected' : ''}>18%</option>
              <option value="28" ${it.gst_rate === 28 ? 'selected' : ''}>28%</option>
            </select>
          </td>
          <td class="text-right" style="font-weight: 600;">₹${total.toFixed(2)}</td>
          <td class="text-center">
            <button type="button" class="so-item-del-btn" style="color: hsl(var(--danger)); cursor: pointer; border: none; background: none; padding: 4px;"><i data-lucide="x" style="width: 16px; height: 16px;"></i></button>
          </td>
        </tr>
      `;
    }).join('');

    document.getElementById('so-form-grandtotal').textContent = `₹${grandTotal.toFixed(2)}`;
    if (window.lucide) window.lucide.createIcons();

    // Attach dynamic form item row event listeners
    itemsBody.querySelectorAll('tr').forEach(row => {
      const idx = parseInt(row.getAttribute('data-index'));
      const it = activeSO.items[idx];

      row.querySelector('.so-qty-edit').addEventListener('change', (e) => {
        it.qty = parseInt(e.target.value || 1);
        refreshFormItemsGrid();
      });
      row.querySelector('.so-rate-edit').addEventListener('change', (e) => {
        it.rate = parseFloat(e.target.value || 0);
        refreshFormItemsGrid();
      });
      row.querySelector('.so-disc-edit').addEventListener('change', (e) => {
        it.discount_rate = parseFloat(e.target.value || 0);
        refreshFormItemsGrid();
      });
      row.querySelector('.so-gst-edit').addEventListener('change', (e) => {
        it.gst_rate = parseInt(e.target.value);
        refreshFormItemsGrid();
      });
      row.querySelector('.so-item-del-btn').addEventListener('click', () => {
        activeSO.items.splice(idx, 1);
        refreshFormItemsGrid();
      });
    });
  }

  function showOrderPreview(docId) {
    const doc = db.find(entity, docId);
    const previewArea = document.getElementById('so-preview-card');
    if (!doc) return;

    const company = db.get('business_settings');
    const isConverted = doc.status === 'Converted';

    let taxSum = 0;
    let discSum = 0;
    let subSum = 0;

    doc.items.forEach(it => {
      const gross = it.qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const taxable = (gross - disc) / (1 + it.gst_rate / 100);
      
      discSum += disc;
      taxSum += ((gross - disc) - taxable);
      subSum += taxable;
    });

    const advancePaid = parseFloat(doc.advance_paid || 0);
    const grandTotal = parseFloat(doc.total_amount || 0);
    const balanceDue = grandTotal - advancePaid;

    const payModes = [];
    if (parseFloat(doc.cash_paid || 0) > 0) payModes.push(`Cash: ₹${parseFloat(doc.cash_paid).toFixed(2)}`);
    if (parseFloat(doc.upi_paid || 0) > 0) payModes.push(`UPI: ₹${parseFloat(doc.upi_paid).toFixed(2)}`);
    if (parseFloat(doc.bank_paid || 0) > 0) payModes.push(`Bank: ₹${parseFloat(doc.bank_paid).toFixed(2)}`);
    const payModeStr = payModes.length > 0 ? payModes.join(', ') : '';

    previewArea.innerHTML = `
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 16px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 12px;" class="no-print">
        <button id="so-btn-print" class="btn btn-secondary" style="padding: 8px 12px;">
          <i data-lucide="printer"></i> Print / PDF
        </button>
        ${isConverted ? `
          <button class="btn btn-secondary" disabled style="padding: 8px 12px; opacity: 0.5;">
            <i data-lucide="check-circle"></i> Converted
          </button>
        ` : `
          <button id="so-btn-convert" class="btn btn-success" style="padding: 8px 12px;">
            <i data-lucide="refresh-cw"></i> Convert to Invoice
          </button>
        `}
      </div>

      <!-- Printable Area -->
      <div id="so-print-area" class="print-layout" style="font-family: inherit; font-size: 0.9rem; color: #000; background: #fff; padding: 24px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color));">
        
        <!-- Document Type Banner -->
        <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            ${company.logo_base64 ? `<img src="${company.logo_base64}" alt="Logo" style="max-height: 45px; margin-bottom: 6px;"><br>` : ''}
            <h2 style="font-size: 1.5rem; margin-bottom: 4px; font-weight: 800;">${company.company_name || 'Gonabhavi Business'}</h2>
            <div style="font-size: 0.8rem; color: #555; line-height: 1.4;">
              ${company.address ? `${company.address}<br>` : ''}
              ${company.phone ? `Phone: ${company.phone}` : ''} 
              ${company.gstin ? ` | GSTIN: ${company.gstin}` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <h1 style="font-size: 1.45rem; color: #1e3a8a; text-transform: uppercase; font-weight: 800; font-family: var(--font-brand);">${title}</h1>
            <div style="font-size: 0.85rem; font-weight: bold; margin-top: 4px;">Number: ${doc.document_number}</div>
            <div style="font-size: 0.8rem; color: #555;">Date: ${formatDateToDDMMYY(doc.date)}</div>
            <div style="font-size: 0.8rem; font-weight: bold; color: ${isConverted ? '#059669' : '#d97706'}; margin-top: 4px;">Status: ${doc.status || 'Open'}</div>
          </div>
        </div>

        <!-- Party Billing -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px;">Billing To:</div>
          <div style="font-weight: 700; font-size: 1.05rem;">${doc.customer_name}</div>
          <div id="so-preview-customer-details" style="font-size: 0.8rem; color: #555; line-height: 1.4; margin-top: 2px;">
            <!-- Fetched dynamically below -->
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #333; font-weight: 700; background-color: #f9fafb;">
              <th style="padding: 8px;">Product Description</th>
              <th style="padding: 8px; text-align: center; width: 80px;">Qty</th>
              <th style="padding: 8px; text-align: right; width: 100px;">Rate</th>
              <th style="padding: 8px; text-align: center; width: 80px;">Disc %</th>
              <th style="padding: 8px; text-align: right; width: 110px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${doc.items.map(it => {
              const rowTotal = it.qty * it.rate - (it.qty * it.rate * (it.discount_rate / 100));
              return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px; font-weight: 600;">${it.product_name}</td>
                  <td style="padding: 8px; text-align: center;">${it.qty}</td>
                  <td style="padding: 8px; text-align: right;">₹${parseFloat(it.rate).toFixed(2)}</td>
                  <td style="padding: 8px; text-align: center;">${it.discount_rate}%</td>
                  <td style="padding: 8px; text-align: right; font-weight: 600;">₹${rowTotal.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Totals & Terms -->
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 200px;">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px;">Terms / Notes:</div>
            <div style="font-size: 0.8rem; color: #555; font-style: italic; white-space: pre-line; margin-bottom: 10px;">${doc.notes || 'Goods once ordered cannot be cancelled. Standard terms apply.'}</div>
            
            ${(() => {
              if (company.bank_name || company.bank_account_number || company.ifsc_code || company.upi_id) {
                return `
                  <div style="margin-top: 10px; border: 1px dashed #ccc; padding: 6px; border-radius: 4px; background-color: #fafafa; font-size: 0.7rem; color: #333; max-width: 240px;" class="print-bank-details">
                    <h4 style="text-transform: uppercase; font-size: 0.62rem; color: #666; margin: 0 0 4px 0; font-weight: 700;">Bank Details:</h4>
                    ${company.bank_name ? `<p style="margin: 0 0 2px 0;"><b>Bank:</b> ${company.bank_name}</p>` : ''}
                    ${company.bank_account_number ? `<p style="margin: 0 0 2px 0;"><b>A/C No:</b> ${company.bank_account_number}</p>` : ''}
                    ${company.ifsc_code ? `<p style="margin: 0 0 2px 0;"><b>IFSC:</b> ${company.ifsc_code}</p>` : ''}
                    ${company.upi_id ? `<p style="margin: 0;"><b>UPI:</b> ${company.upi_id}</p>` : ''}
                  </div>
                `;
              }
              return '';
            })()}
          </div>
          
          <div style="width: 270px; font-size: 0.85rem; line-height: 1.6;">
            <div style="display: flex; justify-content: space-between;">
              <span>Taxable Value:</span>
              <span>₹${subSum.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Total Discount:</span>
              <span style="color: #059669;">-₹${discSum.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>GST Tax:</span>
              <span>₹${taxSum.toFixed(2)}</span>
            </div>
            <hr style="border: none; border-top: 1px solid #ccc; margin: 4px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: 600;">
              <span>Grand Total:</span>
              <span>₹${grandTotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #059669; font-weight: 600;">
              <span>Advance Paid:</span>
              <span>-₹${advancePaid.toFixed(2)}</span>
            </div>
            ${advancePaid > 0 && payModeStr ? `
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #555; font-weight: 500; margin-top: -2px; margin-bottom: 4px;">
                <span>Payment Mode:</span>
                <span style="font-size: 0.7rem;">${payModeStr}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.1rem; color: #e11d48; border-top: 1px solid #333; padding-top: 4px; margin-top: 4px;">
              <span>Balance Due:</span>
              <span>₹${(balanceDue < 0 ? 0 : balanceDue).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Authorized Signature -->
        ${company.authorized_signature ? `
          <div style="display: flex; justify-content: flex-end; margin-top: 30px; text-align: center;">
            <div style="width: 180px;">
              <img src="${company.authorized_signature}" style="max-height: 60px; max-width: 150px; margin-bottom: 4px;">
              <div style="border-top: 1px solid #333; font-size: 0.75rem; font-weight: bold; padding-top: 4px;">Authorized Signatory</div>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Populate customer details in preview
    const cust = db.find('customers', doc.customer_id);
    if (cust) {
      document.getElementById('so-preview-customer-details').innerHTML = `
        ${cust.address ? `${cust.address}<br>` : ''}
        ${cust.phone ? `Phone: ${cust.phone}` : ''}
        ${cust.gstin ? ` | GSTIN: ${cust.gstin}` : ''}
      `;
    }

    // Print Action
    document.getElementById('so-btn-print').addEventListener('click', () => {
      const printContents = document.getElementById('so-print-area').innerHTML;
      
      document.body.innerHTML = `
        <style>
          @page {
            size: A5 portrait;
            margin: 5mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0;
            padding: 0;
          }
          #so-print-area {
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            font-size: 11px !important;
          }
        </style>
        <div style="padding: 10px; background: #fff; color: #000;">
          ${printContents}
        </div>
      `;
      window.print();
      
      // Reload route back
      window.location.reload();
    });

    // Convert Action
    const convertBtn = document.getElementById('so-btn-convert');
    if (convertBtn) {
      convertBtn.addEventListener('click', () => {
        const convertPackage = {
          customer_id: doc.customer_id,
          customer_name: doc.customer_name,
          items: doc.items.map(it => ({
            product_id: it.product_id,
            product_name: it.product_name,
            qty: it.qty,
            rate: it.rate,
            discount_rate: it.discount_rate,
            gst_rate: it.gst_rate
          })),
          final_discount: 0,
          cash_paid: doc.cash_paid || 0,
          upi_paid: doc.upi_paid || 0,
          bank_paid: doc.bank_paid || 0,
          converted_from_so_id: doc.id
        };
        
        localStorage.setItem('gb_convert_doc', JSON.stringify(convertPackage));
        db.logAudit(`Converted Sale Order`, `Sale Order: Prepared serial #${doc.document_number} with advance payment of ₹${advancePaid.toFixed(2)} to convert to invoice.`);
        
        window.location.hash = '#billing';
      });
    }
  }

  // Initial draw
  refreshList();
}

/**
 * NAMED EXPORT: QUOTATIONS REGISTER
 */
export async function QuotationView(container) {
  renderDocumentModule({
    container,
    title: 'Quotation',
    icon: 'quote',
    prefix: 'QT',
    entity: 'quotations',
    hasPricing: true,
    hasExpiry: true
  });
}

/**
 * NAMED EXPORT: ESTIMATES REGISTER
 */
export async function EstimateView(container) {
  renderDocumentModule({
    container,
    title: 'Estimate',
    icon: 'file-text',
    prefix: 'EST',
    entity: 'estimates',
    hasPricing: true,
    hasExpiry: false
  });
}

/**
 * NAMED EXPORT: DELIVERY CHALLANS REGISTER
 */
export async function DeliveryChallanView(container) {
  renderDocumentModule({
    container,
    title: 'Delivery Challan',
    icon: 'truck',
    prefix: 'DC',
    entity: 'delivery_challans',
    hasPricing: false,
    hasExpiry: false
  });
}

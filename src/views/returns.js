/* ==========================================================================
   GONABHAVI — SALES & PURCHASE RETURNS (src/views/returns.js)
   ========================================================================== */

import { db, generateUUID, formatDateToDDMMYY, getLocalYYYYMMDD, formatTimeFromTimestamp } from '../db.js';

// Base helper to render Sales Returns and Purchase Returns
function renderReturnsModule({
  container,
  title,
  icon,
  prefix,
  entity, // 'sales_returns' or 'purchase_returns'
  sourceEntity, // 'invoices' or 'purchases'
  partyLabel // 'Customer' or 'Supplier'
}) {
  const list = db.get(entity);
  const sources = db.get(sourceEntity);

  // Sort newest returns first by timestamp and date
  list.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
    const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
    return timeB - timeA;
  });

  container.innerHTML = `
    <div class="view-card animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="corner-up-left" style="color: hsl(var(--primary));"></i>
          ${title} Register
        </h2>
        <button id="return-btn-new" class="btn btn-primary">
          <i data-lucide="plus"></i> Record ${title}
        </button>
      </div>

      <!-- Table Register List -->
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Return Number</th>
              <th>Date</th>
              <th>Original Source</th>
              <th>${partyLabel}</th>
              <th class="text-right">Return Grand Total</th>
              <th class="text-center" style="width: 80px;">Action</th>
            </tr>
          </thead>
          <tbody id="return-table-body">
            ${list.length === 0 ? `
              <tr>
                <td colspan="6" class="text-center text-muted" style="padding: 40px 20px;">
                  <i data-lucide="corner-up-left" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
                  <p>No ${title.toLowerCase()}s recorded yet.</p>
                </td>
              </tr>
            ` : list.map(item => {
              const originalNum = sourceEntity === 'invoices' ? item.invoice_number : item.bill_number;
              const originalLabel = sourceEntity === 'invoices' ? `Invoice #${originalNum}` : `Bill #${originalNum}`;
              
              return `
                <tr>
                  <td style="font-family: var(--font-mono); font-weight: 600;">${item.return_number}</td>
                  <td style="white-space: nowrap;">
                    <div>${formatDateToDDMMYY(item.date)}</div>
                    ${item.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(item.created_at)}</div>` : ''}
                  </td>
                  <td style="font-weight: 600; color: hsl(var(--primary));">${originalLabel}</td>
                  <td style="font-weight: 500;">${item.customer_name || item.supplier_name || '—'}</td>
                  <td class="text-right text-success" style="font-weight: 700;">₹${parseFloat(item.grand_total || 0).toFixed(2)}</td>
                  <td class="text-center">
                    <button class="btn btn-danger btn-sm return-delete-btn" data-id="${item.id}" style="padding: 6px; border-radius: 50%;" title="Delete Return Log">
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

    <!-- Modal Form Backdrop -->
    <div id="return-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>

    <!-- Large creator Modal Dialog -->
    <div id="return-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 95%; max-width: 800px; max-height: 90vh; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002; overflow: hidden;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 20px;">
        <h3 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="corner-up-left" style="color: hsl(var(--primary));"></i>
          Record ${title}
        </h3>
        <button id="return-modal-close" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
      </div>

      <form id="return-creator-form" style="flex: 1; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
        
        <!-- Header details -->
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 0;">
          <div class="form-group">
            <label class="form-label">Return Number</label>
            <input type="text" id="return-form-num" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">Return Date</label>
            <input type="date" id="return-form-date" class="form-control" required>
          </div>
          <div class="form-group" style="flex: 2;">
            <label class="form-label">Select Original ${sourceEntity === 'invoices' ? 'Invoice (Sales)' : 'Purchase Bill'}</label>
            <select id="return-form-source" class="form-control" required>
              <option value="">-- Choose Original Reference --</option>
              ${sources.map(s => {
                const num = sourceEntity === 'invoices' ? s.invoice_number : s.bill_number;
                const party = sourceEntity === 'invoices' ? (s.customer_name || 'Walk-in') : (s.supplier_name || 'Generic');
                const total = parseFloat(s.grand_total || 0) - parseFloat(s.final_discount || 0);
                return `<option value="${s.id}">#${num} — ${party} (Total: ₹${total.toFixed(2)})</option>`;
              }).join('')}
            </select>
          </div>
        </div>

        <!-- Scrollable items display -->
        <div style="flex: 1; overflow-y: auto; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm);">
          <table class="app-table">
            <thead>
              <tr style="background-color: hsl(var(--bg-primary));">
                <th>Product Description</th>
                <th style="width: 100px; text-align: center;">Original Qty</th>
                <th style="width: 100px; text-align: center;">Returned Qty</th>
                <th style="width: 120px; text-align: right;">Rate</th>
                <th style="width: 100px; text-align: center;">GST %</th>
                <th style="width: 120px; text-align: center;">Return Qty</th>
                <th style="width: 180px;">Reason</th>
              </tr>
            </thead>
            <tbody id="return-form-items-body">
              <tr>
                <td colspan="7" class="text-center text-muted" style="padding: 24px;">Select an original transaction reference above to load product items.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Notes and Total Row -->
        <div style="display: flex; gap: 20px; justify-content: space-between; align-items: flex-end; flex-wrap: wrap;">
          <div class="form-group" style="flex: 1; min-width: 250px;">
            <label class="form-label">Return Notes / Comments</label>
            <input type="text" id="return-form-notes" class="form-control" placeholder="Provide extra return auditing remarks...">
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; font-weight: 600; text-align: right; min-width: 180px;">
            <div style="color: hsl(var(--text-secondary)); font-size: 0.85rem;">Total Refund Credit:</div>
            <div id="return-form-grandtotal" style="font-family: var(--font-brand); font-size: 1.6rem; font-weight: 700; color: hsl(var(--success));">₹0.00</div>
          </div>
        </div>

        <!-- Footer buttons -->
        <div style="display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid hsl(var(--border-color)); padding-top: 16px;">
          <button type="button" id="return-form-cancel" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-success"><i data-lucide="save"></i> Save Return Log</button>
        </div>
      </form>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // State Bindings
  const modal = document.getElementById('return-modal');
  const backdrop = document.getElementById('return-modal-backdrop');
  const closeBtn = document.getElementById('return-modal-close');
  const cancelBtn = document.getElementById('return-form-cancel');
  const form = document.getElementById('return-creator-form');
  const sourceSelect = document.getElementById('return-form-source');
  const itemsBody = document.getElementById('return-form-items-body');

  let activeSource = null;
  let itemsToReturn = [];

  // Generate sequence
  function getNextSerialNumber() {
    const rawAll = db.getAllRaw(entity);
    let max = 0;
    rawAll.forEach(d => {
      const match = d.return_number?.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const val = parseInt(match[1]);
        if (val > max) max = val;
      }
    });
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  // Open modal trigger
  document.getElementById('return-btn-new').addEventListener('click', () => {
    document.getElementById('return-form-num').value = getNextSerialNumber();
    document.getElementById('return-form-date').value = getLocalYYYYMMDD();
    document.getElementById('return-form-notes').value = '';
    sourceSelect.value = '';
    
    itemsBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">Select an original transaction reference above to load product items.</td></tr>`;
    document.getElementById('return-form-grandtotal').textContent = '₹0.00';
    
    activeSource = null;
    itemsToReturn = [];

    modal.style.display = 'flex';
    backdrop.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  });

  // Modal close trigger
  function closeModal() {
    modal.style.display = 'none';
    backdrop.classList.remove('show');
  }
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // Load items from selected invoice/purchase bill
  sourceSelect.addEventListener('change', () => {
    const sourceId = sourceSelect.value;
    if (!sourceId) {
      itemsBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">Select an original transaction reference above to load product items.</td></tr>`;
      document.getElementById('return-form-grandtotal').textContent = '₹0.00';
      return;
    }

    activeSource = db.find(sourceEntity, sourceId);
    if (!activeSource) return;

    // Compile previously returned quantities for this source to cap maximum returns
    const previousReturns = db.get(entity).filter(r => {
      const matchId = sourceEntity === 'invoices' ? r.invoice_id : r.purchase_id;
      return matchId === sourceId && !r.is_deleted;
    });

    itemsToReturn = activeSource.items.map(it => {
      let returnedQtySum = 0;
      previousReturns.forEach(prev => {
        prev.items?.forEach(prevIt => {
          if (prevIt.product_id === it.product_id) {
            // BUG 28 FIX: parseFloat(null) = NaN was poisoning the sum, allowing unlimited returns
            const prevQty = parseFloat(prevIt.qty);
            if (!isNaN(prevQty)) returnedQtySum += prevQty;
          }
        });
      });

      return {
        product_id: it.product_id,
        product_name: it.product_name,
        qty: parseFloat(it.qty || 0),
        already_returned: returnedQtySum,
        rate: parseFloat(it.rate || it.purchase_rate || 0),
        gst_rate: parseInt(it.gst_rate || 0),
        discount_rate: parseFloat(it.discount_rate || 0), // Purchases don't have per-line discount, defaults to 0
        return_qty: 0,
        reason: ''
      };
    });

    refreshReturnGrid();
  });

  // Refresh dynamic return lines grid
  function refreshReturnGrid() {
    if (itemsToReturn.length === 0) return;

    itemsBody.innerHTML = itemsToReturn.map((it, idx) => {
      const maxAvail = it.qty - it.already_returned;
      return `
        <tr data-index="${idx}">
          <td style="font-weight: 600;">${it.product_name}</td>
          <td class="text-center">${it.qty}</td>
          <td class="text-center">${it.already_returned}</td>
          <td class="text-right">₹${it.rate.toFixed(2)}</td>
          <td class="text-center">${it.gst_rate}%</td>
          <td class="text-center">
            <input type="number" class="form-control return-qty-edit text-center" value="${it.return_qty}" min="0" max="${maxAvail}" style="padding: 4px; max-width: 90px;" ${maxAvail <= 0 ? 'disabled placeholder="Fully returned"' : ''}>
            <div style="font-size: 0.72rem; color: hsl(var(--text-muted)); margin-top: 2px;">Max: ${maxAvail}</div>
          </td>
          <td>
            <input type="text" class="form-control return-reason-edit" value="${it.reason}" placeholder="e.g., Damaged, Expired" style="padding: 4px;" ${maxAvail <= 0 ? 'disabled' : ''}>
          </td>
        </tr>
      `;
    }).join('');

    // Bind change events
    itemsBody.querySelectorAll('tr').forEach(row => {
      const idx = parseInt(row.getAttribute('data-index'));
      const item = itemsToReturn[idx];

      const qtyEdit = row.querySelector('.return-qty-edit');
      const reasonEdit = row.querySelector('.return-reason-edit');

      if (qtyEdit) {
        qtyEdit.addEventListener('change', (e) => {
          // BUG 27 FIX: Use Math.floor to enforce whole-number quantities only
          // parseFloat was allowing 1.5, 2.3 etc. which produced fractional returns in the DB
          const val = Math.floor(parseFloat(e.target.value) || 0);
          const maxAvail = Math.floor(item.qty - item.already_returned);
          if (val < 0) {
            item.return_qty = 0;
          } else if (val > maxAvail) {
            item.return_qty = maxAvail;
          } else {
            item.return_qty = val;
          }
          qtyEdit.value = item.return_qty;
          recalculateReturnGrandTotal();
        });
      }

      if (reasonEdit) {
        reasonEdit.addEventListener('input', (e) => {
          item.reason = e.target.value;
        });
      }
    });

    recalculateReturnGrandTotal();
  }

  // Recalculate Return grand total
  function recalculateReturnGrandTotal() {
    let refundTotal = 0;

    // BUG 26 FIX: Sales return must account for whole-invoice final_discount.
    // If invoice had a final discount (e.g. ₹50 off total), we must proportionally reduce refund.
    // We calculate each line's proportion of the original grand total and scale accordingly.
    const invoiceFinalDiscount = (sourceEntity === 'invoices' && activeSource)
      ? parseFloat(activeSource.final_discount || 0)
      : 0;
    const invoiceSubtotalBeforeFinalDisc = activeSource
      ? (activeSource.items || []).reduce((s, it) => {
          const g = parseFloat(it.qty || 0) * parseFloat(it.rate || 0);
          const d = g * (parseFloat(it.discount_rate || 0) / 100);
          return s + (g - d);
        }, 0)
      : 0;
    const finalDiscRatio = (invoiceFinalDiscount > 0 && invoiceSubtotalBeforeFinalDisc > 0)
      ? (invoiceFinalDiscount / invoiceSubtotalBeforeFinalDisc)
      : 0;
    
    itemsToReturn.forEach(it => {
      const gross = it.return_qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      let lineTotal = gross - disc;
      
      // Apply proportional share of any whole-invoice final discount (sales returns only)
      if (finalDiscRatio > 0) {
        lineTotal = lineTotal * (1 - finalDiscRatio);
      }

      // Add tax if purchase (price is before tax)
      if (sourceEntity === 'purchases') {
        const gst = lineTotal * (it.gst_rate / 100);
        refundTotal += (lineTotal + gst);
      } else {
        // Sales are MRP-inclusive (lineTotal is what customer paid)
        refundTotal += lineTotal;
      }
    });

    document.getElementById('return-form-grandtotal').textContent = `₹${refundTotal.toFixed(2)}`;
  }

  // Submit return creation handler (Section 17/18 validations)
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const return_number = document.getElementById('return-form-num').value.trim();
    const date = document.getElementById('return-form-date').value;
    const notes = document.getElementById('return-form-notes').value;

    const activeLines = itemsToReturn.filter(it => it.return_qty > 0);
    if (activeLines.length === 0) {
      alert("At least one product item row must have a Return Quantity greater than 0 to save.");
      return;
    }

    // Uniqueness validation
    const exists = db.getAllRaw(entity).find(r => r.return_number === return_number && !r.is_deleted);
    if (exists) {
      alert(`The return number "${return_number}" is already used by another active return.`);
      return;
    }

    // Grand total
    let refundTotal = 0;
    activeLines.forEach(it => {
      const gross = it.return_qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const lineTotal = gross - disc;
      
      if (sourceEntity === 'purchases') {
        const gst = lineTotal * (it.gst_rate / 100);
        refundTotal += (lineTotal + gst);
      } else {
        refundTotal += lineTotal;
      }
    });

    const returnRecord = {
      return_number,
      date,
      grand_total: refundTotal,
      notes,
      items: activeLines.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        qty: it.return_qty,
        rate: it.rate,
        gst_rate: it.gst_rate,
        discount_rate: it.discount_rate,
        reason: it.reason
      })),
      is_deleted: false
    };

    if (sourceEntity === 'invoices') {
      returnRecord.invoice_id = activeSource.id;
      returnRecord.invoice_number = activeSource.invoice_number;
      returnRecord.customer_id = activeSource.customer_id;
      returnRecord.customer_name = activeSource.customer_name;
    } else {
      returnRecord.purchase_id = activeSource.id;
      returnRecord.bill_number = activeSource.bill_number;
      returnRecord.supplier_id = activeSource.supplier_id;
      returnRecord.supplier_name = activeSource.supplier_name;
    }

    try {
      db.insert(entity, returnRecord);
      closeModal();
      window.dispatchEvent(new CustomEvent('gb-db-change'));
      
      // Reload module
      renderReturnsModule({ container, title, icon, prefix, entity, sourceEntity, partyLabel });
    } catch (err) {
      alert(err.message);
    }
  });

  // Delete Return action
  document.querySelectorAll('.return-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm(`Are you sure you want to delete this return log? This will reverse its effect on stock levels and account receivable dues.`)) {
        db.delete(entity, id);
        window.dispatchEvent(new CustomEvent('gb-db-change'));
        renderReturnsModule({ container, title, icon, prefix, entity, sourceEntity, partyLabel });
      }
    });
  });
}

/**
 * NAMED EXPORT: SALES RETURNS (#sales-return)
 */
export async function SalesReturnView(container) {
  renderReturnsModule({
    container,
    title: 'Sales Return',
    icon: 'corner-up-left',
    prefix: 'SR',
    entity: 'sales_returns',
    sourceEntity: 'invoices',
    partyLabel: 'Customer'
  });
}

/**
 * NAMED EXPORT: PURCHASE RETURNS (#purchase-return)
 */
export async function PurchaseReturnView(container) {
  renderReturnsModule({
    container,
    title: 'Purchase Return',
    icon: 'corner-up-right',
    prefix: 'PR',
    entity: 'purchase_returns',
    sourceEntity: 'purchases',
    partyLabel: 'Supplier'
  });
}

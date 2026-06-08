/* ==========================================================================
   GONABHAVI — MONEY LOGS MANAGER: PAYMENTS & EXPENSES (src/views/payments.js)
   ========================================================================== */

import { db, calc, generateUUID, formatDateToDDMMYY, getLocalYYYYMMDD, formatTimeFromTimestamp } from '../db.js';

// Base helper to render Payments-In, Payments-Out, and Expenses Views
function renderMoneyLogModule({
  container,
  title,
  icon,
  entity,
  partyEntity, // 'customers' or 'suppliers'
  direction // 'in' (money in) or 'out' (money out/expense)
}) {
  const list = db.get(entity);
  const parties = partyEntity ? db.get(partyEntity) : [];
  const settings = db.get('business_settings');
  
  // Sort newest first by timestamp and date
  list.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
    const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
    return timeB - timeA;
  });

  // HTML shell layout
  container.innerHTML = `
    <div class="view-card animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="${icon}" style="color: hsl(var(--primary));"></i>
          ${title} Ledger Register
        </h2>
        <button id="money-btn-new" class="btn btn-primary">
          <i data-lucide="plus"></i> Log New ${title}
        </button>
      </div>

      <!-- Live Balances Bar -->
      <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px;">
        ${partyEntity ? `
          <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
            <div class="stat-info">
              <span class="stat-label" style="font-size: 0.75rem;">Total Dues Outstanding</span>
              <span class="stat-value" id="money-party-dues" style="font-size: 1.4rem;">₹0.00</span>
            </div>
            <div class="stat-icon color-danger" style="width: 38px; height: 38px;">
              <i data-lucide="alert-circle" style="width: 18px; height: 18px;"></i>
            </div>
          </div>
        ` : ''}
        <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Logged In This Session</span>
            <span class="stat-value" style="font-size: 1.4rem; color: hsl(var(--primary));">
              ₹${list.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0).toFixed(2)}
            </span>
          </div>
          <div class="stat-icon color-primary" style="width: 38px; height: 38px;">
            <i data-lucide="banknote" style="width: 18px; height: 18px;"></i>
          </div>
        </div>
      </div>

      <!-- Table Registry List -->
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Date</th>
              ${partyEntity ? `<th>${partyEntity === 'customers' ? 'Customer' : 'Supplier'}</th>` : '<th>Category</th>'}
              <th>Description / Note</th>
              <th>Payment Account</th>
              <th class="text-right">Transaction Amount</th>
              <th class="text-center" style="width: 80px;">Action</th>
            </tr>
          </thead>
          <tbody id="money-table-body">
            ${list.length === 0 ? `
              <tr>
                <td colspan="6" class="text-center text-muted" style="padding: 40px 20px;">
                  <i data-lucide="${icon}" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
                  <p>No ${title.toLowerCase()}s recorded yet.</p>
                </td>
              </tr>
            ` : list.map(item => {
              let partyName = '—';
              if (partyEntity) {
                partyName = partyEntity === 'customers' 
                  ? (db.find('customers', item.customer_id)?.name || 'Unknown Customer')
                  : (db.find('suppliers', item.supplier_id)?.name || 'Unknown Supplier');
              } else {
                partyName = item.category || 'General Expense';
              }

              return `
                <tr>
                  <td style="white-space: nowrap;">
                    <div>${formatDateToDDMMYY(item.date)}</div>
                    ${item.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(item.created_at)}</div>` : ''}
                  </td>
                  <td style="font-weight: 600;">${partyName}</td>
                  <td style="font-size: 0.85rem; color: hsl(var(--text-secondary));">${item.note || item.description || '—'}</td>
                  <td>
                    <span class="badge" style="background-color: hsl(var(--bg-tertiary)); color: hsl(var(--text-primary)); padding: 4px 10px;">
                      ${item.method === 'Cash' ? (settings.account_cash_label || 'Cash') : (item.method === 'UPI' ? (settings.account_upi_label || 'UPI') : (settings.account_bank_label || 'Bank'))}
                    </span>
                  </td>
                  <td class="text-right style-amount font-weight-bold" style="font-weight: 700; color: ${direction === 'in' ? 'hsl(var(--success))' : 'hsl(var(--danger))'}">
                    ${direction === 'in' ? '+' : '-'}₹${parseFloat(item.amount || 0).toFixed(2)}
                  </td>
                  <td class="text-center">
                    <button class="btn btn-danger btn-sm money-delete-btn" data-id="${item.id}" style="padding: 6px; border-radius: 50%;" title="Delete Log">
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
    <div id="money-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>
    
    <!-- Modal Dialog -->
    <div id="money-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 480px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 20px;">
        <h3 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="${icon}" style="color: hsl(var(--primary));"></i>
          Record ${title}
        </h3>
        <button id="money-modal-close-btn" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
      </div>

      <form id="money-log-form" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label class="form-label">Transaction Date</label>
          <input type="date" id="money-form-date" class="form-control" required>
        </div>

        ${partyEntity ? `
          <div class="form-group">
            <label class="form-label">${partyEntity === 'customers' ? 'Select Customer' : 'Select Supplier'}</label>
            <select id="money-form-party" class="form-control" required>
              <option value="">-- Choose Option --</option>
              ${parties.map(p => {
                const bal = partyEntity === 'customers' ? calc.getCustomerBalance(p.id) : calc.getSupplierBalance(p.id);
                return `<option value="${p.id}">${p.name} (${bal > 0 ? `Owes: ₹${bal.toFixed(2)}` : 'Settle'})</option>`;
              }).join('')}
            </select>
          </div>
        ` : `
          <div class="form-group">
            <label class="form-label">Expense Category</label>
            <select id="money-form-category" class="form-control" required>
              <option value="">-- Choose Category --</option>
              <option value="Rent">Office / Shop Rent</option>
              <option value="Electricity">Electricity & Utility Bills</option>
              <option value="Transport">Transport / Fuel / Logistics</option>
              <option value="Salary">Staff Salaries / Commissions</option>
              <option value="Stationery">Office Stationery & Consumables</option>
              <option value="Tea/Snacks">Refreshments / Tea & Snacks</option>
              <option value="Software">Software Subscriptions / Internet</option>
              <option value="Marketing">Advertising & Marketing</option>
              <option value="Other">Miscellaneous Expenses</option>
            </select>
          </div>
        `}

        <div class="form-group">
          <label class="form-label">Transaction Amount (₹)</label>
          <input type="number" step="0.01" min="0.01" id="money-form-amount" class="form-control" placeholder="0.00" required>
        </div>

        <div class="form-group">
          <label class="form-label">Payment Account Method</label>
          <select id="money-form-method" class="form-control" required>
            <option value="Cash">${settings.account_cash_label || 'Cash'}</option>
            <option value="UPI">${settings.account_upi_label || 'UPI'}</option>
            <option value="Bank">${settings.account_bank_label || 'Bank'}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Remarks / Description / Note</label>
          <textarea id="money-form-note" class="form-control" rows="3" placeholder="Provide receipt references, descriptions, etc."></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
          <button type="button" id="money-form-cancel" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Log</button>
        </div>
      </form>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Calculations Bar details loader
  if (partyEntity) {
    let dues = 0;
    parties.forEach(p => {
      // BUG 37 FIX: Only count positive balances for the "Total Dues" stat.
      // Previously negative balances (credits) reduced the total, giving a misleading number.
      const bal = partyEntity === 'customers' ? calc.getCustomerBalance(p.id) : calc.getSupplierBalance(p.id);
      if (bal > 0) dues += bal; // Credit balances (negative) are excluded from dues total
    });
    document.getElementById('money-party-dues').textContent = `₹${dues.toFixed(2)}`;
  }

  // DOM bindings
  const modal = document.getElementById('money-modal');
  const backdrop = document.getElementById('money-modal-backdrop');
  const closeBtn = document.getElementById('money-modal-close-btn');
  const cancelBtn = document.getElementById('money-form-cancel');
  const form = document.getElementById('money-log-form');

  // Trigger modal open
  document.getElementById('money-btn-new').addEventListener('click', () => {
    form.reset(); // BUG 34 FIX: reset() FIRST, then set the date — previously date was set before reset() and got cleared
    document.getElementById('money-form-date').value = getLocalYYYYMMDD();
    modal.style.display = 'flex';
    backdrop.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  });

  // Modal close handlers
  function closeModal() {
    modal.style.display = 'none';
    backdrop.classList.remove('show');
  }
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // Form submit handler (Section 10/11/12 validation)
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('money-form-date').value;
    // BUG 33 FIX: parseFloat on non-numeric input returns NaN which bypassed the <= 0 check
    // NaN <= 0 evaluates to false, so NaN was silently saved as a transaction amount
    const rawAmount = document.getElementById('money-form-amount').value;
    const amount = parseFloat(rawAmount);
    const method = document.getElementById('money-form-method').value;
    const note = document.getElementById('money-form-note').value;

    if (!date) {
      alert("Please select a date for this transaction.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert("Amount must be a valid number greater than ₹0.00.");
      return;
    }

    const itemRecord = {
      date,
      amount,
      method,
      note,
      is_deleted: false
    };

    if (partyEntity) {
      const partyId = document.getElementById('money-form-party').value;
      if (!partyId) {
        alert("Please select a target account name.");
        return;
      }
      if (partyEntity === 'customers') {
        itemRecord.customer_id = partyId;
      } else {
        itemRecord.supplier_id = partyId;
      }
    } else {
      const cat = document.getElementById('money-form-category').value;
      if (!cat) {
        alert("Please select an expense category.");
        return;
      }
      itemRecord.category = cat;
      itemRecord.description = note; // sync categories description
    }

    try {
      db.insert(entity, itemRecord);
      closeModal();
      window.dispatchEvent(new CustomEvent('gb-db-change'));
      
      // Reload view
      renderMoneyLogModule({ container, title, icon, entity, partyEntity, direction });
    } catch (err) {
      alert(err.message);
    }
  });

  // Delete Action handler
  document.querySelectorAll('.money-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm(`Are you sure you want to delete this money log? This will reverse the effect on ledgers and balances.`)) {
        db.delete(entity, id);
        window.dispatchEvent(new CustomEvent('gb-db-change'));
        renderMoneyLogModule({ container, title, icon, entity, partyEntity, direction });
      }
    });
  });
}

/**
 * NAMED EXPORT: PAYMENTS RECEIVED (STANDALONE PAYMENT-IN)
 */
export async function PaymentInView(container) {
  renderMoneyLogModule({
    container,
    title: 'Payment-In',
    icon: 'arrow-down-left',
    entity: 'payment_ins',
    partyEntity: 'customers',
    direction: 'in'
  });
}

/**
 * NAMED EXPORT: PAYMENTS MADE (STANDALONE PAYMENT-OUT)
 */
export async function PaymentOutView(container) {
  renderMoneyLogModule({
    container,
    title: 'Payment-Out',
    icon: 'arrow-up-right',
    entity: 'payment_outs',
    partyEntity: 'suppliers',
    direction: 'out'
  });
}

/**
 * NAMED EXPORT: EXPENSES
 */
export async function ExpensesView(container) {
  renderMoneyLogModule({
    container,
    title: 'Expense',
    icon: 'banknote',
    entity: 'expenses',
    partyEntity: null,
    direction: 'out'
  });
}

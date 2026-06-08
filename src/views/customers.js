/* ==========================================================================
   GONABHAVI — CUSTOMERS MASTER DIRECTORY (src/views/customers.js)
   ========================================================================== */

import { db, calc, getLocalYYYYMMDD } from '../db.js';

let customerSortField = 'name';
let customerSortAsc = true;

export default async function renderCustomers(container) {
  renderCustomersLayout(container);
}

function renderCustomersLayout(container) {
  container.innerHTML = `
    <!-- Top Filter actions bar -->
    <div class="view-card" style="margin-bottom: 20px; padding: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
        
        <div style="display: flex; gap: 12px; flex: 1; min-width: 300px;">
          <input type="text" class="form-control" id="customer-search-input" placeholder="Search by name, phone, or email..." style="max-width: 350px;">
          
          <select class="form-control" id="customer-balance-filter" style="max-width: 180px;">
            <option value="all">All Customers</option>
            <option value="dues">With Outstanding Dues</option>
            <option value="clear">Clear Balances</option>
          </select>
        </div>

        <button class="btn btn-primary" id="btn-add-customer-modal"><i data-lucide="plus-circle"></i> Add New Customer</button>
      </div>
    </div>

    <!-- Customers Directory Table -->
    <div class="view-card" style="margin-bottom: 0;">
      <div class="table-responsive" style="margin-top: 0;">
        <table class="app-table" id="customers-table">
          <thead>
            <tr>
              <th id="sort-cust-name" style="cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 6px;">Customer Name <span id="cust-icon-name" style="display: inline-flex; align-items: center;"></span></div>
              </th>
              <th>Phone Number</th>
              <th>Email Address</th>
              <th>GSTIN</th>
              <th id="sort-cust-balance" style="cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 6px;">Live Outstanding Due <span id="cust-icon-balance" style="display: inline-flex; align-items: center;"></span></div>
              </th>
              <th class="no-print" style="width: 200px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody id="customers-table-body">
            <!-- Dynamic Injection -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach search listeners
  document.getElementById('customer-search-input').addEventListener('input', refreshCustomersList);
  document.getElementById('customer-balance-filter').addEventListener('change', refreshCustomersList);
  document.getElementById('sort-cust-name').addEventListener('click', () => handleCustSort('name'));
  document.getElementById('sort-cust-balance').addEventListener('click', () => handleCustSort('balance'));

  // Modal triggers
  document.getElementById('btn-add-customer-modal').addEventListener('click', () => showCustomerAddModal());

  // Render initial list
  refreshCustomersList();

  if (window.lucide) window.lucide.createIcons();

  function handleCustSort(field) {
    if (customerSortField === field) {
      customerSortAsc = !customerSortAsc;
    } else {
      customerSortField = field;
      customerSortAsc = field !== 'balance'; // Default descending for balance
    }
    refreshCustomersList();
  }
}

function refreshCustomersList() {
  const query = document.getElementById('customer-search-input').value.toLowerCase();
  const filter = document.getElementById('customer-balance-filter').value;
  const customers = db.get('customers');
  const tbody = document.getElementById('customers-table-body');

  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(query) || 
                          (c.phone && c.phone.includes(query)) || 
                          (c.email && c.email.toLowerCase().includes(query));
    
    if (!matchesSearch) return false;

    const bal = calc.getCustomerBalance(c.id);
    if (filter === 'dues') return bal > 0.05; // float thresholds
    if (filter === 'clear') return bal <= 0.05;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;">No customers found. Click "Add New Customer" to register one.</td></tr>`;
    return;
  }

  // Enrich with computed balance for sorting
  const enriched = filtered.map(c => ({
    ...c,
    _liveBalance: calc.getCustomerBalance(c.id)
  }));

  // Sort enriched list
  enriched.sort((a, b) => {
    let valA, valB;
    if (customerSortField === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
      return customerSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (customerSortField === 'balance') {
      valA = a._liveBalance;
      valB = b._liveBalance;
    } else {
      return 0;
    }
    if (valA < valB) return customerSortAsc ? -1 : 1;
    if (valA > valB) return customerSortAsc ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = enriched.map(c => {
    const bal = c._liveBalance;
    return `
      <tr data-id="${c.id}">
        <td style="font-weight: 600;">${c.name}</td>
        <td>${c.phone || '—'}</td>
        <td style="color: hsl(var(--text-secondary));">${c.email || '—'}</td>
        <td style="font-family: var(--font-mono);">${c.gstin || '—'}</td>
        <td style="font-weight: 700;" class="${bal > 0 ? 'text-danger' : 'text-success'}">₹${bal.toFixed(2)}</td>
        <td class="no-print" style="display: flex; gap: 6px; justify-content: center;">
          ${bal > 0.05 
            ? `<button class="btn btn-secondary btn-sm-action btn-share-whatsapp" title="Share WhatsApp Statement" style="color: #25d366;"><i data-lucide="message-square"></i></button>`
            : ''
          }
          <button class="btn btn-secondary btn-sm-action btn-pay" title="Receive Dues" ${bal <= 0 ? 'disabled' : ''}><i data-lucide="hand-coins"></i> Pay</button>
          <button class="btn btn-secondary btn-sm-action btn-edit" title="Edit Customer"><i data-lucide="pencil"></i></button>
          <button class="btn btn-secondary btn-sm-action text-danger btn-delete" title="Delete Customer"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  // Update sort icons
  const iconMap = { name: 'cust-icon-name', balance: 'cust-icon-balance' };
  Object.entries(iconMap).forEach(([field, iconId]) => {
    const el = document.getElementById(iconId);
    if (!el) return;
    if (field === customerSortField) {
      el.innerHTML = customerSortAsc
        ? '<i data-lucide="chevron-up" style="width:12px;height:12px;"></i>'
        : '<i data-lucide="chevron-down" style="width:12px;height:12px;"></i>';
    } else {
      el.innerHTML = '<i data-lucide="chevrons-up-down" style="width:12px;height:12px;opacity:0.4;"></i>';
    }
  });

  if (window.lucide) window.lucide.createIcons();

  // Attach button actions
  tbody.querySelectorAll('tr').forEach(row => {
    const id = row.getAttribute('data-id');
    
    const payBtn = row.querySelector('.btn-pay');
    if (payBtn) {
      payBtn.addEventListener('click', () => showDirectReceiveDuesModal(id));
    }

    const shareBtn = row.querySelector('.btn-share-whatsapp');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const cust = db.find('customers', id);
        const bal = calc.getCustomerBalance(id);
        const settings = db.get('business_settings') || {};
        const bizName = settings.company_name || 'our business';
        const msg = `Dear ${cust.name}, your outstanding balance with ${bizName} is ₹${bal.toFixed(2)}. Please clear your dues at your earliest convenience. Thank you!`;
        const encodedText = encodeURIComponent(msg);
        
        let cleanPhone = (cust.phone || '').replace(/\D/g, '');
        if (cleanPhone.length === 10) {
          cleanPhone = '91' + cleanPhone;
        }
        
        const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
        window.open(url, '_blank');
      });
    }
    
    row.querySelector('.btn-edit').addEventListener('click', () => showCustomerAddModal(id));
    row.querySelector('.btn-delete').addEventListener('click', () => {
      const confirm = window.confirm("Are you sure you want to delete this customer?");
      if (confirm) {
        try {
          db.delete('customers', id);
          refreshCustomersList();
        } catch (err) {
          alert(`Delete blocked: ${err.message}`);
        }
      }
    });
  });
}

// Quick Add / Full Customer Modals Creator (Section 4 & 6 inline triggers support)
export function showCustomerAddModal(customerId = null, onSavedCallback = null) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!customerId;
  const cust = isEdit ? db.find('customers', customerId) : null;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="customer-modal-backdrop">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <h3><i data-lucide="user"></i> ${isEdit ? 'Modify Customer Profile' : 'Register New Customer'}</h3>
          <button class="modal-close-btn" id="btn-close-customer-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="customer-editor-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Customer Name *</label>
            <input type="text" class="form-control" name="name" value="${cust?.name || ''}" required>
          </div>
          <div class="form-grid" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" class="form-control" name="phone" value="${cust?.phone || ''}" placeholder="e.g. 9876543210" maxlength="30">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-control" name="email" value="${cust?.email || ''}">
            </div>
          </div>
          <div class="form-grid" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">GSTIN (optional)</label>
              <input type="text" class="form-control" name="gstin" value="${cust?.gstin || ''}" placeholder="15 characters">
            </div>
            <div class="form-group">
              <label class="form-label">Opening Balance Dues</label>
              <input type="number" step="0.01" class="form-control" name="opening_balance" value="${cust?.opening_balance || 0}" ${isEdit ? 'disabled' : ''}>
            </div>
          </div>
          
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Address (Printed on receipts)</label>
            <textarea class="form-control" name="address" rows="2" style="resize: vertical;">${cust?.address || ''}</textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-customer-editor">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Save Customer</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-customer-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-customer-editor').addEventListener('click', closeModal);

  document.getElementById('customer-editor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      gstin: formData.get('gstin'),
      address: formData.get('address')
    };

    if (!isEdit) {
      updates.opening_balance = parseFloat(formData.get('opening_balance') || 0);
    }

    // Validation (Section 32 Rules)
    // Validate phone number: must not contain letters, and must have at least 6 digits if provided
    if (updates.phone) {
      if (/[a-zA-Z]/.test(updates.phone)) {
        alert("Phone number cannot contain letters.");
        return;
      }
      const digitCount = updates.phone.replace(/\D/g, '').length;
      if (digitCount < 6) {
        alert("Phone number must contain at least 6 digits.");
        return;
      }
    }
    if (updates.gstin && updates.gstin.length !== 15) {
      alert("GSTIN must be exactly 15 characters if provided.");
      return;
    }

    try {
      let savedCust;
      if (isEdit) {
        savedCust = db.update('customers', customerId, updates);
      } else {
        savedCust = db.insert('customers', updates);
      }
      
      closeModal();
      
      if (onSavedCallback) {
        onSavedCallback(savedCust);
      } else {
        const tableBody = document.getElementById('customers-table-body');
        if (tableBody) {
          refreshCustomersList();
        }
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });
}

// 3. Receive Outstanding Dues direct dialog (Add Payment In record)
function showDirectReceiveDuesModal(customerId) {
  const modalContainer = document.getElementById('modal-container');
  const cust = db.find('customers', customerId);
  const bal = calc.getCustomerBalance(customerId);

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="cust-pay-modal-backdrop">
      <div class="modal-card" style="max-width: 420px;">
        <div class="modal-header">
          <h3><i data-lucide="hand-coins"></i> Receive Outstanding Payments</h3>
          <button class="modal-close-btn" id="btn-close-cust-pay-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="cust-pay-submit-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Customer Reference</label>
            <input type="text" class="form-control" value="${cust.name} (Outstanding: ₹${bal.toFixed(2)})" disabled>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Payment Date</label>
            <input type="date" class="form-control" name="date" value="${getLocalYYYYMMDD()}" required>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Amount to Receive (₹) *</label>
            <input type="number" step="0.01" class="form-control" name="amount" value="${bal.toFixed(2)}" max="${bal}" min="0.01" required>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Payment Channel *</label>
            <select class="form-control" name="method" required>
              <option value="Cash">Cash Account</option>
              <option value="UPI">UPI Account</option>
              <option value="Bank">Direct Bank Transfer</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Transaction Details / Notes</label>
            <input type="text" class="form-control" name="note" placeholder="Receipt details, deposit slip, UPI ref...">
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-cust-pay">Cancel</button>
            <button type="submit" class="btn btn-success"><i data-lucide="check"></i> Confirm Payment</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-cust-pay-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-cust-pay').addEventListener('click', closeModal);

  document.getElementById('cust-pay-submit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const amt = parseFloat(formData.get('amount') || 0);
    if (amt <= 0 || amt > bal + 0.05) {
      alert(`Invalid Amount! Receive amount must be greater than 0 and cannot exceed dues of ₹${bal.toFixed(2)}`);
      return;
    }

    const payIn = {
      customer_id: customerId,
      date: formData.get('date'),
      amount: amt,
      method: formData.get('method'),
      note: formData.get('note') || `Receive outstanding dues payment`
    };

    try {
      db.insert('payment_ins', payIn);
      closeModal();
      const tableBody = document.getElementById('customers-table-body');
      if (tableBody) {
        refreshCustomersList();
      }
      alert("Payment recorded and customer ledger adjusted.");
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    }
  });
}

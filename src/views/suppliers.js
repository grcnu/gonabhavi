/* ==========================================================================
   GONABHAVI — SUPPLIERS MASTER DIRECTORY (src/views/suppliers.js)
   ========================================================================== */

import { db, calc, getLocalYYYYMMDD } from '../db.js';

export default async function renderSuppliers(container) {
  renderSuppliersLayout(container);
}

function renderSuppliersLayout(container) {
  container.innerHTML = `
    <!-- Top Filter actions bar -->
    <div class="view-card" style="margin-bottom: 20px; padding: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
        
        <div style="display: flex; gap: 12px; flex: 1; min-width: 300px;">
          <input type="text" class="form-control" id="supplier-search-input" placeholder="Search by name, phone, or email..." style="max-width: 350px;">
          
          <select class="form-control" id="supplier-balance-filter" style="max-width: 180px;">
            <option value="all">All Suppliers</option>
            <option value="dues">With Outstanding Owed</option>
            <option value="clear">Clear Balances</option>
          </select>
        </div>

        <button class="btn btn-primary" id="btn-add-supplier-modal"><i data-lucide="plus-circle"></i> Add New Supplier</button>
      </div>
    </div>

    <!-- Suppliers Directory Table -->
    <div class="view-card" style="margin-bottom: 0;">
      <div class="table-responsive" style="margin-top: 0;">
        <table class="app-table" id="suppliers-table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Phone Number</th>
              <th>Email Address</th>
              <th>GSTIN</th>
              <th>Outstanding Owed</th>
              <th class="no-print" style="width: 200px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody id="suppliers-table-body">
            <!-- Dynamic Injection -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach search listeners
  document.getElementById('supplier-search-input').addEventListener('input', refreshSuppliersList);
  document.getElementById('supplier-balance-filter').addEventListener('change', refreshSuppliersList);

  // Modal triggers
  document.getElementById('btn-add-supplier-modal').addEventListener('click', () => showSupplierAddModal());

  // Render initial list
  refreshSuppliersList();

  if (window.lucide) window.lucide.createIcons();
}

function refreshSuppliersList() {
  const query = document.getElementById('supplier-search-input').value.toLowerCase();
  const filter = document.getElementById('supplier-balance-filter').value;
  const suppliers = db.get('suppliers');
  const tbody = document.getElementById('suppliers-table-body');

  const filtered = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(query) || 
                          (s.phone && s.phone.includes(query)) || 
                          (s.email && s.email.toLowerCase().includes(query));
    
    if (!matchesSearch) return false;

    const bal = calc.getSupplierBalance(s.id);
    if (filter === 'dues') return bal > 0.05;
    if (filter === 'clear') return bal <= 0.05;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;">No suppliers found. Click "Add New Supplier" to register one.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const bal = calc.getSupplierBalance(s.id);
    return `
      <tr data-id="${s.id}">
        <td style="font-weight: 600;">${s.name}</td>
        <td>${s.phone || '—'}</td>
        <td style="color: hsl(var(--text-secondary));">${s.email || '—'}</td>
        <td style="font-family: var(--font-mono);">${s.gstin || '—'}</td>
        <td style="font-weight: 700;" class="${bal > 0 ? 'text-danger' : 'text-success'}">₹${bal.toFixed(2)}</td>
        <td class="no-print" style="display: flex; gap: 6px; justify-content: center;">
          <button class="btn btn-secondary btn-sm-action btn-pay" title="Clear Dues Owed" ${bal <= 0 ? 'disabled' : ''}><i data-lucide="hand-coins"></i> Pay</button>
          <button class="btn btn-secondary btn-sm-action btn-edit" title="Edit Supplier"><i data-lucide="pencil"></i></button>
          <button class="btn btn-secondary btn-sm-action text-danger btn-delete" title="Delete Supplier"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  // Attach button actions
  tbody.querySelectorAll('tr').forEach(row => {
    const id = row.getAttribute('data-id');
    
    const payBtn = row.querySelector('.btn-pay');
    if (payBtn) {
      payBtn.addEventListener('click', () => showDirectPaySupplierModal(id));
    }
    
    row.querySelector('.btn-edit').addEventListener('click', () => showSupplierAddModal(id));
    row.querySelector('.btn-delete').addEventListener('click', () => {
      const confirm = window.confirm("Are you sure you want to delete this supplier?");
      if (confirm) {
        try {
          db.delete('suppliers', id);
          refreshSuppliersList();
        } catch (err) {
          alert(`Delete blocked: ${err.message}`);
        }
      }
    });
  });
}

// Quick Add / Full Supplier Modals Creator
export function showSupplierAddModal(supplierId = null, onSavedCallback = null) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!supplierId;
  const supplier = isEdit ? db.find('suppliers', supplierId) : null;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="supplier-modal-backdrop">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <h3><i data-lucide="briefcase"></i> ${isEdit ? 'Modify Supplier Profile' : 'Register New Supplier'}</h3>
          <button class="modal-close-btn" id="btn-close-supplier-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="supplier-editor-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Supplier Name *</label>
            <input type="text" class="form-control" name="name" value="${supplier?.name || ''}" required>
          </div>
          <div class="form-grid" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" class="form-control" name="phone" value="${supplier?.phone || ''}" placeholder="e.g. 9876543210" maxlength="30">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-control" name="email" value="${supplier?.email || ''}">
            </div>
          </div>
          <div class="form-grid" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">GSTIN (optional)</label>
              <input type="text" class="form-control" name="gstin" value="${supplier?.gstin || ''}" placeholder="15 characters">
            </div>
            <div class="form-group">
              <label class="form-label">Opening Owed Balance</label>
              <input type="number" step="0.01" class="form-control" name="opening_balance" value="${supplier?.opening_balance || 0}" ${isEdit ? 'disabled' : ''}>
            </div>
          </div>
          
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Office Address</label>
            <textarea class="form-control" name="address" rows="2" style="resize: vertical;">${supplier?.address || ''}</textarea>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-supplier-editor">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Save Supplier</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-supplier-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-supplier-editor').addEventListener('click', closeModal);

  document.getElementById('supplier-editor-form').addEventListener('submit', (e) => {
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
      let savedSup;
      if (isEdit) {
        savedSup = db.update('suppliers', supplierId, updates);
      } else {
        savedSup = db.insert('suppliers', updates);
      }
      
      closeModal();
      
      if (onSavedCallback) {
        onSavedCallback(savedSup);
      } else {
        refreshSuppliersList();
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });
}

// 3. Clear Supplier Outstanding Dues dialog (Add Payment Out record)
function showDirectPaySupplierModal(supplierId) {
  const modalContainer = document.getElementById('modal-container');
  const supplier = db.find('suppliers', supplierId);
  const bal = calc.getSupplierBalance(supplierId);

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="sup-pay-modal-backdrop">
      <div class="modal-card" style="max-width: 420px;">
        <div class="modal-header">
          <h3><i data-lucide="hand-coins"></i> Clear Supplier Outstanding</h3>
          <button class="modal-close-btn" id="btn-close-sup-pay-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="sup-pay-submit-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Supplier Reference</label>
            <input type="text" class="form-control" value="${supplier.name} (Owed: ₹${bal.toFixed(2)})" disabled>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Payment Date</label>
            <input type="date" class="form-control" name="date" value="${getLocalYYYYMMDD()}" required>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Amount to Pay (₹) *</label>
            <input type="number" step="0.01" class="form-control" name="amount" value="${bal.toFixed(2)}" max="${bal}" min="0.01" required>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Payment Method *</label>
            <select class="form-control" name="method" required>
              <option value="Cash">Cash Account</option>
              <option value="UPI">UPI Account</option>
              <option value="Bank">Direct Bank Transfer</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Transaction Reference / Notes</label>
            <input type="text" class="form-control" name="note" placeholder="Check number, bank transfer ID...">
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-sup-pay">Cancel</button>
            <button type="submit" class="btn btn-danger"><i data-lucide="check"></i> Confirm Payment</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-sup-pay-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-sup-pay').addEventListener('click', closeModal);

  document.getElementById('sup-pay-submit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const amt = parseFloat(formData.get('amount') || 0);
    if (amt <= 0 || amt > bal + 0.05) {
      alert(`Invalid Amount! Payment amount must be greater than 0 and cannot exceed outstanding of ₹${bal.toFixed(2)}`);
      return;
    }

    const payOut = {
      supplier_id: supplierId,
      date: formData.get('date'),
      amount: amt,
      method: formData.get('method'),
      note: formData.get('note') || `Paid supplier outstanding dues`
    };

    try {
      db.insert('payment_outs', payOut);
      closeModal();
      refreshSuppliersList();
      alert("Supplier payment recorded and ledger updated.");
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    }
  });
}

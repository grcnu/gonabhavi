/* ==========================================================================
   GONABHAVI — FUND TRANSFERS MANAGER (src/views/transfers.js)
   ========================================================================== */

import { db, calc, generateUUID, formatDateToDDMMYY, getLocalYYYYMMDD, formatTimeFromTimestamp } from '../db.js';

export default async function renderTransfers(container) {
  const transfers = db.get('fund_transfers');
  
  // Sort newest first by timestamp and date
  transfers.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
    const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
    return timeB - timeA;
  });

  // Current accounts balances
  const accounts = calc.getAccountBalances();

  container.innerHTML = `
    <div class="view-card animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="shuffle" style="color: hsl(var(--primary));"></i>
          Cash & UPI to Bank Transfers
        </h2>
        <button id="transfer-btn-new" class="btn btn-primary">
          <i data-lucide="plus"></i> Log Fund Deposit
        </button>
      </div>

      <!-- Current Accounts Balances Grid -->
      <div class="dashboard-grid" style="margin-bottom: 24px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Cash Balance</span>
            <span class="stat-value" style="font-size: 1.35rem; color: ${accounts.cash < 0 ? 'hsl(var(--danger))' : 'inherit'}">₹${accounts.cash.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-success" style="width: 38px; height: 38px;">
            <i data-lucide="banknote" style="width: 18px; height: 18px;"></i>
          </div>
        </div>
        <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">UPI Digital Balance</span>
            <span class="stat-value" style="font-size: 1.35rem; color: ${accounts.upi < 0 ? 'hsl(var(--danger))' : 'inherit'}">₹${accounts.upi.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-info" style="width: 38px; height: 38px;">
            <i data-lucide="smartphone" style="width: 18px; height: 18px;"></i>
          </div>
        </div>
        <div class="stat-card" style="padding: 14px 20px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Bank Account Balance</span>
            <span class="stat-value" style="font-size: 1.35rem; color: ${accounts.bank < 0 ? 'hsl(var(--danger))' : 'inherit'}">₹${accounts.bank.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-primary" style="width: 38px; height: 38px;">
            <i data-lucide="landmark" style="width: 18px; height: 18px;"></i>
          </div>
        </div>
      </div>

      <!-- History Table -->
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Transfer Path</th>
              <th>Recipient Account</th>
              <th>Reference / Slip No.</th>
              <th class="text-right">Transfer Amount</th>
              <th class="text-center" style="width: 80px;">Action</th>
            </tr>
          </thead>
          <tbody id="transfer-table-body">
            ${transfers.length === 0 ? `
              <tr>
                <td colspan="6" class="text-center text-muted" style="padding: 40px 20px;">
                  <i data-lucide="shuffle" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
                  <p>No fund transfer deposits recorded yet.</p>
                </td>
              </tr>
            ` : transfers.map(t => `
              <tr>
                <td style="white-space: nowrap;">
                  <div>${formatDateToDDMMYY(t.date)}</div>
                  ${t.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(t.created_at)}</div>` : ''}
                </td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge ${t.from_account === 'Cash' ? 'color-success' : 'color-info'}" style="padding: 3px 8px;">${t.from_account}</span>
                    <i data-lucide="arrow-right" style="width: 14px; height: 14px; color: hsl(var(--text-muted));"></i>
                    <span class="badge color-primary" style="padding: 3px 8px;">Bank</span>
                  </div>
                </td>
                <td><span style="font-weight: 600;">Bank Ledger</span></td>
                <td style="font-size: 0.85rem; color: hsl(var(--text-secondary));">${t.note || '—'}</td>
                <td class="text-right" style="font-weight: 700; color: hsl(var(--primary));">₹${parseFloat(t.amount || 0).toFixed(2)}</td>
                <td class="text-center">
                  <button class="btn btn-danger btn-sm transfer-delete-btn" data-id="${t.id}" style="padding: 6px; border-radius: 50%;" title="Delete Transfer Record">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Backdrop -->
    <div id="transfer-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>

    <!-- Modal Form -->
    <div id="transfer-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 450px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 20px;">
        <h3 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="shuffle" style="color: hsl(var(--primary));"></i>
          Record Fund Transfer
        </h3>
        <button id="transfer-modal-close" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
      </div>

      <form id="transfer-form" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label class="form-label">Transfer Date</label>
          <input type="date" id="transfer-date" class="form-control" required>
        </div>

        <div class="form-group">
          <label class="form-label">Transfer From Source</label>
          <select id="transfer-from" class="form-control" required>
            <option value="">-- Choose Account --</option>
            <option value="Cash">Cash Account (Avail: ₹${accounts.cash.toFixed(2)})</option>
            <option value="UPI">UPI digital (Avail: ₹${accounts.upi.toFixed(2)})</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Transfer To Destination</label>
          <input type="text" class="form-control" value="Bank Account (Default)" disabled style="background-color: hsl(var(--bg-primary)); cursor: not-allowed;">
        </div>

        <div class="form-group">
          <label class="form-label">Deposit Amount (₹)</label>
          <input type="number" step="0.01" min="0.01" id="transfer-amount" class="form-control" placeholder="0.00" required>
        </div>

        <div class="form-group">
          <label class="form-label">Reference Note / Deposit Slip No.</label>
          <textarea id="transfer-note" class="form-control" rows="3" placeholder="Slip number, ATM deposit code, digital memo..."></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
          <button type="button" id="transfer-cancel" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Process Deposit</button>
        </div>
      </form>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // DOM bindings
  const modal = document.getElementById('transfer-modal');
  const backdrop = document.getElementById('transfer-modal-backdrop');
  const closeBtn = document.getElementById('transfer-modal-close');
  const cancelBtn = document.getElementById('transfer-cancel');
  const form = document.getElementById('transfer-form');

  // Trigger modal open
  document.getElementById('transfer-btn-new').addEventListener('click', () => {
    document.getElementById('transfer-date').value = getLocalYYYYMMDD();
    form.reset();
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

  // Form submit handler with safety override confirmation
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('transfer-date').value;
    const from_account = document.getElementById('transfer-from').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value || 0);
    const note = document.getElementById('transfer-note').value;

    if (!from_account || amount <= 0) {
      alert("Please specify a valid transfer account source and positive amount.");
      return;
    }

    // Source Balance Safety check
    const currentSourceVal = from_account === 'Cash' ? accounts.cash : accounts.upi;
    if (amount > currentSourceVal) {
      const confirmOverride = confirm(`[OVERDRAFT WARNING] Transfer amount of ₹${amount.toFixed(2)} exceeds the available ${from_account} account balance of ₹${currentSourceVal.toFixed(2)}.\n\nAre you sure you want to proceed and override this safety limit?`);
      if (!confirmOverride) {
        return;
      }
    }

    try {
      db.insert('fund_transfers', {
        date,
        from_account,
        to_account: 'Bank',
        amount,
        note
      });
      
      closeModal();
      window.dispatchEvent(new CustomEvent('gb-db-change'));
      
      // Reload view
      renderTransfers(container);
    } catch (err) {
      alert(err.message);
    }
  });

  // Delete Action handler
  document.querySelectorAll('.transfer-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Are you sure you want to delete this fund transfer? The money will be reversed out of Bank and put back into the source account.")) {
        db.delete('fund_transfers', id);
        window.dispatchEvent(new CustomEvent('gb-db-change'));
        renderTransfers(container);
      }
    });
  });
}

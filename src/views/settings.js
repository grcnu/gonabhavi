/* ==========================================================================
   GONABHAVI — SETTINGS & CLOUD SYNC CONFIGURATION (src/views/settings.js)
   ========================================================================== */

import { db, getSupabase, getLocalYYYYMMDD } from '../db.js';
import { updateHeaderBadges } from '../app.js';

// Default Export: Main Company Settings Page
export default async function renderSettings(container) {
  const settings = db.get('business_settings');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
      
      <!-- Company Details Form -->
      <div class="view-card" style="margin-bottom: 0;">
        <h3 class="card-title"><i data-lucide="building"></i> Company Profile</h3>
        <form id="company-profile-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Company Name *</label>
              <input type="text" class="form-control" name="company_name" value="${settings.company_name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" class="form-control" name="phone" value="${settings.phone || ''}" placeholder="e.g. 9876543210 or 080-123456" maxlength="30">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-control" name="email" value="${settings.email || ''}">
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Full Address</label>
            <textarea class="form-control" name="address" rows="3" style="resize: vertical;">${settings.address || ''}</textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">GSTIN (GST Number)</label>
              <input type="text" class="form-control" name="gstin" value="${settings.gstin || ''}" placeholder="15 characters">
            </div>
            <div class="form-group">
              <label class="form-label">PAN Number</label>
              <input type="text" class="form-control" name="pan" value="${settings.pan || ''}" placeholder="Format: AAAAA9999A">
            </div>
            <div class="form-group">
              <label class="form-label">State Name</label>
              <input type="text" class="form-control" name="state_name" value="${settings.state_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">State Code</label>
              <input type="text" class="form-control" name="state_code" value="${settings.state_code || ''}" placeholder="2-digit (01-37)">
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid hsl(var(--border-color)); margin: 24px 0;">
          
          <h4 style="margin-bottom: 16px; font-family: var(--font-brand); font-weight: 600;"><i data-lucide="credit-card"></i> Bank Details & UPI ID</h4>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <input type="text" class="form-control" name="bank_name" value="${settings.bank_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Account Number</label>
              <input type="text" class="form-control" name="bank_account_number" value="${settings.bank_account_number || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">IFSC Code</label>
              <input type="text" class="form-control" name="ifsc_code" value="${settings.ifsc_code || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">UPI ID</label>
              <input type="text" class="form-control" name="upi_id" value="${settings.upi_id || ''}" placeholder="upi@bank">
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid hsl(var(--border-color)); margin: 24px 0;">

          <h4 style="margin-bottom: 16px; font-family: var(--font-brand); font-weight: 600;"><i data-lucide="wallet"></i> Custom Payment Method Labels</h4>
          <p style="font-size: 0.82rem; color: hsl(var(--text-secondary)); margin-bottom: 12px; line-height: 1.4;">
            Rename the default payment account labels to match your business ledger names. For example, you can rename "UPI" to "SBI Bank" and "Bank" to "HDFC Bank" to track payments across two bank accounts.
          </p>
          <div class="form-grid" style="margin-bottom: 16px;">
            <div class="form-group">
              <label class="form-label">Cash Account Label</label>
              <input type="text" class="form-control" name="account_cash_label" value="${settings.account_cash_label || 'Cash'}" placeholder="e.g. Cash Ledger">
            </div>
            <div class="form-group">
              <label class="form-label">UPI Account Label</label>
              <input type="text" class="form-control" name="account_upi_label" value="${settings.account_upi_label || 'UPI'}" placeholder="e.g. UPI Wallet / Bank 2">
            </div>
            <div class="form-group">
              <label class="form-label">Bank Account Label</label>
              <input type="text" class="form-control" name="account_bank_label" value="${settings.account_bank_label || 'Bank'}" placeholder="e.g. Bank Account / HDFC">
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid hsl(var(--border-color)); margin: 24px 0;">

          <h4 style="margin-bottom: 16px; font-family: var(--font-brand); font-weight: 600;"><i data-lucide="file-check"></i> Invoice Branding & Terms</h4>
          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Terms and Conditions</label>
            <textarea class="form-control" name="invoice_terms" rows="2" style="resize: vertical;">${settings.invoice_terms || ''}</textarea>
          </div>

          <div style="text-align: right;">
            <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Save Profile Details</button>
          </div>

          <div style="margin-top: 24px; padding: 12px; border-radius: var(--radius-sm); background: hsl(var(--bg-secondary)); border: 1px dashed hsl(var(--border-color)); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <span style="font-size: 0.8rem; color: hsl(var(--text-secondary));"><i data-lucide="shield" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Need to backup or sync your local data?</span>
            <a href="#sync-backup" class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.8rem;"><i data-lucide="database"></i> Backup & Sync Screen</a>
          </div>
        </form>
      </div>

      <!-- Staff User Directory & Permissions -->
      <div class="view-card" style="margin-top: 20px; margin-bottom: 0;">
        <h3 class="card-title"><i data-lucide="users"></i> Staff User Directory & Permissions</h3>
        <p style="font-size: 0.85rem; color: hsl(var(--text-secondary)); margin-bottom: 16px; line-height: 1.4;">
          Create employee accounts and configure what areas of the software they can access. Checked items are allowed, unchecked items are blocked.
        </p>

        <!-- Staff List Table -->
        <div class="table-responsive" style="margin-top: 0; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm); margin-bottom: 20px;">
          <table class="app-table" style="font-size: 0.8rem; margin: 0;">
            <thead>
              <tr style="background: hsl(var(--bg-secondary));">
                <th style="padding: 6px 8px;">Employee Email</th>
                <th style="padding: 6px 8px; text-align: center;">Purchases</th>
                <th style="padding: 6px 8px; text-align: center;">Expenses</th>
                <th style="padding: 6px 8px; text-align: center;">Reports</th>
                <th style="padding: 6px 8px; text-align: center;">Dashboard Balances</th>
                <th style="padding: 6px 8px; text-align: center;">Delete Invoices</th>
                <th style="padding: 6px 8px; text-align: center; width: 60px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const staffList = settings.staff_users || [];
                if (staffList.length === 0) {
                  return `<tr><td colspan="7" class="text-center text-muted" style="padding: 16px;">No employee accounts configured yet.</td></tr>`;
                }
                return staffList.map((s, sIdx) => {
                  const perm = s.permissions || {};
                  return `
                    <tr data-index="${sIdx}">
                      <td style="padding: 6px 8px; font-weight: 600; font-family: var(--font-mono);">${s.email}</td>
                      <td style="padding: 6px 8px; text-align: center;">
                        <input type="checkbox" class="staff-perm-check" data-index="${sIdx}" data-perm="allow_purchases" ${perm.allow_purchases ? 'checked' : ''} style="cursor: pointer;">
                      </td>
                      <td style="padding: 6px 8px; text-align: center;">
                        <input type="checkbox" class="staff-perm-check" data-index="${sIdx}" data-perm="allow_expenses" ${perm.allow_expenses ? 'checked' : ''} style="cursor: pointer;">
                      </td>
                      <td style="padding: 6px 8px; text-align: center;">
                        <input type="checkbox" class="staff-perm-check" data-index="${sIdx}" data-perm="allow_reports" ${perm.allow_reports ? 'checked' : ''} style="cursor: pointer;">
                      </td>
                      <td style="padding: 6px 8px; text-align: center;">
                        <input type="checkbox" class="staff-perm-check" data-index="${sIdx}" data-perm="allow_dashboard_balances" ${perm.allow_dashboard_balances ? 'checked' : ''} style="cursor: pointer;">
                      </td>
                      <td style="padding: 6px 8px; text-align: center;">
                        <input type="checkbox" class="staff-perm-check" data-index="${sIdx}" data-perm="allow_delete_invoices" ${perm.allow_delete_invoices ? 'checked' : ''} style="cursor: pointer;">
                      </td>
                      <td style="padding: 6px 8px; text-align: center;">
                        <button class="btn btn-secondary btn-sm text-danger btn-delete-staff" data-index="${sIdx}" style="padding: 4px; min-height: unset; height: 24px; width: 24px; border-radius: var(--radius-xs);" title="Remove Employee"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
                      </td>
                    </tr>
                  `;
                }).join('');
              })()}
            </tbody>
          </table>
        </div>

        <!-- Add Staff Account Form -->
        <h4 style="margin-bottom: 12px; font-family: var(--font-brand); font-weight: 600;"><i data-lucide="user-plus"></i> Add New Employee Account</h4>
        <form id="create-staff-account-form">
          <div class="form-grid" style="grid-template-columns: 1fr 1fr 100px; gap: 10px; align-items: flex-end; margin-bottom: 0;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Employee Email</label>
              <input type="email" class="form-control" name="staff_email" placeholder="staff@store.com" required style="padding: 6px 10px; height: 34px; font-size: 0.85rem;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Password (Min 6 chars)</label>
              <input type="password" class="form-control" name="staff_password" placeholder="Password" required minlength="6" style="padding: 6px 10px; height: 34px; font-size: 0.85rem;">
            </div>
            <button type="submit" class="btn btn-primary" style="height: 34px; font-size: 0.85rem; padding: 0; justify-content: center; display: flex; align-items: center; gap: 4px;"><i data-lucide="plus"></i> Add</button>
          </div>
        </form>
      </div>

      <!-- Secondary Panel: Invoice Custom Numbering and Logo previews -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Invoice Settings Card -->
        <div class="view-card">
          <h3 class="card-title"><i data-lucide="hash"></i> Invoice Sequences</h3>
          <form id="invoice-sequencing-form">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Prefix</label>
              <input type="text" class="form-control" name="invoice_prefix" value="${settings.invoice_prefix || 'INV'}">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Separator</label>
              <input type="text" class="form-control" name="invoice_separator" value="${settings.invoice_separator || '-'}">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Start Number</label>
              <input type="number" class="form-control" name="invoice_start_number" value="${settings.invoice_start_number || 1}">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Padding (Digits)</label>
              <input type="number" class="form-control" name="invoice_padding" value="${settings.invoice_padding || 4}" min="1" max="10">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Suffix (optional)</label>
              <input type="text" class="form-control" name="invoice_suffix" value="${settings.invoice_suffix || ''}">
            </div>

            <hr style="border: none; border-top: 1px solid hsl(var(--border-color)); margin: 16px 0;">

            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label" style="display: flex; align-items: center; gap: 6px;">
                <i data-lucide="monitor" style="width: 14px; height: 14px;"></i>
                This Computer's Invoice Prefix
              </label>
              <input type="text" class="form-control" id="device-prefix-input"
                value="${localStorage.getItem('gb_device_prefix') || ''}"
                placeholder="e.g. A for Shop 1, B for Shop 2 (leave blank if only 1 shop)" maxlength="3">
              <p style="font-size: 0.75rem; color: hsl(var(--warning)); margin-top: 6px; line-height: 1.5; background: hsl(var(--warning) / 0.08); padding: 8px 10px; border-radius: var(--radius-xs); border-left: 3px solid hsl(var(--warning));">
                <strong>&#9888; This setting is saved on THIS browser/computer only. It does NOT sync to other devices.</strong><br>
                If you run 2 shops, type <strong>A</strong> here on Shop 1's computer, and type <strong>B</strong> on Shop 2's computer separately.
                Shop 1 will then generate <em>A-INV-0034</em> and Shop 2 will generate <em>B-INV-0034</em> — they can never clash.
              </p>
            </div>

            <div class="form-group" style="margin-bottom: 16px; flex-direction: row; gap: 8px; align-items: center; margin-top: 10px;">
              <input type="checkbox" id="fy_reset" name="fy_reset" ${settings.fy_reset ? 'checked' : ''} style="cursor: pointer;">
              <label for="fy_reset" class="form-label" style="margin-bottom: 0; cursor: pointer;">Financial Year Reset (1st April)</label>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;"><i data-lucide="save"></i> Update Sequence</button>
          </form>
        </div>

        <!-- Logo & Signature Preview Card -->
        <div class="view-card">
          <h3 class="card-title"><i data-lucide="image"></i> Branding Images</h3>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Company Logo (Click to Upload)</label>
            <div class="logo-placeholder" id="logo-dropzone" style="border: 2px dashed hsl(var(--border-color)); padding: 20px; border-radius: var(--radius-sm); text-align: center; cursor: pointer; background: hsl(var(--bg-primary));">
              ${settings.logo_base64 
                ? `<img src="${settings.logo_base64}" alt="Logo" style="max-height: 80px; max-width: 100%;">` 
                : `<i data-lucide="image-plus" style="width: 32px; height: 32px; color: hsl(var(--text-muted)); margin-bottom: 8px;"></i><p style="font-size: 0.8rem; color: hsl(var(--text-secondary));">Upload Logo</p>`
              }
            </div>
            <input type="file" id="logo-file-input" accept="image/*" style="display: none;">
          </div>

          <div class="form-group">
            <label class="form-label">Authorized Signature</label>
            <div class="logo-placeholder" id="sig-dropzone" style="border: 2px dashed hsl(var(--border-color)); padding: 20px; border-radius: var(--radius-sm); text-align: center; cursor: pointer; background: hsl(var(--bg-primary));">
              ${settings.sig_base64 
                ? `<img src="${settings.sig_base64}" alt="Signature" style="max-height: 80px; max-width: 100%;">` 
                : `<i data-lucide="pen-tool" style="width: 32px; height: 32px; color: hsl(var(--text-muted)); margin-bottom: 8px;"></i><p style="font-size: 0.8rem; color: hsl(var(--text-secondary));">Upload Signature</p>`
              }
            </div>
            <input type="file" id="sig-file-input" accept="image/*" style="display: none;">
          </div>
        </div>

      </div>

    </div>
  `;

  // Apply Lucide icons
  if (window.lucide) window.lucide.createIcons();

  // Attach submit listeners
  document.getElementById('company-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {};
    formData.forEach((val, key) => updates[key] = val);
    
    // Validations (Section 32 Data Rules)
    if (updates.gstin && updates.gstin.length !== 15) {
      alert("GSTIN must be exactly 15 alphanumeric characters if provided.");
      return;
    }
    if (updates.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(updates.pan)) {
      alert("PAN format must be exactly AAAAA9999A (e.g. ABCDE1234F).");
      return;
    }
    if (updates.state_code && !/^[0-9]{2}$/.test(updates.state_code)) {
      alert("State code must be exactly 2-digit number (e.g., 29).");
      return;
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

    try {
      db.update('business_settings', settings.id, updates);
      alert("Company Profile saved successfully.");
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });

  document.getElementById('invoice-sequencing-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // BUG 6 FIX: parseInt('abc') = NaN was being saved directly, producing "INV-NaN" invoice numbers
    // Pattern: parse first, then || fallback (not the other way around)
    const rawStart   = parseInt(formData.get('invoice_start_number'));
    const rawPadding = parseInt(formData.get('invoice_padding'));
    const updates = {
      invoice_prefix:       formData.get('invoice_prefix'),
      invoice_separator:    formData.get('invoice_separator'),
      invoice_start_number: isNaN(rawStart)   ? 1 : rawStart,
      invoice_padding:      isNaN(rawPadding) ? 4 : Math.min(10, Math.max(1, rawPadding)),
      invoice_suffix:       formData.get('invoice_suffix'),
      fy_reset:             document.getElementById('fy_reset').checked
    };

    // Save device prefix to THIS browser's localStorage only — it must NOT sync to cloud
    // This is intentionally separate so each shop computer keeps its own independent prefix
    const devicePrefix = (document.getElementById('device-prefix-input')?.value || '').trim().toUpperCase();
    localStorage.setItem('gb_device_prefix', devicePrefix);

    try {
      db.update('business_settings', settings.id, updates);
      alert(`Invoice Numbering rules saved.${devicePrefix ? ` This computer's invoice prefix is set to: "${devicePrefix}"` : ' No device prefix set (single shop mode).'}`);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });


  // Handle Logo Upload base64 conversion
  const logoDrop = document.getElementById('logo-dropzone');
  const logoInput = document.getElementById('logo-file-input');
  logoDrop.addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        db.update('business_settings', settings.id, { logo_base64: evt.target.result });
        logoDrop.innerHTML = `<img src="${evt.target.result}" alt="Logo" style="max-height: 80px; max-width: 100%;">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle Signature Upload base64 conversion
  const sigDrop = document.getElementById('sig-dropzone');
  const sigInput = document.getElementById('sig-file-input');
  sigDrop.addEventListener('click', () => sigInput.click());
  sigInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        db.update('business_settings', settings.id, { sig_base64: evt.target.result });
        sigDrop.innerHTML = `<img src="${evt.target.result}" alt="Signature" style="max-height: 80px; max-width: 100%;">`;
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle Staff Creation Submit
  const staffForm = document.getElementById('create-staff-account-form');
  if (staffForm) {
    staffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const email = formData.get('staff_email').trim();
      const pass = formData.get('staff_password');
      
      const staffList = settings.staff_users || [];
      if (staffList.some(s => s.email.toLowerCase() === email.toLowerCase())) {
        alert("Employee account with this email already exists in settings.");
        return;
      }

      try {
        const client = getSupabase();
        if (client) {
          alert("Creating employee account on Supabase cloud database...");
          const { error } = await client.auth.signUp({ email, password: pass });
          if (error) {
            if (!error.message.includes("already registered")) {
              throw error;
            }
          }
        }
        
        const newStaff = {
          email: email,
          permissions: {
            allow_purchases: true,
            allow_expenses: true,
            allow_reports: false,
            allow_dashboard_balances: false,
            allow_delete_invoices: false
          }
        };

        settings.staff_users = [...staffList, newStaff];
        db.update('business_settings', settings.id, { staff_users: settings.staff_users });
        
        alert(`Employee account for ${email} added successfully.`);
        renderSettings(container);
        
        const appModule = await import('../app.js');
        if (appModule && appModule.applyStaffRestrictions) {
          appModule.applyStaffRestrictions();
        }
      } catch (err) {
        alert(`Failed to add employee account: ${err.message}`);
      }
    });
  }

  // Handle Staff Permissions Toggles
  document.querySelectorAll('.staff-perm-check').forEach(check => {
    check.addEventListener('change', async (e) => {
      const idx = parseInt(check.getAttribute('data-index'));
      const permName = check.getAttribute('data-perm');
      
      settings.staff_users[idx].permissions = settings.staff_users[idx].permissions || {};
      settings.staff_users[idx].permissions[permName] = check.checked;
      
      try {
        db.update('business_settings', settings.id, { staff_users: settings.staff_users });
        
        const appModule = await import('../app.js');
        if (appModule && appModule.applyStaffRestrictions) {
          appModule.applyStaffRestrictions();
        }
      } catch (err) {
        alert(`Failed to update permissions: ${err.message}`);
      }
    });
  });

  // Handle Staff Account Deletion
  document.querySelectorAll('.btn-delete-staff').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-index'));
      const email = settings.staff_users[idx].email;
      
      const confirm = window.confirm(`Are you sure you want to permanently remove staff access for ${email}?`);
      if (confirm) {
        try {
          settings.staff_users.splice(idx, 1);
          db.update('business_settings', settings.id, { staff_users: settings.staff_users });
          
          alert("Employee account removed successfully.");
          renderSettings(container);
          
          const appModule = await import('../app.js');
          if (appModule && appModule.applyStaffRestrictions) {
            appModule.applyStaffRestrictions();
          }
        } catch (err) {
          alert(`Failed to delete employee: ${err.message}`);
        }
      }
    });
  });
}

// Named Export: Backup & Sync Setup View
export async function SyncBackupView(container) {
  const settings = db.get('business_settings');
  const session = localStorage.getItem('gb_session');
  let userEmail = 'Offline Guest';
  if (session) {
    try { userEmail = JSON.parse(session).email; } catch(e) {}
  }

  // Entity display config: internal key → friendly name + icon
  const SYNC_ENTITIES = [
    { key: 'invoices',          label: 'Sale Invoices',       icon: 'receipt' },
    { key: 'products',          label: 'Products',            icon: 'package' },
    { key: 'customers',         label: 'Customers',           icon: 'users' },
    { key: 'suppliers',         label: 'Suppliers',           icon: 'truck' },
    { key: 'purchases',         label: 'Purchase Bills',      icon: 'shopping-cart' },
    { key: 'payment_ins',       label: 'Payments Received',   icon: 'arrow-down-circle' },
    { key: 'payment_outs',      label: 'Payments Made',       icon: 'arrow-up-circle' },
    { key: 'expenses',          label: 'Expenses',            icon: 'credit-card' },
    { key: 'sale_orders',       label: 'Sale Orders',         icon: 'clipboard-list' },
    { key: 'estimates',         label: 'Estimates/Quotations',icon: 'file-text' },
    { key: 'delivery_challans', label: 'Delivery Challans',   icon: 'truck' },
    { key: 'sales_returns',     label: 'Sales Returns',       icon: 'rotate-ccw' },
    { key: 'purchase_returns',  label: 'Purchase Returns',    icon: 'rotate-cw' },
    { key: 'stock_adjustments', label: 'Stock Adjustments',   icon: 'layers' },
    { key: 'fund_transfers',    label: 'Fund Transfers',      icon: 'arrow-right-left' },
    { key: 'business_settings', label: 'Business Settings',   icon: 'settings' },
  ];

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      
      <!-- Supabase Cloud Sync Card -->
      <div class="view-card" style="margin-bottom: 0;">
        <h3 class="card-title"><i data-lucide="cloud"></i> Supabase Cloud Sync</h3>
        
        <form id="supabase-config-form" style="margin-bottom: 24px;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Supabase URL</label>
            <input type="url" class="form-control" name="supabase_url" value="${settings.supabase_url || ''}" placeholder="https://xyz.supabase.co" required>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Supabase Public Anon Key</label>
            <input type="password" class="form-control" name="supabase_key" value="${settings.supabase_key || ''}" placeholder="eyJhbGciOi..." required>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button type="submit" class="btn btn-secondary" style="flex: 1;"><i data-lucide="save"></i> Save Connection</button>
            <button type="button" class="btn btn-primary" id="btn-test-sync" style="flex: 1;"><i data-lucide="network"></i> Test & Sync Now</button>
          </div>
        </form>

        <hr style="border: none; border-top: 1px solid hsl(var(--border-color)); margin: 24px 0;">

        <h4 style="margin-bottom: 16px; font-family: var(--font-brand); font-weight: 600;"><i data-lucide="user-check"></i> Account Login / Sign Up</h4>
        ${session 
          ? `
            <div style="background: hsl(var(--success-transparent)); border: 1px solid hsl(var(--success)); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 20px;">
              <p style="font-weight: 600; color: hsl(var(--success)); margin-bottom: 4px;"><i data-lucide="shield-check" style="display: inline-block; width: 16px; height: 16px; vertical-align: middle;"></i> Cloud Sync Session Active</p>
              <p style="font-size: 0.85rem; color: hsl(var(--text-secondary));">Signed in as: <strong>${userEmail}</strong>. All changes auto-sync to cloud with a 3-second debounce.</p>
            </div>
            <button class="btn btn-danger" id="btn-cloud-logout" style="width: 100%;"><i data-lucide="log-out"></i> Sign Out from Account</button>
          `
          : `
            <div style="background: hsl(var(--bg-primary)); border: 1px solid hsl(var(--border-color)); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.85rem; color: hsl(var(--text-secondary));">
              <p style="margin-bottom: 8px;">To enable multi-device sync (Windows + Android), first register or sign in.</p>
              <p>All data belongs privately to your user account isolation.</p>
            </div>
            
            <form id="auth-account-form">
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-control" name="auth_email" required>
              </div>
              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" name="auth_password" required minlength="6">
              </div>
              
              <div style="display: flex; gap: 12px;">
                <button type="button" class="btn btn-secondary" id="btn-auth-signup" style="flex: 1;"><i data-lucide="user-plus"></i> Sign Up</button>
                <button type="submit" class="btn btn-primary" style="flex: 1;"><i data-lucide="log-in"></i> Sign In</button>
              </div>
            </form>
          `
        }
      </div>

      <!-- Local JSON Backup Card -->
      <div class="view-card" style="margin-bottom: 0;">
        <h3 class="card-title"><i data-lucide="database"></i> Local Backup & Restore</h3>
        
        <div style="background: hsl(var(--bg-primary)); border: 1px solid hsl(var(--border-color)); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 24px; font-size: 0.85rem; color: hsl(var(--text-secondary));">
          <p style="font-weight: 600; color: hsl(var(--text-primary)); margin-bottom: 6px;">Protect your local data</p>
          <p style="margin-bottom: 8px;">Download all customer dues, stock movements, invoices, and expense transactions in a single compact JSON file on your machine.</p>
          <p>You can import this backup file on any device to restore 100% of your business data.</p>
        </div>

        <button class="btn btn-success" id="btn-export-backup" style="width: 100%; margin-bottom: 24px; padding: 14px;"><i data-lucide="download"></i> Download Business JSON Backup</button>

        <hr style="border: none; border-top: 1px solid hsl(var(--border-color)); margin: 24px 0;">

        <h4 style="margin-bottom: 16px; font-family: var(--font-brand); font-weight: 600;"><i data-lucide="upload-cloud"></i> Restore JSON Backup File</h4>
        <div style="border: 2px dashed hsl(var(--border-color)); padding: 24px; border-radius: var(--radius-sm); text-align: center; cursor: pointer; background: hsl(var(--bg-primary));" id="backup-restore-dropzone">
          <i data-lucide="folder-archive" style="width: 38px; height: 38px; color: hsl(var(--text-muted)); margin-bottom: 8px;"></i>
          <p style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px;">Click to Select Backup JSON File</p>
          <p style="font-size: 0.75rem; color: hsl(var(--text-secondary));">Warning: Importing a backup file replaces ALL current data!</p>
        </div>
        <input type="file" id="backup-restore-input" accept=".json" style="display: none;">
      </div>

    </div>

    <!-- ===== CLOUD SYNC HEALTH DASHBOARD ===== -->
    <div class="view-card" style="margin-top: 24px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
        <h3 class="card-title" style="margin-bottom: 0;"><i data-lucide="shield-check"></i> Cloud Sync Health Check</h3>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div id="sync-queue-badge" style="font-size: 0.8rem; padding: 4px 14px; border-radius: 20px; background: hsl(var(--bg-tertiary)); color: hsl(var(--text-secondary)); border: 1px solid hsl(var(--border-color));">
            ⏳ Pending Queue: Calculating...
          </div>
          <button class="btn btn-primary btn-sm" id="btn-refresh-sync-health" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Run Full Check
          </button>
        </div>
      </div>
      <p style="font-size: 0.82rem; color: hsl(var(--text-secondary)); margin-bottom: 20px; line-height: 1.5;">
        Compares every record saved locally on this computer against what is actually stored in Supabase.
        <strong style="color: hsl(var(--success));">🟢 Synced</strong> = cloud matches local. 
        <strong style="color: hsl(var(--warning));">🟡 Partial</strong> = some records not yet uploaded. 
        <strong style="color: hsl(var(--danger));">🔴 Not Synced</strong> = not connected or records missing from cloud.
      </p>

      <div id="sync-health-table-container">
        <div style="text-align: center; padding: 40px; color: hsl(var(--text-secondary));">
          <i data-lucide="cloud-off" style="width: 36px; height: 36px; opacity: 0.4; margin-bottom: 12px;"></i>
          <p style="font-weight: 500; margin-bottom: 6px;">Sync check not yet run</p>
          <p style="font-size: 0.82rem;">Click <strong>Run Full Check</strong> above to verify all your data is safely backed up in Supabase.</p>
        </div>
      </div>

      <div id="sync-summary-bar" style="display: none; margin-top: 16px; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600;"></div>

      <div style="margin-top: 14px; padding: 10px 14px; background: hsl(var(--bg-secondary)); border-radius: var(--radius-sm); font-size: 0.77rem; color: hsl(var(--text-secondary)); line-height: 1.6;">
        <strong>Note:</strong> Local Count = records on this browser. Cloud Count = records in Supabase. If Cloud Count is lower, click "Test &amp; Sync Now" to push missing records. If not logged in, Cloud Count will show as "—".
      </div>
    </div>
    
    <!-- Supabase Setup Guide & Script -->
    <div class="view-card" style="margin-top: 24px;">
      <h3 class="card-title" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><i data-lucide="help-circle"></i> Supabase Setup Guide (Zero Coding)</h3>
      <p style="font-size: 0.9rem; color: hsl(var(--text-secondary)); margin-bottom: 20px; line-height: 1.5;">
        Follow these steps to configure your own free cloud database on Supabase. This allows real-time sync across multiple devices (desktops, laptops, mobiles).
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: left; font-size: 0.85rem; line-height: 1.5; color: hsl(var(--text-secondary)); margin-bottom: 24px;">
        <div>
          <h5 style="color: hsl(var(--text-primary)); font-weight: 600; margin-bottom: 8px;"><span style="color: hsl(var(--primary)); font-weight: 700;">1.</span> Create Project</h5>
          <ol style="padding-left: 16px; margin: 0 0 16px 0;">
            <li>Go to <a href="https://supabase.com" target="_blank" style="color: hsl(var(--primary)); text-decoration: underline;">supabase.com</a> and sign up for a free account.</li>
            <li>Click "New Project", set a project name (e.g., <b>Gonabhavi Furnishing</b>), select a database password, and choose your nearest region.</li>
          </ol>

          <h5 style="color: hsl(var(--text-primary)); font-weight: 600; margin-bottom: 8px;"><span style="color: hsl(var(--primary)); font-weight: 700;">2.</span> Copy API keys</h5>
          <ol style="padding-left: 16px; margin: 0;">
            <li>Wait for the project setup to complete.</li>
            <li>Click the <b>Settings (Gear Icon)</b> on the left sidebar, then click <b>API</b>.</li>
            <li>Copy your <b>Project URL</b> and <b>anon/public</b> Key. Paste them in the fields above.</li>
          </ol>
        </div>

        <div>
          <h5 style="color: hsl(var(--text-primary)); font-weight: 600; margin-bottom: 8px;"><span style="color: hsl(var(--primary)); font-weight: 700;">3.</span> Enable Email Login</h5>
          <ol style="padding-left: 16px; margin: 0 0 16px 0;">
            <li>Click <b>Authentication</b> on the left sidebar, go to <b>Providers</b>, and open <b>Email</b>.</li>
            <li>Toggle <b>Confirm email</b> to OFF (so you can register instantly without waiting for verification emails). Click Save.</li>
          </ol>

          <h5 style="color: hsl(var(--text-primary)); font-weight: 600; margin-bottom: 8px;"><span style="color: hsl(var(--primary)); font-weight: 700;">4.</span> Run Database Setup Script</h5>
          <ol style="padding-left: 16px; margin: 0;">
            <li>Click <b>SQL Editor</b> on the left sidebar, click "New Query".</li>
            <li>Click the "Copy SQL Setup Script" button below, paste it into the editor, and click <b>Run</b>.</li>
          </ol>
        </div>
      </div>

      <div style="border-top: 1px solid hsl(var(--border-color)); padding-top: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <h4 style="font-family: var(--font-brand); font-weight: 600; color: hsl(var(--text-primary)); margin: 0; display: flex; align-items: center; gap: 6px;"><i data-lucide="terminal"></i> SQL Setup Script</h4>
          <button class="btn btn-primary btn-sm" id="btn-copy-sql-script"><i data-lucide="copy"></i> Copy SQL Setup Script</button>
        </div>
        <textarea id="sql-script-box" readonly style="width: 100%; height: 160px; font-family: monospace; font-size: 0.8rem; background: hsl(var(--bg-primary)); color: hsl(var(--text-secondary)); border: 1px solid hsl(var(--border-color)); padding: 12px; border-radius: var(--radius-sm); resize: none;" onclick="this.select();"></textarea>
      </div>
    </div>
  `;

  // ── Sync Health Check Engine ─────────────────────────────────────────────
  async function runSyncHealthCheck() {
    const tableContainer = document.getElementById('sync-health-table-container');
    const summaryBar = document.getElementById('sync-summary-bar');
    const queueBadge = document.getElementById('sync-queue-badge');

    // Show pending queue count from localStorage
    try {
      const queue = JSON.parse(localStorage.getItem('gb_sync_queue') || '[]');
      const queueCount = queue.length;
      if (queueCount === 0) {
        queueBadge.innerHTML = '✅ Pending Queue: Empty (all changes uploaded)';
        queueBadge.style.background = 'hsl(var(--success-transparent))';
        queueBadge.style.color = 'hsl(var(--success))';
        queueBadge.style.borderColor = 'hsl(var(--success))';
      } else {
        queueBadge.innerHTML = `⚠️ Pending Queue: ${queueCount} record(s) waiting to upload`;
        queueBadge.style.background = 'hsl(var(--warning) / 0.1)';
        queueBadge.style.color = 'hsl(var(--warning))';
        queueBadge.style.borderColor = 'hsl(var(--warning))';
      }
    } catch(e) {
      queueBadge.textContent = 'Queue: Unknown';
    }

    tableContainer.innerHTML = `
      <div style="text-align: center; padding: 30px; color: hsl(var(--text-secondary));">
        <i data-lucide="loader" style="width: 28px; height: 28px;"></i>
        <p style="margin-top: 10px; font-size: 0.88rem;">Connecting to Supabase and counting records... please wait.</p>
      </div>`;
    if (window.lucide) window.lucide.createIcons();

    const client = getSupabase();
    const isOnline = !!client && db.getCurrentUserId() !== 'guest-user-offline';

    // Build results for each entity
    const results = [];
    for (const entity of SYNC_ENTITIES) {
      const localAll  = db.getAllRaw(entity.key);
      const localActive = localAll.filter(r => !r.is_deleted);
      const localDeleted = localAll.filter(r => r.is_deleted);
      let cloudCount = null;
      let cloudDeleted = null;
      let errorMsg = null;

      if (isOnline) {
        try {
          // Count active cloud records
          const { count: activeCount, error: e1 } = await client
            .from(entity.key)
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', false);
          if (e1) throw e1;
          cloudCount = activeCount ?? 0;

          // Count deleted cloud records
          const { count: deletedCount, error: e2 } = await client
            .from(entity.key)
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', true);
          if (e2) throw e2;
          cloudDeleted = deletedCount ?? 0;
        } catch(err) {
          errorMsg = err.message || 'Query failed';
        }
      }

      results.push({
        ...entity,
        localCount: localActive.length,
        localDeleted: localDeleted.length,
        cloudCount,
        cloudDeleted,
        errorMsg,
        isOnline
      });
    }

    // Summarise overall health
    let allSynced = 0, partial = 0, unverified = 0;
    results.forEach(r => {
      if (!r.isOnline || r.errorMsg) { unverified++; return; }
      if (r.cloudCount === r.localCount) allSynced++;
      else partial++;
    });

    // Render table
    const rowsHtml = results.map(r => {
      let statusIcon, statusText, statusColor, rowBg;

      if (!r.isOnline) {
        statusIcon = '⚪'; statusText = 'Not Connected'; statusColor = 'var(--text-muted)'; rowBg = '';
      } else if (r.errorMsg) {
        statusIcon = '❌'; statusText = 'Error'; statusColor = 'var(--danger)'; rowBg = 'hsl(var(--danger) / 0.04)';
      } else if (r.cloudCount === r.localCount) {
        statusIcon = '✅'; statusText = '100% Synced'; statusColor = 'var(--success)'; rowBg = 'hsl(var(--success) / 0.04)';
      } else if (r.cloudCount > r.localCount) {
        statusIcon = '🔵'; statusText = 'Cloud has more (other device)'; statusColor = 'var(--primary)'; rowBg = 'hsl(var(--primary) / 0.04)';
      } else {
        const missing = r.localCount - r.cloudCount;
        statusIcon = '🟡'; statusText = `${missing} record(s) not yet uploaded`; statusColor = 'var(--warning)'; rowBg = 'hsl(var(--warning) / 0.04)';
      }

      const cloudDisplay = !r.isOnline ? '<span style="color: hsl(var(--text-muted));">—</span>'
        : r.errorMsg ? `<span style="color: hsl(var(--danger)); font-size: 0.75rem;">${r.errorMsg.substring(0,30)}</span>`
        : `<strong>${r.cloudCount}</strong> <span style="color: hsl(var(--text-muted)); font-size: 0.78rem;">(+${r.cloudDeleted} deleted)</span>`;

      return `
        <tr style="background: ${rowBg};">
          <td style="font-weight: 500;">
            <i data-lucide="${r.icon}" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px; opacity: 0.7;"></i>
            ${r.label}
          </td>
          <td style="text-align: center; font-weight: 700;">${r.localCount} <span style="color: hsl(var(--text-muted)); font-size: 0.78rem; font-weight: 400;">(+${r.localDeleted} deleted)</span></td>
          <td style="text-align: center;">${cloudDisplay}</td>
          <td style="text-align: center;">
            <span style="color: hsl(${statusColor}); font-weight: 600; font-size: 0.85rem; white-space: nowrap;">
              ${statusIcon} ${statusText}
            </span>
          </td>
        </tr>`;
    }).join('');

    tableContainer.innerHTML = `
      <div class="table-responsive" style="margin: 0; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm);">
        <table class="app-table" style="margin: 0;">
          <thead>
            <tr>
              <th>Data Type</th>
              <th style="text-align: center; width: 180px;">Local (This Computer)</th>
              <th style="text-align: center; width: 180px;">Cloud (Supabase)</th>
              <th style="text-align: center; width: 220px;">Sync Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;

    // Summary bar
    summaryBar.style.display = 'block';
    if (!isOnline) {
      summaryBar.style.background = 'hsl(var(--bg-tertiary))';
      summaryBar.style.color = 'hsl(var(--text-secondary))';
      summaryBar.innerHTML = '⚪ Not connected to Supabase. Log in and configure credentials above to run a live sync check.';
    } else if (partial === 0 && unverified === 0) {
      summaryBar.style.background = 'hsl(var(--success-transparent))';
      summaryBar.style.color = 'hsl(var(--success))';
      summaryBar.innerHTML = `✅ All ${allSynced} data types are 100% synced with Supabase. Your data is fully backed up in the cloud.`;
    } else {
      summaryBar.style.background = 'hsl(var(--warning) / 0.12)';
      summaryBar.style.color = 'hsl(var(--warning))';
      summaryBar.innerHTML = `⚠️ ${partial} data type(s) have records not yet uploaded to cloud. Click "Test & Sync Now" to push them.`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Auto-run check on page load if connected
  setTimeout(() => {
    const client = getSupabase();
    if (client && db.getCurrentUserId() !== 'guest-user-offline') {
      runSyncHealthCheck();
    } else {
      // Still show queue status even if offline
      try {
        const queue = JSON.parse(localStorage.getItem('gb_sync_queue') || '[]');
        const queueBadge = document.getElementById('sync-queue-badge');
        if (queueBadge) {
          queueBadge.innerHTML = queue.length === 0
            ? '✅ Pending Queue: Empty'
            : `⚠️ Pending Queue: ${queue.length} record(s) waiting`;
        }
      } catch(e) {}
    }
  }, 300);

  document.getElementById('btn-refresh-sync-health').addEventListener('click', runSyncHealthCheck);

  const sqlScript = `-- SQL Script to set up Supabase Tables for Gonabhavi Furnishing Shop
-- Copy and paste this into the Supabase SQL Editor (https://supabase.com -> SQL Editor -> New Query) and click Run.

create table if not exists products (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists customers (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists suppliers (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists invoices (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists invoice_payments (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists sale_orders (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists purchases (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists expenses (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists payment_ins (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists payment_outs (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists estimates (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists delivery_challans (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists sales_returns (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists purchase_returns (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists quotations (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists fund_transfers (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists stock_adjustments (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);
create table if not exists business_settings (id uuid primary key, user_id text, updated_at timestamp with time zone, is_deleted boolean, data jsonb);

-- Enable Row Level Security (RLS) policies for user data isolation
alter table products enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table invoices enable row level security;
alter table invoice_payments enable row level security;
alter table sale_orders enable row level security;
alter table purchases enable row level security;
alter table expenses enable row level security;
alter table payment_ins enable row level security;
alter table payment_outs enable row level security;
alter table estimates enable row level security;
alter table delivery_challans enable row level security;
alter table sales_returns enable row level security;
alter table purchase_returns enable row level security;
alter table quotations enable row level security;
alter table fund_transfers enable row level security;
alter table stock_adjustments enable row level security;
alter table business_settings enable row level security;

-- Create policies so users can only see/edit their own data
drop policy if exists user_policy on products;
create policy user_policy on products for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on customers;
create policy user_policy on customers for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on suppliers;
create policy user_policy on suppliers for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on invoices;
create policy user_policy on invoices for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on invoice_payments;
create policy user_policy on invoice_payments for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on sale_orders;
create policy user_policy on sale_orders for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on purchases;
create policy user_policy on purchases for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on expenses;
create policy user_policy on expenses for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on payment_ins;
create policy user_policy on payment_ins for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on payment_outs;
create policy user_policy on payment_outs for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on estimates;
create policy user_policy on estimates for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on delivery_challans;
create policy user_policy on delivery_challans for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on sales_returns;
create policy user_policy on sales_returns for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on purchase_returns;
create policy user_policy on purchase_returns for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on quotations;
create policy user_policy on quotations for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on fund_transfers;
create policy user_policy on fund_transfers for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on stock_adjustments;
create policy user_policy on stock_adjustments for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
drop policy if exists user_policy on business_settings;
create policy user_policy on business_settings for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
`;

  document.getElementById('sql-script-box').value = sqlScript;

  document.getElementById('btn-copy-sql-script').addEventListener('click', () => {
    navigator.clipboard.writeText(sqlScript);
    alert("SQL setup script copied to clipboard! Paste it inside Supabase SQL Editor and click 'Run'.");
  });

  if (window.lucide) window.lucide.createIcons();

  // Handle Supabase Connection saves
  document.getElementById('supabase-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
      supabase_url: formData.get('supabase_url'),
      supabase_key: formData.get('supabase_key')
    };

    try {
      db.update('business_settings', settings.id, updates);
      alert("Supabase credentials saved successfully. Testing Connection next.");
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  });

  // Handle Dynamic Sync triggers
  document.getElementById('btn-test-sync').addEventListener('click', async () => {
    try {
      alert("Attempting cloud handshake. Please wait...");
      const client = getSupabase();
      if (!client) {
        throw new Error("Supabase Client failed to initialize. Check if URL/Anon Key is entered correctly.");
      }
      
      await db.syncCloudFull();
      updateHeaderBadges();
      alert("Smart Sync complete! Local data merged successfully with cloud records.");
      window.location.reload();
    } catch (err) {
      alert(`Cloud sync handshake failed: ${err.message}`);
    }
  });

  // Local JSON Backup exporter
  document.getElementById('btn-export-backup').addEventListener('click', () => {
    const backup = {};
    const ENTITIES = [
      'products', 'customers', 'suppliers', 'invoices', 'invoice_payments',
      'sale_orders', 'purchases', 'expenses', 'payment_ins', 'payment_outs',
      'estimates', 'delivery_challans', 'sales_returns', 'purchase_returns',
      'quotations', 'fund_transfers', 'stock_adjustments', 'audit_logs',
      'business_settings'
    ];

    ENTITIES.forEach(e => {
      backup[e] = db.getAllRaw(e);
    });

    const dateStr = getLocalYYYYMMDD();
    const fileName = `gonabhavi_backup_${dateStr}.json`;
    const jsonStr = JSON.stringify(backup, null, 2);
    
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    db.logAudit("Backup Exported", `Downloaded JSON data file: ${fileName}`);
  });

  // Local Backup JSON Importer / Restore
  const dropzone = document.getElementById('backup-restore-dropzone');
  const fileInput = document.getElementById('backup-restore-input');
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const confirm = window.confirm("WARNING: Importing this backup will permanently replace ALL current data on this machine. Are you sure you want to proceed?");
      if (!confirm) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const parsed = JSON.parse(evt.target.result);
          
          // Basic JSON Validation (Section 30 Spec Rules)
          const ENTITIES = [
            'products', 'customers', 'suppliers', 'invoices', 'invoice_payments',
            'sale_orders', 'purchases', 'expenses', 'payment_ins', 'payment_outs',
            'estimates', 'delivery_challans', 'sales_returns', 'purchase_returns',
            'quotations', 'fund_transfers', 'stock_adjustments', 'audit_logs',
            'business_settings'
          ];
          
          const missing = ENTITIES.filter(key => !parsed[key]);
          if (missing.length > 5) { // Allow some slack but major parts must be present
            throw new Error("Invalid backup format. Backup JSON file is corrupt or missing crucial entities.");
          }

          // Restore
          ENTITIES.forEach(key => {
            if (parsed[key]) {
              localStorage.setItem(`gb_${key}`, JSON.stringify(parsed[key]));
            }
          });

          db.logAudit("Backup Restored", "Imported business JSON file and replaced database.");
          alert("Restore Successful! Page will reload to load imported files.");
          window.location.reload();
        } catch (err) {
          alert(`Restore failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
  });

  // Auth logins / registrations
  const signupBtn = document.getElementById('btn-auth-signup');
  const authForm = document.getElementById('auth-account-form');
  
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      // BUG 2 FIX: Use querySelector with null guard instead of direct property access
      const emailInput = authForm?.querySelector('[name="auth_email"]');
      const passInput  = authForm?.querySelector('[name="auth_password"]');
      const email = emailInput?.value?.trim() || '';
      const pass  = passInput?.value || '';
      
      if (!email || !pass || pass.length < 6) {
        alert("Please enter a valid email and password (min 6 characters) to sign up.");
        return;
      }

      const client = getSupabase();
      if (!client) {
        alert("Please set up your Supabase connection credentials first and save them.");
        return;
      }

      alert("Sending registration. Check your email inbox if verification is required.");
      try {
        const { data, error } = await client.auth.signUp({
          email: email,
          password: pass
        });
        if (error) throw error;
        
        // BUG 3 FIX: data.user can be null when Supabase email confirmation is required.
        // Previously this crashed with "Cannot read properties of null (reading 'id')"
        if (!data?.user) {
          alert("Registration submitted! Please check your email inbox to verify your account, then sign in.");
          return;
        }

        alert(`Account created successfully! Logging in session...`);
        localStorage.setItem('gb_session', JSON.stringify({ id: data.user.id, email: data.user.email }));
        window.location.reload();
      } catch (err) {
        alert(`Sign Up failed: ${err.message}`);
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authForm.auth_email.value;
      const pass = authForm.auth_password.value;
      
      const client = getSupabase();
      if (!client) {
        alert("Please set up your Supabase credentials first.");
        return;
      }

      alert("Authenticating details...");
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: email,
          password: pass
        });
        if (error) throw error;
        
        localStorage.setItem('gb_session', JSON.stringify({ id: data.user.id, email: data.user.email }));
        alert("Logged in successfully! Merging cloud database entries now.");
        db.logAudit("Cloud Account Logged In", `Session active for user ${email}`);
        await db.syncCloudFull();
        window.location.reload();
      } catch (err) {
        alert(`Login failed: ${err.message}`);
      }
    });
  }

  // Logout handle
  const cloudLogoutBtn = document.getElementById('btn-cloud-logout');
  if (cloudLogoutBtn) {
    cloudLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('gb_session');
      db.logAudit("User Logged Out", "Cleared cloud session keys.");
      window.location.reload();
    });
  }
}

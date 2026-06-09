/* ==========================================================================
   GONABHAVI — APPLICATION CONTROLLER & CLIENT ROUTER (src/app.js)
   ========================================================================== */

import { db, getSupabase } from './db.js';

// Overwrite native blocking alert with a premium, non-blocking glassmorphic toast notification
window.alert = function(message) {
  if (typeof document === 'undefined') {
    console.log("Alert: ", message);
    return;
  }
  
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    const isMobile = window.innerWidth <= 768;
    container.style.cssText = `position: fixed; bottom: ${isMobile ? '84px' : '24px'}; right: ${isMobile ? '14px' : '24px'}; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;`;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  
  const lowerMsg = message.toLowerCase();
  let typeIcon = 'check-circle';
  if (lowerMsg.includes('failed') || lowerMsg.includes('error') || lowerMsg.includes('block') || lowerMsg.includes('exceeds') || lowerMsg.includes('blank') || lowerMsg.includes('required') || lowerMsg.includes('invalid')) {
    toast.classList.add('toast-error');
    typeIcon = 'alert-circle';
  } else if (lowerMsg.includes('warning') || lowerMsg.includes('caution') || lowerMsg.includes('alert')) {
    toast.classList.add('toast-warning');
    typeIcon = 'alert-triangle';
  } else if (lowerMsg.includes('handshake') || lowerMsg.includes('connecting') || lowerMsg.includes('syncing') || lowerMsg.includes('wait') || lowerMsg.includes('handshaking')) {
    toast.classList.add('toast-info');
    typeIcon = 'loader';
  }

  const iconHtml = window.lucide 
    ? `<i data-lucide="${typeIcon}" style="width: 18px; height: 18px;"></i>` 
    : '';

  toast.innerHTML = `
    ${iconHtml}
    <div style="flex: 1; word-break: break-word; line-height: 1.4;">${message.replace(/\n/g, '<br>')}</div>
    <button style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.6; padding: 4px; display: flex;" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  container.appendChild(toast);
  
  if (window.lucide) window.lucide.createIcons();

  // Auto-remove after 3.8s
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.35s ease-in forwards';
    setTimeout(() => {
      toast.remove();
    }, 350);
  }, 3500);
};

// Import Views Dynamically when needed to optimize speed
const viewModules = {
  dashboard: () => import('./views/dashboard.js'),
  billing: () => import('./views/billing.js'),
  'sale-order': () => import('./views/documents.js').then(m => m.SaleOrderView),
  invoices: () => import('./views/billing.js').then(m => m.InvoicesListView),
  'payment-in': () => import('./views/payments.js').then(m => m.PaymentInView),
  'sales-return': () => import('./views/returns.js').then(m => m.SalesReturnView),
  quotations: () => import('./views/documents.js').then(m => m.QuotationView),
  
  'purchase-bill': () => import('./views/purchases.js').then(m => m.PurchaseBillView),
  'purchase-ledger': () => import('./views/purchases.js').then(m => m.PurchaseLedgerView),
  'payment-out': () => import('./views/payments.js').then(m => m.PaymentOutView),
  'purchase-return': () => import('./views/returns.js').then(m => m.PurchaseReturnView),
  
  products: () => import('./views/products.js'),
  customers: () => import('./views/customers.js'),
  suppliers: () => import('./views/suppliers.js'),
  inventory: () => import('./views/inventory.js'),
  'stock-adjustment': () => import('./views/inventory.js').then(m => m.StockAdjustmentView),
  expenses: () => import('./views/payments.js').then(m => m.ExpensesView),
  'fund-transfer': () => import('./views/transfers.js'),
  estimates: () => import('./views/documents.js').then(m => m.EstimateView),
  'delivery-challans': () => import('./views/documents.js').then(m => m.DeliveryChallanView),
  
  reports: () => import('./views/reports.js'),
  'gst-summary': () => import('./views/reports.js').then(m => m.GstSummaryView),
  'profit-loss': () => import('./views/reports.js').then(m => m.ProfitLossView),
  'balance-sheet': () => import('./views/reports.js').then(m => m.BalanceSheetView),
  'receivables-payables': () => import('./views/reports.js').then(m => m.ReceivablesPayablesView),
  'customer-ledger': () => import('./views/reports.js').then(m => m.CustomerLedgerView),
  'supplier-ledger': () => import('./views/reports.js').then(m => m.SupplierLedgerView),
  'money-ledger': () => import('./views/reports.js').then(m => m.MoneyLedgerView),
  'product-margins': () => import('./views/reports.js').then(m => m.ProductMarginsView),
  
  'barcode-labels': () => import('./views/labels.js'),
  'audit-log': () => import('./views/reports.js').then(m => m.AuditLogView),
  'sync-backup': () => import('./views/settings.js').then(m => m.SyncBackupView),
  settings: () => import('./views/settings.js'),
  'reset-password': () => import('./views/settings.js').then(m => m.ResetPasswordView)
};

// Global Layout DOM Selectors
const appSidebar = document.getElementById('app-sidebar');
const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const profileDropdownBtn = document.getElementById('profile-dropdown-btn');
const profileDropdown = document.getElementById('profile-dropdown');
const logoutBtn = document.getElementById('header-logout-btn');
const viewport = document.getElementById('app-viewport');
const viewTitle = document.getElementById('view-title');

const headerInvoiceCount = document.getElementById('header-invoice-count');
const headerSyncStatus = document.getElementById('header-sync-status');
const headerUserEmail = document.getElementById('header-user-email');

// 1. Initial State Settings
(function initLayoutSettings() {
  // Theme Loader
  const storedTheme = localStorage.getItem('gb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', storedTheme);

  // Collapsible Sidebar Restorer
  const isCollapsed = localStorage.getItem('gb_sidebar_collapsed') === 'true';
  if (isCollapsed && window.innerWidth > 1024) {
    appSidebar.classList.add('collapsed');
  }

  // Desktop Sidebar Hidden Restorer
  const isSidebarHidden = localStorage.getItem('gb_desktop_sidebar_hidden') === 'true';
  const appContainer = document.querySelector('.app-container');
  if (isSidebarHidden && window.innerWidth > 1024) {
    appContainer.classList.add('sidebar-hidden');
  }

  // Restore Nav Group Collapsed States
  document.querySelectorAll('.nav-group').forEach((group, index) => {
    const title = group.querySelector('.nav-group-title')?.textContent || `group-${index}`;
    const collapsed = localStorage.getItem(`gb_nav_group_collapsed_${title}`) === 'true';
    if (collapsed) {
      group.classList.add('collapsed');
    }
  });

  // Restore Privacy Mode (default to true to protect financial numbers initially)
  const isPrivacyMode = localStorage.getItem('gb_privacy_mode') !== 'false';
  if (isPrivacyMode) {
    document.documentElement.classList.add('privacy-mode');
  } else {
    document.documentElement.classList.remove('privacy-mode');
  }

  // Refresh Invoice Badge Count
  updateHeaderBadges();
  
  // Apply staff visibility limitations
  applyStaffRestrictions();

  // Setup Event Listeners for Sync Status
  window.addEventListener('gb-sync-status', (e) => {
    updateSyncBadge(e.detail);
  });
})();

// 2. Navigation Routing & Controller
export function renderLoginPortal() {
  const session = localStorage.getItem('gb_session');
  const settings = db.get('business_settings');
  const defaultUrl = settings.supabase_url || import.meta.env.VITE_SUPABASE_URL || '';
  const defaultKey = settings.supabase_key || import.meta.env.VITE_SUPABASE_KEY || '';
  
  // If session exists, remove overlay and proceed
  const existingOverlay = document.getElementById('login-portal-overlay');
  if (session) {
    if (existingOverlay) {
      existingOverlay.remove();
      document.querySelector('.app-container').classList.remove('login-active');
    }
    return true;
  }

  // Intercept layout
  document.querySelector('.app-container').classList.add('login-active');

  // Create overlay if not present
  let overlay = document.getElementById('login-portal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'login-portal-overlay';
    overlay.className = 'login-portal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="login-portal-card">
      <div class="login-portal-header">
        <img src="/src/logo.png" alt="Gonabhavi Logo" class="login-portal-logo">
        <h2>Gonabhavi Furnishing</h2>
        <p>Premium Billing & Store Ledger Manager</p>
      </div>

      <div class="login-tabs">
        <button class="login-tab-btn active" id="tab-cloud"><i data-lucide="cloud"></i> Cloud Sync</button>
        <button class="login-tab-btn" id="tab-local"><i data-lucide="monitor-off"></i> Local Mode</button>
      </div>

      <!-- Cloud Sync Form -->
      <div class="login-form-container active" id="form-cloud-container">
        <form id="portal-cloud-form">
          <div id="connection-guide-hint" style="background: hsl(var(--bg-primary)); padding: 12px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); margin-bottom: 16px; font-size: 0.8rem; line-height: 1.4; color: hsl(var(--text-secondary)); text-align: left;">
            <span style="font-weight: 600; color: hsl(var(--primary));"><i data-lucide="info" style="display:inline-block; width:14px; height:14px; vertical-align:middle; margin-right: 4px;"></i> Supabase Setup:</span>
            Paste your Project URL & Anon Key from your Supabase Dashboard to sync across computer & mobile.
          </div>

          <div id="portal-credentials-fields" style="${defaultUrl && defaultKey ? 'display: none;' : ''}">
            <div class="form-group" style="margin-bottom: 12px; text-align: left;">
              <label class="form-label">Supabase URL</label>
              <input type="url" class="form-control" name="url" id="portal-url" value="${defaultUrl}" placeholder="https://yourproject.supabase.co" ${defaultUrl && defaultKey ? '' : 'required'}>
            </div>
            <div class="form-group" style="margin-bottom: 12px; text-align: left;">
              <label class="form-label">Supabase Anon Key</label>
              <input type="password" class="form-control" name="key" id="portal-key" value="${defaultKey}" placeholder="eyJhbGciOi..." ${defaultUrl && defaultKey ? '' : 'required'}>
            </div>
          </div>

          ${defaultUrl && defaultKey ? `
            <div style="text-align: right; margin-bottom: 16px;">
              <button type="button" id="btn-toggle-portal-credentials" style="background: none; border: none; font-size: 0.78rem; color: hsl(var(--primary)); cursor: pointer; text-decoration: underline; padding: 0;">Configure Connection Credentials (Advanced)</button>
            </div>
          ` : ''}

          <div class="form-group" style="margin-bottom: 12px; text-align: left;">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" name="email" id="portal-email" placeholder="owner@store.com" required>
          </div>
          <div class="form-group" style="margin-bottom: 20px; text-align: left;" id="portal-password-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label class="form-label" style="margin-bottom: 0;">Password</label>
              <button type="button" id="btn-portal-forgot" style="background: none; border: none; font-size: 0.76rem; color: hsl(var(--primary)); cursor: pointer; text-decoration: underline; padding: 0;">Forgot Password?</button>
            </div>
            <input type="password" class="form-control" name="password" id="portal-password" placeholder="Min 6 characters" required minlength="6">
          </div>

          <div class="login-actions-grid" id="portal-login-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="btn-portal-signup"><i data-lucide="user-plus"></i> Create Account</button>
            <button type="submit" class="btn btn-primary" id="btn-portal-submit-login"><i data-lucide="log-in"></i> Connect & Login</button>
          </div>
          
          <div id="portal-forgot-actions" style="display: none; flex-direction: column; gap: 12px; align-items: center;">
            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; display: flex; align-items: center; gap: 6px;"><i data-lucide="mail"></i> Send Reset Email</button>
            <button type="button" id="btn-portal-back-to-login" style="background: none; border: none; font-size: 0.8rem; color: hsl(var(--text-secondary)); cursor: pointer; text-decoration: underline;">Back to Login</button>
          </div>
        </form>
      </div>

      <!-- Local Mode Details -->
      <div class="login-form-container" id="form-local-container">
        <div style="background: hsl(var(--warning-transparent)); border: 1px solid hsl(var(--warning)); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.85rem; line-height: 1.4; color: hsl(var(--text-primary)); text-align: left;">
          <p style="font-weight: 600; color: hsl(var(--warning)); margin-bottom: 4px;"><i data-lucide="alert-triangle" style="display:inline-block; width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Offline-Only Warning</p>
          In Local Mode, invoices and products are saved strictly inside this browser. If you clear browser cookies or reset your system, data could be lost. We highly recommend Cloud Sync.
        </div>
        <p style="font-size: 0.85rem; color: hsl(var(--text-secondary)); margin-bottom: 24px; line-height: 1.5; text-align: left;">
          Ready to run offline-only first? You can always hook up your Supabase database later under Settings.
        </p>
        <button class="btn btn-success" id="btn-portal-local-start" style="width: 100%; padding: 14px;"><i data-lucide="play"></i> Launch Local Store</button>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Tab switching
  const tabCloud = overlay.querySelector('#tab-cloud');
  const tabLocal = overlay.querySelector('#tab-local');
  const formCloud = overlay.querySelector('#form-cloud-container');
  const formLocal = overlay.querySelector('#form-local-container');

  tabCloud.addEventListener('click', () => {
    tabCloud.classList.add('active');
    tabLocal.classList.remove('active');
    formCloud.classList.add('active');
    formLocal.classList.remove('active');
  });

  tabLocal.addEventListener('click', () => {
    tabLocal.classList.add('active');
    tabCloud.classList.remove('active');
    formLocal.classList.add('active');
    formCloud.classList.remove('active');
  });

  // Toggle connection credentials input fields
  const toggleCredsBtn = overlay.querySelector('#btn-toggle-portal-credentials');
  if (toggleCredsBtn) {
    toggleCredsBtn.addEventListener('click', () => {
      const container = overlay.querySelector('#portal-credentials-fields');
      const urlInput = overlay.querySelector('#portal-url');
      const keyInput = overlay.querySelector('#portal-key');
      if (container.style.display === 'none') {
        container.style.display = 'block';
        toggleCredsBtn.textContent = 'Hide Connection Credentials';
        urlInput.setAttribute('required', 'true');
        keyInput.setAttribute('required', 'true');
      } else {
        container.style.display = 'none';
        toggleCredsBtn.textContent = 'Configure Connection Credentials (Advanced)';
        urlInput.removeAttribute('required');
        keyInput.removeAttribute('required');
      }
    });
  }

  // Toggle forgot password mode
  let isForgotMode = false;
  const forgotBtn = overlay.querySelector('#btn-portal-forgot');
  const backToLoginBtn = overlay.querySelector('#btn-portal-back-to-login');
  const passwordGroup = overlay.querySelector('#portal-password-group');
  const passwordInput = overlay.querySelector('#portal-password');
  const loginActions = overlay.querySelector('#portal-login-actions');
  const forgotActions = overlay.querySelector('#portal-forgot-actions');

  if (forgotBtn && backToLoginBtn) {
    forgotBtn.addEventListener('click', () => {
      isForgotMode = true;
      passwordGroup.style.display = 'none';
      passwordInput.removeAttribute('required');
      loginActions.style.display = 'none';
      forgotActions.style.display = 'flex';
    });

    backToLoginBtn.addEventListener('click', () => {
      isForgotMode = false;
      passwordGroup.style.display = 'block';
      passwordInput.setAttribute('required', 'true');
      loginActions.style.display = 'grid';
      forgotActions.style.display = 'none';
    });
  }

  // Handle local launch
  overlay.querySelector('#btn-portal-local-start').addEventListener('click', () => {
    localStorage.setItem('gb_session', JSON.stringify({ id: 'guest-user-offline', email: 'Offline Guest' }));
    renderLoginPortal();
    router();
  });

  // Handle Cloud signup
  overlay.querySelector('#btn-portal-signup').addEventListener('click', async () => {
    const url = overlay.querySelector('#portal-url').value || defaultUrl;
    const key = overlay.querySelector('#portal-key').value || defaultKey;
    const email = overlay.querySelector('#portal-email').value;
    const pass = overlay.querySelector('#portal-password').value;

    if (!url || !key || !email || !pass || pass.length < 6) {
      alert("Please fill in all credentials (URL, Key, Email, and Password min 6 chars) to register your account.");
      return;
    }

    try {
      db.update('business_settings', settings.id, { supabase_url: url, supabase_key: key });
      const client = getSupabase();
      if (!client) throw new Error("Client initialization failed. Verify URL/Key.");

      alert("Creating user account on Supabase cloud database...");
      const { data, error } = await client.auth.signUp({ email, password: pass });
      if (error) throw error;

      alert("Account created successfully! Performing cloud database handshake...");
      localStorage.setItem('gb_session', JSON.stringify({ id: data.user.id, email: data.user.email }));
      
      try {
        await db.syncCloudFull();
      } catch (syncErr) {
        if (syncErr.message.includes('schema cache') || syncErr.message.includes('relation') || syncErr.message.includes('does not exist')) {
          alert("Account created, but your Supabase database tables are not set up yet!\n\nWe have logged you in. To start syncing, go to 'Settings -> Sync & Backup', copy the SQL Setup Script, paste it into your Supabase SQL Editor, and click 'Run'.");
        } else {
          alert(`Sync Handshake Warning: ${syncErr.message}`);
        }
      }

      renderLoginPortal();
      window.location.reload();
    } catch (err) {
      alert(`Sync Registration Failed: ${err.message}`);
    }
  });

  // Handle Cloud Signin or Reset Password form submit
  overlay.querySelector('#portal-cloud-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = overlay.querySelector('#portal-url').value || defaultUrl;
    const key = overlay.querySelector('#portal-key').value || defaultKey;
    const email = overlay.querySelector('#portal-email').value;

    try {
      db.update('business_settings', settings.id, { supabase_url: url, supabase_key: key });
      const client = getSupabase();
      if (!client) throw new Error("Client initialization failed. Verify URL/Key.");

      if (isForgotMode) {
        alert("Sending password reset instructions to your email...");
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        });
        if (error) throw error;
        alert("Password reset email sent! Please check your email inbox to reset your password.");
        backToLoginBtn.click(); // Reset UI back to login
        return;
      }

      const pass = overlay.querySelector('#portal-password').value;
      alert("Connecting to Supabase and logging in...");
      const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;

      localStorage.setItem('gb_session', JSON.stringify({ id: data.user.id, email: data.user.email }));
      alert("Logged in successfully! Performing cloud database handshake...");
      
      try {
        await db.syncCloudFull();
      } catch (syncErr) {
        if (syncErr.message.includes('schema cache') || syncErr.message.includes('relation') || syncErr.message.includes('does not exist')) {
          alert("Logged in successfully, but your Supabase database tables are not set up yet!\n\nTo start syncing, go to 'Settings -> Sync & Backup', copy the SQL Setup Script, paste it into your Supabase SQL Editor, and click 'Run'.");
        } else {
          alert(`Sync Handshake Warning: ${syncErr.message}`);
        }
      }

      renderLoginPortal();
      window.location.reload();
    } catch (err) {
      alert(`Cloud Login Failed: ${err.message}`);
    }
  });

  return false;
}

async function router() {
  // Check if user is redirected here from a password reset email link
  const hash = window.location.hash;
  if (hash && (hash.includes('type=recovery') || hash.includes('recovery') || hash.includes('access_token'))) {
    const params = new URLSearchParams(hash.replace('#', ''));
    if (params.get('type') === 'recovery' || params.has('access_token')) {
      const client = getSupabase();
      if (client) {
        // Wait slightly to let Supabase client extract token from hash
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session } } = await client.auth.getSession();
        if (session && session.user) {
          localStorage.setItem('gb_session', JSON.stringify({ id: session.user.id, email: session.user.email }));
          window.location.hash = '#reset-password';
          window.location.reload();
          return;
        }
      }
    }
  }

  // Prevent routing if user is not logged in and render login portal
  if (window.location.hash !== '#reset-password' && !renderLoginPortal()) return;
  
  // Apply staff menu restricts
  applyStaffRestrictions();

  // Get active route hash
  let route = window.location.hash.slice(1) || 'dashboard';
  
  // Normalize parameters
  if (route.includes('?')) {
    route = route.split('?')[0];
  }

  // Guard routes based on permissions
  const role = db.getUserRole();
  if (role === 'staff') {
    const permissions = db.getUserPermissions();
    const isRestrictedRoute = 
      (route === 'settings' || route === 'sync-backup' || route === 'audit-log') ||
      (!permissions.allow_purchases && (route === 'purchase-bill' || route === 'purchase-ledger' || route === 'payment-out' || route === 'purchase-return')) ||
      (!permissions.allow_reports && (route === 'reports' || route === 'gst-summary' || route === 'profit-loss' || route === 'balance-sheet' || route === 'receivables-payables' || route === 'customer-ledger' || route === 'supplier-ledger' || route === 'money-ledger' || route === 'product-margins')) ||
      (!permissions.allow_expenses && route === 'expenses') ||
      (!permissions.allow_fund_transfers && route === 'fund-transfer') ||
      (!permissions.allow_stock_adjustments && route === 'stock-adjustment');

    if (isRestrictedRoute) {
      alert("Access Denied: Restricted to Owner role.");
      window.location.hash = '#dashboard';
      return;
    }
  }

  // Fallback to dashboard if invalid route
  if (!viewModules[route]) {
    window.location.hash = '#dashboard';
    return;
  }

  // Highlight active link in sidebar and mobile bottom nav
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === route) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    if (link.getAttribute('data-view') === route) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Highlight FAB when on billing screen
  const fab = document.getElementById('mobile-fab-new-invoice');
  if (fab) {
    if (route === 'billing') {
      fab.style.opacity = '0.4';
      fab.style.pointerEvents = 'none';
    } else {
      fab.style.opacity = '';
      fab.style.pointerEvents = '';
    }
  }

  // Set page/view title
  const activeLink = document.querySelector(`.nav-link[data-view="${route}"]`);
  if (activeLink) {
    viewTitle.textContent = activeLink.querySelector('span').textContent;
  }

  // Close mobile drawer if open
  appSidebar.classList.remove('show');
  sidebarOverlay.classList.remove('show');

  // Inject beautiful spinner
  viewport.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Assembling Gonabhavi modules...</p>
    </div>
  `;

  try {
    // Load and render view
    const viewLoader = viewModules[route];
    const module = await viewLoader();
    const renderFn = module.default || module;
    
    // Inject and execute
    viewport.innerHTML = '';
    const container = document.createElement('div');
    container.className = `view-container fade-in-active`;
    viewport.appendChild(container);
    
    // Execute view builder
    await renderFn(container);

    // Re-render UMD Lucide icons for injected HTML
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error("Routing error", err);
    viewport.innerHTML = `
      <div class="view-card text-center" style="max-width: 500px; margin: 50px auto;">
        <i data-lucide="alert-octagon" class="text-danger" style="width: 48px; height: 48px; margin-bottom: 16px;"></i>
        <h3 class="text-danger" style="margin-bottom: 12px;">Failed to load view</h3>
        <p style="color: hsl(var(--text-secondary)); margin-bottom: 20px;">${err.message}</p>
        <button class="btn btn-primary" onclick="window.location.reload()"><i data-lucide="refresh-cw"></i> Retry</button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

// Listen to Hash Changes
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  router();
  checkAuthSession();
});

// 3. User Interactions (Sidebar, Theme, Dropdowns)

// Collapse Sidebar Desktop
sidebarCollapseBtn.addEventListener('click', () => {
  appSidebar.classList.toggle('collapsed');
  localStorage.setItem('gb_sidebar_collapsed', appSidebar.classList.contains('collapsed'));
});

// Collapsible Navigation Menu Groups
document.querySelectorAll('.nav-group-header').forEach(header => {
  header.addEventListener('click', () => {
    const group = header.closest('.nav-group');
    if (!group) return;
    group.classList.toggle('collapsed');
    const title = group.querySelector('.nav-group-title')?.textContent || 'group';
    localStorage.setItem(`gb_nav_group_collapsed_${title}`, group.classList.contains('collapsed'));
  });
});

// Desktop Sidebar Show/Hide Toggle
const desktopMenuBtn = document.getElementById('desktop-menu-btn');
const appContainer = document.querySelector('.app-container');
if (desktopMenuBtn) {
  desktopMenuBtn.addEventListener('click', () => {
    appContainer.classList.toggle('sidebar-hidden');
    localStorage.setItem('gb_desktop_sidebar_hidden', appContainer.classList.contains('sidebar-hidden'));
  });
}

// Mobile Hamburger toggle
mobileMenuBtn.addEventListener('click', () => {
  appSidebar.classList.add('show');
  sidebarOverlay.classList.add('show');
});

sidebarOverlay.addEventListener('click', () => {
  appSidebar.classList.remove('show');
  sidebarOverlay.classList.remove('show');
});

// Theme Toggler
themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('gb_theme', newTheme);
  
  // Dispatch theme change event so active charts can adapt colors
  window.dispatchEvent(new CustomEvent('gb-theme-change', { detail: newTheme }));
});

// Privacy Toggler
const privacyToggleBtn = document.getElementById('privacy-toggle-btn');
if (privacyToggleBtn) {
  privacyToggleBtn.addEventListener('click', () => {
    const isPrivacy = document.documentElement.classList.toggle('privacy-mode');
    localStorage.setItem('gb_privacy_mode', isPrivacy ? 'true' : 'false');
  });
}

// User Profile dropdown menu toggle
profileDropdownBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
  profileDropdown.classList.remove('show');
});

// Refresh invoices count badge
export function updateHeaderBadges() {
  const invoicesCount = db.get('invoices').length;
  headerInvoiceCount.textContent = invoicesCount;
}

// Dynamic Sync Indicator controller
export function updateSyncBadge(status) {
  headerSyncStatus.innerHTML = '';
  
  if (status === 'syncing') {
    headerSyncStatus.setAttribute('title', 'Sync Status: Syncing with Supabase Cloud...');
    headerSyncStatus.innerHTML = `
      <i data-lucide="loader-2" class="cloud-icon-syncing"></i>
      <span id="sync-status-text">Syncing...</span>
    `;
  } else if (status === 'connected') {
    headerSyncStatus.setAttribute('title', 'Sync Status: Cloud Connected & Synced.');
    headerSyncStatus.innerHTML = `
      <i data-lucide="cloud" class="cloud-icon-online"></i>
      <span id="sync-status-text">Synced</span>
    `;
  } else {
    headerSyncStatus.setAttribute('title', 'Sync Status: Running Offline-Only Mode.');
    headerSyncStatus.innerHTML = `
      <i data-lucide="cloud-off" class="cloud-icon-offline"></i>
      <span id="sync-status-text">Local</span>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

// 4. Session & Auth checks
function checkAuthSession() {
  const session = localStorage.getItem('gb_session');
  if (session) {
    const user = JSON.parse(session);
    if (user.id === 'guest-user-offline') {
      headerUserEmail.textContent = 'Offline Guest';
      updateSyncBadge('local');
    } else {
      headerUserEmail.textContent = user.email || 'Cloud Guest';
      updateSyncBadge('connected');
    }
  } else {
    headerUserEmail.textContent = 'Offline Guest';
    updateSyncBadge('local');
  }
}

// Handle Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('gb_session');
  db.logAudit("User Logged Out", "Cleared cloud session keys. Reverted to offline local access.");
  window.location.reload();
});

// Listen for global database additions to keep headers synced
window.addEventListener('gb-db-change', () => {
  updateHeaderBadges();
});




// Mobile bottom nav Menu button triggers sidebar toggle
const mobileMenuToggleBtn = document.getElementById('mobile-menu-toggle-btn');
if (mobileMenuToggleBtn) {
  mobileMenuToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    appSidebar.classList.add('show');
    sidebarOverlay.classList.add('show');
  });
}

// Staff restrictions helper to show/hide menus dynamically
export function applyStaffRestrictions() {
  const role = db.getUserRole();
  const permissions = db.getUserPermissions();

  if (role === 'staff') {
    document.body.classList.add('role-staff');
  } else {
    document.body.classList.remove('role-staff');
  }

  // Helper function to hide/show DOM selectors
  const toggleVisibility = (selector, visible) => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = visible ? '' : 'none';
    });
  };

  // Settings are always restricted for staff
  toggleVisibility('.restricted-settings', role !== 'staff');

  // Others based on configurable checklist permissions
  toggleVisibility('.restricted-purchases', permissions.allow_purchases);
  toggleVisibility('.restricted-reports', permissions.allow_reports);
  toggleVisibility('.restricted-expenses', permissions.allow_expenses);
  toggleVisibility('.restricted-fund-transfer', role !== 'staff' || permissions.allow_fund_transfers);
  toggleVisibility('.restricted-stock-adjustment', role !== 'staff' || permissions.allow_stock_adjustments);
}



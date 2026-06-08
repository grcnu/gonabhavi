/* ==========================================================================
   GONABHAVI — DASHBOARD MAIN VIEW (src/views/dashboard.js)
   ========================================================================== */

import { db, calc, getLocalYYYYMMDD, formatDateToDDMMYY, formatTimeFromTimestamp } from '../db.js';

export default async function renderDashboard(container) {
  // Fetch live stats
  const settings = db.get('business_settings');
  const today = getLocalYYYYMMDD();
  const invoices = db.get('invoices');
  const products = db.get('products');

  // 1. Dynamic Sales Period Calculation
  const activePeriod = localStorage.getItem('gb_dashboard_sales_period') || 'today';
  const fromDateVal = localStorage.getItem('gb_dashboard_sales_from_date') || getLocalYYYYMMDD();
  const toDateVal = localStorage.getItem('gb_dashboard_sales_to_date') || getLocalYYYYMMDD();

  const getSalesForPeriod = (period, customFrom = '', customTo = '') => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const todayStr = getLocalYYYYMMDD();
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    let lastMonthYear = currentYear;
    let lastMonthVal = currentMonth - 1;
    if (lastMonthVal < 0) {
      lastMonthVal = 11;
      lastMonthYear -= 1;
    }
    const lastMonthPrefix = `${lastMonthYear}-${String(lastMonthVal + 1).padStart(2, '0')}`;
    const currentYearPrefix = `${currentYear}`;
    
    const filteredInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const dateStr = inv.date;
      
      switch (period) {
        case 'today':
          return dateStr === todayStr;
        case 'this_month':
          return dateStr.startsWith(currentMonthPrefix);
        case 'last_month':
          return dateStr.startsWith(lastMonthPrefix);
        case 'this_year':
          return dateStr.startsWith(currentYearPrefix);
        case 'custom':
          return dateStr >= customFrom && dateStr <= customTo;
        case 'all':
          return true;
        default:
          return false;
      }
    });
    
    return filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0)), 0);
  };

  const initialSalesVal = getSalesForPeriod(activePeriod, fromDateVal, toDateVal);

  // 2. Total Customer Receivables (registered customer balances + unregistered invoice dues)
  let totalDues = 0;
  const customersList = db.get('customers');
  const registeredIds = new Set(customersList.map(c => c.id));
  
  customersList.forEach(c => {
    totalDues += calc.getCustomerBalance(c.id);
  });

  invoices.forEach(inv => {
    if (!inv.customer_id || !registeredIds.has(inv.customer_id)) {
      totalDues += parseFloat(inv.balance_due || 0);
    }
  });

  // 3. Current Account Balances
  const accounts = calc.getAccountBalances();

  // 4. Low stock items (stock between 1 and 5)
  const lowStockProducts = products.filter(p => {
    const stock = calc.getCurrentStock(p.id);
    return stock > 0 && stock <= 5;
  });

  const outOfStockProducts = products.filter(p => calc.getCurrentStock(p.id) <= 0);

  const permissions = db.getUserPermissions();
  const showBalances = permissions.allow_dashboard_balances;

  container.innerHTML = `
    <!-- Stats Cards Grid -->
    <div class="dashboard-grid">
      
      ${showBalances ? `
        <!-- Card: Sales (Dynamic Period Selection) -->
        <div class="stat-card" id="sales-stat-card" style="position: relative; cursor: pointer;">
          <div class="stat-info" style="width: 100%;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; width: 100%; flex-wrap: wrap;">
              <span class="stat-label">Sales</span>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;" id="sales-period-controls">
                <select id="sales-period-select" class="form-control" style="padding: 1px 4px; font-size: 0.72rem; width: 110px; height: 22px; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-xs); cursor: pointer; background: hsl(var(--bg-primary)); color: hsl(var(--text-primary));">
                  <option value="today" ${activePeriod === 'today' ? 'selected' : ''}>Today</option>
                  <option value="this_month" ${activePeriod === 'this_month' ? 'selected' : ''}>This Month</option>
                  <option value="last_month" ${activePeriod === 'last_month' ? 'selected' : ''}>Last Month</option>
                  <option value="this_year" ${activePeriod === 'this_year' ? 'selected' : ''}>This Year</option>
                  <option value="custom" ${activePeriod === 'custom' ? 'selected' : ''}>Custom Range...</option>
                  <option value="all" ${activePeriod === 'all' ? 'selected' : ''}>All-Time</option>
                </select>
                <div id="sales-date-range-container" style="display: ${activePeriod === 'custom' ? 'flex' : 'none'}; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
                  <span style="font-size: 0.65rem; color: hsl(var(--text-secondary));">From</span>
                  <input type="date" id="sales-from-date" value="${fromDateVal}" class="form-control" style="padding: 1px 4px; font-size: 0.7rem; width: 95px; height: 20px; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-xs); background: hsl(var(--bg-primary)); color: hsl(var(--text-primary));">
                  <span style="font-size: 0.65rem; color: hsl(var(--text-secondary));">To</span>
                  <input type="date" id="sales-to-date" value="${toDateVal}" class="form-control" style="padding: 1px 4px; font-size: 0.7rem; width: 95px; height: 20px; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-xs); background: hsl(var(--bg-primary)); color: hsl(var(--text-primary));">
                </div>
              </div>
            </div>
            <span class="stat-value privacy-value" id="sales-stat-value">₹${initialSalesVal.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-primary">
            <i data-lucide="trending-up"></i>
          </div>
        </div>

        <!-- Card: Customer Dues -->
        <a href="#customers" class="stat-card" style="text-decoration: none; color: inherit; cursor: pointer;">
          <div class="stat-info">
            <span class="stat-label">Receivables (Dues)</span>
            <span class="stat-value text-danger privacy-value">₹${totalDues.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-danger">
            <i data-lucide="users"></i>
          </div>
        </a>

        <!-- Card: Cash Balance -->
        <a href="#money-ledger?account=Cash" class="stat-card" style="text-decoration: none; color: inherit; cursor: pointer;">
          <div class="stat-info">
            <span class="stat-label">${settings.account_cash_label || 'Cash'} Balance</span>
            <span class="stat-value privacy-value">₹${accounts.cash.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-success">
            <i data-lucide="wallet"></i>
          </div>
        </a>

        <!-- Card: UPI Balance -->
        <a href="#money-ledger?account=UPI" class="stat-card" style="text-decoration: none; color: inherit; cursor: pointer;">
          <div class="stat-info">
            <span class="stat-label">${settings.account_upi_label || 'UPI'} Balance</span>
            <span class="stat-value privacy-value" style="color: #6366f1;">₹${accounts.upi.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-info">
            <i data-lucide="smartphone"></i>
          </div>
        </a>

        <!-- Card: Bank Balance -->
        <a href="#money-ledger?account=Bank" class="stat-card" style="text-decoration: none; color: inherit; cursor: pointer;">
          <div class="stat-info">
            <span class="stat-label">${settings.account_bank_label || 'Bank'} Balance</span>
            <span class="stat-value privacy-value" style="color: #0ea5e9;">₹${accounts.bank.toFixed(2)}</span>
          </div>
          <div class="stat-icon color-warning">
            <i data-lucide="landmark"></i>
          </div>
        </a>
      ` : ''}
      
    </div>

    <!-- Double Column Widget: Invoices & Product Search -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr)); gap: 20px;">
      
      <!-- Recent Invoices Widget -->
      <div class="view-card" style="margin-bottom: 0;">
        <h3 class="card-title"><i data-lucide="receipt"></i> Recent 5 Invoices</h3>
        <div class="table-responsive" style="border: none; margin-top: 0;">
          <table class="app-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th style="text-align: right;">Total</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${renderRecentInvoices(invoices)}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 16px; text-align: right;">
          <a href="#invoices" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;"><i data-lucide="arrow-right"></i> View All Invoices</a>
        </div>
      </div>

      <!-- Product Search & Stock History Widget -->
      <div class="view-card" style="margin-bottom: 0; display: flex; flex-direction: column; gap: 14px;">
        <h3 class="card-title"><i data-lucide="package-search"></i> Product Search & History</h3>
        
        <!-- Search bar and Filters -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <input type="text" id="dash-prod-search" class="form-control" placeholder="Search by product name or barcode...">
          
          <div style="display: flex; gap: 8px;">
            <select id="dash-prod-filter" class="form-control" style="font-size: 0.82rem; padding: 4px 8px; height: 32px; flex: 1;">
              <option value="all">All Products</option>
              <option value="available">Available (> 0)</option>
              <option value="low">Low Stock (1 to 5)</option>
              <option value="outofstock">Out of Stock (≤ 0)</option>
            </select>
            
            <select id="dash-prod-sort" class="form-control" style="font-size: 0.82rem; padding: 4px 8px; height: 32px; flex: 1;">
              <option value="name_asc">Name (A-Z)</option>
              <option value="stock_desc">Stock (High to Low)</option>
              <option value="stock_asc">Stock (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
              <option value="price_asc">Price (Low to High)</option>
            </select>
          </div>
        </div>
        
        <!-- Table of results -->
        <div class="table-responsive" style="border: none; margin-top: 0; flex: 1; max-height: 250px; overflow-y: auto;">
          <table class="app-table">
            <thead>
              <tr>
                <th>Product Details</th>
                <th style="width: 100px; text-align: right;">Sale Price</th>
                <th style="width: 90px; text-align: center;">Live Stock</th>
              </tr>
            </thead>
            <tbody id="dash-prod-search-results">
              <!-- Populated dynamically -->
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal Backdrop for Dashboard History -->
    <div id="dash-timeline-overlay" class="billing-checkout-overlay" style="z-index: 2000;"></div>
    <div id="dash-timeline-modal" class="modal-card" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95); width: 95%; max-width: 780px; max-height: 80vh; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); display: none; flex-direction: column; z-index: 2001; overflow: hidden; opacity: 0; transition: transform 0.2s ease-out, opacity 0.2s ease-out;">
      <div class="modal-header">
        <h3 id="dash-timeline-title"><i data-lucide="history"></i> Product Stock History</h3>
        <button id="btn-close-dash-timeline" class="modal-close-btn"><i data-lucide="x"></i></button>
      </div>
      <div id="dash-timeline-content" style="flex: 1; overflow-y: auto; padding: 20px; -webkit-overflow-scrolling: touch;">
        <!-- Timeline table loaded here -->
      </div>
    </div>

    <!-- Desktop Floating Speed Dial Actions -->
    <div class="dash-fab-container" style="position: fixed; bottom: 30px; right: 30px; z-index: 1000; display: flex; flex-direction: column; align-items: flex-end; gap: 12px;">
      <div class="dash-fab-actions" style="display: none; flex-direction: column; gap: 10px; align-items: flex-end;">
        <a href="#billing" class="dash-sub-fab" style="text-decoration: none; display: flex; align-items: center; gap: 8px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); padding: 6px 12px; border-radius: 20px; box-shadow: var(--shadow-md); font-size: 0.8rem; font-weight: 600; color: hsl(var(--text-primary)); transition: transform 0.15s, background-color 0.15s;">
          <span>New Sales Invoice</span>
          <div style="background: hsl(var(--primary)); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
            <i data-lucide="receipt" style="width: 15px; height: 15px;"></i>
          </div>
        </a>
        <button id="dash-btn-add-product" class="dash-sub-fab" style="border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); padding: 6px 12px; border-radius: 20px; box-shadow: var(--shadow-md); font-size: 0.8rem; font-weight: 600; color: hsl(var(--text-primary)); transition: transform 0.15s, background-color 0.15s;">
          <span>Add New Product</span>
          <div style="background: #22c55e; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
            <i data-lucide="package" style="width: 15px; height: 15px;"></i>
          </div>
        </button>
        <a href="#expenses" class="dash-sub-fab" style="text-decoration: none; display: flex; align-items: center; gap: 8px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); padding: 6px 12px; border-radius: 20px; box-shadow: var(--shadow-md); font-size: 0.8rem; font-weight: 600; color: hsl(var(--text-primary)); transition: transform 0.15s, background-color 0.15s;">
          <span>Record Expense</span>
          <div style="background: #ef4444; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">
            <i data-lucide="credit-card" style="width: 15px; height: 15px;"></i>
          </div>
        </a>
      </div>
      <button id="dash-fab-trigger" style="border: none; cursor: pointer; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, hsl(var(--primary)), hsl(248 90% 58%)); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px hsl(var(--primary) / 0.4); transition: transform 0.2s;">
        <i data-lucide="plus" id="dash-fab-icon" style="width: 26px; height: 26px; stroke-width: 2.5; transition: transform 0.2s;"></i>
      </button>
    </div>

    <style>
      @media (max-width: 768px) {
        .dash-fab-container {
          display: none !important;
        }
      }
      .dash-sub-fab:hover {
        background-color: hsl(var(--bg-tertiary)) !important;
        transform: translateY(-2px);
      }
      #dash-fab-trigger:active {
        transform: scale(0.95);
      }
    </style>
  `;

  // 1. Attach clicking invoice row to load edit billing view
  container.querySelectorAll('.recent-invoice-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      window.location.hash = `#billing?edit=${id}`;
    });
  });

  // Attach direct printing for recent invoices print buttons
  container.querySelectorAll('.btn-print-recent-invoice').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      try {
        const { printInvoiceDirectly } = await import('./billing.js');
        printInvoiceDirectly(id);
      } catch (err) {
        console.error('Failed to load printing module:', err);
        alert('Could not trigger printing.');
      }
    });
  });

  // 2. Setup Search, Filter and Sort logic
  const searchInput = container.querySelector('#dash-prod-search');
  const filterSelect = container.querySelector('#dash-prod-filter');
  const sortSelect = container.querySelector('#dash-prod-sort');
  const resultsBody = container.querySelector('#dash-prod-search-results');

  function renderSearchResults(prods) {
    if (prods.length === 0) {
      resultsBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: 24px;">No products found matching query.</td></tr>`;
      return;
    }

    resultsBody.innerHTML = prods.map(p => {
      const stock = calc.getCurrentStock(p.id);
      let stockColor = 'inherit';
      if (stock <= 0) stockColor = 'hsl(var(--danger))';
      else if (stock <= 5) stockColor = 'hsl(var(--warning))';
      else stockColor = 'hsl(var(--success))';

      return `
        <tr class="dash-prod-row" data-id="${p.id}" style="cursor: pointer;">
          <td>
            <div style="font-weight: 600; font-size: 0.9rem;">${p.name}</div>
            <div style="font-size: 0.76rem; color: hsl(var(--text-secondary)); margin-top: 1px;">${p.description || 'No description available'}</div>
          </td>
          <td style="text-align: right; font-weight: 600; font-size: 0.88rem;">₹${parseFloat(p.sale_price || 0).toFixed(2)}</td>
          <td style="text-align: center; font-weight: 700; font-size: 0.95rem; color: ${stockColor};">${stock}</td>
        </tr>
      `;
    }).join('');

    // Attach timeline history modal popups
    resultsBody.querySelectorAll('.dash-prod-row').forEach(row => {
      row.addEventListener('click', () => {
        showProductHistoryModal(row.getAttribute('data-id'));
      });
    });
  }

  function updateProductSearch() {
    const query = searchInput.value.toLowerCase().trim();
    const filterVal = filterSelect.value;
    const sortVal = sortSelect.value;

    let filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(query) ||
                            (p.qr || '').toLowerCase().includes(query) ||
                            (p.description || '').toLowerCase().includes(query) ||
                            (p.category || '').toLowerCase().includes(query);
      if (!matchesSearch) return false;

      const stock = calc.getCurrentStock(p.id);
      if (filterVal === 'available') {
        return stock > 0;
      } else if (filterVal === 'low') {
        return stock > 0 && stock <= 5;
      } else if (filterVal === 'outofstock') {
        return stock <= 0;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortVal === 'name_asc') {
        return a.name.localeCompare(b.name);
      } else if (sortVal === 'stock_desc') {
        return calc.getCurrentStock(b.id) - calc.getCurrentStock(a.id);
      } else if (sortVal === 'stock_asc') {
        return calc.getCurrentStock(a.id) - calc.getCurrentStock(b.id);
      } else if (sortVal === 'price_desc') {
        return parseFloat(b.sale_price || 0) - parseFloat(a.sale_price || 0);
      } else if (sortVal === 'price_asc') {
        return parseFloat(a.sale_price || 0) - parseFloat(b.sale_price || 0);
      }
      return 0;
    });

    renderSearchResults(filtered.slice(0, 15));
  }

  searchInput.addEventListener('input', updateProductSearch);
  filterSelect.addEventListener('change', updateProductSearch);
  sortSelect.addEventListener('change', updateProductSearch);

  // Initial draw
  updateProductSearch();

  // Modal interactions variables
  const modal = container.querySelector('#dash-timeline-modal');
  const overlay = container.querySelector('#dash-timeline-overlay');
  const closeBtn = container.querySelector('#btn-close-dash-timeline');

  const openModal = () => {
    modal.style.display = 'flex';
    overlay.classList.add('show');
    setTimeout(() => {
      modal.style.transform = 'translate(-50%, -50%) scale(1)';
      modal.style.opacity = '1';
    }, 50);
  };

  const closeModal = () => {
    modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
    modal.style.opacity = '0';
    overlay.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 200);
  };

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  // Computes the stock ledger movements history for the modal window
  function showProductHistoryModal(productId) {
    const product = db.find('products', productId);
    if (!product) return;

    container.querySelector('#dash-timeline-title').innerHTML = `
      <i data-lucide="history" style="color: hsl(var(--primary));"></i>
      Stock Timeline — ${product.name}
    `;

    const timelineContainer = container.querySelector('#dash-timeline-content');
    const movements = [];

    // 1. Opening Stock Entry
    movements.push({
      date: product.created_at || new Date().toISOString(),
      type: 'Opening Stock',
      ref: 'Product Creation',
      party: 'System Initializer',
      qtyIn: parseFloat(product.opening_stock || 0),
      qtyOut: 0,
      note: 'Initial stock balance set at product registration.',
      created_at: product.created_at || product.updated_at
    });

    // 2. Purchased quantities (from supplier bills)
    db.get('purchases').forEach(bill => {
      bill.items?.forEach(it => {
        if (it.product_id === productId) {
          movements.push({
            date: bill.date,
            type: 'Purchase Bill',
            ref: bill.bill_number,
            party: bill.supplier_name || 'Generic Supplier',
            qtyIn: parseFloat(it.qty || 0),
            qtyOut: 0,
            note: `Purchased at ₹${parseFloat(it.purchase_rate || it.rate || 0).toFixed(2)} (before tax)`,
            created_at: bill.created_at
          });
        }
      });
    });

    // 3. Sold quantities (from invoices)
    db.get('invoices').forEach(inv => {
      inv.items?.forEach(it => {
        if (it.product_id === productId) {
          movements.push({
            date: inv.date,
            type: 'Sales Invoice',
            ref: inv.invoice_number,
            party: inv.customer_name || 'Walk-in Customer',
            qtyIn: 0,
            qtyOut: parseFloat(it.qty || 0),
            note: `Sold at ₹${parseFloat(it.rate || 0).toFixed(2)} (GST-inclusive)`,
            created_at: inv.created_at
          });
        }
      });
    });

    // 4. Sales returns
    db.get('sales_returns').forEach(ret => {
      ret.items?.forEach(it => {
        if (it.product_id === productId) {
          movements.push({
            date: ret.date,
            type: 'Sales Return',
            ref: ret.return_number,
            party: ret.customer_name || 'Customer Return',
            qtyIn: parseFloat(it.qty || 0),
            qtyOut: 0,
            note: `Customer returned item: ${it.reason || 'Not specified'}`,
            created_at: ret.created_at
          });
        }
      });
    });

    // 5. Purchase returns
    db.get('purchase_returns').forEach(ret => {
      ret.items?.forEach(it => {
        if (it.product_id === productId) {
          movements.push({
            date: ret.date,
            type: 'Purchase Return',
            ref: ret.return_number,
            party: ret.supplier_name || 'Supplier Return',
            qtyIn: 0,
            qtyOut: parseFloat(it.qty || 0),
            note: `Supplier return dispatch: ${it.reason || 'Not specified'}`,
            created_at: ret.created_at
          });
        }
      });
    });

    // 6. Stock adjustments
    db.get('stock_adjustments').forEach(adj => {
      if (adj.product_id === productId) {
        const change = parseFloat(adj.qty_change || 0);
        movements.push({
          date: adj.date,
          type: 'Stock Adjustment',
          ref: adj.reason || 'Manual Correction',
          party: 'Manager Override',
          qtyIn: change > 0 ? change : 0,
          qtyOut: change < 0 ? Math.abs(change) : 0,
          note: adj.note || 'No additional notes provided.',
          created_at: adj.created_at
        });
      }
    });

    // Sort chronologically ascending to compute a accurate running stock ledger
    movements.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
      const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

    let runningStock = 0;
    const computedMovements = movements.map(m => {
      runningStock += m.qtyIn - m.qtyOut;
      return { ...m, runningStock };
    });

    // Render chronologically newest first
    computedMovements.reverse();

    if (computedMovements.length === 0) {
      timelineContainer.innerHTML = `<p class="text-muted text-center" style="padding: 24px;">No movements logged for this product.</p>`;
    } else {
      timelineContainer.innerHTML = `
        <div class="table-responsive" style="margin-top: 0; border: none;">
          <table class="app-table" style="font-size: 0.85rem;">
            <thead>
              <tr style="background-color: hsl(var(--bg-primary));">
                <th>Date</th>
                <th>Movement Type</th>
                <th>Reference</th>
                <th>Party</th>
                <th class="text-center">In (+)</th>
                <th class="text-center">Out (-)</th>
                <th class="text-center" style="font-weight: 700;">Running Stock</th>
              </tr>
            </thead>
            <tbody>
              ${computedMovements.map(m => `
                <tr>
                  <td style="white-space: nowrap;">
                    <div>${formatDateToDDMMYY(m.date)}</div>
                    ${m.created_at ? `<div style="font-size: 0.7rem; color: hsl(var(--text-secondary)); margin-top: 1px;">${formatTimeFromTimestamp(m.created_at)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${m.type === 'Purchase Bill' || m.type === 'Sales Return' || (m.type === 'Stock Adjustment' && m.qtyIn > 0) ? 'badge-success' : 'badge-danger'}" style="padding: 2px 6px; font-size: 0.7rem;">
                      ${m.type}
                    </span>
                  </td>
                  <td>
                    <div style="font-weight: 600;">${m.ref}</div>
                    <div style="font-size: 0.72rem; color: hsl(var(--text-secondary));">${m.note}</div>
                  </td>
                  <td>${m.party}</td>
                  <td class="text-center text-success" style="font-weight: 600;">${m.qtyIn > 0 ? `+${m.qtyIn}` : '—'}</td>
                  <td class="text-center text-danger" style="font-weight: 600;">${m.qtyOut > 0 ? `-${m.qtyOut}` : '—'}</td>
                  <td class="text-center" style="font-weight: 700; color: hsl(var(--primary));">${m.runningStock}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    openModal();
    if (window.lucide) window.lucide.createIcons();
  }

  // Floating Speed Dial FAB interaction handlers
  const fabTrigger = container.querySelector('#dash-fab-trigger');
  const fabActions = container.querySelector('.dash-fab-actions');
  const fabIcon = container.querySelector('#dash-fab-icon');

  if (fabTrigger && fabActions) {
    fabTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = fabActions.style.display === 'flex';
      if (isVisible) {
        fabActions.style.display = 'none';
        fabIcon.style.transform = 'rotate(0deg)';
        fabTrigger.style.transform = 'scale(1)';
      } else {
        fabActions.style.display = 'flex';
        fabIcon.style.transform = 'rotate(45deg)';
        fabTrigger.style.transform = 'scale(1.05)';
      }
    });

    document.addEventListener('click', () => {
      if (fabActions.style.display === 'flex') {
        fabActions.style.display = 'none';
        fabIcon.style.transform = 'rotate(0deg)';
        fabTrigger.style.transform = 'scale(1)';
      }
    });
  }

  const addProdBtn = container.querySelector('#dash-btn-add-product');
  if (addProdBtn) {
    addProdBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fabActions) {
        fabActions.style.display = 'none';
        if (fabIcon) fabIcon.style.transform = 'rotate(0deg)';
        if (fabTrigger) fabTrigger.style.transform = 'scale(1)';
      }
      import('./products.js').then(m => {
        m.showProductAddModal(null, () => {
          if (typeof updateProductSearch === 'function') {
            updateProductSearch();
          }
        });
      });
    });
  }

  // Handle dynamic sales card navigation & period changes
  const salesCardDiv = container.querySelector('#sales-stat-card');
  if (salesCardDiv) {
    salesCardDiv.addEventListener('click', (e) => {
      // Do not navigate if user is clicking on controls
      if (e.target.closest('#sales-period-controls')) {
        return;
      }
      window.location.hash = '#invoices';
    });
  }

  const periodSelect = container.querySelector('#sales-period-select');
  const fromDateInput = container.querySelector('#sales-from-date');
  const toDateInput = container.querySelector('#sales-to-date');
  const salesValSpan = container.querySelector('#sales-stat-value');
  const dateRangeContainer = container.querySelector('#sales-date-range-container');

  if (periodSelect && fromDateInput && toDateInput && salesValSpan && dateRangeContainer) {
    const preventNav = (e) => {
      e.stopPropagation();
    };
    periodSelect.addEventListener('click', preventNav);
    periodSelect.addEventListener('mousedown', preventNav);
    fromDateInput.addEventListener('click', preventNav);
    fromDateInput.addEventListener('mousedown', preventNav);
    toDateInput.addEventListener('click', preventNav);
    toDateInput.addEventListener('mousedown', preventNav);

    const updateSales = () => {
      const period = periodSelect.value;
      const fromDate = fromDateInput.value;
      const toDate = toDateInput.value;
      
      localStorage.setItem('gb_dashboard_sales_period', period);
      localStorage.setItem('gb_dashboard_sales_from_date', fromDate);
      localStorage.setItem('gb_dashboard_sales_to_date', toDate);
      
      if (period === 'custom') {
        dateRangeContainer.style.display = 'flex';
      } else {
        dateRangeContainer.style.display = 'none';
      }
      
      const salesVal = getSalesForPeriod(period, fromDate, toDate);
      salesValSpan.textContent = `₹${salesVal.toFixed(2)}`;
    };

    periodSelect.addEventListener('change', updateSales);
    fromDateInput.addEventListener('change', updateSales);
    toDateInput.addEventListener('change', updateSales);
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderRecentInvoices(invoices) {
  const sorted = [...invoices]
    .filter(inv => !inv.is_deleted)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (sorted.length === 0) {
    return `<tr><td colspan="5" class="text-center text-muted" style="padding: 24px;">No billing invoices saved yet.</td></tr>`;
  }

  return sorted.map(inv => {
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

    return `
      <tr class="recent-invoice-row" data-id="${inv.id}" style="cursor: pointer;">
        <td style="font-family: var(--font-mono); font-weight: 600; font-size: 0.85rem;">${inv.invoice_number}</td>
        <td style="font-size: 0.78rem; white-space: nowrap; color: hsl(var(--text-secondary));">${formatDateToDDMMYY(inv.date)}</td>
        <td style="font-size: 0.85rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${custName}</td>
        <td style="text-align: right; font-size: 0.85rem;">
          <div style="font-weight: 600;"><span class="privacy-value">₹${total.toFixed(2)}</span></div>
          ${due > 0.05 
            ? `<div style="font-size: 0.7rem; color: hsl(var(--danger)); margin-top: 1px; font-weight: 500;">Due: ₹${due.toFixed(2)}</div>` 
            : `<div style="font-size: 0.7rem; color: hsl(var(--success)); margin-top: 1px; font-weight: 500;">Fully Paid</div>`
          }
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <button class="btn-print-recent-invoice" data-id="${inv.id}" title="Direct Print Invoice" style="background: none; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-xs); transition: background-color 0.2s;">
              <i data-lucide="printer" style="width: 13px; height: 13px; color: hsl(var(--primary));"></i>
            </button>
            <span class="badge ${badgeClass}" style="padding: 2px 6px; font-size: 0.72rem;">${statusText}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

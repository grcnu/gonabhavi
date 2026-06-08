/* ==========================================================================
   GONABHAVI — INVENTORY & STOCK ADJUSTMENT VIEWS (src/views/inventory.js)
   ========================================================================== */

import { db, calc, generateUUID, formatDateToDDMMYY, getLocalYYYYMMDD, formatTimeFromTimestamp } from '../db.js';

/**
 * 1. DEFAULT VIEW: INVENTORY MASTER LIST (#inventory)
 */
export default async function renderInventoryView(container) {
  const products = db.get('products');
  let stockSortOrder = 'none'; // 'none', 'desc', 'asc'
  
  // HTML Layout Frame
  container.innerHTML = `
    <div class="view-card animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="package" style="color: hsl(var(--primary));"></i>
          Live Inventory Ledger
        </h2>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="#stock-adjustment" class="btn btn-secondary">
            <i data-lucide="sliders"></i> Stock Adjustments
          </a>
          <a href="#barcode-labels" class="btn btn-primary">
            <i data-lucide="barcode"></i> Print Barcode Labels
          </a>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 20px;">
        <div class="form-group">
          <label class="form-label">Search Products</label>
          <input type="text" id="inventory-search" class="form-control" placeholder="Search by name, Barcode, QR...">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="inventory-filter-category" class="form-control">
            <option value="All">All Categories</option>
            ${Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => `
              <option value="${cat}">${cat}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Stock Status</label>
          <select id="inventory-filter-status" class="form-control">
            <option value="All">All Statuses</option>
            <option value="Available">Available (> 5 units)</option>
            <option value="Low Stock">Low Stock (1-5 units)</option>
            <option value="Out of Stock">Out of Stock (<= 0 units)</option>
            <option value="Error">Stock Errors (Negative calculations)</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Product Details</th>
              <th>QR / Barcode</th>
              <th>Category</th>
              <th class="text-right">Sale Price (MRP)</th>
              <th id="sort-live-stock" style="cursor: pointer; user-select: none; text-align: center;">
                Live Stock
                <span id="stock-sort-icon" style="display: inline-flex; align-items: center; margin-left: 4px; vertical-align: middle;">
                  <i data-lucide="arrow-up-down" style="width: 12px; height: 12px;"></i>
                </span>
              </th>
              <th class="text-center">Status</th>
              <th class="text-center" style="width: 150px;">Actions</th>
            </tr>
          </thead>
          <tbody id="inventory-table-body">
            <!-- Dynamically Rendered Rows -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Backdrop for History Timeline -->
    <div id="timeline-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>
    <div id="timeline-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 800px; max-height: 85vh; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002; overflow: hidden;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 16px;">
        <h3 id="timeline-modal-title" class="card-title" style="margin-bottom: 0;">
          <i data-lucide="history" style="color: hsl(var(--primary));"></i>
          Product Stock History
        </h3>
        <button id="timeline-close-btn" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
      </div>
      <div id="timeline-modal-content" style="flex: 1; overflow-y: auto; padding-right: 8px;">
        <!-- Timeline Entries -->
      </div>
    </div>
  `;

  // DOM Bindings
  const searchInput = document.getElementById('inventory-search');
  const categoryFilter = document.getElementById('inventory-filter-category');
  const statusFilter = document.getElementById('inventory-filter-status');
  const tableBody = document.getElementById('inventory-table-body');
  const timelineModal = document.getElementById('timeline-modal');
  const timelineBackdrop = document.getElementById('timeline-modal-backdrop');
  const timelineCloseBtn = document.getElementById('timeline-close-btn');

  // Trigger filtering
  function updateTable() {
    const search = searchInput.value.toLowerCase().trim();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = products.filter(p => {
      const liveStock = calc.getCurrentStock(p.id);
      
      // Search Match
      const matchesSearch = p.name.toLowerCase().includes(search) || 
                            p.qr.toLowerCase().includes(search) || 
                            (p.category || '').toLowerCase().includes(search) ||
                            (p.description || '').toLowerCase().includes(search);
      
      // Category Match
      const matchesCategory = category === 'All' || p.category === category;
      
      // Stock Status Match
      let matchesStatus = true;
      if (status === 'Available') matchesStatus = liveStock > 5;
      else if (status === 'Low Stock') matchesStatus = liveStock >= 1 && liveStock <= 5;
      else if (status === 'Out of Stock') matchesStatus = liveStock <= 0;
      else if (status === 'Error') matchesStatus = liveStock < 0; // Handled separately in db layer to cap at 0, but check actual math
      
      return matchesSearch && matchesCategory && matchesStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 40px; color: hsl(var(--text-secondary));">
            <i data-lucide="package-search" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
            <p>No products match the selected filters.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Apply sorting by live stock levels
    const sortedFiltered = [...filtered];
    if (stockSortOrder === 'desc') {
      sortedFiltered.sort((a, b) => calc.getCurrentStock(b.id) - calc.getCurrentStock(a.id));
    } else if (stockSortOrder === 'asc') {
      sortedFiltered.sort((a, b) => calc.getCurrentStock(a.id) - calc.getCurrentStock(b.id));
    }

    tableBody.innerHTML = sortedFiltered.map(p => {
      const stock = calc.getCurrentStock(p.id);
      let badgeClass = 'color-success';
      let badgeLabel = 'Available';
      
      if (stock <= 0) {
        badgeClass = 'color-danger';
        badgeLabel = 'Out of Stock';
      } else if (stock <= 5) {
        badgeClass = 'color-warning';
        badgeLabel = 'Low Stock';
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 600;">${p.name}</div>
            <div style="font-size: 0.8rem; color: hsl(var(--text-secondary));">${p.description || 'No description'}</div>
          </td>
          <td><code style="font-family: var(--font-mono); font-size: 0.85rem;">${p.qr}</code></td>
          <td><span class="badge" style="background-color: hsl(var(--bg-tertiary)); color: hsl(var(--text-primary));">${p.category || 'Uncategorized'}</span></td>
          <td class="text-right" style="font-weight: 600;">₹${parseFloat(p.sale_price || 0).toFixed(2)}</td>
          <td class="text-center" style="font-weight: 700; font-size: 1.1rem; color: ${stock <= 0 ? 'hsl(var(--danger))' : 'inherit'}">${stock}</td>
          <td class="text-center">
            <span class="badge ${badgeClass}" style="padding: 4px 10px;">${badgeLabel}</span>
          </td>
          <td class="text-center">
            <button class="btn btn-secondary btn-sm timeline-btn" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.8rem;" title="View Timeline Ledger">
              <i data-lucide="history"></i> History
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Re-create icons in table
    if (window.lucide) window.lucide.createIcons();

    // Bind Timeline buttons
    document.querySelectorAll('.timeline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showProductHistory(btn.getAttribute('data-id'));
      });
    });
  }

  // Stock Movement History timeline modal builder
  function showProductHistory(productId) {
    const product = db.find('products', productId);
    if (!product) return;

    document.getElementById('timeline-modal-title').innerHTML = `
      <i data-lucide="history" style="color: hsl(var(--primary));"></i>
      Stock Timeline — ${product.name}
    `;

    const timelineContainer = document.getElementById('timeline-modal-content');
    
    // Compile movements
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
            note: `Purchased at ₹${parseFloat(it.rate || 0).toFixed(2)} (before tax)`,
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

    // Sort chronologically ascending to compute a accurate running stock ledger column
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

    // Render chronologically newest first for immediate readability
    computedMovements.reverse();

    if (computedMovements.length === 0) {
      timelineContainer.innerHTML = `<p class="text-muted text-center" style="padding: 24px;">No movements logged for this product.</p>`;
    } else {
      timelineContainer.innerHTML = `
        <div class="table-responsive" style="margin-top: 0; border: none;">
          <table class="app-table" style="font-size: 0.9rem;">
            <thead>
              <tr style="background-color: hsl(var(--bg-primary));">
                <th>Date</th>
                <th>Movement Type</th>
                <th>Reference / Source</th>
                <th>Associated Party</th>
                <th class="text-center">Stock In (+)</th>
                <th class="text-center">Stock Out (-)</th>
                <th class="text-center" style="font-weight: 700;">Running Stock</th>
              </tr>
            </thead>
            <tbody>
              ${computedMovements.map(m => `
                <tr>
                  <td style="white-space: nowrap;">
                    <div>${formatDateToDDMMYY(m.date)}</div>
                    ${m.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(m.created_at)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${m.type === 'Purchase Bill' || m.type === 'Sales Return' || (m.type === 'Stock Adjustment' && m.qtyIn > 0) ? 'color-success' : 'color-danger'}" style="padding: 2px 6px; font-size: 0.72rem;">
                      ${m.type}
                    </span>
                  </td>
                  <td>
                    <div style="font-weight: 600;">${m.ref}</div>
                    <div style="font-size: 0.75rem; color: hsl(var(--text-secondary));">${m.note}</div>
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

    // Open Modal
    timelineModal.style.display = 'flex';
    timelineBackdrop.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  }

  // Close timeline event listeners
  function closeModal() {
    timelineModal.style.display = 'none';
    timelineBackdrop.classList.remove('show');
  }
  
  timelineCloseBtn.addEventListener('click', closeModal);
  timelineBackdrop.addEventListener('click', closeModal);

  // Bind key filters
  searchInput.addEventListener('input', updateTable);
  categoryFilter.addEventListener('change', updateTable);
  statusFilter.addEventListener('change', updateTable);

  // Bind sort listener
  document.getElementById('sort-live-stock').addEventListener('click', () => {
    if (stockSortOrder === 'none') {
      stockSortOrder = 'desc';
    } else if (stockSortOrder === 'desc') {
      stockSortOrder = 'asc';
    } else {
      stockSortOrder = 'none';
    }
    updateTable();
    updateStockSortIcon();
  });

  function updateStockSortIcon() {
    const iconContainer = document.getElementById('stock-sort-icon');
    if (!iconContainer) return;
    if (stockSortOrder === 'none') {
      iconContainer.innerHTML = `<i data-lucide="arrow-up-down" style="width: 12px; height: 12px;"></i>`;
    } else if (stockSortOrder === 'desc') {
      iconContainer.innerHTML = `<i data-lucide="arrow-down" style="width: 12px; height: 12px; color: hsl(var(--primary));"></i>`;
    } else if (stockSortOrder === 'asc') {
      iconContainer.innerHTML = `<i data-lucide="arrow-up" style="width: 12px; height: 12px; color: hsl(var(--primary));"></i>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // Initial draw
  updateTable();
}

/**
 * 2. NAMED EXPORT: STOCK ADJUSTMENTS MANAGER VIEW (#stock-adjustment)
 */
export async function StockAdjustmentView(container) {
  const products = db.get('products');
  
  // HTML layout skeleton
  container.innerHTML = `
    <div class="view-card animate-fade-in">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="sliders" style="color: hsl(var(--primary));"></i>
          Inventory Discrepancy Adjustments
        </h2>
        <button id="add-adjustment-btn" class="btn btn-primary">
          <i data-lucide="plus"></i> Log Stock Correction
        </button>
      </div>

      <!-- Grid list of recent adjustments -->
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Correction Type</th>
              <th class="text-center">Quantity Adjustment</th>
              <th>Reason</th>
              <th>Notes / Remarks</th>
              <th class="text-center" style="width: 80px;">Action</th>
            </tr>
          </thead>
          <tbody id="adjustment-table-body">
            <!-- Dynamic Adjustment Entries -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Backdrop for Add/Log Adjustment Form -->
    <div id="adj-modal-backdrop" class="sidebar-overlay" style="z-index: 1001;"></div>
    <div id="adj-modal" class="profile-dropdown" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 500px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 24px; display: none; flex-direction: column; z-index: 1002;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px; margin-bottom: 20px;">
        <h3 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="sliders" style="color: hsl(var(--primary));"></i>
          New Stock Correction
        </h3>
        <button id="adj-close-btn" class="btn btn-secondary" style="padding: 6px 12px;"><i data-lucide="x"></i></button>
      </div>
      
      <form id="adj-form" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label class="form-label">Adjustment Date</label>
          <input type="date" id="adj-date" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Product</label>
          <select id="adj-product-id" class="form-control" required>
            <option value="">-- Choose Product --</option>
            ${products.map(p => `<option value="${p.id}">${p.name} (Barcode: ${p.qr})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Correction Type & Count</label>
          <div style="display: flex; gap: 12px;">
            <select id="adj-direction" class="form-control" style="width: 140px;" required>
              <option value="add">Add Stock (+)</option>
              <option value="subtract">Deduct Stock (-)</option>
            </select>
            <input type="number" id="adj-qty" class="form-control" style="flex: 1;" min="1" step="any" placeholder="Quantity Count" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Reason Category</label>
          <select id="adj-reason" class="form-control" required>
            <option value="">-- Select Reason --</option>
            <option value="Count Correction">Inventory Audit Count Correction</option>
            <option value="Damaged">Damaged / Expired stock discarded</option>
            <option value="Theft">Shrinkage / Missing / Stolen goods</option>
            <option value="Sample">Free samples distributed</option>
            <option value="Promo">Marketing / Promo usage</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Remarks / Description</label>
          <textarea id="adj-note" class="form-control" rows="3" placeholder="Provide extra auditing remarks..."></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
          <button type="button" id="adj-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Adjustment</button>
        </div>
      </form>
    </div>
  `;

  // DOM bindings
  const tableBody = document.getElementById('adjustment-table-body');
  const addBtn = document.getElementById('add-adjustment-btn');
  const modal = document.getElementById('adj-modal');
  const backdrop = document.getElementById('adj-modal-backdrop');
  const closeBtn = document.getElementById('adj-close-btn');
  const cancelBtn = document.getElementById('adj-cancel-btn');
  const form = document.getElementById('adj-form');
  const dateInput = document.getElementById('adj-date');

  // Load and draw corrections
  function updateTable() {
    const list = db.get('stock_adjustments');
    
    // Sort newest adjustments first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 40px; color: hsl(var(--text-secondary));">
            <i data-lucide="sliders" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
            <p>No inventory adjustments logged yet.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tableBody.innerHTML = list.map(adj => {
      const prodName = db.find('products', adj.product_id)?.name || 'Unknown Product';
      const change = parseFloat(adj.qty_change || 0);

      return `
        <tr>
          <td style="white-space: nowrap;">
            <div>${formatDateToDDMMYY(adj.date)}</div>
            ${adj.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(adj.created_at)}</div>` : ''}
          </td>
          <td style="font-weight: 600;">${prodName}</td>
          <td>
            <span class="badge ${change > 0 ? 'color-success' : 'color-danger'}" style="padding: 3px 8px;">
              ${change > 0 ? 'Stock Addition' : 'Stock Deduction'}
            </span>
          </td>
          <td class="text-center font-weight-bold" style="font-weight: 700; color: ${change > 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))'}">
            ${change > 0 ? `+${change}` : change}
          </td>
          <td><span style="font-weight: 600;">${adj.reason}</span></td>
          <td style="font-size: 0.85rem; color: hsl(var(--text-secondary));">${adj.note || '—'}</td>
          <td class="text-center">
            <button class="btn btn-danger btn-sm delete-adj-btn" data-id="${adj.id}" style="padding: 6px; border-radius: 50%;" title="Delete Adjustment">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind delete adjustment action
    document.querySelectorAll('.delete-adj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm("Are you sure you want to delete this stock adjustment? This will reverse the stock count adjustment.")) {
          try {
            db.delete('stock_adjustments', id);
            // Trigger sidebars and badges refresh
            window.dispatchEvent(new CustomEvent('gb-db-change'));
            updateTable();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });
  }

  // Open Modal triggers
  addBtn.addEventListener('click', () => {
    // Pre-fill date with today
    dateInput.value = getLocalYYYYMMDD();
    
    // Reset form
    form.reset();
    
    // Open Dialog
    modal.style.display = 'flex';
    backdrop.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  });

  function closeDialog() {
    modal.style.display = 'none';
    backdrop.classList.remove('show');
  }

  closeBtn.addEventListener('click', closeDialog);
  cancelBtn.addEventListener('click', closeDialog);
  backdrop.addEventListener('click', closeDialog);

  // Form submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const productId = document.getElementById('adj-product-id').value;
    const date = dateInput.value;
    const direction = document.getElementById('adj-direction').value;
    const qty = parseFloat(document.getElementById('adj-qty').value || 0);
    const reason = document.getElementById('adj-reason').value;
    const note = document.getElementById('adj-note').value;

    if (!productId || qty <= 0 || !reason) {
      alert("Please fill in all required fields accurately.");
      return;
    }

    // Direction calculation
    const qtyChange = direction === 'add' ? qty : -qty;

    try {
      db.insert('stock_adjustments', {
        product_id: productId,
        date,
        qty_change: qtyChange,
        reason,
        note
      });

      // Dispatch global change & reload
      window.dispatchEvent(new CustomEvent('gb-db-change'));
      closeDialog();
      updateTable();
    } catch (err) {
      alert(err.message);
    }
  });

  // Load table
  updateTable();
}

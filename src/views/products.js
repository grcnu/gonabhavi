/* ==========================================================================
   GONABHAVI — PRODUCTS MASTER MANAGEMENT (src/views/products.js)
   ========================================================================== */

import { db, calc, formatDateToDDMMYY, formatTimeFromTimestamp } from '../db.js';

export default async function renderProducts(container) {
  renderProductLayout(container);
}

function renderProductLayout(container) {
  container.innerHTML = `
    <!-- Top Filter actions bar -->
    <div class="view-card" style="margin-bottom: 20px; padding: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center;">
        
        <div style="display: flex; gap: 12px; flex: 1; min-width: 300px;">
          <input type="text" class="form-control" id="product-search-input" placeholder="Search by name, barcode, or category..." style="max-width: 350px;">
          
          <select class="form-control" id="product-status-filter" style="max-width: 160px;">
            <option value="all">All Statuses</option>
            <option value="available">Available (>5)</option>
            <option value="low">Low Stock (1-5)</option>
            <option value="out">Out of Stock (<=0)</option>
          </select>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="btn-csv-import-trigger"><i data-lucide="upload"></i> Excel Import</button>
          <button class="btn btn-secondary" id="btn-csv-export"><i data-lucide="download"></i> Excel Export</button>
          <button class="btn btn-primary" id="btn-add-product-modal"><i data-lucide="plus"></i> Add New Product</button>
        </div>
      </div>
    </div>

    <!-- Products Data Table -->
    <div class="view-card" style="margin-bottom: 0;">
      <div class="table-responsive" style="margin-top: 0;">
        <table class="app-table" id="products-table">
          <thead>
            <tr>
              <th>Barcode / QR</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Purchase Price</th>
              <th>Sale Price (MRP)</th>
              <th>GST%</th>
              <th>Live Stock</th>
              <th>Status</th>
              <th class="no-print" style="width: 140px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody id="products-table-body">
            <!-- Dynamic Injection -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Hidden File Input for Excel Upload -->
    <input type="file" id="product-csv-file-input" accept=".xlsx, .xls, .csv" style="display: none;">
  `;

  // Attach search listeners
  const searchInput = document.getElementById('product-search-input');
  const statusFilter = document.getElementById('product-status-filter');

  searchInput.addEventListener('input', refreshProductsList);
  statusFilter.addEventListener('change', refreshProductsList);

  // CSV Importer trigger
  const csvFile = document.getElementById('product-csv-file-input');
  document.getElementById('btn-csv-import-trigger').addEventListener('click', () => csvFile.click());
  csvFile.addEventListener('change', handleExcelImport);
 
  // CSV Exporter
  document.getElementById('btn-csv-export').addEventListener('click', handleExcelExport);

  // Modal Triggers
  document.getElementById('btn-add-product-modal').addEventListener('click', () => showProductAddModal());

  // Render initial list
  refreshProductsList();
  
  if (window.lucide) window.lucide.createIcons();
}

// Render dynamic table
function refreshProductsList() {
  const query = document.getElementById('product-search-input').value.toLowerCase();
  const filter = document.getElementById('product-status-filter').value;
  const products = db.get('products');
  const tbody = document.getElementById('products-table-body');

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(query) || 
                          p.qr.toLowerCase().includes(query) || 
                          (p.category && p.category.toLowerCase().includes(query));
    
    if (!matchesSearch) return false;

    const stock = calc.getCurrentStock(p.id);
    if (filter === 'available') return stock > 5;
    if (filter === 'low') return stock > 0 && stock <= 5;
    if (filter === 'out') return stock <= 0;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 30px;">No matching products found. Click "Add New Product" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const stock = calc.getCurrentStock(p.id);
    let statusClass = 'badge-success';
    let statusText = 'Available';
    
    if (stock <= 0) {
      statusClass = 'badge-danger';
      statusText = 'Out of Stock';
    } else if (stock <= 5) {
      statusClass = 'badge-warning';
      statusText = 'Low Stock';
    }

    return `
      <tr data-id="${p.id}">
        <td style="font-family: var(--font-mono); font-weight: 500;">${p.qr}</td>
        <td style="font-weight: 600;">${p.name}</td>
        <td style="color: hsl(var(--text-secondary));">${p.category || '—'}</td>
        <td style="font-weight: 600;"><span class="privacy-value">₹${parseFloat(p.purchase_price || 0).toFixed(2)}</span></td>
        <td style="font-weight: 600;">₹${parseFloat(p.sale_price || 0).toFixed(2)}</td>
        <td>${p.gst_rate}%</td>
        <td style="font-weight: 700;">${stock}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td class="no-print" style="display: flex; gap: 6px; justify-content: center;">
          <button class="btn btn-secondary btn-sm-action btn-history" title="Stock History"><i data-lucide="history"></i></button>
          <button class="btn btn-secondary btn-sm-action btn-edit" title="Edit Product"><i data-lucide="pencil"></i></button>
          <button class="btn btn-secondary btn-sm-action text-danger btn-delete" title="Delete Product"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();

  // Attach button actions
  tbody.querySelectorAll('tr').forEach(row => {
    const id = row.getAttribute('data-id');
    
    row.querySelector('.btn-history').addEventListener('click', () => showProductHistoryModal(id));
    row.querySelector('.btn-edit').addEventListener('click', () => showProductAddModal(id));
    row.querySelector('.btn-delete').addEventListener('click', () => {
      const confirm = window.confirm("Are you sure you want to delete this product?");
      if (confirm) {
        try {
          db.delete('products', id);
          refreshProductsList();
        } catch (err) {
          alert(`Delete blocked: ${err.message}`);
        }
      }
    });
  });
}

// 1. Product Editor Form Modal (Create and Update)
export function showProductAddModal(productId = null, onSavedCallback = null) {
  const modalContainer = document.getElementById('modal-container');
  const isEdit = !!productId;
  const product = isEdit ? db.find('products', productId) : null;

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="product-modal-backdrop">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h3><i data-lucide="package"></i> ${isEdit ? 'Modify Product Details' : 'Register New Product'}</h3>
          <button class="modal-close-btn" id="btn-close-product-modal"><i data-lucide="x"></i></button>
        </div>
        <form id="product-editor-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Product Name *</label>
            <input type="text" class="form-control" name="name" value="${product?.name || ''}" required>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">QR / Barcode Value *</label>
            <input type="text" class="form-control" name="qr" value="${product?.qr || ''}" placeholder="Scan barcode or type value" required>
          </div>
          <div class="form-grid" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">Purchase Price (Cost Price)</label>
              <input type="number" step="0.01" class="form-control" name="purchase_price" id="prod-purchase-price-input" value="${product?.purchase_price || ''}" min="0" placeholder="Optional (defaults to 0)">
            </div>
            <div class="form-group">
              <label class="form-label">Sale Price (MRP - Incl. GST) *</label>
              <input type="number" step="0.01" class="form-control" name="sale_price" id="prod-sale-price-input" value="${product?.sale_price || ''}" required min="0">
            </div>
          </div>
          <div id="prod-markup-feedback" style="font-size: 0.8rem; font-weight: 600; margin-top: -6px; margin-bottom: 12px; color: hsl(var(--text-secondary)); min-height: 18px;"></div>
          <div class="form-grid" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">GST Tax Rate *</label>
              <select class="form-control" name="gst_rate">
                <option value="0" ${product?.gst_rate === 0 ? 'selected' : ''}>0% (Tax Exempt)</option>
                <option value="5" ${product?.gst_rate === 5 ? 'selected' : ''}>5%</option>
                <option value="12" ${product?.gst_rate === 12 ? 'selected' : ''}>12%</option>
                <option value="18" ${product?.gst_rate === 18 ? 'selected' : ''}>18%</option>
                <option value="28" ${product?.gst_rate === 28 ? 'selected' : ''}>28%</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Default Discount %</label>
              <input type="number" step="0.1" class="form-control" name="default_discount" value="${product?.default_discount || 0}" min="0" max="100">
            </div>
          </div>
          
          <div class="form-grid" style="margin-bottom: 16px;">
            <div class="form-group">
              <label class="form-label">${isEdit ? 'Adjust Live Stock count' : 'Initial Opening Stock'}</label>
              <input type="number" class="form-control" name="stock_val" value="${isEdit ? calc.getCurrentStock(productId) : 0}">
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <input type="text" class="form-control" name="category" value="${product?.category || ''}">
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Description</label>
            <input type="text" class="form-control" name="description" value="${product?.description || ''}">
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-product-editor">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Save Product</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
  
  // Close triggers
  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-product-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-product-editor').addEventListener('click', closeModal);

  // Live Markup & Margin Calculator
  const purInp = document.getElementById('prod-purchase-price-input');
  const saleInp = document.getElementById('prod-sale-price-input');
  const markupDiv = document.getElementById('prod-markup-feedback');

  function updateMarkupCalculator() {
    const purchase = parseFloat(purInp.value) || 0;
    const sale = parseFloat(saleInp.value) || 0;
    if (purchase > 0 && sale > 0) {
      const profit = sale - purchase;
      const markup = (profit / purchase) * 100;
      const margin = (profit / sale) * 100;
      if (profit >= 0) {
        markupDiv.innerHTML = `<span style="color: hsl(var(--success)); display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="trending-up" style="width: 14px; height: 14px;"></i> Margin: ${margin.toFixed(1)}% (Markup: ${markup.toFixed(1)}% | Profit: ₹${profit.toFixed(2)})</span>`;
      } else {
        markupDiv.innerHTML = `<span style="color: hsl(var(--danger));">Selling at a Loss! Loss: ₹${Math.abs(profit).toFixed(2)}</span>`;
      }
    } else {
      markupDiv.innerHTML = '';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  if (purInp && saleInp && markupDiv) {
    purInp.addEventListener('input', updateMarkupCalculator);
    saleInp.addEventListener('input', updateMarkupCalculator);
    updateMarkupCalculator();
  }

  // Submit trigger
  document.getElementById('product-editor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
      name: formData.get('name'),
      qr: formData.get('qr'),
      category: formData.get('category'),
      purchase_price: parseFloat(formData.get('purchase_price')) || 0,
      sale_price: parseFloat(formData.get('sale_price') || 0),
      gst_rate: parseInt(formData.get('gst_rate')),
      default_discount: parseFloat(formData.get('default_discount') || 0),
      description: formData.get('description')
    };

    // Live Stock calculation logic adjustments (Section 33 formulas)
    const typedStock = parseFloat(formData.get('stock_val') || 0);

    if (isEdit) {
      // Rearranging Opening Stock formula to align typed values:
      let purchased = 0;
      let sold = 0;
      let sReturns = 0;
      let pReturns = 0;
      let adjs = 0;

      db.get('purchases').forEach(bill => {
        bill.items?.forEach(it => { if (it.product_id === productId) purchased += parseFloat(it.qty || 0); });
      });
      db.get('invoices').forEach(inv => {
        inv.items?.forEach(it => { if (it.product_id === productId) sold += parseFloat(it.qty || 0); });
      });
      db.get('sales_returns').forEach(ret => {
        ret.items?.forEach(it => { if (it.product_id === productId) sReturns += parseFloat(it.qty || 0); });
      });
      db.get('purchase_returns').forEach(ret => {
        ret.items?.forEach(it => { if (it.product_id === productId) pReturns += parseFloat(it.qty || 0); });
      });
      db.get('stock_adjustments').forEach(adj => {
        if (adj.product_id === productId) adjs += parseFloat(adj.qty_change || 0);
      });

      const newOpening = typedStock - purchased + sold - sReturns + pReturns - adjs;
      updates.opening_stock = newOpening;
    } else {
      updates.opening_stock = typedStock;
    }

    try {
      let savedProd;
      if (isEdit) {
        savedProd = db.update('products', productId, updates);
      } else {
        savedProd = db.insert('products', updates);
      }
      closeModal();
      
      if (onSavedCallback) {
        onSavedCallback(savedProd);
      } else {
        const tableBody = document.getElementById('products-table-body');
        if (tableBody) {
          refreshProductsList();
        }
      }
    } catch (err) {
      alert(`Error saving product: ${err.message}`);
    }
  });
}

// 2. Product stock movement history Timeline Modal (Section 13)
function showProductHistoryModal(productId) {
  const modalContainer = document.getElementById('modal-container');
  const product = db.find('products', productId);
  if (!product) return;

  // Build History Timeline Arrays
  const timeline = [];

  // 1. Add Opening Stock entry
  timeline.push({
    date: product.created_at.split('T')[0],
    type: 'Opening Stock',
    reference: 'Product Initial Setup',
    qtyIn: parseFloat(product.opening_stock || 0),
    qtyOut: 0,
    timestamp: new Date(product.created_at).getTime()
  });

  // 2. Add Purchases
  db.get('purchases').forEach(bill => {
    bill.items?.forEach(it => {
      if (it.product_id === productId) {
        timeline.push({
          date: bill.date,
          type: 'Purchase Bill',
          reference: `Bill: ${bill.bill_number}`,
          qtyIn: parseFloat(it.qty || 0),
          qtyOut: 0,
          timestamp: new Date(bill.created_at).getTime()
        });
      }
    });
  });

  // 3. Add Sales
  db.get('invoices').forEach(inv => {
    inv.items?.forEach(it => {
      if (it.product_id === productId) {
        timeline.push({
          date: inv.date,
          type: 'Sale Invoice',
          reference: `Invoice: ${inv.invoice_number}`,
          qtyIn: 0,
          qtyOut: parseFloat(it.qty || 0),
          timestamp: new Date(inv.created_at).getTime()
        });
      }
    });
  });

  // 4. Sales returns
  db.get('sales_returns').forEach(ret => {
    ret.items?.forEach(it => {
      if (it.product_id === productId) {
        timeline.push({
          date: ret.date,
          type: 'Sales Return',
          reference: `Return: ${ret.return_number}`,
          qtyIn: parseFloat(it.qty || 0),
          qtyOut: 0,
          timestamp: new Date(ret.created_at).getTime()
        });
      }
    });
  });

  // 5. Purchase returns
  db.get('purchase_returns').forEach(ret => {
    ret.items?.forEach(it => {
      if (it.product_id === productId) {
        timeline.push({
          date: ret.date,
          type: 'Purchase Return',
          reference: `Return: ${ret.return_number}`,
          qtyIn: 0,
          qtyOut: parseFloat(it.qty || 0),
          timestamp: new Date(ret.created_at).getTime()
        });
      }
    });
  });

  // 6. Stock adjustments
  db.get('stock_adjustments').forEach(adj => {
    if (adj.product_id === productId) {
      const val = parseFloat(adj.qty_change || 0);
      timeline.push({
        date: adj.date,
        type: 'Stock Adjustment',
        reference: `Reason: ${adj.reason} (${adj.note || ''})`,
        qtyIn: val > 0 ? val : 0,
        qtyOut: val < 0 ? Math.abs(val) : 0,
        timestamp: new Date(adj.created_at).getTime()
      });
    }
  });

  // Sort timeline chronologically (Section 13 Formula requirement)
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  // Compile running balance
  let running = 0;
  timeline.forEach(row => {
    running += row.qtyIn - row.qtyOut;
    row.balance = running < 0 ? 0 : running;
  });

  // Reverse list for display (Newest on top)
  const displayTimeline = [...timeline].reverse();

  modalContainer.innerHTML = `
    <div class="modal-backdrop" id="history-modal-backdrop">
      <div class="modal-card" style="max-width: 750px;">
        <div class="modal-header">
          <h3><i data-lucide="history"></i> Stock History — ${product.name}</h3>
          <button class="modal-close-btn" id="btn-close-history-modal"><i data-lucide="x"></i></button>
        </div>
        
        <div style="background: hsl(var(--bg-primary)); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px; border: 1px solid hsl(var(--border-color));">
          <p>Product Barcode: <strong>${product.qr}</strong> | Live Available Stock: <strong class="text-success">${calc.getCurrentStock(productId)}</strong></p>
        </div>

        <div class="table-responsive" style="max-height: 400px; margin-top: 0;">
          <table class="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action Type</th>
                <th>Details / Reference</th>
                <th>Qty In</th>
                <th>Qty Out</th>
                <th>Running Stock</th>
              </tr>
            </thead>
            <tbody>
              ${displayTimeline.map(row => `
                <tr>
                  <td>
                    <div>${formatDateToDDMMYY(row.date)}</div>
                    ${row.timestamp ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(row.timestamp)}</div>` : ''}
                  </td>
                  <td><span class="badge ${row.qtyIn > 0 ? 'badge-success' : 'badge-danger'}">${row.type}</span></td>
                  <td style="color: hsl(var(--text-secondary));">${row.reference}</td>
                  <td class="text-success">${row.qtyIn > 0 ? `+${row.qtyIn}` : '—'}</td>
                  <td class="text-danger">${row.qtyOut > 0 ? `-${row.qtyOut}` : '—'}</td>
                  <td style="font-weight: 700;">${row.balance}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="text-align: right; margin-top: 16px;">
          <button class="btn btn-secondary" id="btn-close-history-footer">Close History</button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modalContainer.innerHTML = '';
  document.getElementById('btn-close-history-modal').addEventListener('click', closeModal);
  document.getElementById('btn-close-history-footer').addEventListener('click', closeModal);
}

// 3. Dynamic Excel Importer Parsing using SheetJS (XLSX)
function handleExcelImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (rows.length === 0) {
        throw new Error("Excel sheet is empty!");
      }

      const rawHeaders = Object.keys(rows[0]);
      const cleanHeaders = rawHeaders.map(h => h.toLowerCase().trim());
      
      const hasName = cleanHeaders.includes('name');
      const hasQr = cleanHeaders.includes('qr');
      
      if (!hasName || !hasQr) {
        throw new Error("Missing required columns in Excel sheet! File must have at least 'Name' and 'QR' columns.");
      }

      let addedCount = 0;
      let updatedCount = 0;
      
      rows.forEach(row => {
        const getVal = (possibleKeys) => {
          for (const key of Object.keys(row)) {
            if (possibleKeys.includes(key.toLowerCase().trim())) {
              return row[key];
            }
          }
          return '';
        };

        const name = getVal(['name', 'product_name', 'product name']);
        const qr = String(getVal(['qr', 'barcode', 'code', 'qr code', 'qr_code'])).trim();

        if (!name || !qr) {
          return;
        }

        const updates = {
          name: String(name).trim(),
          qr,
          category: String(getVal(['category'])).trim(),
          description: String(getVal(['description'])).trim(),
          purchase_price: parseFloat(getVal(['cost', 'purchase_price', 'purchase_rate', 'purchase price', 'purchase_price']) || 0),
          sale_price: parseFloat(getVal(['price', 'sale_price', 'sale price', 'mrp', 'sale_price']) || 0),
          gst_rate: parseInt(getVal(['gst', 'gst_rate', 'gst rate', 'gst %', 'gst_rate']) || 0),
          default_discount: parseFloat(getVal(['discount', 'default_discount', 'default discount', 'discount %', 'default_di']) || 0),
          opening_stock: parseFloat(getVal(['stock', 'opening_stock', 'opening stock', 'live stock', 'live_stock', 'stock_val']) || 0)
        };

        const products = db.getAllRaw('products');
        const existing = products.find(p => p.qr === qr && !p.is_deleted);

        if (existing) {
          // Don't overwrite opening_stock for existing products — it would corrupt live stock levels
          delete updates.opening_stock;
          db.update('products', existing.id, updates);
          updatedCount++;
        } else {
          db.insert('products', updates);
          addedCount++;
        }
      });

      refreshProductsList();
      db.logAudit("Excel Products Imported", `Bulk import successfully parsed. Added: ${addedCount}, Updated: ${updatedCount}`);
      alert(`Excel Bulk Import Complete!\n\nAdded New: ${addedCount}\nUpdated Existing: ${updatedCount}`);
    } catch (err) {
      alert(`Excel parsing failed: ${err.message}`);
    }
  };
  reader.readAsArrayBuffer(file);
}

// 4. Product list Excel Exporter
function handleExcelExport() {
  const products = db.get('products');
  if (products.length === 0) {
    alert("No products in list to export!");
    return;
  }

  const headers = ['Name', 'QR', 'Category', 'Description', 'Purchase_Price', 'Sale_Price', 'GST_Rate', 'Default_Discount', 'Live_Stock'];
  const data = products.map(p => ({
    'Name': p.name,
    'QR': p.qr,
    'Category': p.category || '',
    'Description': p.description || '',
    'Purchase_Price': p.purchase_price || 0,
    'Sale_Price': p.sale_price || 0,
    'GST_Rate': p.gst_rate || 0,
    'Default_Discount': p.default_discount || 0,
    'Live_Stock': calc.getCurrentStock(p.id)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  XLSX.writeFile(workbook, "gonabhavi_products_export.xlsx");
  db.logAudit("Excel Products Exported", "Downloaded Excel (.xlsx) file of products.");
}

/* ==========================================================================
   GONABHAVI — BARCODE PRINT QUEUE & LABEL GENERATOR (src/views/labels.js)
   ========================================================================== */

import { db, calc } from '../db.js';

// Local temporary array for the printing queue (persists during active session)
let printQueue = [];

export default async function renderBarcodeLabels(container) {
  const products = db.get('products');

  // Page structure
  container.innerHTML = `
    <div class="animate-fade-in print-area-container">
      
      <!-- View Title and Actions -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="qr-code" style="color: hsl(var(--primary));"></i>
          Product QR Code Label Center
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-labels-print" class="btn btn-primary" ${printQueue.length === 0 ? 'disabled' : ''}>
            <i data-lucide="printer"></i> Print QR Labels Sheet
          </button>
          <button id="btn-labels-clear" class="btn btn-secondary" ${printQueue.length === 0 ? 'disabled' : ''}>
            <i data-lucide="trash-2"></i> Clear Queue
          </button>
        </div>
      </div>

      <!-- Split Screen Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;" class="labels-grid-responsive">
        
        <!-- LEFT COLUMN: CONTROLS & QUEUE -->
        <div class="no-print" style="display: flex; flex-direction: column; gap: 20px;">
          
          <!-- 1. Add Product Form -->
          <div class="view-card" style="padding: 16px; margin-bottom: 0;">
            <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 14px;"><i data-lucide="plus" style="color: hsl(var(--primary));"></i> Add Product to Print</h3>
            
            <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
              <div class="form-group" style="flex: 2; min-width: 200px; margin-bottom: 0;">
                <label class="form-label">Select Product</label>
                <select id="label-prod-select" class="form-control">
                  <option value="">-- Choose Product --</option>
                  ${products.map(p => {
                    const stock = calc.getCurrentStock(p.id);
                    return `<option value="${p.id}">${p.name} (Code: ${p.qr} | Stock: ${stock})</option>`;
                  }).join('')}
                </select>
              </div>

              <div class="form-group" style="width: 90px; margin-bottom: 0;">
                <label class="form-label">Quantity</label>
                <input type="number" id="label-qty-input" class="form-control" value="8" min="1">
              </div>

              <button id="btn-label-queue-add" class="btn btn-primary" style="padding: 10px 16px;">
                <i data-lucide="plus-circle"></i> Add
              </button>
            </div>
          </div>

          <!-- 2. Customize Print options -->
          <div class="view-card" style="padding: 16px; margin-bottom: 0;">
            <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 14px;"><i data-lucide="sliders" style="color: hsl(var(--primary));"></i> Sheet & Label Layout</h3>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Page Grid Columns</label>
                <select id="label-columns-select" class="form-control">
                  <option value="2">2 Columns (Large Labels)</option>
                  <option value="3" selected>3 Columns (Medium Standard Labels)</option>
                  <option value="4">4 Columns (Small Labels)</option>
                </select>
              </div>

              <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 6px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; color: hsl(var(--text-primary));">
                  <input type="checkbox" id="label-toggle-name" checked style="width: 16px; height: 16px; accent-color: hsl(var(--primary));">
                  Show Product Name
                </label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; color: hsl(var(--text-primary));">
                  <input type="checkbox" id="label-toggle-description" checked style="width: 16px; height: 16px; accent-color: hsl(var(--primary));">
                  Show Description
                </label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; color: hsl(var(--text-primary));">
                  <input type="checkbox" id="label-toggle-price" checked style="width: 16px; height: 16px; accent-color: hsl(var(--primary));">
                  Show MRP Price
                </label>
              </div>
            </div>
          </div>

          <!-- 3. Current Queue Table -->
          <div class="view-card" style="margin-bottom: 0;">
            <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 12px;"><i data-lucide="list-ordered" style="color: hsl(var(--primary));"></i> Active Labels Print Queue</h3>
            
            <div class="table-responsive" style="margin-top: 0; border: none; max-height: 250px; overflow-y: auto;">
              <table class="app-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Description</th>
                    <th>QR Value</th>
                    <th style="width: 100px;" class="text-center">Labels Count</th>
                    <th style="width: 50px;"></th>
                  </tr>
                </thead>
                <tbody id="label-queue-tbody">
                  <!-- Generated dynamically -->
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- RIGHT COLUMN: LIVE SHEET PREVIEW -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <h3 class="card-title no-print" style="font-size: 1.05rem; margin-bottom: 0;"><i data-lucide="eye" style="color: hsl(var(--primary));"></i> Print-Sheet Preview</h3>
          
          <div id="labels-preview-sheet-box" style="background: #ffffff; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm); padding: 20px; box-shadow: var(--shadow-sm); min-height: 500px; display: flex; flex-direction: column; overflow-x: auto;">
            <!-- Render grid of labels dynamically -->
          </div>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Dom hooks
  const prodSelect = document.getElementById('label-prod-select');
  const qtyInput = document.getElementById('label-qty-input');
  const queueAddBtn = document.getElementById('btn-label-queue-add');
  const queueTbody = document.getElementById('label-queue-tbody');
  const previewSheetBox = document.getElementById('labels-preview-sheet-box');
  const columnsSelect = document.getElementById('label-columns-select');
  const toggleName = document.getElementById('label-toggle-name');
  const togglePrice = document.getElementById('label-toggle-price');
  const toggleDescription = document.getElementById('label-toggle-description');
  
  const printBtn = document.getElementById('btn-labels-print');
  const clearBtn = document.getElementById('btn-labels-clear');

  // Redraw preview sheet
  function redrawSheet() {
    // Enable/disable buttons based on queue size
    const isEmpty = printQueue.length === 0;
    printBtn.disabled = isEmpty;
    clearBtn.disabled = isEmpty;

    // Render Queue Table
    queueTbody.innerHTML = '';
    if(isEmpty) {
      queueTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 20px 10px;">Queue is empty. Select a product to begin.</td></tr>`;
      previewSheetBox.innerHTML = `
        <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #888; padding: 40px 10px; text-align: center;">
          <i data-lucide="printer" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 10px; opacity: 0.5;"></i>
          <p style="margin: 0; font-size: 0.95rem;">Add products and quantities to print. A real-time sheet preview will render here.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    printQueue.forEach((item, idx) => {
      queueTbody.innerHTML += `
        <tr data-index="${idx}">
          <td style="font-weight: 500;">${item.name}</td>
          <td style="color: hsl(var(--text-secondary)); font-size: 0.85rem;">${item.description || '—'}</td>
          <td style="font-size: 0.85rem; font-family: monospace; color: hsl(var(--text-secondary));">${item.qr}</td>
          <td>
            <input type="number" class="form-control label-qty-edit-cell" value="${item.qty}" min="1" style="padding: 4px 8px; text-align: center;">
          </td>
          <td class="text-center">
            <button class="btn-delete-queue-item" style="color: hsl(var(--danger)); border: none; background: none; cursor: pointer;" title="Remove">
              <i data-lucide="trash" style="width: 16px; height: 16px;"></i>
            </button>
          </td>
        </tr>
      `;
    });

    // Reattach cell change listeners
    queueTbody.querySelectorAll('tr').forEach(row => {
      const idx = parseInt(row.getAttribute('data-index'));
      const item = printQueue[idx];

      row.querySelector('.label-qty-edit-cell').addEventListener('change', (e) => {
        item.qty = parseInt(e.target.value || 1);
        redrawSheet();
      });

      row.querySelector('.btn-delete-queue-item').addEventListener('click', () => {
        printQueue.splice(idx, 1);
        redrawSheet();
      });
    });

    // Render Preview QR Grid
    const cols = parseInt(columnsSelect.value || 3);
    const showNameVal = toggleName.checked;
    const showPriceVal = togglePrice.checked;
    const showDescVal = toggleDescription.checked;

    previewSheetBox.innerHTML = '';
    
    // Create grid wrapper
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gap = '12px';
    grid.style.width = '100%';
    previewSheetBox.appendChild(grid);

    // Loop through queue and output matching label copies
    printQueue.forEach((item) => {
      for (let i = 0; i < item.qty; i++) {
        const label = document.createElement('div');
        label.className = 'print-label-card';
        
        // Custom styling for individual premium label card in print preview (Black/White style)
        label.style.border = '1px dashed #555';
        label.style.padding = '10px 8px';
        label.style.display = 'flex';
        label.style.flexDirection = 'column';
        label.style.alignItems = 'center';
        label.style.justifyContent = 'center';
        label.style.background = '#ffffff';
        label.style.color = '#000000';
        label.style.borderRadius = '4px';
        label.style.textAlign = 'center';
        label.style.boxSizing = 'border-box';

        let nameHtml = '';
        if(showNameVal) {
          nameHtml = `<div style="font-size: 0.72rem; font-weight: 700; color: #000; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">${item.name}</div>`;
        }

        let descHtml = '';
        if(showDescVal && item.description) {
          descHtml = `<div style="font-size: 0.62rem; color: #555; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">${item.description}</div>`;
        }

        let priceHtml = '';
        if(showPriceVal) {
          priceHtml = `<div style="font-size: 0.78rem; font-weight: 800; color: #000; margin-top: 2px;">MRP: ₹${parseFloat(item.price || 0).toFixed(2)}</div>`;
        }

        // Include user logo at the top
        label.innerHTML = `
          <img src="/src/logo.png" style="max-height: 18px; max-width: 85%; object-fit: contain; margin-bottom: 4px; display: block;">
          ${nameHtml}
          ${descHtml}
          <canvas class="qr-preview-canvas" data-code="${item.qr}" style="width: 75px; height: 75px; display: block; margin: 4px auto;"></canvas>
          ${priceHtml}
        `;
        
        grid.appendChild(label);
      }
    });

    // Run QRious on all canvases inside the preview box
    document.querySelectorAll('.qr-preview-canvas').forEach(canvas => {
      const code = canvas.getAttribute('data-code');
      if (code) {
        try {
          new window.QRious({
            element: canvas,
            value: code,
            size: 150 // crisp high resolution for printing
          });
        } catch (err) {
          console.error("Failed QR code rendering", err);
          canvas.outerHTML = `<div style="font-family: monospace; font-size: 0.75rem; border: 1px dashed red; padding: 4px; color: red;">QR Error</div>`;
        }
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Add Product button trigger
  queueAddBtn.addEventListener('click', () => {
    const prodId = prodSelect.value;
    const qty = parseInt(qtyInput.value || 1);
    if (!prodId) {
      alert("Please select a product first.");
      return;
    }

    const p = db.find('products', prodId);
    if (p) {
      const existing = printQueue.find(item => item.product_id === p.id);
      if (existing) {
        existing.qty += qty;
      } else {
        printQueue.push({
          product_id: p.id,
          name: p.name,
          qr: p.qr,
          price: p.sale_price,
          description: p.description || '',
          qty: qty
        });
      }
      
      redrawSheet();
    }
  });

  // Customize layout filters change
  columnsSelect.addEventListener('change', redrawSheet);
  toggleName.addEventListener('change', redrawSheet);
  togglePrice.addEventListener('change', redrawSheet);
  toggleDescription.addEventListener('change', redrawSheet);

  // Clear queue
  clearBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to clear the active barcode printing queue?")) {
      printQueue = [];
      redrawSheet();
    }
  });

  // Print trigger
  printBtn.addEventListener('click', () => {
    const cols = parseInt(columnsSelect.value || 3);
    const printContents = previewSheetBox.innerHTML;
    
    document.body.innerHTML = `
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 8mm;
        }
        body {
          background: #fff !important;
          color: #000 !important;
          margin: 0;
          padding: 0;
        }
        /* A4 labels grid layout */
        .print-grid {
          display: grid !important;
          grid-template-columns: repeat(${cols}, 1fr) !important;
          gap: 12px !important;
          width: 100% !important;
        }
        .print-label-card {
          border: 1px dashed #555 !important;
          padding: 10px 8px !important;
          text-align: center !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          background: #fff !important;
          color: #000 !important;
          box-sizing: border-box !important;
        }
        .print-label-card img {
          max-height: 18px !important;
          max-width: 85% !important;
          object-fit: contain !important;
          margin-bottom: 4px !important;
          display: block !important;
        }
        .print-label-card canvas {
          width: 75px !important;
          height: 75px !important;
          display: block !important;
          margin: 4px auto !important;
        }
      </style>
      <div class="print-grid">
        ${printContents}
      </div>
    `;
    window.print();
    window.location.reload();
  });

  // Initial draw
  redrawSheet();
}

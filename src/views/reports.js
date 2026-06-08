/* ==========================================================================
   GONABHAVI — FINANCIAL REPORTING SUITE (src/views/reports.js)
   ========================================================================== */

import { db, calc, formatDateToDDMMYY, getLocalYYYYMMDD, formatTimeFromTimestamp } from '../db.js';

// Helper for formatting currency in Indian standard Rupees
function formatINR(val) {
  return '₹' + parseFloat(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Helper to calculate days between two dates
function getDaysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/* ==========================================================================
   1. REPORTS HUB (Default Export)
   ========================================================================== */
export default async function renderReportsHub(container) {
  // Aggregate Overview stats
  const settings = db.get('business_settings');
  const invoices = db.get('invoices');
  const returns = db.get('sales_returns');
  const purchases = db.get('purchases');
  const purReturns = db.get('purchase_returns');
  const expenses = db.get('expenses');
  const customers = db.get('customers');
  const suppliers = db.get('suppliers');
  
  // Account Balances
  const accounts = calc.getAccountBalances();
  const cashUPIBankTotal = accounts.cash + accounts.upi + accounts.bank;

  // 1. Net Revenue
  let grossSales = 0;
  let finalDiscounts = 0;
  invoices.forEach(inv => {
    grossSales += parseFloat(inv.grand_total || 0);
    finalDiscounts += parseFloat(inv.final_discount || 0);
  });
  const totalSalesReturn = returns.reduce((acc, r) => acc + parseFloat(r.grand_total || 0), 0);
  const netRevenue = (grossSales - finalDiscounts) - totalSalesReturn;

  // 2. Net Purchases (COGS)
  const grossPurchases = purchases.reduce((acc, p) => acc + parseFloat(p.grand_total || 0), 0);
  const totalPurReturns = purReturns.reduce((acc, r) => acc + parseFloat(r.grand_total || 0), 0);
  const netPurchases = grossPurchases - totalPurReturns;

  // 3. Gross Profit
  const grossProfit = netRevenue - netPurchases;

  // 4. Operating Expenses
  const totalExpenses = expenses.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0);

  // 5. Net Profit
  const netProfit = grossProfit - totalExpenses;

  // 6. Outstanding Receivables & Payables
  let totalReceivables = 0;
  customers.forEach(c => {
    totalReceivables += calc.getCustomerBalance(c.id);
  });

  let totalPayables = 0;
  suppliers.forEach(s => {
    totalPayables += calc.getSupplierBalance(s.id);
  });

  // 7. GST Net Liability
  let salesGst = 0;
  invoices.forEach(inv => {
    inv.items?.forEach(it => {
      const gross = it.qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const afterDisc = gross - disc;
      const taxable = afterDisc / (1 + it.gst_rate / 100);
      salesGst += (afterDisc - taxable);
    });
  });
  let returnGst = 0;
  returns.forEach(ret => {
    ret.items?.forEach(it => {
      const gross = it.qty * it.rate;
      const disc = gross * (it.discount_rate / 100);
      const afterDisc = gross - disc;
      const taxable = afterDisc / (1 + it.gst_rate / 100);
      returnGst += (afterDisc - taxable);
    });
  });
  const netGstLiability = salesGst - returnGst;

  container.innerHTML = `
    <div class="animate-fade-in">
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 1.6rem; font-weight: 700; margin-bottom: 6px; font-family: var(--font-brand);">
          <i data-lucide="bar-chart-3" style="color: hsl(var(--primary)); vertical-align: middle; margin-right: 6px;"></i>
          Financial Analysis & Reports
        </h2>
        <p style="color: hsl(var(--text-secondary)); font-size: 0.95rem; margin: 0;">Access live business ledgers, tax aggregates, profit metrics, and audit journals.</p>
      </div>

      <!-- Live Core Metrics Row -->
      <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: 30px; gap: 16px;">
        
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Net Sales Revenue</span>
            <span class="stat-value text-primary">${formatINR(netRevenue)}</span>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted));">Sales minus Returns</span>
          </div>
          <div class="stat-icon color-primary">
            <i data-lucide="trending-up"></i>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Net Operating Profit</span>
            <span class="stat-value ${netProfit >= 0 ? 'text-success' : 'text-danger'}">${formatINR(netProfit)}</span>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted));">GP minus Operating Expenses</span>
          </div>
          <div class="stat-icon ${netProfit >= 0 ? 'color-success' : 'color-danger'}">
            <i data-lucide="award"></i>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Outstanding Receivables</span>
            <span class="stat-value text-warning">${formatINR(totalReceivables)}</span>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted));">Customer Outstanding Dues</span>
          </div>
          <div class="stat-icon color-warning">
            <i data-lucide="arrow-down-left"></i>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Supplier Payables</span>
            <span class="stat-value text-danger">${formatINR(totalPayables)}</span>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted));">Supplier Unpaid Purchase Dues</span>
          </div>
          <div class="stat-icon color-danger">
            <i data-lucide="arrow-up-right"></i>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Account Liquid Cash</span>
            <span class="stat-value text-success">${formatINR(cashUPIBankTotal)}</span>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted));">${settings.account_cash_label || 'Cash'}, ${settings.account_upi_label || 'UPI'} & ${settings.account_bank_label || 'Bank'} Accounts</span>
          </div>
          <div class="stat-icon color-success">
            <i data-lucide="wallet"></i>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Net GST Liability</span>
            <span class="stat-value text-info">${formatINR(netGstLiability)}</span>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted));">Tax on Sales minus Returns</span>
          </div>
          <div class="stat-icon color-info">
            <i data-lucide="landmark"></i>
          </div>
        </div>

      </div>

      <!-- Navigation Hub Grid -->
      <h3 style="font-size: 1.15rem; font-family: var(--font-brand); margin-bottom: 16px;">Select Report Module</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        
        <!-- P&L Tile -->
        <a href="#profit-loss" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-success" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="dollar-sign" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Profit & Loss Statement</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Review gross revenue, cost of goods sold, operating expenses, and net profit splits.</p>
          </div>
        </a>

        <!-- Balance Sheet Tile -->
        <a href="#balance-sheet" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-primary" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="scale" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Balance Sheet</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Calculate company Net Worth by comparing live liquid assets + inventory against liabilities.</p>
          </div>
        </a>

        <!-- GST summary Tile -->
        <a href="#gst-summary" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-info" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="calculator" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">GST Tax Summary</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Review taxable sales value, CGST/SGST/IGST tax splits grouped by rates (0%, 5%, 12%, 18%, 28%).</p>
          </div>
        </a>

        <!-- Aging Reports Tile -->
        <a href="#receivables-payables" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-warning" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="calendar" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Outstanding Dues Aging</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Track receivables and payables aging distributions (0-30, 31-60, 61-90, 90+ days) to manage credit risks.</p>
          </div>
        </a>

        <!-- Customer Ledger Tile -->
        <a href="#customer-ledger" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-info" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="users" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Customer Ledgers</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Review full chronological transaction histories, debits, credits, and running dues for clients.</p>
          </div>
        </a>

        <!-- Supplier Ledger Tile -->
        <a href="#supplier-ledger" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-danger" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="truck" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Supplier Ledgers</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Chronological audit logs tracking purchase costs, credits, payments, and unpaid supplier bills.</p>
          </div>
        </a>

        <!-- Money Ledger Tile -->
        <a href="#money-ledger" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-success" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="banknote" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Money Account Registers</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Track day-to-day transaction flows, deposits, withdrawals, and transfers in Cash, UPI, or Bank.</p>
          </div>
        </a>

        <!-- Product Margins Tile -->
        <a href="#product-margins" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-warning" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="percent" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">Product Profit Margins</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Analyze margins by comparing product purchase prices against selling prices to identify high-profit items.</p>
          </div>
        </a>

        <!-- Audit Log Tile -->
        <a href="#audit-log" class="view-card text-decoration-none" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: transform 0.2s, border-color 0.2s; cursor: pointer;">
          <div class="stat-icon color-primary" style="width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;">
            <i data-lucide="history" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700; color: hsl(var(--text-primary));">System Audit Log</h4>
            <p style="margin: 0; font-size: 0.85rem; color: hsl(var(--text-secondary));">Scroll through chronological records of all operations, database CRUD events, and sync triggers.</p>
          </div>
        </a>

      </div>
    </div>
  `;

  // Attach card hover effects for premium feel
  document.querySelectorAll('a.view-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'translateY(-3px)';
      el.style.borderColor = 'hsl(var(--primary))';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translateY(0)';
      el.style.borderColor = 'hsl(var(--border-color))';
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   2. GST TAX SUMMARY REPORT
   ========================================================================== */
export async function GstSummaryView(container) {
  // Default dates: start of current month and today
  const now = new Date();
  const startOfMonth = getLocalYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = getLocalYYYYMMDD();

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="calculator" style="color: hsl(var(--info));"></i>
          GST Tax Summary Register
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-gst-print" class="btn btn-secondary"><i data-lucide="printer"></i> Print Report</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Filters Row -->
      <div class="form-grid no-print" style="margin-bottom: 24px; padding: 14px; background: hsl(var(--bg-primary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color));">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">From Date</label>
          <input type="date" id="gst-filter-from" class="form-control" value="${startOfMonth}">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">To Date</label>
          <input type="date" id="gst-filter-to" class="form-control" value="${today}">
        </div>
        <div style="display: flex; align-items: flex-end; margin-bottom: 0;">
          <button id="btn-gst-apply" class="btn btn-primary" style="width: 100%;"><i data-lucide="filter"></i> Apply Period Filter</button>
        </div>
      </div>

      <!-- Printable Report Header -->
      <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
        <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
          GST Tax Summary Report | Period: <span id="print-gst-period"></span>
        </p>
        <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
      </div>

      <!-- Aggregated Tax Metrics Cards -->
      <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px; gap: 14px;">
        <div class="stat-card" style="padding: 12px 16px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Gross Taxable Sales</span>
            <span class="stat-value" id="gst-gross-sales" style="font-size: 1.3rem;">₹0.00</span>
          </div>
        </div>
        <div class="stat-card" style="padding: 12px 16px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Gross GST Collected</span>
            <span class="stat-value text-info" id="gst-gross-tax" style="font-size: 1.3rem;">₹0.00</span>
          </div>
        </div>
        <div class="stat-card" style="padding: 12px 16px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Returns GST Deductions</span>
            <span class="stat-value text-danger" id="gst-return-tax" style="font-size: 1.3rem;">₹0.00</span>
          </div>
        </div>
        <div class="stat-card" style="padding: 12px 16px; background: hsl(var(--bg-primary));">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 0.75rem;">Net Tax Liability</span>
            <span class="stat-value text-success" id="gst-net-tax" style="font-size: 1.3rem;">₹0.00</span>
          </div>
        </div>
      </div>

      <!-- GST Summary Table -->
      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th style="width: 80px;">Rate (%)</th>
              <th class="text-right">Sales Taxable Value</th>
              <th class="text-right">Sales CGST</th>
              <th class="text-right">Sales SGST</th>
              <th class="text-right">Sales GST Amount</th>
              <th class="text-right" style="color: hsl(var(--danger));">Return GST Offset</th>
              <th class="text-right" style="font-weight: 700;">Net Taxable Value</th>
              <th class="text-right" style="font-weight: 700; color: hsl(var(--primary));">Net GST Liability</th>
            </tr>
          </thead>
          <tbody id="gst-table-body">
            <!-- Populated via script -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const fromInput = document.getElementById('gst-filter-from');
  const toInput = document.getElementById('gst-filter-to');
  const tableBody = document.getElementById('gst-table-body');
  
  const grossSalesVal = document.getElementById('gst-gross-sales');
  const grossTaxVal = document.getElementById('gst-gross-tax');
  const returnTaxVal = document.getElementById('gst-return-tax');
  const netTaxVal = document.getElementById('gst-net-tax');
  const printPeriod = document.getElementById('print-gst-period');

  function calculateGstReport() {
    const fromDateStr = fromInput.value;
    const toDateStr = toInput.value;
    
    // Set print period
    if(printPeriod) {
      printPeriod.textContent = `${formatDateToDDMMYY(fromDateStr)} to ${formatDateToDDMMYY(toDateStr)}`;
    }

    const start = new Date(fromDateStr).getTime();
    // Set end to the very end of the date
    const end = new Date(toDateStr).getTime() + (24 * 60 * 60 * 1000 - 1);

    // Get filter-matching transactions
    const invoices = db.get('invoices').filter(inv => {
      const t = new Date(inv.date).getTime();
      return t >= start && t <= end;
    });

    const returns = db.get('sales_returns').filter(r => {
      const t = new Date(r.date).getTime();
      return t >= start && t <= end;
    });

    // Tax rates structure
    const rates = [0, 5, 12, 18, 28];
    const dataByRate = {};
    rates.forEach(r => {
      dataByRate[r] = {
        salesTaxable: 0,
        salesGst: 0,
        returnTaxable: 0,
        returnGst: 0
      };
    });

    // Ingest Sales
    invoices.forEach(inv => {
      inv.items?.forEach(it => {
        const rate = parseInt(it.gst_rate || 0);
        if (dataByRate[rate] === undefined) {
          dataByRate[rate] = { salesTaxable: 0, salesGst: 0, returnTaxable: 0, returnGst: 0 };
        }
        
        const gross = it.qty * it.rate;
        const discRate = parseFloat(it.discount_rate || 0);
        const disc = gross * (discRate / 100);
        const afterDisc = gross - disc;
        const taxable = afterDisc / (1 + rate / 100);
        const gst = afterDisc - taxable;

        dataByRate[rate].salesTaxable += taxable;
        dataByRate[rate].salesGst += gst;
      });
    });

    // Ingest Sales Returns
    returns.forEach(ret => {
      ret.items?.forEach(it => {
        const rate = parseInt(it.gst_rate || 0);
        if (dataByRate[rate] === undefined) {
          dataByRate[rate] = { salesTaxable: 0, salesGst: 0, returnTaxable: 0, returnGst: 0 };
        }

        const gross = it.qty * it.rate;
        const discRate = parseFloat(it.discount_rate || 0);
        const disc = gross * (discRate / 100);
        const afterDisc = gross - disc;
        const taxable = afterDisc / (1 + rate / 100);
        const gst = afterDisc - taxable;

        dataByRate[rate].returnTaxable += taxable;
        dataByRate[rate].returnGst += gst;
      });
    });

    // Compute Summaries
    let totalGrossSales = 0;
    let totalGrossTax = 0;
    let totalReturnTax = 0;
    let totalNetTax = 0;

    tableBody.innerHTML = '';
    
    Object.keys(dataByRate).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(rateKey => {
      const r = parseInt(rateKey);
      const row = dataByRate[r];

      const netTaxable = row.salesTaxable - row.returnTaxable;
      const netTax = row.salesGst - row.returnGst;

      totalGrossSales += row.salesTaxable;
      totalGrossTax += row.salesGst;
      totalReturnTax += row.returnGst;
      totalNetTax += netTax;

      tableBody.innerHTML += `
        <tr>
          <td><span class="badge color-primary">${r}%</span></td>
          <td class="text-right">${formatINR(row.salesTaxable)}</td>
          <td class="text-right">${formatINR(row.salesGst / 2)}</td>
          <td class="text-right">${formatINR(row.salesGst / 2)}</td>
          <td class="text-right">${formatINR(row.salesGst)}</td>
          <td class="text-right text-danger">${formatINR(row.returnGst)}</td>
          <td class="text-right" style="font-weight:600;">${formatINR(netTaxable)}</td>
          <td class="text-right" style="font-weight:700; color: hsl(var(--primary));">${formatINR(netTax)}</td>
        </tr>
      `;
    });

    // Total row
    tableBody.innerHTML += `
      <tr style="background: hsl(var(--bg-primary)); font-weight: 700; border-top: 2px solid hsl(var(--border-color));">
        <td>Total</td>
        <td class="text-right">${formatINR(totalGrossSales)}</td>
        <td class="text-right">${formatINR(totalGrossTax / 2)}</td>
        <td class="text-right">${formatINR(totalGrossTax / 2)}</td>
        <td class="text-right">${formatINR(totalGrossTax)}</td>
        <td class="text-right text-danger">${formatINR(totalReturnTax)}</td>
        <td class="text-right">${formatINR(totalGrossSales - totalReturnTax)}</td>
        <td class="text-right" style="font-weight: 800; color: hsl(var(--success));">${formatINR(totalNetTax)}</td>
      </tr>
    `;

    grossSalesVal.textContent = formatINR(totalGrossSales);
    grossTaxVal.textContent = formatINR(totalGrossTax);
    returnTaxVal.textContent = formatINR(totalReturnTax);
    netTaxVal.textContent = formatINR(totalNetTax);
  }

  // Bind Actions
  document.getElementById('btn-gst-apply').addEventListener('click', calculateGstReport);
  document.getElementById('btn-gst-print').addEventListener('click', () => {
    window.print();
  });

  // Init
  calculateGstReport();
}

/* ==========================================================================
   3. PROFIT & LOSS STATEMENT VIEW
   ========================================================================== */
export async function ProfitLossView(container) {
  const now = new Date();
  const startOfMonth = getLocalYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = getLocalYYYYMMDD();

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="trending-up" style="color: hsl(var(--success));"></i>
          Profit & Loss Statement (P&L)
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-pl-print" class="btn btn-secondary"><i data-lucide="printer"></i> Print Statement</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Filters Row -->
      <div class="form-grid no-print" style="margin-bottom: 24px; padding: 14px; background: hsl(var(--bg-primary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color));">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">From Date</label>
          <input type="date" id="pl-filter-from" class="form-control" value="${startOfMonth}">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">To Date</label>
          <input type="date" id="pl-filter-to" class="form-control" value="${today}">
        </div>
        <div style="display: flex; align-items: flex-end; margin-bottom: 0;">
          <button id="btn-pl-apply" class="btn btn-primary" style="width: 100%;"><i data-lucide="filter"></i> Generate Statement</button>
        </div>
      </div>

      <!-- Printable Report Header -->
      <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
        <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
          Income & Expense Statement | Period: <span id="print-pl-period"></span>
        </p>
        <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start;" class="pl-grid-responsive">
        
        <!-- P&L Calculation Sheet -->
        <div class="view-card" style="margin-bottom: 0; background: hsl(var(--bg-primary)); padding: 20px;">
          
          <!-- 1. Revenue Block -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 6px;">
              <h3 style="margin: 0; font-size: 1.1rem; color: hsl(var(--success)); font-weight: 700;">1. REVENUE (Sales Income)</h3>
              <span id="pl-net-revenue-top" style="font-weight: 700; color: hsl(var(--success));">₹0.00</span>
            </div>
            <div style="padding: 10px 0 0 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.95rem;">
              <div style="display: flex; justify-content: space-between;">
                <span>Gross Invoice Sales</span>
                <span id="pl-gross-sales">₹0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: hsl(var(--danger));">
                <span>(-) Whole Invoice Final Discounts Given</span>
                <span id="pl-invoice-discounts">-₹0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: hsl(var(--danger));">
                <span>(-) Sales Returns (Credit Notes)</span>
                <span id="pl-sales-returns">-₹0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px dashed hsl(var(--border-color)); padding-top: 6px; margin-top: 4px;">
                <span>Net Sales Revenue</span>
                <span id="pl-net-revenue">₹0.00</span>
              </div>
            </div>
          </div>

          <!-- 2. COGS Block -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 6px;">
              <h3 style="margin: 0; font-size: 1.1rem; color: hsl(var(--warning)); font-weight: 700;">2. COST OF GOODS SOLD (Net Purchases)</h3>
              <span id="pl-net-cogs-top" style="font-weight: 700; color: hsl(var(--warning));">₹0.00</span>
            </div>
            <div style="padding: 10px 0 0 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.95rem;">
              <div style="display: flex; justify-content: space-between;">
                <span>Gross Inventory Purchases (Bills)</span>
                <span id="pl-gross-purchases">₹0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: hsl(var(--success));">
                <span>(-) Purchase Returns (Debit Notes)</span>
                <span id="pl-purchase-returns">-₹0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px dashed hsl(var(--border-color)); padding-top: 6px; margin-top: 4px;">
                <span>Net Cost of Purchases (COGS)</span>
                <span id="pl-net-cogs">₹0.00</span>
              </div>
            </div>
          </div>

          <!-- 3. Gross Profit Summary Row -->
          <div style="padding: 14px 16px; background: hsl(var(--bg-secondary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 1.15rem; font-family: var(--font-brand);">
            <span>3. GROSS PROFIT (1 minus 2)</span>
            <span id="pl-gross-profit" style="color: hsl(var(--primary));">₹0.00</span>
          </div>

          <!-- 4. Operating Expenses Block -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 6px;">
              <h3 style="margin: 0; font-size: 1.1rem; color: hsl(var(--danger)); font-weight: 700;">4. OPERATING EXPENSES (Overheads)</h3>
              <span id="pl-expenses-total-top" style="font-weight: 700; color: hsl(var(--danger));">₹0.00</span>
            </div>
            
            <div id="pl-expenses-list-container" style="padding: 10px 0 0 12px; display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem;">
              <!-- Groups populated dynamically -->
            </div>
            
            <div style="padding: 6px 0 0 12px; display: flex; justify-content: space-between; font-weight: 600; border-top: 1px dashed hsl(var(--border-color)); margin-top: 8px;">
              <span>Total Overheads / Expenses</span>
              <span id="pl-expenses-total">₹0.00</span>
            </div>
          </div>

          <!-- 5. Net Profit Row -->
          <div id="pl-net-profit-card" style="padding: 16px 20px; background: hsl(var(--success-light, var(--bg-secondary))); border-radius: var(--radius-sm); border: 2px solid hsl(var(--success)); display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 1.35rem; font-family: var(--font-brand);">
            <span>5. NET OPERATING PROFIT</span>
            <span id="pl-net-profit" style="color: hsl(var(--success));">₹0.00</span>
          </div>

        </div>

        <!-- Expense Category Breakdown Charts/Bars -->
        <div class="view-card" style="margin-bottom: 0; padding: 20px;">
          <h3 class="card-title" style="font-size: 1.1rem; margin-bottom: 16px;"><i data-lucide="pie-chart" style="color: hsl(var(--danger));"></i> Overheads Breakdown</h3>
          <div id="pl-expenses-chart-bars" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Category list percentage indicators -->
          </div>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Dom Hooks
  const fromInput = document.getElementById('pl-filter-from');
  const toInput = document.getElementById('pl-filter-to');
  const printPeriod = document.getElementById('print-pl-period');

  const grossSalesVal = document.getElementById('pl-gross-sales');
  const invDiscVal = document.getElementById('pl-invoice-discounts');
  const salesRetVal = document.getElementById('pl-sales-returns');
  const netRevVal = document.getElementById('pl-net-revenue');
  const netRevValTop = document.getElementById('pl-net-revenue-top');

  const grossPurVal = document.getElementById('pl-gross-purchases');
  const purRetVal = document.getElementById('pl-purchase-returns');
  const netCogsVal = document.getElementById('pl-net-cogs');
  const netCogsValTop = document.getElementById('pl-net-cogs-top');

  const grossProfitVal = document.getElementById('pl-gross-profit');

  const expensesContainer = document.getElementById('pl-expenses-list-container');
  const expensesTotal = document.getElementById('pl-expenses-total');
  const expensesTotalTop = document.getElementById('pl-expenses-total-top');
  const netProfitVal = document.getElementById('pl-net-profit');
  const netProfitCard = document.getElementById('pl-net-profit-card');

  const expensesChartBars = document.getElementById('pl-expenses-chart-bars');

  function calculatePL() {
    const fromDateStr = fromInput.value;
    const toDateStr = toInput.value;

    if (printPeriod) {
      printPeriod.textContent = `${formatDateToDDMMYY(fromDateStr)} to ${formatDateToDDMMYY(toDateStr)}`;
    }

    const start = new Date(fromDateStr).getTime();
    const end = new Date(toDateStr).getTime() + (24 * 60 * 60 * 1000 - 1);

    // Filtered data
    const invoices = db.get('invoices').filter(i => {
      const t = new Date(i.date).getTime();
      return t >= start && t <= end;
    });

    const salesReturns = db.get('sales_returns').filter(r => {
      const t = new Date(r.date).getTime();
      return t >= start && t <= end;
    });

    const purchases = db.get('purchases').filter(p => {
      const t = new Date(p.date).getTime();
      return t >= start && t <= end;
    });

    const purchaseReturns = db.get('purchase_returns').filter(r => {
      const t = new Date(r.date).getTime();
      return t >= start && t <= end;
    });

    const expenses = db.get('expenses').filter(e => {
      const t = new Date(e.date).getTime();
      return t >= start && t <= end;
    });

    // 1. REVENUE calculations
    let gSales = 0;
    let finalDisc = 0;
    invoices.forEach(inv => {
      gSales += parseFloat(inv.grand_total || 0);
      finalDisc += parseFloat(inv.final_discount || 0);
    });
    const sReturns = salesReturns.reduce((acc, r) => acc + parseFloat(r.grand_total || 0), 0);
    const netRevenue = (gSales - finalDisc) - sReturns;

    grossSalesVal.textContent = formatINR(gSales);
    invDiscVal.textContent = `-₹${finalDisc.toFixed(2)}`;
    salesRetVal.textContent = `-₹${sReturns.toFixed(2)}`;
    netRevVal.textContent = formatINR(netRevenue);
    netRevValTop.textContent = formatINR(netRevenue);

    // 2. COGS calculations
    const gPurchases = purchases.reduce((acc, p) => acc + parseFloat(p.grand_total || 0), 0);
    const pReturns = purchaseReturns.reduce((acc, r) => acc + parseFloat(r.grand_total || 0), 0);
    const netCogs = gPurchases - pReturns;

    grossPurVal.textContent = formatINR(gPurchases);
    purRetVal.textContent = `-₹${pReturns.toFixed(2)}`;
    netCogsVal.textContent = formatINR(netCogs);
    netCogsValTop.textContent = formatINR(netCogs);

    // 3. Gross Profit
    const grossProfit = netRevenue - netCogs;
    grossProfitVal.textContent = formatINR(grossProfit);
    if(grossProfit >= 0) {
      grossProfitVal.className = 'text-primary';
    } else {
      grossProfitVal.className = 'text-danger';
    }

    // 4. Overheads expenses grouping
    const expGrouped = {};
    let totalExp = 0;
    expenses.forEach(e => {
      const cat = e.category || 'General & Admin';
      const amt = parseFloat(e.amount || 0);
      totalExp += amt;
      expGrouped[cat] = (expGrouped[cat] || 0) + amt;
    });

    expensesTotal.textContent = formatINR(totalExp);
    expensesTotalTop.textContent = formatINR(totalExp);

    expensesContainer.innerHTML = '';
    expensesChartBars.innerHTML = '';

    if (totalExp === 0) {
      expensesContainer.innerHTML = `<span class="text-muted" style="padding: 10px 0;">No operational overhead expenses recorded in this period.</span>`;
      expensesChartBars.innerHTML = `<p class="text-muted text-center" style="padding: 20px 0;">No overhead details available.</p>`;
    } else {
      // Sort categories by amount descending
      const sortedCats = Object.entries(expGrouped).sort((a,b) => b[1] - a[1]);
      
      sortedCats.forEach(([cat, amt]) => {
        const percent = totalExp > 0 ? (amt / totalExp) * 100 : 0;
        
        // Add to main sheet
        expensesContainer.innerHTML += `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: hsl(var(--text-secondary));">${cat}</span>
            <span>${formatINR(amt)}</span>
          </div>
        `;

        // Add to visual side panel bar
        expensesChartBars.innerHTML += `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
              <span style="font-weight: 600; color: hsl(var(--text-primary));">${cat}</span>
              <span style="color: hsl(var(--danger)); font-weight: 700;">${percent.toFixed(1)}% (${formatINR(amt)})</span>
            </div>
            <div style="width: 100%; height: 6px; background: hsl(var(--bg-primary)); border-radius: 3px; overflow: hidden;">
              <div style="width: ${percent}%; height: 100%; background: hsl(var(--danger)); border-radius: 3px;"></div>
            </div>
          </div>
        `;
      });
    }

    // 5. Net Operating Profit
    const netProfit = grossProfit - totalExp;
    netProfitVal.textContent = formatINR(netProfit);

    if (netProfit >= 0) {
      netProfitVal.className = 'text-success';
      netProfitCard.style.borderColor = 'hsl(var(--success))';
      netProfitCard.style.background = 'hsla(var(--success-h), var(--success-s), var(--success-l), 0.08)';
    } else {
      netProfitVal.className = 'text-danger';
      netProfitCard.style.borderColor = 'hsl(var(--danger))';
      netProfitCard.style.background = 'hsla(var(--danger-h), var(--danger-s), var(--danger-l), 0.08)';
    }
  }

  // Bind events
  document.getElementById('btn-pl-apply').addEventListener('click', calculatePL);
  document.getElementById('btn-pl-print').addEventListener('click', () => {
    window.print();
  });

  calculatePL();
}

/* ==========================================================================
   4. BALANCE SHEET VIEW
   ========================================================================== */
export async function BalanceSheetView(container) {
  // Pull assets details
  const accounts = calc.getAccountBalances();
  const customers = db.get('customers');
  const suppliers = db.get('suppliers');
  const products = db.get('products');

  // Customer outstanding receivables
  let receivablesTotal = 0;
  customers.forEach(c => {
    receivablesTotal += calc.getCustomerBalance(c.id);
  });

  // Supplier payables
  let payablesTotal = 0;
  suppliers.forEach(s => {
    payablesTotal += calc.getSupplierBalance(s.id);
  });

  // Inventory value (stock * purchase price)
  let inventoryValue = 0;
  products.forEach(p => {
    const stock = calc.getCurrentStock(p.id);
    const price = parseFloat(p.purchase_price || 0);
    inventoryValue += (stock * price);
  });

  // Assets Total
  const cashUPIBankTotal = accounts.cash + accounts.upi + accounts.bank;
  const totalAssets = cashUPIBankTotal + receivablesTotal + inventoryValue;

  // Liabilities Total
  const totalLiabilities = payablesTotal;

  // Net Worth (Owner Equity)
  const netWorth = totalAssets - totalLiabilities;

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="scale" style="color: hsl(var(--primary));"></i>
          Company Balance Sheet & Worth
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-bs-print" class="btn btn-secondary"><i data-lucide="printer"></i> Print Sheet</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Printable Report Header -->
      <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
        <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
          Balance Sheet | As of ${formatDateToDDMMYY(new Date())}
        </p>
        <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
      </div>

      <!-- Live Calculated Net Worth Block -->
      <div class="stat-card" style="padding: 20px; margin-bottom: 24px; background: linear-gradient(135deg, hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.1), hsla(var(--success-h), var(--success-s), var(--success-l), 0.05)); border: 1px solid hsl(var(--primary)); text-align: center; max-width: 500px; margin-left: auto; margin-right: auto; justify-content: center;">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <span style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: hsl(var(--text-secondary)); font-weight: 600;">Net Business Worth (Owner Equity)</span>
          <span style="font-size: 2rem; font-weight: 800; color: hsl(var(--primary)); font-family: var(--font-brand);">${formatINR(netWorth)}</span>
          <span class="badge color-success" style="padding: 4px 12px; margin-top: 6px; font-size: 0.75rem;"><i data-lucide="check-circle" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i> Ledgers Balanced & Reconciled</span>
        </div>
      </div>

      <!-- Double Entry Assets vs Liabilities Layout -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;" class="bs-grid-responsive">
        
        <!-- ASSETS COLUMN -->
        <div class="view-card" style="margin-bottom: 0; background: hsl(var(--bg-primary)); padding: 20px; display: flex; flex-direction: column;">
          <h3 style="margin: 0 0 16px 0; font-size: 1.15rem; color: hsl(var(--success)); border-bottom: 2px solid hsl(var(--success)); padding-bottom: 8px; font-weight: 700; display: flex; justify-content: space-between;">
            <span>ASSETS (Value Inflows)</span>
            <span>Total Assets</span>
          </h3>

          <div style="display: flex; flex-direction: column; gap: 14px; flex-grow: 1;">
            
            <!-- Liquid Bank/Cash sub-block -->
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: hsl(var(--text-primary)); font-weight: 600;">Liquid Funds Accounts</h4>
              <div style="padding-left: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: hsl(var(--text-secondary)); border-left: 2px solid hsl(var(--border-color));">
                <div style="display: flex; justify-content: space-between;">
                  <span>Cash Drawer Balance</span>
                  <span>${formatINR(accounts.cash)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>UPI Wallet Accounts</span>
                  <span>${formatINR(accounts.upi)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Bank Account Ledger</span>
                  <span>${formatINR(accounts.bank)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 600; color: hsl(var(--text-primary)); border-top: 1px dashed hsl(var(--border-color)); padding-top: 4px; margin-top: 2px;">
                  <span>Subtotal Liquid Assets</span>
                  <span>${formatINR(cashUPIBankTotal)}</span>
                </div>
              </div>
            </div>

            <!-- Receivables Block -->
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: hsl(var(--text-primary)); font-weight: 600;">Trade Receivables</h4>
              <div style="padding-left: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: hsl(var(--text-secondary)); border-left: 2px solid hsl(var(--border-color));">
                <div style="display: flex; justify-content: space-between;">
                  <span>Customer Book Outstanding Balances</span>
                  <span>${formatINR(receivablesTotal)}</span>
                </div>
              </div>
            </div>

            <!-- Inventory Assets Block -->
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: hsl(var(--text-primary)); font-weight: 600;">Inventory Capital Asset</h4>
              <div style="padding-left: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: hsl(var(--text-secondary)); border-left: 2px solid hsl(var(--border-color));">
                <div style="display: flex; justify-content: space-between;">
                  <span>Warehouse Stock Valuation (Cost price)</span>
                  <span>${formatINR(inventoryValue)}</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Total Assets Row -->
          <div style="margin-top: 30px; padding: 12px 0 0 0; border-top: 2px solid hsl(var(--success)); display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem; color: hsl(var(--success)); font-family: var(--font-brand);">
            <span>TOTAL ASSETS</span>
            <span>${formatINR(totalAssets)}</span>
          </div>

        </div>

        <!-- LIABILITIES & OWNER EQUITY COLUMN -->
        <div class="view-card" style="margin-bottom: 0; background: hsl(var(--bg-primary)); padding: 20px; display: flex; flex-direction: column;">
          <h3 style="margin: 0 0 16px 0; font-size: 1.15rem; color: hsl(var(--danger)); border-bottom: 2px solid hsl(var(--danger)); padding-bottom: 8px; font-weight: 700; display: flex; justify-content: space-between;">
            <span>LIABILITIES & EQUITY</span>
            <span>Total Liabilities</span>
          </h3>

          <div style="display: flex; flex-direction: column; gap: 14px; flex-grow: 1;">
            
            <!-- Payables Block -->
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: hsl(var(--text-primary)); font-weight: 600;">Trade Payables</h4>
              <div style="padding-left: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: hsl(var(--text-secondary)); border-left: 2px solid hsl(var(--border-color));">
                <div style="display: flex; justify-content: space-between;">
                  <span>Supplier Book Payables Balance</span>
                  <span>${formatINR(payablesTotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 600; color: hsl(var(--text-primary)); border-top: 1px dashed hsl(var(--border-color)); padding-top: 4px; margin-top: 2px;">
                  <span>Total Liabilities</span>
                  <span>${formatINR(totalLiabilities)}</span>
                </div>
              </div>
            </div>

            <!-- Owner Equity Block -->
            <div>
              <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; color: hsl(var(--text-primary)); font-weight: 600;">Owner Equity & Reserves</h4>
              <div style="padding-left: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: hsl(var(--text-secondary)); border-left: 2px solid hsl(var(--border-color));">
                <div style="display: flex; justify-content: space-between;">
                  <span>Owner Capital Reserve (Net Worth)</span>
                  <span>${formatINR(netWorth)}</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Total Liabilities + Equity Row -->
          <div style="margin-top: 30px; padding: 12px 0 0 0; border-top: 2px solid hsl(var(--danger)); display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem; color: hsl(var(--text-primary)); font-family: var(--font-brand);">
            <span>LIABILITIES & EQUITY TOTAL</span>
            <span>${formatINR(totalLiabilities + netWorth)}</span>
          </div>

        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-bs-print').addEventListener('click', () => {
    window.print();
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   5. OUTSTANDING RECEIVABLES & PAYABLES AGING REPORT
   ========================================================================== */
export async function ReceivablesPayablesView(container) {
  const customers = db.get('customers');
  const suppliers = db.get('suppliers');
  const invoices = db.get('invoices');
  const purchases = db.get('purchases');

  const today = new Date();

  // Aging Data structure for customers
  const customerAging = [];
  customers.forEach(c => {
    const bal = calc.getCustomerBalance(c.id);
    if (bal <= 0.05) return; // Skip if no outstanding balance

    const aging = {
      name: c.name,
      total: bal,
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b90_plus: 0
    };

    // Distribute balance by invoice ages
    const custInvs = invoices.filter(i => i.customer_id === c.id && i.balance_due > 0.05);
    let distributedAmt = 0;

    custInvs.forEach(inv => {
      const days = getDaysBetween(inv.date, today);
      const due = parseFloat(inv.balance_due || 0);
      distributedAmt += due;

      if (days <= 30) aging.b0_30 += due;
      else if (days <= 60) aging.b31_60 += due;
      else if (days <= 90) aging.b61_90 += due;
      else aging.b90_plus += due;
    });

    // Opening balance or discrepancies go to 90+ oldest bucket
    const diff = bal - distributedAmt;
    if (diff > 0.05) {
      aging.b90_plus += diff;
    }

    customerAging.push(aging);
  });

  // Aging Data structure for suppliers
  const supplierAging = [];
  suppliers.forEach(s => {
    const bal = calc.getSupplierBalance(s.id);
    if (bal <= 0.05) return;

    const aging = {
      name: s.name,
      total: bal,
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b90_plus: 0
    };

    const suppBills = purchases.filter(p => p.supplier_id === s.id);
    let distributedAmt = 0;

    suppBills.forEach(bill => {
      const gross = parseFloat(bill.grand_total || 0);
      const paid = parseFloat(bill.cash_paid || 0) + parseFloat(bill.upi_paid || 0) + parseFloat(bill.bank_paid || 0);
      const due = gross - paid;
      if (due <= 0.05) return;

      distributedAmt += due;
      const days = getDaysBetween(bill.date, today);

      if (days <= 30) aging.b0_30 += due;
      else if (days <= 60) aging.b31_60 += due;
      else if (days <= 90) aging.b61_90 += due;
      else aging.b90_plus += due;
    });

    // Opening balances / offsets
    const diff = bal - distributedAmt;
    if (diff > 0.05) {
      aging.b90_plus += diff;
    }

    supplierAging.push(aging);
  });

  // Calculate totals
  const totalRec = customerAging.reduce((acc, c) => acc + c.total, 0);
  const totalPay = supplierAging.reduce((acc, s) => acc + s.total, 0);

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="calendar" style="color: hsl(var(--warning));"></i>
          Outstanding Dues Aging Register
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-aging-print" class="btn btn-secondary"><i data-lucide="printer"></i> Print Aging Report</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Print Header -->
      <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
        <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
          Outstanding Dues Aging Summary | As of ${formatDateToDDMMYY(new Date())}
        </p>
        <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
      </div>

      <!-- 1. CUSTOMER RECEIVABLES AGING -->
      <div class="view-card" style="background: hsl(var(--bg-primary)); padding: 18px; margin-bottom: 24px;">
        <h3 class="card-title" style="font-size: 1.1rem; color: hsl(var(--warning)); margin-bottom: 12px;">
          Customer Receivables (Outstanding Dues to Collect) — Total: ${formatINR(totalRec)}
        </h3>
        
        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th class="text-right" style="font-weight: 700;">Outstanding Due</th>
                <th class="text-right">0-30 Days</th>
                <th class="text-right">31-60 Days</th>
                <th class="text-right">61-90 Days</th>
                <th class="text-right">90+ Days</th>
              </tr>
            </thead>
            <tbody>
              ${customerAging.length === 0 ? `
                <tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No outstanding customer receivables to display. All balances clear!</td></tr>
              ` : customerAging.map(c => `
                <tr>
                  <td style="font-weight: 600;">${c.name}</td>
                  <td class="text-right text-warning" style="font-weight: 700;">${formatINR(c.total)}</td>
                  <td class="text-right">${c.b0_30 > 0 ? formatINR(c.b0_30) : '—'}</td>
                  <td class="text-right">${c.b31_60 > 0 ? formatINR(c.b31_60) : '—'}</td>
                  <td class="text-right">${c.b61_90 > 0 ? formatINR(c.b61_90) : '—'}</td>
                  <td class="text-right" style="color: hsl(var(--danger)); font-weight: 600;">${c.b90_plus > 0 ? formatINR(c.b90_plus) : '—'}</td>
                </tr>
              `).join('')}
              ${customerAging.length > 0 ? `
                <tr style="background: hsl(var(--bg-secondary)); font-weight: 700; border-top: 2px solid hsl(var(--border-color));">
                  <td>Total Receivables</td>
                  <td class="text-right text-warning">${formatINR(totalRec)}</td>
                  <td class="text-right">${formatINR(customerAging.reduce((acc, c)=>acc+c.b0_30, 0))}</td>
                  <td class="text-right">${formatINR(customerAging.reduce((acc, c)=>acc+c.b31_60, 0))}</td>
                  <td class="text-right">${formatINR(customerAging.reduce((acc, c)=>acc+c.b61_90, 0))}</td>
                  <td class="text-right" style="color: hsl(var(--danger));">${formatINR(customerAging.reduce((acc, c)=>acc+c.b90_plus, 0))}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. SUPPLIER PAYABLES AGING -->
      <div class="view-card" style="background: hsl(var(--bg-primary)); padding: 18px; margin-bottom: 0;">
        <h3 class="card-title" style="font-size: 1.1rem; color: hsl(var(--danger)); margin-bottom: 12px;">
          Supplier Payables (Outstanding Dues to Pay) — Total: ${formatINR(totalPay)}
        </h3>

        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th class="text-right" style="font-weight: 700;">Outstanding Owed</th>
                <th class="text-right">0-30 Days</th>
                <th class="text-right">31-60 Days</th>
                <th class="text-right">61-90 Days</th>
                <th class="text-right">90+ Days</th>
              </tr>
            </thead>
            <tbody>
              ${supplierAging.length === 0 ? `
                <tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">No outstanding supplier payables to display. All settled!</td></tr>
              ` : supplierAging.map(s => `
                <tr>
                  <td style="font-weight: 600;">${s.name}</td>
                  <td class="text-right text-danger" style="font-weight: 700;">${formatINR(s.total)}</td>
                  <td class="text-right">${s.b0_30 > 0 ? formatINR(s.b0_30) : '—'}</td>
                  <td class="text-right">${s.b31_60 > 0 ? formatINR(s.b31_60) : '—'}</td>
                  <td class="text-right">${s.b61_90 > 0 ? formatINR(s.b61_90) : '—'}</td>
                  <td class="text-right" style="color: hsl(var(--danger)); font-weight: 600;">${s.b90_plus > 0 ? formatINR(s.b90_plus) : '—'}</td>
                </tr>
              `).join('')}
              ${supplierAging.length > 0 ? `
                <tr style="background: hsl(var(--bg-secondary)); font-weight: 700; border-top: 2px solid hsl(var(--border-color));">
                  <td>Total Payables</td>
                  <td class="text-right text-danger">${formatINR(totalPay)}</td>
                  <td class="text-right">${formatINR(supplierAging.reduce((acc, s)=>acc+s.b0_30, 0))}</td>
                  <td class="text-right">${formatINR(supplierAging.reduce((acc, s)=>acc+s.b31_60, 0))}</td>
                  <td class="text-right">${formatINR(supplierAging.reduce((acc, s)=>acc+s.b61_90, 0))}</td>
                  <td class="text-right" style="color: hsl(var(--danger));">${formatINR(supplierAging.reduce((acc, s)=>acc+s.b90_plus, 0))}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  document.getElementById('btn-aging-print').addEventListener('click', () => {
    window.print();
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   6. CUSTOMER STATEMENT LEDGER
   ========================================================================== */
export async function CustomerLedgerView(container) {
  const customers = db.get('customers');

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="users" style="color: hsl(var(--info));"></i>
          Customer Statement Ledger
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-custledger-print" class="btn btn-secondary" disabled><i data-lucide="printer"></i> Print Ledger</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Selector row -->
      <div class="no-print" style="margin-bottom: 24px; padding: 14px; background: hsl(var(--bg-primary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); max-width: 450px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Select Customer</label>
          <select id="custledger-select" class="form-control">
            <option value="">-- Choose Customer --</option>
            ${customers.map(c => `<option value="${c.id}">${c.name} (${c.phone || 'No Phone'})</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Ledger container -->
      <div id="custledger-content" style="display: none;">
        
        <!-- Print Header -->
        <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
          <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
          <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
            Customer Statement Ledger | Client: <span id="print-cust-name" style="font-weight: 700;"></span>
          </p>
          <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: hsl(var(--bg-primary)); padding: 12px 20px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); margin-bottom: 16px;">
          <span style="font-weight: 600; color: hsl(var(--text-secondary));">Client Outstanding Ledger Balance</span>
          <span id="custledger-balance-total" style="font-size: 1.35rem; font-weight: 700; color: hsl(var(--warning)); font-family: var(--font-brand);">₹0.00</span>
        </div>

        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction Type</th>
                <th>Reference ID</th>
                <th class="text-right">Debit (Sales +)</th>
                <th class="text-right">Credit (Payments -)</th>
                <th class="text-right" style="font-weight: 700;">Running Balance</th>
                <th>Notes / Items</th>
              </tr>
            </thead>
            <tbody id="custledger-table-body">
              <!-- Populated dynamically -->
            </tbody>
          </table>
        </div>

      </div>

      <div id="custledger-empty-placeholder" style="padding: 50px 20px; text-align: center; color: hsl(var(--text-secondary));">
        <i data-lucide="users" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
        <p>Please select a customer from the dropdown list to compile their ledger statement.</p>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const select = document.getElementById('custledger-select');
  const printBtn = document.getElementById('btn-custledger-print');
  const content = document.getElementById('custledger-content');
  const placeholder = document.getElementById('custledger-empty-placeholder');
  const tableBody = document.getElementById('custledger-table-body');
  const balTotal = document.getElementById('custledger-balance-total');
  const printCustName = document.getElementById('print-cust-name');

  select.addEventListener('change', () => {
    const custId = select.value;
    if(!custId) {
      printBtn.disabled = true;
      content.style.display = 'none';
      placeholder.style.display = 'block';
      return;
    }

    const customer = db.find('customers', custId);
    if(!customer) return;

    printBtn.disabled = false;
    content.style.display = 'block';
    placeholder.style.display = 'none';
    printCustName.textContent = `${customer.name} (${customer.phone || 'No Phone'})`;

    // Gather and sort all transactions chronological
    const tx = [];

    // 1. Opening Balance
    const openBal = parseFloat(customer.opening_balance || 0);
    tx.push({
      date: customer.created_at || new Date().toISOString(),
      type: 'Opening Balance',
      ref: 'OPEN-BAL',
      debit: openBal,
      credit: 0,
      note: 'Starting opening balance in customer ledger ledger.',
      created_at: customer.created_at || customer.updated_at
    });

    // 2. Sales Invoices
    db.get('invoices').forEach(inv => {
      if(inv.customer_id === custId) {
        const netSalesAmt = parseFloat(inv.grand_total || 0) - parseFloat(inv.final_discount || 0);
        tx.push({
          date: inv.date,
          type: 'Invoice',
          ref: inv.invoice_number,
          debit: netSalesAmt,
          credit: 0,
          note: inv.items?.map(it => `${it.product_name} (x${it.qty})`).join(', ') || 'Item sales',
          created_at: inv.created_at
        });
      }
    });

    // 3. Payments In (handles both standalone and invoice-linked)
    db.get('payment_ins').forEach(pay => {
      if (pay.customer_id === custId) {
        tx.push({
          date: pay.date,
          type: 'Payment (Receipt)',
          ref: pay.method || 'Cash',
          debit: 0,
          credit: parseFloat(pay.amount || 0),
          note: pay.note || `Received via ${pay.method}`,
          created_at: pay.created_at
        });
      }
    });

    // 4. Sales Returns
    db.get('sales_returns').forEach(ret => {
      if (ret.customer_id === custId) {
        tx.push({
          date: ret.date,
          type: 'Sales Return',
          ref: ret.return_number || 'CN',
          debit: 0,
          credit: parseFloat(ret.grand_total || 0),
          note: ret.note || 'Items returned by customer',
          created_at: ret.created_at
        });
      }
    });

    // Sort transactions chronological by timestamp and date
    tx.sort((a,b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
      const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

    // Compile running balances
    let runBal = 0;
    tableBody.innerHTML = '';

    tx.forEach(t => {
      runBal += (t.debit - t.credit);
      
      tableBody.innerHTML += `
        <tr>
          <td style="white-space: nowrap;">
            <div>${formatDateToDDMMYY(t.date)}</div>
            ${t.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(t.created_at)}</div>` : ''}
          </td>
          <td>
            <span class="badge ${t.type === 'Invoice' ? 'color-primary' : (t.type === 'Sales Return' ? 'color-danger' : 'color-success')}" style="padding: 3px 8px;">
              ${t.type}
            </span>
          </td>
          <td style="font-weight: 600;">${t.ref}</td>
          <td class="text-right text-danger">${t.debit > 0 ? formatINR(t.debit) : '—'}</td>
          <td class="text-right text-success">${t.credit > 0 ? formatINR(t.credit) : '—'}</td>
          <td class="text-right" style="font-weight: 700; color: ${runBal < 0 ? 'hsl(var(--success))' : 'inherit'}">${formatINR(runBal)}</td>
          <td style="font-size: 0.85rem; color: hsl(var(--text-secondary)); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.note}">${t.note}</td>
        </tr>
      `;
    });

    balTotal.textContent = formatINR(calc.getCustomerBalance(custId));
  });

  document.getElementById('btn-custledger-print').addEventListener('click', () => {
    window.print();
  });
}

/* ==========================================================================
   7. SUPPLIER STATEMENT LEDGER
   ========================================================================== */
export async function SupplierLedgerView(container) {
  const suppliers = db.get('suppliers');

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="truck" style="color: hsl(var(--danger));"></i>
          Supplier Statement Ledger
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-suppledger-print" class="btn btn-secondary" disabled><i data-lucide="printer"></i> Print Ledger</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Selector row -->
      <div class="no-print" style="margin-bottom: 24px; padding: 14px; background: hsl(var(--bg-primary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); max-width: 450px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Select Supplier</label>
          <select id="suppledger-select" class="form-control">
            <option value="">-- Choose Supplier --</option>
            ${suppliers.map(s => `<option value="${s.id}">${s.name} (${s.phone || 'No Phone'})</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Ledger content container -->
      <div id="suppledger-content" style="display: none;">
        
        <!-- Print Header -->
        <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
          <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
          <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
            Supplier Statement Ledger | Supplier: <span id="print-supp-name" style="font-weight: 700;"></span>
          </p>
          <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: hsl(var(--bg-primary)); padding: 12px 20px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); margin-bottom: 16px;">
          <span style="font-weight: 600; color: hsl(var(--text-secondary));">Supplier Ledger Outstanding Payable</span>
          <span id="suppledger-balance-total" style="font-size: 1.35rem; font-weight: 700; color: hsl(var(--danger)); font-family: var(--font-brand);">₹0.00</span>
        </div>

        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction Type</th>
                <th>Reference ID</th>
                <th class="text-right">Debit (Payments -)</th>
                <th class="text-right">Credit (Purchases +)</th>
                <th class="text-right" style="font-weight: 700;">Running Balance</th>
                <th>Notes / Items</th>
              </tr>
            </thead>
            <tbody id="suppledger-table-body">
              <!-- Populated dynamically -->
            </tbody>
          </table>
        </div>

      </div>

      <div id="suppledger-empty-placeholder" style="padding: 50px 20px; text-align: center; color: hsl(var(--text-secondary));">
        <i data-lucide="truck" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
        <p>Please select a supplier from the dropdown list to compile their ledger statement.</p>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const select = document.getElementById('suppledger-select');
  const printBtn = document.getElementById('btn-suppledger-print');
  const content = document.getElementById('suppledger-content');
  const placeholder = document.getElementById('suppledger-empty-placeholder');
  const tableBody = document.getElementById('suppledger-table-body');
  const balTotal = document.getElementById('suppledger-balance-total');
  const printSuppName = document.getElementById('print-supp-name');

  select.addEventListener('change', () => {
    const suppId = select.value;
    if(!suppId) {
      printBtn.disabled = true;
      content.style.display = 'none';
      placeholder.style.display = 'block';
      return;
    }

    const supplier = db.find('suppliers', suppId);
    if(!supplier) return;

    printBtn.disabled = false;
    content.style.display = 'block';
    placeholder.style.display = 'none';
    printSuppName.textContent = `${supplier.name} (${supplier.phone || 'No Phone'})`;

    // Gather transactions chronological
    const tx = [];

    // 1. Opening Balance
    const openBal = parseFloat(supplier.opening_balance || 0);
    tx.push({
      date: supplier.created_at || new Date().toISOString(),
      type: 'Opening Balance',
      ref: 'OPEN-BAL',
      debit: 0,
      credit: openBal,
      note: 'Starting opening balance in supplier accounts.',
      created_at: supplier.created_at || supplier.updated_at
    });

    // 2. Purchases bills
    db.get('purchases').forEach(bill => {
      if(bill.supplier_id === suppId) {
        tx.push({
          date: bill.date,
          type: 'Purchase Bill',
          ref: bill.bill_number || 'BILL',
          debit: 0,
          credit: parseFloat(bill.grand_total || 0),
          note: bill.items?.map(it => `${it.product_name} (x${it.qty})`).join(', ') || 'Products inventory stock purchase',
          created_at: bill.created_at
        });

        // Split payments paid in Purchase act as debit/payment records
        const paid = parseFloat(bill.cash_paid || 0) + parseFloat(bill.upi_paid || 0) + parseFloat(bill.bank_paid || 0);
        if(paid > 0) {
          tx.push({
            date: bill.date,
            type: 'Payment (Outflow)',
            ref: `BILL-PAY-${bill.bill_number}`,
            debit: paid,
            credit: 0,
            note: `Payment split paid in Bill #${bill.bill_number}`,
            created_at: bill.created_at
          });
        }
      }
    });

    // 3. Standalone Payments Out
    db.get('payment_outs').forEach(pay => {
      if (pay.supplier_id === suppId) {
        tx.push({
          date: pay.date,
          type: 'Payment (Outflow)',
          ref: pay.method || 'Cash',
          debit: parseFloat(pay.amount || 0),
          credit: 0,
          note: pay.note || `Paid via ${pay.method}`,
          created_at: pay.created_at
        });
      }
    });

    // 4. Purchase Returns
    db.get('purchase_returns').forEach(ret => {
      if(ret.supplier_id === suppId) {
        tx.push({
          date: ret.date,
          type: 'Purchase Return',
          ref: ret.return_number || 'DN',
          debit: parseFloat(ret.grand_total || 0),
          credit: 0,
          note: ret.note || 'Products inventory returned to supplier',
          created_at: ret.created_at
        });
      }
    });

    // Sort chronological by timestamp and date
    tx.sort((a,b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
      const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

    // Compiling running balances
    let runBal = 0;
    tableBody.innerHTML = '';

    tx.forEach(t => {
      runBal += (t.credit - t.debit); // Credit additions, debit subtractions for supplier dues

      tableBody.innerHTML += `
        <tr>
          <td style="white-space: nowrap;">
            <div>${formatDateToDDMMYY(t.date)}</div>
            ${t.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(t.created_at)}</div>` : ''}
          </td>
          <td>
            <span class="badge ${t.type === 'Purchase Bill' ? 'color-info' : (t.type === 'Purchase Return' ? 'color-danger' : 'color-success')}" style="padding: 3px 8px;">
              ${t.type}
            </span>
          </td>
          <td style="font-weight: 600;">${t.ref}</td>
          <td class="text-right text-success">${t.debit > 0 ? formatINR(t.debit) : '—'}</td>
          <td class="text-right text-danger">${t.credit > 0 ? formatINR(t.credit) : '—'}</td>
          <td class="text-right" style="font-weight: 700; color: ${runBal < 0 ? 'hsl(var(--success))' : 'inherit'}">${formatINR(runBal)}</td>
          <td style="font-size: 0.85rem; color: hsl(var(--text-secondary)); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.note}">${t.note}</td>
        </tr>
      `;
    });

    balTotal.textContent = formatINR(calc.getSupplierBalance(suppId));
  });

  document.getElementById('btn-suppledger-print').addEventListener('click', () => {
    window.print();
  });
}

/* ==========================================================================
   8. MONEY ACCOUNT REGISTERS LEDGER
   ========================================================================== */
export async function MoneyLedgerView(container) {
  const settings = db.get('business_settings');
  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="banknote" style="color: hsl(var(--success));"></i>
          Money Accounts Transaction Register
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-money-print" class="btn btn-secondary" disabled><i data-lucide="printer"></i> Print Register</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Account Selector dropdown -->
      <div class="no-print" style="margin-bottom: 24px; padding: 14px; background: hsl(var(--bg-primary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); max-width: 450px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Select Account Book</label>
          <select id="money-select" class="form-control">
            <option value="">-- Choose Account --</option>
            <option value="Cash">${settings.account_cash_label || 'Cash'} Drawer Account</option>
            <option value="UPI">${settings.account_upi_label || 'UPI'} Digital Wallet</option>
            <option value="Bank">${settings.account_bank_label || 'Bank'} Account Ledger</option>
          </select>
        </div>
      </div>

      <div id="money-content" style="display: none;">
        
        <!-- Print Header -->
        <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
          <h2 style="margin: 0; font-family: var(--font-brand);">${db.get('business_settings').company_name}</h2>
          <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
            Account Transaction Register | Account: <span id="print-money-acc" style="font-weight: 700;"></span>
          </p>
          <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
        </div>

        <!-- Ledger balance indicator -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: hsl(var(--bg-primary)); padding: 12px 20px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color)); margin-bottom: 16px;">
          <span id="money-balance-title" style="font-weight: 600; color: hsl(var(--text-secondary));">Account Reconciled Balance</span>
          <span id="money-balance-total" style="font-size: 1.35rem; font-weight: 700; font-family: var(--font-brand);">₹0.00</span>
        </div>

        <div class="table-responsive">
          <table class="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction Type</th>
                <th>Reference Reference</th>
                <th class="text-right">Inflow (Receipts +)</th>
                <th class="text-right">Outflow (Payments -)</th>
                <th class="text-right" style="font-weight: 700;">Running Reconciled Balance</th>
                <th>Description Note</th>
              </tr>
            </thead>
            <tbody id="money-table-body">
              <!-- Populated dynamically -->
            </tbody>
          </table>
        </div>

      </div>

      <div id="money-empty-placeholder" style="padding: 50px 20px; text-align: center; color: hsl(var(--text-secondary));">
        <i data-lucide="banknote" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
        <p>Please select a financial account drawer to review transaction inflow and outflow logs.</p>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const select = document.getElementById('money-select');
  const printBtn = document.getElementById('btn-money-print');
  const content = document.getElementById('money-content');
  const placeholder = document.getElementById('money-empty-placeholder');
  const tableBody = document.getElementById('money-table-body');
  const balTotal = document.getElementById('money-balance-total');
  const printMoneyAcc = document.getElementById('print-money-acc');

  select.addEventListener('change', () => {
    const acc = select.value;
    if(!acc) {
      printBtn.disabled = true;
      content.style.display = 'none';
      placeholder.style.display = 'block';
      return;
    }

    printBtn.disabled = false;
    content.style.display = 'block';
    placeholder.style.display = 'none';
    const customAccLabel = acc === 'Cash' ? (settings.account_cash_label || 'Cash') : (acc === 'UPI' ? (settings.account_upi_label || 'UPI') : (settings.account_bank_label || 'Bank'));
    printMoneyAcc.textContent = customAccLabel + " Register";

    // Gather money movements
    const tx = [];

    // 1. Payments-In (handles both standalone and invoice-linked receipts)
    db.get('payment_ins').forEach(pay => {
      if(pay.method === acc) {
        const isInvoicePay = !!pay.invoice_id;
        tx.push({
          date: pay.date,
          type: isInvoicePay ? 'Sales Sale Receipt' : 'Payment-In Deposit',
          ref: isInvoicePay ? (pay.invoice_number || 'INV') : pay.id.substring(0,8).toUpperCase(),
          in: parseFloat(pay.amount || 0),
          out: 0,
          note: pay.note || (isInvoicePay ? `Invoice payment` : `Customer standalone credit deposit`),
          created_at: pay.created_at
        });
      }
    });

    // 2. Expenses
    db.get('expenses').forEach(exp => {
      if(exp.method === acc) {
        tx.push({
          date: exp.date,
          type: 'Operating Expense',
          ref: exp.category || 'Expense',
          in: 0,
          out: parseFloat(exp.amount || 0),
          note: exp.note || `Category: ${exp.category}`,
          created_at: exp.created_at
        });
      }
    });

    // 3. Purchases stock bills
    db.get('purchases').forEach(bill => {
      let paid = 0;
      if (acc === 'Cash') paid = parseFloat(bill.cash_paid || 0);
      else if (acc === 'UPI') paid = parseFloat(bill.upi_paid || 0);
      else if (acc === 'Bank') paid = parseFloat(bill.bank_paid || 0);

      if (paid > 0) {
        tx.push({
          date: bill.date,
          type: 'Stock Purchase Bill',
          ref: bill.bill_number || 'BILL',
          in: 0,
          out: paid,
          note: `Paid to supplier: ${bill.supplier_name || 'Dealer'}`,
          created_at: bill.created_at
        });
      }
    });

    // 4. Standalone Payments-Out
    db.get('payment_outs').forEach(pay => {
      if (pay.method === acc) {
        tx.push({
          date: pay.date,
          type: 'Payment-Out Settled',
          ref: pay.id.substring(0,8).toUpperCase(),
          in: 0,
          out: parseFloat(pay.amount || 0),
          note: pay.note || `Settled supplier outstanding credit`,
          created_at: pay.created_at
        });
      }
    });

    // 5. Fund Transfers
    db.get('fund_transfers').forEach(tf => {
      const amt = parseFloat(tf.amount || 0);
      
      // If Cash/UPI transferred out to Bank
      if (tf.from_account === acc) {
        tx.push({
          date: tf.date,
          type: 'Fund Transfer Out',
          ref: 'DEPOSIT-BANK',
          in: 0,
          out: amt,
          note: tf.note || `Deposited into Bank Account`,
          created_at: tf.created_at
        });
      }

      // If Bank receiving from Cash/UPI
      if (acc === 'Bank') {
        tx.push({
          date: tf.date,
          type: 'Fund Deposit In',
          ref: `TRANS-FROM-${tf.from_account.toUpperCase()}`,
          in: amt,
          out: 0,
          note: tf.note || `Deposited from local ${tf.from_account} balance`,
          created_at: tf.created_at
        });
      }
    });

    // Sort Chronologically by timestamp and date
    tx.sort((a,b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
      const timeB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

    // Compiling running ledger
    let runBal = 0;
    tableBody.innerHTML = '';

    tx.forEach(t => {
      runBal += (t.in - t.out);

      tableBody.innerHTML += `
        <tr>
          <td style="white-space: nowrap;">
            <div>${formatDateToDDMMYY(t.date)}</div>
            ${t.created_at ? `<div style="font-size: 0.72rem; color: hsl(var(--text-secondary)); margin-top: 2px;">${formatTimeFromTimestamp(t.created_at)}</div>` : ''}
          </td>
          <td>
            <span class="badge ${t.in > 0 ? 'color-success' : 'color-danger'}" style="padding: 3px 8px;">
              ${t.type}
            </span>
          </td>
          <td style="font-weight: 600;">${t.ref}</td>
          <td class="text-right text-success">${t.in > 0 ? formatINR(t.in) : '—'}</td>
          <td class="text-right text-danger">${t.out > 0 ? formatINR(t.out) : '—'}</td>
          <td class="text-right" style="font-weight: 700; color: ${runBal < 0 ? 'hsl(var(--danger))' : 'inherit'}">${formatINR(runBal)}</td>
          <td style="font-size: 0.85rem; color: hsl(var(--text-secondary)); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.note}">${t.note}</td>
        </tr>
      `;
    });

    const finalBalances = calc.getAccountBalances();
    const finalVal = acc === 'Cash' ? finalBalances.cash : (acc === 'UPI' ? finalBalances.upi : finalBalances.bank);
    
    document.getElementById('money-balance-title').textContent = `${customAccLabel} Reconciled Balance`;
    balTotal.textContent = formatINR(finalVal);
    if(finalVal >= 0) {
      balTotal.className = 'text-success';
    } else {
      balTotal.className = 'text-danger';
    }
  });

  document.getElementById('btn-money-print').addEventListener('click', () => {
    window.print();
  });

  // Extract account parameter if present in hash to auto-preselect the book
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const query = hash.split('?')[1];
    const params = new URLSearchParams(query);
    const preselectedAccount = params.get('account');
    if (preselectedAccount && (preselectedAccount === 'Cash' || preselectedAccount === 'UPI' || preselectedAccount === 'Bank')) {
      select.value = preselectedAccount;
      select.dispatchEvent(new Event('change'));
    }
  }
}

/* ==========================================================================
   9. AUDIT LOG JOURNAL VIEW
   ========================================================================== */
export async function AuditLogView(container) {
  const logs = db.getAllRaw('audit_logs');
  
  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="history" style="color: hsl(var(--primary));"></i>
          System Operations Audit Log
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-audit-clear" class="btn btn-danger"><i data-lucide="trash-2"></i> Clear Logs</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; max-height: 550px; overflow-y: auto; padding-right: 8px; border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-sm); padding: 14px; background: hsl(var(--bg-primary));" id="audit-log-scroller">
        ${logs.length === 0 ? `
          <div style="padding: 40px; text-align: center; color: hsl(var(--text-secondary));">
            <i data-lucide="history" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 8px; opacity: 0.5;"></i>
            <p>No system operation audits compiled yet.</p>
          </div>
        ` : logs.map(l => `
          <div style="padding: 10px 14px; background: hsl(var(--bg-secondary)); border: 1px solid hsl(var(--border-color)); border-radius: var(--radius-xs); display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="badge ${l.action.includes('Delete') || l.action.includes('Fail') ? 'color-danger' : (l.action.includes('Add') || l.action.includes('Success') ? 'color-success' : 'color-primary')}" style="padding: 3px 8px; font-size: 0.75rem;">
                  ${l.action}
                </span>
                <span style="font-size: 0.85rem; font-weight: 500; color: hsl(var(--text-primary));">${l.details}</span>
              </div>
            </div>
            <span style="font-size: 0.75rem; color: hsl(var(--text-muted)); font-family: monospace;">
              ${new Date(l.timestamp).toLocaleString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-audit-clear').addEventListener('click', () => {
    if (confirm("Are you sure you want to permanently clear the system audit log history? This action cannot be undone.")) {
      localStorage.setItem('gb_audit_logs', '[]');
      db.logAudit("Audit Log Cleared", "User cleared the internal system operation journal registry.");
      
      // Reload active view
      AuditLogView(container);
    }
  });
}

/* ==========================================================================
   10. PRODUCT PROFIT MARGINS REPORT
   ========================================================================== */
export async function ProductMarginsView(container) {
  const products = db.get('products');
  const invoices = db.get('invoices');
  const returns = db.get('sales_returns');
  const settings = db.get('business_settings');

  // Compile stats for each product
  const data = products.map(p => {
    const costPrice = parseFloat(p.purchase_price || 0);
    const salePrice = parseFloat(p.sale_price || 0);
    const profitPerUnit = salePrice - costPrice;
    const baseMarginPercent = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0;

    // Calculate actual sales quantity and revenue
    let qtySold = 0;
    let actualRevenue = 0;

    // Add invoices
    invoices.forEach(inv => {
      inv.items.forEach(it => {
        if (it.product_id === p.id) {
          qtySold += parseInt(it.qty || 0);
          const gross = it.qty * it.rate;
          const disc = gross * ((it.discount_rate || 0) / 100);
          actualRevenue += (gross - disc);
        }
      });
    });

    // Subtract returns
    returns.forEach(ret => {
      ret.items.forEach(it => {
        if (it.product_id === p.id) {
          qtySold -= parseInt(it.qty || 0);
          const gross = it.qty * it.rate;
          const disc = gross * ((it.discount_rate || 0) / 100);
          actualRevenue -= (gross - disc);
        }
      });
    });

    if (qtySold < 0) qtySold = 0;
    if (actualRevenue < 0) actualRevenue = 0;

    const actualCost = qtySold * costPrice;
    const actualProfit = actualRevenue - actualCost;
    const actualMarginPercent = actualRevenue > 0 ? (actualProfit / actualRevenue) * 100 : 0;
    const liveStock = calc.getCurrentStock(p.id);

    return {
      id: p.id,
      name: p.name,
      qr: p.qr || '—',
      category: p.category || 'General',
      purchase_price: costPrice,
      sale_price: salePrice,
      base_margin: profitPerUnit,
      base_margin_pct: baseMarginPercent,
      qty_sold: qtySold,
      revenue: actualRevenue,
      actual_cost: actualCost,
      actual_profit: actualProfit,
      actual_margin_pct: actualMarginPercent,
      stock: liveStock
    };
  });

  // Calculate Aggregates for header cards
  const totalProducts = data.length;
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalProfit = data.reduce((sum, item) => sum + item.actual_profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Best Selling Item
  let bestSelling = { name: '—', qty: 0 };
  data.forEach(item => {
    if (item.qty_sold > bestSelling.qty) {
      bestSelling = { name: item.name, qty: item.qty_sold };
    }
  });

  container.innerHTML = `
    <div class="view-card animate-fade-in print-area-container">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid hsl(var(--border-color)); padding-bottom: 16px;">
        <h2 class="card-title" style="margin-bottom: 0;">
          <i data-lucide="percent" style="color: hsl(var(--warning));"></i>
          Product Profit Margin Analysis
        </h2>
        <div style="display: flex; gap: 8px;" class="no-print">
          <button id="btn-csv-export-margins" class="btn btn-secondary"><i data-lucide="download"></i> Export CSV</button>
          <button id="btn-print-margins" class="btn btn-secondary"><i data-lucide="printer"></i> Print Report</button>
          <a href="#reports" class="btn btn-secondary"><i data-lucide="arrow-left"></i> Back to Hub</a>
        </div>
      </div>

      <!-- Overview Stats Grid -->
      <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Products Analyzed</span>
            <span class="stat-value">${totalProducts} Items</span>
          </div>
          <div class="stat-icon color-primary">
            <i data-lucide="box"></i>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Generated Revenue</span>
            <span class="stat-value text-success privacy-value">${formatINR(totalRevenue)}</span>
          </div>
          <div class="stat-icon color-success">
            <i data-lucide="trending-up"></i>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Actual Gross Profit</span>
            <span class="stat-value text-success privacy-value" style="color: hsl(var(--success));">${formatINR(totalProfit)}</span>
          </div>
          <div class="stat-icon color-success">
            <i data-lucide="banknote"></i>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Average Margin %</span>
            <span class="stat-value text-info privacy-value" style="color: #6366f1;">${avgMargin.toFixed(2)}%</span>
          </div>
          <div class="stat-icon color-info">
            <i data-lucide="percent"></i>
          </div>
        </div>
      </div>

      <!-- Print Title Header -->
      <div class="print-header" style="display: none; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-family: var(--font-brand);">${settings.company_name}</h2>
        <p style="margin: 4px 0 12px 0; color: hsl(var(--text-secondary)); font-size: 0.9rem;">
          Product Profit Margin Analysis Report
        </p>
        <hr style="border: none; border-top: 2px solid #000; margin-bottom: 20px;">
      </div>

      <!-- Filters Row -->
      <div class="form-grid no-print" style="grid-template-columns: 2fr 1fr; margin-bottom: 24px; padding: 14px; background: hsl(var(--bg-primary)); border-radius: var(--radius-sm); border: 1px solid hsl(var(--border-color));">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Search Product</label>
          <input type="text" id="margin-search" class="form-control" placeholder="Search by name, category, barcode...">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Sort By</label>
          <select id="margin-sort" class="form-control">
            <option value="name_asc">Alphabetical (A - Z)</option>
            <option value="name_desc">Alphabetical (Z - A)</option>
            <option value="margin_desc">Base Margin % (Highest)</option>
            <option value="margin_asc">Base Margin % (Lowest)</option>
            <option value="profit_desc">Actual Profit (Highest)</option>
            <option value="revenue_desc">Actual Revenue (Highest)</option>
            <option value="sold_desc">Quantity Sold (Highest)</option>
          </select>
        </div>
      </div>

      <div class="table-responsive">
        <table class="app-table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Product Name</th>
              <th>Category</th>
              <th class="text-right">Stock</th>
              <th class="text-right">Cost Price</th>
              <th class="text-right">Sale Price</th>
              <th class="text-right">Base Margin</th>
              <th class="text-right">Qty Sold</th>
              <th class="text-right">Actual Revenue</th>
              <th class="text-right" style="font-weight: 700;">Actual Profit</th>
              <th class="text-center">Margin Health</th>
            </tr>
          </thead>
          <tbody id="margin-table-body">
            <!-- Populated dynamically -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const searchInput = document.getElementById('margin-search');
  const sortSelect = document.getElementById('margin-sort');
  const tbody = document.getElementById('margin-table-body');

  function renderTable() {
    const query = searchInput.value.toLowerCase();
    const sortBy = sortSelect.value;

    // Filter
    let filtered = data.filter(item => {
      return item.name.toLowerCase().includes(query) ||
             item.qr.toLowerCase().includes(query) ||
             item.category.toLowerCase().includes(query);
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'margin_desc') return b.base_margin_pct - a.base_margin_pct;
      if (sortBy === 'margin_asc') return a.base_margin_pct - b.base_margin_pct;
      if (sortBy === 'profit_desc') return b.actual_profit - a.actual_profit;
      if (sortBy === 'revenue_desc') return b.revenue - a.revenue;
      if (sortBy === 'sold_desc') return b.qty_sold - a.qty_sold;
      return 0;
    });

    // Draw
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center text-muted" style="padding: 40px 20px;">
            No products found matching filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      // Margin Health Badge
      let badgeClass = 'color-danger';
      let healthText = 'Negative';
      if (item.base_margin_pct > 30) {
        badgeClass = 'color-success';
        healthText = 'High Margin (>30%)';
      } else if (item.base_margin_pct >= 15) {
        badgeClass = 'color-primary';
        healthText = 'Healthy (15-30%)';
      } else if (item.base_margin_pct > 0) {
        badgeClass = 'color-warning';
        healthText = 'Low Margin (0-15%)';
      } else if (item.base_margin_pct === 0) {
        badgeClass = 'color-secondary';
        healthText = 'Zero Margin';
      }

      return `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 0.8rem;">${item.qr}</td>
          <td style="font-weight: 600;">${item.name}</td>
          <td><span style="font-size: 0.8rem; opacity: 0.75;">${item.category}</span></td>
          <td class="text-right" style="font-weight: 500; color: ${item.stock <= 0 ? 'hsl(var(--danger))' : 'inherit'}">${item.stock}</td>
          <td class="text-right privacy-value">${formatINR(item.purchase_price)}</td>
          <td class="text-right">${formatINR(item.sale_price)}</td>
          <td class="text-right text-success" style="font-size: 0.85rem;">
            ${formatINR(item.base_margin)}<br>
            <span style="font-size: 0.7rem; color: hsl(var(--text-secondary));">${item.base_margin_pct.toFixed(1)}%</span>
          </td>
          <td class="text-right" style="font-weight: 500;">${item.qty_sold}</td>
          <td class="text-right text-success privacy-value">${formatINR(item.revenue)}</td>
          <td class="text-right privacy-value" style="font-weight: 700; color: ${item.actual_profit < 0 ? 'hsl(var(--danger))' : (item.actual_profit > 0 ? 'hsl(var(--success))' : 'inherit')}">
            ${item.actual_profit < 0 ? '-' : ''}${formatINR(Math.abs(item.actual_profit))}<br>
            <span style="font-size: 0.7rem; color: hsl(var(--text-secondary)); font-weight: 400;">${item.actual_margin_pct.toFixed(1)}% act</span>
          </td>
          <td class="text-center">
            <span class="badge ${badgeClass}" style="padding: 3px 8px; font-size: 0.7rem;">
              ${healthText}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Bind Listeners
  searchInput.addEventListener('input', renderTable);
  sortSelect.addEventListener('change', renderTable);

  renderTable();

  // Print button
  document.getElementById('btn-print-margins').addEventListener('click', () => {
    window.print();
  });

  // CSV Export button
  document.getElementById('btn-csv-export-margins').addEventListener('click', () => {
    const csvRows = [];
    // Header Row
    csvRows.push(['Barcode', 'Product Name', 'Category', 'Stock', 'Cost Price (INR)', 'Sale Price (INR)', 'Base Margin (INR)', 'Base Margin (%)', 'Qty Sold', 'Actual Revenue (INR)', 'Actual Profit (INR)', 'Actual Margin (%)']);

    data.forEach(item => {
      csvRows.push([
        `"${item.qr}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.stock,
        item.purchase_price,
        item.sale_price,
        item.base_margin,
        item.base_margin_pct.toFixed(2),
        item.qty_sold,
        item.revenue,
        item.actual_profit,
        item.actual_margin_pct.toFixed(2)
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `product_profit_margins_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

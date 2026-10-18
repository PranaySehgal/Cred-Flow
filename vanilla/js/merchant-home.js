import { getMerchantInfo } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { formatMoney } from './format.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('merchant', '../login.html');
const container = document.getElementById('merchant-home-content');

if (session) {
  setupNav('merchant', 'home');
  loadHome();
}

async function loadHome() {
  try {
    const result = await getMerchantInfo(session.userId);
    const loans = Array.isArray(result.loans) ? result.loans : [];
    const transactions = Array.isArray(result.transactions) ? result.transactions : [];
    const principal = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
    const outstanding = loans.reduce(
      (sum, loan) => sum + Math.max(Number(loan.amount || 0) - Number(loan.paid_amount || 0), 0),
      0
    );

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title text-xl">Merchant account</h1>
          <p class="page-subtitle">${escapeHtml(session.username)}</p>
        </div>
        <button id="btn-refresh" class="btn btn-outline btn-sm">Refresh</button>
      </div>
      <div class="grid-2" style="margin-bottom:1.25rem;">
        <div class="stat-card">
          <p class="stat-label">Total contracted</p>
          <p class="stat-value tabular">${formatMoney(principal)}</p>
          <p class="stat-sub">${loans.length} contract${loans.length === 1 ? '' : 's'}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Outstanding balance</p>
          <p class="stat-value tabular">${formatMoney(outstanding)}</p>
          <p class="stat-sub">Contracted amount less payments recorded</p>
        </div>
      </div>
      <div class="flex gap-2" style="margin-bottom:1.25rem;flex-wrap:wrap;">
        <a href="log-cash-sale.html" class="btn btn-primary">Record a transaction</a>
        <a href="inventory.html" class="btn btn-outline">Manage inventory</a>
        <a href="transactions.html" class="btn btn-outline">View transactions</a>
        <a href="support.html" class="btn btn-outline">Report an issue</a>
      </div>
      <section class="card" style="margin-bottom:1.25rem;">
        <div class="card-header"><h2 class="card-title">Contracts</h2></div>
        <div class="card-content">
          ${loans.length ? loans.map((loan) => `
            <div class="flex justify-between items-center" style="padding:.75rem 0;border-bottom:1px solid var(--color-line);">
              <div><p class="font-semibold">Lender ${escapeHtml(loan.l_id)}</p><p class="text-xs text-muted">Contract ${escapeHtml(loan.id || '—')}</p></div>
              <div style="text-align:right;"><p class="font-semibold">${formatMoney(loan.amount)}</p><p class="text-xs text-muted">Paid ${formatMoney(loan.paid_amount)}</p></div>
            </div>
          `).join('') : '<p class="text-sm text-muted">No contracts were returned by the backend.</p>'}
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h2 class="card-title">Recent transactions</h2></div>
        <div class="card-content">
          ${transactions.length ? transactions.slice(0, 5).map((transaction) => `
            <div class="flex justify-between items-center" style="padding:.65rem 0;border-bottom:1px solid var(--color-line);">
              <div><p class="font-semibold">${escapeHtml(transaction.method || 'Transaction')}</p><p class="text-xs text-muted">${escapeHtml(transaction.date || '')}</p></div>
              <p class="font-semibold tabular">${formatMoney(transaction.amount)}</p>
            </div>
          `).join('') : '<p class="text-sm text-muted">No transactions were returned by the backend.</p>'}
        </div>
      </section>
    `;
    document.getElementById('btn-refresh').addEventListener('click', loadHome);
  } catch (error) {
    showLoadError(container, error);
  }
}

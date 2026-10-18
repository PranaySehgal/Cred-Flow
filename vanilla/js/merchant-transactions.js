import { getMerchantInfo } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { formatDateTime, formatMoney } from './format.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('merchant', '../login.html');
const container = document.getElementById('merchant-txns-content');

if (session) {
  setupNav('merchant', 'transactions');
  loadTransactions();
}

async function loadTransactions() {
  try {
    const result = await getMerchantInfo(session.userId);
    const transactions = Array.isArray(result.transactions) ? result.transactions : [];
    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title text-xl">Transactions</h1><p class="page-subtitle">${transactions.length} records returned by the backend</p></div>
        <a href="log-cash-sale.html" class="btn btn-primary btn-sm">Record transaction</a>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem;">
        ${transactions.length ? transactions.map((transaction) => {
          const date = transaction.date ? formatDateTime(transaction.date) : 'Date unavailable';
          return `
            <article class="card card-content flex justify-between items-center" style="padding:1rem;">
              <div><span class="badge badge-teal">${escapeHtml(transaction.method || 'transaction')}</span><p class="text-xs text-muted" style="margin-top:.4rem;">${escapeHtml(date)}</p></div>
              <p class="font-bold text-navy tabular">${formatMoney(transaction.amount)}</p>
            </article>`;
        }).join('') : '<div class="card card-content text-center text-muted">No transactions have been recorded for this account.</div>'}
      </div>
    `;
  } catch (error) {
    showLoadError(container, error);
  }
}

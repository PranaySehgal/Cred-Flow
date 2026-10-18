import { getLenderInfo } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { formatMoney } from './format.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('lender', '../login.html');
const container = document.getElementById('lender-portfolio-content');

if (session) {
  setupNav('lender', 'portfolio');
  loadPortfolio();
}

async function loadPortfolio() {
  try {
    const result = await getLenderInfo(session.userId);
    const loans = Array.isArray(result.lends) ? result.lends : [];
    const totalExtended = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
    const totalCollected = loans.reduce((sum, loan) => sum + Number(loan.paid_amount || 0), 0);
    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title text-2xl">Lender portfolio</h1><p class="page-subtitle">${escapeHtml(session.username)}</p></div>
        <button id="refresh-portfolio" class="btn btn-outline btn-sm">Refresh</button>
      </div>
      <div class="grid-2" style="margin-bottom:1.25rem;">
        <div class="stat-card"><p class="stat-label">Total contracted</p><p class="stat-value tabular">${formatMoney(totalExtended)}</p><p class="stat-sub">${loans.length} contract${loans.length === 1 ? '' : 's'}</p></div>
        <div class="stat-card"><p class="stat-label">Payments recorded</p><p class="stat-value tabular text-teal">${formatMoney(totalCollected)}</p><p class="stat-sub">Sum of backend contract paid amounts</p></div>
      </div>
      <div class="flex gap-2" style="margin-bottom:1.25rem;">
        <a href="merchants.html" class="btn btn-outline">View merchants & repayments</a>
        <a href="../admin/agreement-new.html" class="btn btn-primary">Create a contract</a>
      </div>
      <div class="card">
        <div class="card-header"><h2 class="card-title">Contracts</h2></div>
        <div class="card-content">
          ${loans.length ? loans.map((loan) => {
            const amount = Number(loan.amount || 0);
            const paid = Number(loan.paid_amount || 0);
            const outstanding = Math.max(amount - paid, 0);
            return `
              <div class="flex justify-between items-center" style="padding:.75rem 0;border-bottom:1px solid var(--color-line);">
                <div><p class="font-semibold">Merchant ${escapeHtml(loan.m_id)}</p><p class="text-xs text-muted">Outstanding ${formatMoney(outstanding)}</p></div>
                <div style="text-align:right;"><p class="font-semibold">${formatMoney(amount)}</p><p class="text-xs text-muted">Paid ${formatMoney(paid)}</p></div>
              </div>`;
          }).join('') : '<p class="text-sm text-muted">No contracts were returned by the backend.</p>'}
        </div>
      </div>
    `;
    document.getElementById('refresh-portfolio').addEventListener('click', loadPortfolio);
  } catch (error) {
    showLoadError(container, error);
  }
}

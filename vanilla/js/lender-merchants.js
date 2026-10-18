import { getLenderInfo, updateContract } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { formatMoney, istDateKey } from './format.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('lender', '../login.html');
const container = document.getElementById('lender-merchants-content');
let loans = [];

if (session) {
  setupNav('lender', 'merchants');
  loadLoans();
}

async function loadLoans() {
  try {
    const result = await getLenderInfo(session.userId);
    loans = Array.isArray(result.lends) ? result.lends : [];
    renderLoans();
  } catch (error) {
    showLoadError(container, error);
  }
}

function renderLoans(search = '') {
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title text-2xl">Merchants & repayments</h1><p class="page-subtitle">Live contracts returned for ${escapeHtml(session.username)}</p></div>
      <a href="../admin/agreement-new.html" class="btn btn-primary btn-sm">Create contract</a>
    </div>
    <div class="card card-content" style="margin-bottom:1rem;">
      <label for="merchant-search" class="form-label">Filter by merchant account ID</label>
      <input id="merchant-search" class="form-input" type="search" placeholder="Merchant ID">
    </div>
    <div id="merchant-loan-list" style="display:flex;flex-direction:column;gap:.75rem;"></div>
  `;

  const searchInput = document.getElementById('merchant-search');
  searchInput.value = search;
  searchInput.addEventListener('input', () => renderLoanCards(searchInput.value));
  renderLoanCards(search);
}

function renderLoanCards(search) {
  const list = document.getElementById('merchant-loan-list');
  const filtered = loans.filter((loan) =>
    String(loan.m_id ?? '').toLowerCase().includes(search.toLowerCase())
  );
  list.innerHTML = filtered.length ? filtered.map((loan, index) => {
    const amount = Number(loan.amount || 0);
    const paid = Number(loan.paid_amount || 0);
    return `
      <article class="card card-content">
        <div class="flex justify-between items-center">
          <div><h2 class="font-bold text-navy">Merchant ${escapeHtml(loan.m_id)}</h2><p class="text-xs text-muted">Contracted ${formatMoney(amount)} · paid ${formatMoney(paid)}</p></div>
          <p class="font-semibold tabular">${formatMoney(Math.max(amount - paid, 0))} outstanding</p>
        </div>
        <form class="repayment-form" data-index="${index}" style="display:flex;gap:.5rem;align-items:end;margin-top:1rem;flex-wrap:wrap;">
          <div class="form-group" style="margin:0;flex:1;min-width:140px;">
            <label class="form-label" for="payment-${index}">Payment amount (₹)</label>
            <input class="form-input" type="number" id="payment-${index}" name="amountPaid" min="1" max="${Math.max(amount - paid, 0)}" step="1" required>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" for="date-${index}">Payment date</label>
            <input class="form-input" type="date" id="date-${index}" name="dop" value="${istDateKey()}" required>
          </div>
          <button class="btn btn-primary btn-sm" type="submit">Record payment</button>
        </form>
      </article>`;
  }).join('') : '<div class="card card-content text-center text-muted">No merchant contracts match that ID.</div>';

  list.querySelectorAll('.repayment-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const loan = filtered[Number(form.dataset.index)];
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        await updateContract(
          loan.m_id,
          session.userId,
          Number(form.elements.amountPaid.value),
          form.elements.dop.value
        );
        await loadLoans();
      } catch (error) {
        const message = document.createElement('p');
        message.className = 'text-xs text-danger';
        message.textContent = error.message;
        form.append(message);
        submit.disabled = false;
      }
    });
  });
}

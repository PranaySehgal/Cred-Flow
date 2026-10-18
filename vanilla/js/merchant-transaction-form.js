import { addTransaction } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { escapeHtml } from './view.js';

const session = requireRole('merchant', '../login.html');
const container = document.getElementById('cash-sale-container');

if (session) {
  setupNav('merchant', 'transactions');
  renderForm();
}

function renderForm() {
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title text-xl">Record a transaction</h1><p class="page-subtitle">Save a transaction to your backend account.</p></div>
    </div>
    <div id="transaction-error" class="alert-banner danger" style="display:none;" role="alert"></div>
    <div class="card card-content">
      <form id="transaction-form">
        <div class="form-group">
          <label for="amount" class="form-label">Transaction amount (₹) <span class="required">*</span></label>
          <input type="number" id="amount" class="form-input" min="1" step="0.01" required>
        </div>
        <div class="form-group">
          <label for="method" class="form-label">Payment method <span class="required">*</span></label>
          <select id="method" class="form-select" required>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="submit-transaction">Save transaction</button>
      </form>
    </div>
  `;

  document.getElementById('transaction-form').addEventListener('submit', submitTransaction);
}

async function submitTransaction(event) {
  event.preventDefault();
  const button = document.getElementById('submit-transaction');
  const amount = Number(document.getElementById('amount').value);
  const method = document.getElementById('method').value;
  if (!Number.isFinite(amount) || amount <= 0) return;

  button.disabled = true;
  try {
    const transactionId = crypto.randomUUID();
    await addTransaction(session.userId, amount, transactionId, method);
    container.innerHTML = `
      <div class="card card-content">
        <h1 class="text-xl text-navy">Transaction recorded</h1>
        <p class="text-sm text-muted" style="margin-top:.65rem;">The backend accepted transaction ${escapeHtml(transactionId)}.</p>
        <div class="flex gap-2" style="margin-top:1rem;">
          <a href="transactions.html" class="btn btn-primary">View transactions</a>
          <a href="index.html" class="btn btn-outline">Return home</a>
        </div>
      </div>
    `;
  } catch (error) {
    const panel = document.getElementById('transaction-error');
    panel.style.display = 'flex';
    panel.textContent = error.message;
    button.disabled = false;
  }
}

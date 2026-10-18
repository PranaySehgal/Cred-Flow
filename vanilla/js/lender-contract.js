import { createContract } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { escapeHtml } from './view.js';

const session = requireRole('lender', '../login.html');
const container = document.getElementById('lender-contract-content');

if (session) {
  setupNav('lender', 'contract');
  renderForm();
}

function renderForm() {
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title text-2xl">Create a contract</h1><p class="page-subtitle">Contract records are saved to the lender and merchant accounts.</p></div>
    </div>
    <div id="contract-error" class="alert-banner danger" style="display:none;" role="alert"></div>
    <div class="card card-content" style="max-width:640px;">
      <form id="contract-form">
        <div class="form-group">
          <label for="merchant-id" class="form-label">Merchant account ID <span class="required">*</span></label>
          <input id="merchant-id" name="merchantId" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="contract-amount" class="form-label">Contract amount (₹) <span class="required">*</span></label>
          <input id="contract-amount" name="amount" class="form-input" type="number" min="1" step="1" required>
        </div>
        <div class="form-group">
          <label for="contract-tenure" class="form-label">Tenure (days) <span class="required">*</span></label>
          <input id="contract-tenure" name="tenure" class="form-input" type="number" min="1" step="1" required>
        </div>
        <button type="submit" class="btn btn-primary" id="save-contract">Create contract</button>
      </form>
    </div>
  `;
  document.getElementById('contract-form').addEventListener('submit', submitContract);
}

async function submitContract(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = document.getElementById('save-contract');
  submit.disabled = true;
  try {
    const result = await createContract(
      form.elements.merchantId.value.trim(),
      session.userId,
      Number(form.elements.amount.value),
      Number(form.elements.tenure.value)
    );
    container.innerHTML = `
      <div class="card card-content">
        <h1 class="text-xl text-navy">Contract created</h1>
        <p class="text-sm text-muted" style="margin-top:.65rem;">${escapeHtml(result.message || 'The backend accepted the contract.')}</p>
        <a href="../lender/merchants.html" class="btn btn-primary" style="margin-top:1rem;">View contracts</a>
      </div>`;
  } catch (error) {
    const panel = document.getElementById('contract-error');
    panel.style.display = 'flex';
    panel.textContent = error.message;
    submit.disabled = false;
  }
}

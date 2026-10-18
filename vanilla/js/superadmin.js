import {
  createSuperAdminContract,
  getSuperAdminAccountRequests,
  getSuperAdminAccounts,
  getSuperAdminIssues,
  logout,
  resolveSuperAdminIssue,
  reviewSuperAdminAccountRequest,
  updateManagedAccount,
} from './backend.js';
import { requireRole, signOut } from './session.js';
import { setupNav } from './nav.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('superadmin', '../login.html');
const container = document.getElementById('superadmin-content');
const editor = document.getElementById('account-editor');
const editForm = document.getElementById('account-edit-form');
let accounts = [];
let accountRequests = [];

if (session) {
  setupNav('superadmin');
  loadDashboard();
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="sign-out"]');
    if (!button) return;
    button.disabled = true;
    try {
      await logout();
    } catch (error) {
      console.error('Could not revoke the server session during sign-out.', error);
    }
    signOut();
    window.location.href = '../login.html';
  });
}

async function loadDashboard() {
  container.innerHTML = '<p class="text-sm text-muted">Loading accounts and issues…</p>';
  try {
    const [accountResult, requestResult, issueResult] = await Promise.all([
      getSuperAdminAccounts(),
      getSuperAdminAccountRequests(),
      getSuperAdminIssues(),
    ]);
    accounts = accountResult.accounts;
    accountRequests = requestResult.requests;
    renderDashboard(issueResult.issues);
  } catch (error) {
    showLoadError(container, error);
  }
}

function renderDashboard(issues) {
  const merchants = accounts.filter((account) => account.account_types.includes('merchant'));
  const lenders = accounts.filter((account) => account.account_types.includes('lender'));
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title text-2xl">Super-admin operations</h1>
        <p class="page-subtitle">Approve account requests, manage account details, resolve reported issues, and create contracts.</p>
      </div>
      <button id="refresh-superadmin" class="btn btn-outline btn-sm">Refresh</button>
    </div>
    <div class="grid-3" style="margin-bottom:1.25rem;">
      <div class="stat-card"><p class="stat-label">Merchants</p><p class="stat-value">${merchants.length}</p></div>
      <div class="stat-card"><p class="stat-label">Lenders</p><p class="stat-value">${lenders.length}</p></div>
      <div class="stat-card"><p class="stat-label">Agents</p><p class="stat-value">${accounts.filter((account) => account.account_types.includes('agent')).length}</p></div>
    </div>
    <section class="card" style="margin-bottom:1.25rem;">
      <div class="card-header"><h2 class="card-title">Account requests awaiting approval (${accountRequests.length})</h2></div>
      <div class="card-content">
        ${accountRequests.length ? accountRequests.map((request) => `
          <article class="flex justify-between items-center" style="gap:1rem;flex-wrap:wrap;padding:.75rem 0;border-bottom:1px solid var(--color-line);">
            <div>
              <p class="font-semibold">${escapeHtml(request.user_id)}</p>
              <p class="text-sm text-muted">${escapeHtml(request.atype)} access${request.SName ? ` · ${escapeHtml(request.SName)}` : ''}${request.OName ? ` · ${escapeHtml(request.OName)}` : ''}${request.MobileNum ? ` · ${escapeHtml(request.MobileNum)}` : ''}</p>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" data-review-user="${escapeHtml(request.user_id)}" data-review-type="${escapeHtml(request.atype)}" data-review-decision="approved">Approve</button>
              <button class="btn btn-outline btn-sm" data-review-user="${escapeHtml(request.user_id)}" data-review-type="${escapeHtml(request.atype)}" data-review-decision="rejected">Reject</button>
            </div>
          </article>
        `).join('') : '<p class="text-sm text-muted">No account requests are waiting for review.</p>'}
      </div>
    </section>
    <section class="card" style="margin-bottom:1.25rem;">
      <div class="card-header"><h2 class="card-title">Accounts</h2></div>
      <div class="card-content" style="padding:0;">
        <div class="form-group" style="padding:1rem 1rem 0;">
          <label for="account-search" class="form-label">Search accounts</label>
          <input id="account-search" class="form-input" type="search" placeholder="Email or account name">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Account</th><th>Business / contact</th><th>Account types</th><th></th></tr></thead>
            <tbody id="account-rows"></tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="card" style="margin-bottom:1.25rem;">
      <div class="card-header"><h2 class="card-title">Pending issues (${issues.length})</h2></div>
      <div class="card-content">
        ${issues.length ? issues.map((issue) => `
          <article class="card card-content" style="margin-bottom:.75rem;">
            <div class="flex justify-between items-center" style="gap:1rem;flex-wrap:wrap;">
              <div>
                <p class="font-semibold">${escapeHtml(issue.user_id || 'Unknown account')}</p>
                <p class="text-sm" style="margin-top:.35rem;">${escapeHtml(issue.desc || '')}</p>
                <p class="text-xs text-muted" style="margin-top:.35rem;">${escapeHtml(issue.issue_id || '')}</p>
              </div>
              <button class="btn btn-outline btn-sm" data-resolve-issue="${escapeHtml(issue.issue_id)}">Resolve</button>
            </div>
          </article>
        `).join('') : '<p class="text-sm text-muted">No pending issues.</p>'}
      </div>
    </section>
    <section class="card card-content" style="max-width:720px;">
      <h2 class="card-title" style="margin-bottom:1rem;">Create contract</h2>
      <p class="text-xs text-muted" style="margin-bottom:1rem;">Super admins can create contracts but cannot edit or update repayments.</p>
      <div id="contract-error" class="alert-banner danger" role="alert" hidden></div>
      <form id="superadmin-contract-form">
        <div class="form-group">
          <label for="contract-merchant" class="form-label">Merchant <span class="required">*</span></label>
          <select id="contract-merchant" name="merchant_id" class="form-select" required>
            ${accountOptions(merchants, 'Select merchant')}
          </select>
        </div>
        <div class="form-group">
          <label for="contract-lender" class="form-label">Lender <span class="required">*</span></label>
          <select id="contract-lender" name="lender_id" class="form-select" required>
            ${accountOptions(lenders, 'Select lender')}
          </select>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label for="contract-amount" class="form-label">Amount (₹) <span class="required">*</span></label>
            <input id="contract-amount" name="amount" class="form-input" type="number" min="1" step="1" required>
          </div>
          <div class="form-group">
            <label for="contract-tenure" class="form-label">Tenure (days) <span class="required">*</span></label>
            <input id="contract-tenure" name="tenure" class="form-input" type="number" min="1" step="1" required>
          </div>
        </div>
        <button class="btn btn-primary" id="create-superadmin-contract">Create contract</button>
      </form>
    </section>
  `;

  renderAccounts(accounts);
  document.getElementById('refresh-superadmin').addEventListener('click', loadDashboard);
  document.getElementById('account-search').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    renderAccounts(accounts.filter((account) =>
      [account.user_id, account.OName, account.SName, ...account.account_types]
        .some((value) => String(value || '').toLowerCase().includes(query))
    ));
  });
  container.querySelectorAll('[data-resolve-issue]').forEach((button) => {
    button.addEventListener('click', () => resolveIssue(button));
  });
  container.querySelectorAll('[data-review-user]').forEach((button) => {
    button.addEventListener('click', () => reviewAccountRequest(button));
  });
  document.getElementById('superadmin-contract-form').addEventListener('submit', submitContract);
}

function accountOptions(list, placeholder) {
  return `<option value="">${placeholder}</option>${list.map((account) =>
    `<option value="${escapeHtml(account.user_id)}">${escapeHtml(account.SName || account.OName || account.user_id)} — ${escapeHtml(account.user_id)}</option>`
  ).join('')}`;
}

function renderAccounts(list) {
  const rows = document.getElementById('account-rows');
  if (!rows) return;
  rows.innerHTML = list.length ? list.map((account) => `
    <tr>
      <td>${escapeHtml(account.user_id)}</td>
      <td>${escapeHtml(account.SName || account.OName || '—')}</td>
      <td>${account.account_types.map((type) => `<span class="badge badge-navy">${escapeHtml(type)}</span>`).join(' ')}</td>
      <td><button class="btn btn-outline btn-sm" data-edit-account="${escapeHtml(account.user_id)}">Edit</button></td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="text-center text-muted">No matching accounts.</td></tr>';
  rows.querySelectorAll('[data-edit-account]').forEach((button) => {
    button.addEventListener('click', () => openAccountEditor(button.dataset.editAccount));
  });
}

function openAccountEditor(userId) {
  const account = accounts.find((item) => item.user_id === userId);
  if (!account) return;
  editForm.elements.user_id.value = account.user_id;
  editForm.elements.owner_name.value = account.OName || '';
  editForm.elements.shop_name.value = account.SName || '';
  editForm.elements.mobile_number.value = account.MobileNum || '';
  editForm.elements.latitude.value = account.lat ?? '';
  editForm.elements.longitude.value = account.long ?? '';
  document.getElementById('account-edit-error').hidden = true;
  editor.showModal();
}

async function reviewAccountRequest(button) {
  const { reviewUser: userId, reviewType: accountType, reviewDecision: decision } = button.dataset;
  const requestButtons = [...container.querySelectorAll('[data-review-user]')].filter(
    (item) => item.dataset.reviewUser === userId && item.dataset.reviewType === accountType
  );
  requestButtons.forEach((item) => { item.disabled = true; });
  try {
    await reviewSuperAdminAccountRequest(userId, accountType, decision);
    await loadDashboard();
  } catch (error) {
    requestButtons.forEach((item) => { item.disabled = false; });
    showDashboardError(error);
  }
}

document.getElementById('close-account-editor').addEventListener('click', () => editor.close());
editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.getElementById('save-account-details');
  const error = document.getElementById('account-edit-error');
  submit.disabled = true;
  error.hidden = true;
  try {
    const latitude = editForm.elements.latitude.value.trim();
    const longitude = editForm.elements.longitude.value.trim();
    await updateManagedAccount({
      user_id: editForm.elements.user_id.value,
      owner_name: editForm.elements.owner_name.value.trim() || null,
      shop_name: editForm.elements.shop_name.value.trim() || null,
      mobile_number: editForm.elements.mobile_number.value.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
    });
    editor.close();
    await loadDashboard();
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

async function resolveIssue(button) {
  button.disabled = true;
  try {
    await resolveSuperAdminIssue(button.dataset.resolveIssue);
    await loadDashboard();
  } catch (error) {
    button.disabled = false;
    showDashboardError(error);
  }
}

async function submitContract(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById('create-superadmin-contract');
  const error = document.getElementById('contract-error');
  button.disabled = true;
  error.hidden = true;
  try {
    await createSuperAdminContract({
      merchant_id: form.elements.merchant_id.value,
      lender_id: form.elements.lender_id.value,
      amount: Number(form.elements.amount.value),
      tenure: Number(form.elements.tenure.value),
    });
    form.reset();
    error.className = 'alert-banner success';
    error.textContent = 'Contract created.';
    error.hidden = false;
  } catch (requestError) {
    error.className = 'alert-banner danger';
    error.textContent = requestError.message;
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

function showDashboardError(error) {
  const message = document.createElement('div');
  message.className = 'alert-banner danger';
  message.setAttribute('role', 'alert');
  message.textContent = error.message;
  container.prepend(message);
}

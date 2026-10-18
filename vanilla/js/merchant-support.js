import { createIssue, getIssues, resolveIssue } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { escapeHtml } from './view.js';

const session = requireRole('merchant', '../login.html');
const container = document.getElementById('merchant-support-content');

if (session) {
  setupNav('merchant', 'support');
  renderSupport();
}

async function renderSupport() {
  container.innerHTML = '<p class="text-sm text-muted">Loading issues…</p>';
  try {
    const result = await getIssues(session.userId);
    const issues = Array.isArray(result.issues) ? result.issues : [];
    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title text-xl">Issues & support</h1><p class="page-subtitle">Report a problem to the operations team</p></div>
      </div>
      <div id="issue-error" class="alert-banner danger" style="display:none;" role="alert"></div>
      <div class="card card-content" style="margin-bottom:1.25rem;">
        <form id="issue-form">
          <div class="form-group">
            <label for="issue-description" class="form-label">Describe the issue <span class="required">*</span></label>
            <textarea id="issue-description" class="form-textarea" required maxlength="2000"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Submit issue</button>
        </form>
      </div>
      <section class="card">
        <div class="card-header"><h2 class="card-title">Issues (${issues.length})</h2></div>
        <div class="card-content" style="display:flex;flex-direction:column;gap:.75rem;">
          ${issues.length ? issues.map((issue) => `
            <article class="card card-content" style="background:var(--color-canvas);">
              <div class="flex justify-between items-center">
                <span class="badge badge-amber">${escapeHtml(issue.status || 'pending')}</span>
                <button class="btn btn-outline btn-sm resolve-issue" data-id="${escapeHtml(issue.issue_id)}">Resolve</button>
              </div>
              <p class="text-sm" style="margin-top:.65rem;">${escapeHtml(issue.desc || '')}</p>
              <p class="text-xs text-muted" style="margin-top:.35rem;">${escapeHtml(issue.issue_id || '')}</p>
            </article>
          `).join('') : '<p class="text-sm text-muted">No issues have been reported for this account.</p>'}
        </div>
      </section>
    `;

    document.getElementById('issue-form').addEventListener('submit', submitIssue);
    document.querySelectorAll('.resolve-issue').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await resolveIssue(button.dataset.id);
          await renderSupport();
        } catch (error) {
          showError(error);
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    showError(error);
  }
}

async function submitIssue(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await createIssue(session.userId, document.getElementById('issue-description').value.trim());
    await renderSupport();
  } catch (error) {
    showError(error);
    button.disabled = false;
  }
}

function showError(error) {
  const panel = document.getElementById('issue-error');
  if (!panel) {
    container.innerHTML = `
      <div class="alert-banner danger" role="alert">
        <div class="alert-banner-body"><p class="alert-banner-title">Could not load issues</p><p class="alert-banner-text">${escapeHtml(error.message || error)}</p></div>
      </div>`;
    return;
  }
  panel.style.display = 'flex';
  panel.innerHTML = `<div class="alert-banner-body"><p class="alert-banner-title">Request failed</p><p class="alert-banner-text">${escapeHtml(error.message || error)}</p></div>`;
}

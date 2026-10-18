import { decideAgentTask, getAgentTasks } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('agent', '../login.html');
const container = document.getElementById('agent-content');

if (session) {
  setupNav('agent');
  loadTasks();
}

async function loadTasks() {
  try {
    const tasks = await getAgentTasks(session.userId);
    renderTasks(Array.isArray(tasks) ? tasks : []);
  } catch (error) {
    showLoadError(container, error);
  }
}

function renderTasks(tasks) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title text-2xl">Field assignments</h1>
        <p class="page-subtitle">Review assigned visits and respond to pending tasks.</p>
      </div>
      <button id="refresh-agent-tasks" class="btn btn-outline btn-sm">Refresh</button>
    </div>
    <section class="card">
      <div class="card-header"><h2 class="card-title">Your assignments</h2></div>
      <div class="card-content">
        ${tasks.length ? tasks.map((task, index) => {
          const status = String(task.status || 'pending').toLowerCase();
          return `
            <article class="card" style="padding:1rem;margin-bottom:.8rem;">
              <div class="flex justify-between items-center" style="gap:1rem;flex-wrap:wrap;">
                <div>
                  <h3 class="font-semibold">${escapeHtml(task.oname || 'Field visit')}</h3>
                  <p class="text-xs text-muted">Contact: ${escapeHtml(task.ocontact || 'Not provided')}</p>
                  <p class="text-xs text-muted">Scheduled: ${escapeHtml(task.time || 'Not specified')}</p>
                  <p class="text-xs text-muted">Location: ${escapeHtml(task.lat ?? '—')}, ${escapeHtml(task.long ?? '—')}</p>
                </div>
                <span class="badge ${status === 'pending' ? 'badge-amber' : 'badge-teal'}">${escapeHtml(status)}</span>
              </div>
              ${status === 'pending' ? `
                <div class="flex gap-2" style="margin-top:1rem;">
                  <button class="btn btn-primary btn-sm" data-task-index="${index}" data-decision="accepted">Accept visit</button>
                  <button class="btn btn-outline btn-sm" data-task-index="${index}" data-decision="declined">Decline</button>
                </div>
              ` : ''}
            </article>
          `;
        }).join('') : '<p class="text-sm text-muted">No field assignments have been sent to this account yet.</p>'}
      </div>
    </section>
  `;

  document.getElementById('refresh-agent-tasks').addEventListener('click', loadTasks);
  container.querySelectorAll('[data-task-index]').forEach((button) => {
    button.addEventListener('click', async () => {
      const task = tasks[Number(button.dataset.taskIndex)];
      const buttons = container.querySelectorAll(`[data-task-index="${button.dataset.taskIndex}"]`);
      buttons.forEach((item) => { item.disabled = true; });
      try {
        await decideAgentTask(session.userId, task, button.dataset.decision);
        await loadTasks();
      } catch (error) {
        buttons.forEach((item) => { item.disabled = false; });
        const alert = document.createElement('div');
        alert.className = 'alert-banner danger';
        alert.setAttribute('role', 'alert');
        alert.textContent = error.message;
        container.prepend(alert);
      }
    });
  });
}

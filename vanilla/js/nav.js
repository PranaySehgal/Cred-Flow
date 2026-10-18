import { getSession, signOut } from './session.js';
import { icon, logo } from './icons.js';
import { logout } from './backend.js';

export function setupNav(role, activeId) {
  const session = getSession();
  const inRootProfile = window.location.pathname.endsWith('/profile.html');
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
    window.location.href = inRootProfile ? 'login.html' : '../login.html';
  });

  if (role === 'merchant') {
    const merchantPage = (page) => inRootProfile ? `merchant/${page}` : page;
    const header = document.getElementById('merchant-header');
    if (!header) return;
    header.innerHTML = `
      <header class="print-hide app-header">
        <div class="container-narrow app-header-inner">
          <a href="${merchantPage('index.html')}" class="logo-link" aria-label="CreditFlow home">${logo({ height: 26 })}</a>
          <div class="flex items-center gap-3">
            <span class="text-muted text-sm font-medium">${session?.username || ''}</span>
            <a href="../profile.html" class="btn btn-outline btn-sm">Profile</a>
            <button data-action="sign-out" class="btn btn-ghost btn-sm">${icon('logout', { size: 14 })}<span>Sign out</span></button>
          </div>
        </div>
      </header>
      <nav class="print-hide merchant-tabs">
        <div class="container-narrow flex gap-1">
          <a href="${merchantPage('index.html')}" class="merchant-tab ${activeId === 'home' ? 'active' : ''}">${icon('home', { size: 15 })} Home</a>
          <a href="${merchantPage('transactions.html')}" class="merchant-tab ${activeId === 'transactions' ? 'active' : ''}">${icon('history', { size: 15 })} Transactions</a>
          <a href="${merchantPage('inventory.html')}" class="merchant-tab ${activeId === 'inventory' ? 'active' : ''}">Inventory</a>
          <a href="${merchantPage('support.html')}" class="merchant-tab ${activeId === 'support' ? 'active' : ''}">${icon('headphones', { size: 15 })} Support</a>
        </div>
      </nav>
    `;
  } else if (role === 'lender') {
    const inAdminDirectory = window.location.pathname.includes('/admin/');
    const lenderPage = (page) => inAdminDirectory ? `../lender/${page}` : inRootProfile ? `lender/${page}` : page;
    const contractPage = inAdminDirectory ? 'agreement-new.html' : inRootProfile ? 'admin/agreement-new.html' : '../admin/agreement-new.html';
    const sidebar = document.getElementById('lender-sidebar');
    if (sidebar) {
      sidebar.innerHTML = `
        <div class="sidebar-brand"><a href="${lenderPage('index.html')}" aria-label="CreditFlow">${logo({ height: 26, inverted: true })}</a></div>
        <nav class="sidebar-nav">
          <a href="${lenderPage('index.html')}" class="sidebar-link ${activeId === 'portfolio' ? 'active' : ''}">${icon('dashboard', { size: 16 })}<span>Portfolio</span></a>
          <a href="${lenderPage('merchants.html')}" class="sidebar-link ${activeId === 'merchants' ? 'active' : ''}">${icon('users', { size: 16 })}<span>Merchants & repayments</span></a>
          <a href="${contractPage}" class="sidebar-link ${activeId === 'contract' ? 'active' : ''}">${icon('fileSignature', { size: 16 })}<span>New contract</span></a>
          <a href="${inAdminDirectory ? '../profile.html' : inRootProfile ? 'profile.html' : '../profile.html'}" class="sidebar-link ${activeId === 'profile' ? 'active' : ''}">${icon('users', { size: 16 })}<span>Account details</span></a>
        </nav>
        <div class="sidebar-footer">
          <div style="font-weight:600;font-size:13px;color:#fff;">${session?.username || ''}</div>
          <button data-action="sign-out" class="btn btn-outline btn-sm btn-block" style="margin-top:10px;background:transparent;color:#fff;border-color:rgba(255,255,255,.25);">${icon('logout', { size: 14 })}<span>Sign out</span></button>
        </div>
      `;
    }
    const topbar = document.getElementById('lender-mobile-topbar');
    if (topbar) {
      topbar.innerHTML = `
        <a href="${lenderPage('index.html')}">${logo({ height: 24, inverted: true })}</a>
        <button id="toggle-sidebar" class="btn btn-ghost btn-sm" style="color:#fff;" aria-label="Toggle navigation">
          ${icon('menu', { size: 20 })}
        </button>
      `;
      document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
        document.querySelector('.portal-sidebar')?.classList.toggle('open');
      });
    }
  } else if (role === 'agent') {
    const agentPage = (page) => inRootProfile ? `agent/${page}` : page;
    const header = document.getElementById('agent-header');
    if (!header) return;
    header.innerHTML = `
      <header class="print-hide app-header">
        <div class="container-narrow app-header-inner">
          <a href="${agentPage('index.html')}" class="logo-link" aria-label="CreditFlow">${logo({ height: 26 })}</a>
          <div class="flex items-center gap-3">
            <span class="text-muted text-sm font-medium">${session?.username || ''}</span>
            <a href="${inRootProfile ? 'profile.html' : '../profile.html'}" class="btn btn-outline btn-sm">Profile</a>
            <button data-action="sign-out" class="btn btn-ghost btn-sm">${icon('logout', { size: 14 })}<span>Sign out</span></button>
          </div>
        </div>
      </header>
    `;
  } else if (role === 'superadmin') {
    const header = document.getElementById('superadmin-header');
    if (!header) return;
    header.innerHTML = `
      <header class="print-hide app-header">
        <div class="container-narrow app-header-inner">
          <a href="index.html" class="logo-link" aria-label="CreditFlow">${logo({ height: 26 })}</a>
          <div class="flex items-center gap-3">
            <span class="badge badge-navy">Super admin</span>
            <span class="text-muted text-sm font-medium">${session?.username || ''}</span>
            <button data-action="sign-out" class="btn btn-ghost btn-sm">${icon('logout', { size: 14 })}<span>Sign out</span></button>
          </div>
        </div>
      </header>
    `;
  }
}

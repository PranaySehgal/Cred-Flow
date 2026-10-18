const SESSION_KEY = 'creditflow-session';

export function getSession() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    const state = data.state;
    if (!state?.userId || !state?.username || !state?.role) return null;
    return state;
  } catch {
    return null;
  }
}

export function signIn(role, username, ranking = null, authToken = null) {
  const state = {
    role,
    userId: username,
    username,
    name: username,
    signedInAt: new Date().toISOString(),
    ranking,
    authToken,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ state, version: 1 }));
  return state;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

const SUPPORTED_PAGES = {
  merchant: ['index.html', 'transactions.html', 'support.html', 'log-cash-sale.html', 'inventory.html', 'profile.html'],
  lender: ['index.html', 'merchants.html', 'agreement-new.html', 'profile.html'],
  agent: ['index.html', 'profile.html'],
  superadmin: ['index.html'],
};

export function requireUser(redirectPath = 'login.html') {
  const session = getSession();
  if (
    !session ||
    !session.authToken ||
    !['merchant', 'lender', 'agent', 'superadmin'].includes(session.role)
  ) {
    window.location.href = redirectPath;
    return null;
  }
  return session;
}

export function requireRole(expectedRole, redirectPath = '../login.html') {
  const session = getSession();
  if (!session || !session.authToken || !session.role || session.role !== expectedRole) {
    window.location.href = redirectPath;
    return null;
  }

  const currentPage = window.location.pathname.split('/').pop();
  if (!(SUPPORTED_PAGES[expectedRole] || []).includes(currentPage)) {
    document.body.innerHTML = `
      <main class="container-narrow" style="padding:3rem 1rem;">
        <div class="card card-content">
          <h1 class="text-xl text-navy">This screen is not connected to the backend yet</h1>
          <p class="text-sm text-muted" style="margin-top:.75rem;">
            This view previously used demonstration data. Use a connected screen from the navigation instead.
          </p>
          <a class="btn btn-primary" style="margin-top:1rem;" href="${expectedRole === 'merchant' ? 'index.html' : '../lender/index.html'}">
            Return to ${expectedRole === 'merchant' ? 'merchant home' : 'lender portfolio'}
          </a>
        </div>
      </main>
    `;
    return null;
  }

  return session;
}

import { getSession } from './session.js';

function getApiBaseUrl() {
  const configuredUrl =
    window.CREDITFLOW_API_URL ||
    localStorage.getItem('creditflow-api-url') ||
    'http://127.0.0.1:8000';

  let apiUrl;
  try {
    apiUrl = new URL(configuredUrl);
  } catch {
    throw new Error(
      `Invalid API URL "${configuredUrl}". Set it to an absolute URL such as http://127.0.0.1:8000.`
    );
  }

  if (!['http:', 'https:'].includes(apiUrl.protocol)) {
    throw new Error('The API URL must use HTTP or HTTPS.');
  }

  return apiUrl.origin;
}

const activeRequests = new Map();
let loadingOverlay;

function startLoading(message) {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'cf-loading-overlay';
    loadingOverlay.setAttribute('role', 'status');
    loadingOverlay.setAttribute('aria-live', 'polite');
    loadingOverlay.setAttribute('aria-hidden', 'true');
    loadingOverlay.innerHTML = `
      <div class="cf-loading-card">
        <span class="cf-loading-spinner" aria-hidden="true"></span>
        <span class="cf-loading-message"></span>
      </div>
    `;
    document.body.append(loadingOverlay);
  }

  const requestId = Symbol();
  activeRequests.set(requestId, message);
  document.body.setAttribute('aria-busy', 'true');
  loadingOverlay.querySelector('.cf-loading-message').textContent = message;
  loadingOverlay.classList.add('is-visible');
  loadingOverlay.setAttribute('aria-hidden', 'false');

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeRequests.delete(requestId);
    if (activeRequests.size === 0) {
      loadingOverlay.classList.remove('is-visible');
      loadingOverlay.setAttribute('aria-hidden', 'true');
      document.body.removeAttribute('aria-busy');
    } else {
      loadingOverlay.querySelector('.cf-loading-message').textContent =
        Array.from(activeRequests.values()).pop();
    }
  };
}

function loadingMessageFor(path) {
  if (path.includes('/auth/login')) return 'Checking your sign-in…';
  if (path.includes('/auth/verify-otp')) return 'Verifying sign-in code…';
  if (path.includes('/auth/resend-otp')) return 'Sending a new verification code…';
  if (path.includes('/auth/createAccount')) return 'Creating your account…';
  if (path.includes('/superadmin/accounts/update')) return 'Saving account details…';
  if (path.includes('/superadmin/account-requests/decision')) return 'Reviewing account request…';
  if (path.includes('/superadmin/account-requests')) return 'Loading account requests…';
  if (path.includes('/superadmin/accounts')) return 'Loading accounts…';
  if (path.includes('/superadmin/issues/resolve')) return 'Resolving issue…';
  if (path.includes('/superadmin/issues')) return 'Loading issues…';
  if (path.includes('/superadmin/contracts')) return 'Creating contract…';
  if (path.includes('/agent/tasks/decision')) return 'Updating assignment…';
  if (path.includes('/agent/tasks')) return 'Loading agent assignments…';
  if (path.includes('/getUserProfile')) return 'Loading account details…';
  if (path.includes('/updateUserProfile')) return 'Saving your details…';
  if (path.includes('/infoMerchant') || path.includes('/infoLender') || path.includes('/getIssues')) {
    return 'Loading your account data…';
  }
  if (path.includes('/addTransactions')) return 'Recording transaction…';
  if (path.includes('/merchant/inventory/update')) return 'Saving inventory…';
  if (path.includes('/merchant/inventory')) return 'Loading inventory…';
  if (path.includes('/addContract')) return 'Creating contract…';
  if (path.includes('/updateContract')) return 'Updating repayment…';
  if (path.includes('/createIssue')) return 'Submitting issue…';
  if (path.includes('/setIssues')) return 'Updating issue…';
  return 'Loading…';
}

export async function apiPost(path, params = {}, options = {}) {
  const apiBaseUrl = getApiBaseUrl();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const queryString = query.toString();
  const hasBody = Object.hasOwn(options, 'body');
  const stopLoading = startLoading(loadingMessageFor(path));
  const authToken = getSession()?.authToken;

  try {
    const response = await fetch(`${apiBaseUrl}${path}${queryString ? `?${queryString}` : ''}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        (typeof result === 'object' && (result.detail || result.message)) ||
        `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    if (result && typeof result === 'object' && typeof result.message === 'string') {
      if (/^(error|transaction failed)/i.test(result.message)) {
        throw new Error(result.message);
      }
    }

    return result;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Could not reach the CreditFlow API at ${apiBaseUrl}. ${error.message}`);
    }
    throw error;
  } finally {
    stopLoading();
  }
}

export function login(username, password, role) {
  return apiPost('/auth/login', {}, { body: { username, password, atype: role } });
}

export function verifyLoginCode(challengeId, code) {
  return apiPost('/auth/verify-otp', {}, {
    body: { challenge_id: challengeId, code },
  });
}

export function resendLoginCode(challengeId) {
  return apiPost('/auth/resend-otp', {}, { body: { challenge_id: challengeId } });
}

export function logout() {
  return apiPost('/auth/logout');
}

export function createAccount(username, password, role) {
  return apiPost('/auth/createAccount', {}, { body: { username, password, atype: role } });
}

export function getMerchantInfo(userId) {
  return apiPost('/infoMerchant', { user_id: userId });
}

export function getLenderInfo(userId) {
  return apiPost('/infoLender', { user_id: userId });
}

export function addTransaction(userId, amount, transactionId, method) {
  return apiPost('/addTransactions', {
    mid: userId,
    amount,
    transact_id: transactionId,
    method,
  });
}

export function getMerchantInventory() {
  return apiPost('/merchant/inventory/list');
}

export function updateMerchantInventory(items) {
  return apiPost('/merchant/inventory/update', {}, { body: { items } });
}

export function createContract(merchantId, lenderId, amount, tenure) {
  return apiPost('/addContract', {
    mid: merchantId,
    lid: lenderId,
    amount,
    tenure,
  });
}

export function updateContract(merchantId, lenderId, amountPaid, dateOfPayment) {
  return apiPost('/updateContract', {
    mid: merchantId,
    lid: lenderId,
    amountPaid,
    dop: dateOfPayment,
  });
}

export function createIssue(userId, description) {
  return apiPost('/createIssue', { user_id: userId, desc: description });
}

export function getIssues(userId) {
  return apiPost('/getIssues', { user_id: userId });
}

export function resolveIssue(issueId) {
  return apiPost('/setIssues', { issue_id: issueId });
}

export function getUserProfile(userId) {
  return apiPost('/getUserProfile', { user_id: userId });
}

export function updateUserProfile(profile) {
  return apiPost('/updateUserProfile', {}, { body: profile });
}

export function getSuperAdminAccounts() {
  return apiPost('/superadmin/accounts');
}

export function getSuperAdminAccountRequests() {
  return apiPost('/superadmin/account-requests');
}

export function reviewSuperAdminAccountRequest(userId, accountType, decision) {
  return apiPost('/superadmin/account-requests/decision', {}, {
    body: { user_id: userId, atype: accountType, decision },
  });
}

export function updateManagedAccount(profile) {
  return apiPost('/superadmin/accounts/update', {}, { body: profile });
}

export function getSuperAdminIssues() {
  return apiPost('/superadmin/issues');
}

export function resolveSuperAdminIssue(issueId) {
  return apiPost('/superadmin/issues/resolve', {}, { body: { issue_id: issueId } });
}

export function createSuperAdminContract(contract) {
  return apiPost('/superadmin/contracts', {}, { body: contract });
}

export function getAgentTasks(agentId) {
  return apiPost('/agent/tasks', { agent_id: agentId });
}

export function decideAgentTask(agentId, task, status) {
  return apiPost(
    '/agent/tasks/decision',
    { agent_id: agentId },
    {
      body: {
        lat: Number(task.lat),
        long: Number(task.long),
        date: task.time,
        oname: task.oname,
        ocontact: task.ocontact,
        status,
      },
    }
  );
}

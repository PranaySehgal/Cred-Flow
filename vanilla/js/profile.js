import { getUserProfile, logout, updateUserProfile } from './backend.js';
import { requireUser, signOut } from './session.js';
import { escapeHtml } from './view.js';

const session = requireUser();
const container = document.getElementById('profile-content');

if (session) {
  const homeLink = document.getElementById('profile-home-link');
  homeLink.href = {
    merchant: 'merchant/index.html',
    lender: 'lender/index.html',
    agent: 'agent/index.html',
    superadmin: 'superadmin/index.html',
  }[session.role];
  document.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="sign-out"]')) return;
    try {
      await logout();
    } catch (error) {
      console.error('Could not revoke the server session during sign-out.', error);
    }
    signOut();
    window.location.href = 'login.html';
  });
  loadProfile();
}

async function loadProfile(message = '') {
  try {
    const profile = await getUserProfile(session.userId);
    renderProfile(profile, message);
  } catch (error) {
    container.innerHTML = `
      <div class="alert-banner danger" role="alert">
        <div class="alert-banner-body">
          <p class="alert-banner-title">Could not load account details</p>
          <p class="alert-banner-text">${escapeHtml(error.message)}</p>
        </div>
      </div>
    `;
  }
}

function renderProfile(profile, message) {
  const hasBusinessRole = ['merchant', 'lender'].includes(session.role);
  const ranking = hasBusinessRole ? session.ranking : null;
  const rankingNotice = ranking?.status === 'updated'
    ? `<div class="alert-banner success" role="status"><div class="alert-banner-body"><p class="alert-banner-title">Rank updated for this login</p><p class="alert-banner-text">TinyFish score: ${escapeHtml(ranking.rating)} / 100${ranking.risk_tier ? ` · ${escapeHtml(ranking.risk_tier)}` : ''}</p></div></div>`
    : ranking?.status === 'needs_profile'
      ? '<div class="alert-banner amber" role="status"><div class="alert-banner-body"><p class="alert-banner-title">Complete your business details to calculate a rank</p><p class="alert-banner-text">Save a shop name and both coordinates. Ranking will run the next time you sign in.</p></div></div>'
      : ranking?.status === 'failed'
        ? `<div class="alert-banner danger" role="alert"><div class="alert-banner-body"><p class="alert-banner-title">Ranking could not be updated</p><p class="alert-banner-text">${escapeHtml(ranking.message || 'Check the server configuration and try again at your next sign in.')}</p></div></div>`
        : '';
  const rankingCard = !hasBusinessRole
    ? ''
    : `
      <section class="card" style="margin-bottom:1rem;">
        <div class="card-header">
          <div>
            <h2 class="card-title">TinyFish rank</h2>
            <p class="text-xs text-muted">The score is read from your account record.</p>
          </div>
        </div>
        <div class="card-content">
          <p class="stat-value tabular">${profile.rating >= 0 ? `${escapeHtml(profile.rating)} / 100` : 'Not ranked yet'}</p>
          <p class="text-xs text-muted" style="margin-top:.35rem;">The backend re-evaluates the ranking after each successful login when business name and coordinates are available.</p>
        </div>
      </section>
    `;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title text-2xl">Account details</h1>
        <p class="page-subtitle">${escapeHtml(session.username)} · Account types: ${escapeHtml((profile.account_types || [profile.AType]).join(', '))}</p>
      </div>
    </div>
    ${rankingNotice}
    ${message ? `<div class="alert-banner success" role="status"><div class="alert-banner-body"><p class="alert-banner-text">${escapeHtml(message)}</p></div></div>` : ''}
    ${rankingCard}
    <section class="card card-content">
      <h2 class="card-title" style="margin-bottom:1rem;">Edit your details</h2>
      <form id="profile-form">
        <div class="form-group">
          <label for="owner-name" class="form-label">Owner / contact name</label>
          <input id="owner-name" name="owner_name" class="form-input" maxlength="255" value="${escapeHtml(profile.OName || '')}">
        </div>
        <div class="form-group">
          <label for="shop-name" class="form-label">Business / shop name <span class="required">*</span></label>
          <input id="shop-name" name="shop_name" class="form-input" maxlength="255" value="${escapeHtml(profile.SName || '')}" required>
        </div>
        <div class="form-group">
          <label for="mobile-number" class="form-label">Mobile number</label>
          <input id="mobile-number" name="mobile_number" type="tel" class="form-input" maxlength="32" value="${escapeHtml(profile.MobileNum || '')}">
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label for="latitude" class="form-label">Latitude</label>
            <input id="latitude" name="latitude" type="number" class="form-input" min="-90" max="90" step="any" value="${escapeHtml(profile.lat || '')}">
          </div>
          <div class="form-group">
            <label for="longitude" class="form-label">Longitude</label>
            <input id="longitude" name="longitude" type="number" class="form-input" min="-180" max="180" step="any" value="${escapeHtml(profile.long || '')}">
          </div>
        </div>
        <p class="form-hint" style="margin-bottom:1rem;">Both coordinates are required for TinyFish business verification. The score is recalculated at your next login.</p>
        <button type="submit" id="save-profile" class="btn btn-primary">Save details</button>
      </form>
    </section>
  `;

  document.getElementById('profile-form').addEventListener('submit', saveProfile);
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById('save-profile');
  button.disabled = true;
  try {
    const latitude = form.elements.latitude.value.trim();
    const longitude = form.elements.longitude.value.trim();
    const profile = await updateUserProfile({
      user_id: session.userId,
      owner_name: form.elements.owner_name.value.trim() || null,
      shop_name: form.elements.shop_name.value.trim() || null,
      mobile_number: form.elements.mobile_number.value.trim() || null,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
    });
    renderProfile(profile, 'Your account details were saved.');
  } catch (error) {
    const message = document.createElement('div');
    message.className = 'alert-banner danger';
    message.setAttribute('role', 'alert');
    message.textContent = error.message;
    form.prepend(message);
    button.disabled = false;
  }
}

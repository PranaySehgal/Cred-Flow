export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function showLoadError(container, error) {
  container.innerHTML = `
    <div class="alert-banner danger" role="alert">
      <div class="alert-banner-body">
        <p class="alert-banner-title">Could not load live data</p>
        <p class="alert-banner-text">${escapeHtml(error.message || error)}</p>
      </div>
    </div>
  `;
}

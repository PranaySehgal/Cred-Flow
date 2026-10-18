import { getMerchantInventory, updateMerchantInventory } from './backend.js';
import { requireRole } from './session.js';
import { setupNav } from './nav.js';
import { escapeHtml, showLoadError } from './view.js';

const session = requireRole('merchant', '../login.html');
const container = document.getElementById('merchant-inventory-content');
let inventory = [];

if (session) {
  setupNav('merchant', 'inventory');
  loadInventory();
}

async function loadInventory() {
  try {
    const result = await getMerchantInventory();
    if (!Array.isArray(result.inventory)) {
      throw new Error('The backend returned an invalid inventory list.');
    }
    inventory = result.inventory;
    renderInventory();
    return true;
  } catch (error) {
    showLoadError(container, error);
    return false;
  }
}

function renderInventory() {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title text-xl">Inventory</h1>
        <p class="page-subtitle">Add products and update their prices and available quantities.</p>
      </div>
      <button id="refresh-inventory" class="btn btn-outline btn-sm" type="button">Refresh</button>
    </div>
    <div id="inventory-feedback" class="alert-banner" style="display:none;" role="status"></div>
    <section class="card" style="margin-bottom:1.25rem;">
      <div class="card-header"><h2 class="card-title" id="inventory-form-title">Add or update a product</h2></div>
      <div class="card-content">
        <form id="inventory-form">
          <div class="grid-2">
            <div class="form-group">
              <label for="inventory-product" class="form-label">Product name <span class="required">*</span></label>
              <input id="inventory-product" class="form-input" maxlength="255" required>
            </div>
            <div class="form-group">
              <label for="inventory-price" class="form-label">Price (₹) <span class="required">*</span></label>
              <input id="inventory-price" class="form-input" type="number" min="0" step="0.01" required>
            </div>
          </div>
          <div class="form-group">
            <label for="inventory-quantity" class="form-label">Quantity available <span class="required">*</span></label>
            <input id="inventory-quantity" class="form-input" type="number" min="0" step="1" required>
          </div>
          <div class="flex gap-2">
            <button id="save-inventory" class="btn btn-primary" type="submit">Save product</button>
            <button id="cancel-inventory-edit" class="btn btn-outline" type="button" hidden>Cancel edit</button>
          </div>
        </form>
      </div>
    </section>
    <section class="card">
      <div class="card-header"><h2 class="card-title">Your products</h2></div>
      <div class="card-content" id="inventory-list">
        ${renderInventoryList()}
      </div>
    </section>
  `;

  document.getElementById('inventory-form').addEventListener('submit', saveInventoryItem);
  document.getElementById('refresh-inventory').addEventListener('click', loadInventory);
  document.getElementById('cancel-inventory-edit').addEventListener('click', resetForm);
  document.getElementById('inventory-list').addEventListener('click', editInventoryItem);
}

function renderInventoryList() {
  if (!inventory.length) {
    return '<p class="text-sm text-muted">No products added yet. Use the form above to add your first product.</p>';
  }
  return inventory.map((item, index) => `
    <div class="flex justify-between items-center" style="gap:1rem;padding:.8rem 0;border-bottom:1px solid var(--color-line);">
      <div>
        <p class="font-semibold">${escapeHtml(item.product)}</p>
        <p class="text-xs text-muted">₹${Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Quantity: ${escapeHtml(item.quantity)}</p>
      </div>
      <button class="btn btn-outline btn-sm" type="button" data-edit-inventory="${index}">Edit</button>
    </div>
  `).join('');
}

function editInventoryItem(event) {
  const button = event.target.closest('[data-edit-inventory]');
  if (!button) return;
  const item = inventory[Number(button.dataset.editInventory)];
  if (!item) return;

  document.getElementById('inventory-product').value = item.product;
  document.getElementById('inventory-product').readOnly = true;
  document.getElementById('inventory-price').value = item.price;
  document.getElementById('inventory-quantity').value = item.quantity;
  document.getElementById('inventory-form-title').textContent = 'Update product';
  document.getElementById('save-inventory').textContent = 'Update product';
  document.getElementById('cancel-inventory-edit').hidden = false;
  clearFeedback();
  document.getElementById('inventory-product').focus();
}

async function saveInventoryItem(event) {
  event.preventDefault();
  const button = document.getElementById('save-inventory');
  const product = document.getElementById('inventory-product').value.trim();
  const price = Number(document.getElementById('inventory-price').value);
  const quantity = Number(document.getElementById('inventory-quantity').value);
  if (!product || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 0) {
    showFeedback('Enter a product name, a valid non-negative price, and a whole-number quantity.', true);
    return;
  }

  button.disabled = true;
  clearFeedback();
  try {
    await updateMerchantInventory([{ product, price, quantity }]);
    resetForm();
    if (await loadInventory()) showFeedback('Inventory saved successfully.');
  } catch (error) {
    showFeedback(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function resetForm() {
  document.getElementById('inventory-form').reset();
  document.getElementById('inventory-product').readOnly = false;
  document.getElementById('inventory-form-title').textContent = 'Add or update a product';
  document.getElementById('save-inventory').textContent = 'Save product';
  document.getElementById('cancel-inventory-edit').hidden = true;
}

function showFeedback(message, isError = false) {
  const panel = document.getElementById('inventory-feedback');
  panel.className = `alert-banner ${isError ? 'danger' : 'success'}`;
  panel.textContent = message;
  panel.style.display = 'flex';
}

function clearFeedback() {
  const panel = document.getElementById('inventory-feedback');
  panel.style.display = 'none';
  panel.textContent = '';
}

import { istDateKey } from './format.js';

export const TODAY = istDateKey();
export const aggregates = [];
export const agreements = [];
export const auditLog = [];
export const disputes = [];
export const fees = [];
export const alerts = [];
export const leads = [];
export const lenders = [];
export const merchants = [];
export const qrProfiles = [];
export const riskAlerts = [];
export const supportTickets = [];
export const transactions = [];
export const verifications = [];

export function merchantById(id) {
  const merchant = merchants.find((item) => item.id === id);
  if (!merchant) throw new Error('Merchant data is only available from the backend.');
  return merchant;
}

export function lenderById(id) {
  const lender = lenders.find((item) => item.id === id);
  if (!lender) throw new Error('Lender data is only available from the backend.');
  return lender;
}

export function aggregatesFor() {
  return [];
}

export function agreementForMerchant() {
  throw new Error('Agreement data is only available from the backend.');
}

import { istDateKey } from './format.js';

const unavailable = () => {
  throw new Error('This screen is not connected to a backend endpoint.');
};

const unavailableApi = new Proxy({}, { get: () => unavailable });

export const merchantApi = unavailableApi;
export const lenderApi = unavailableApi;
export const adminApi = unavailableApi;

export const merchantById = unavailable;
export const lenderById = unavailable;
export const agreementForMerchant = unavailable;
export const aggregatesFor = () => [];
export const rowFor = unavailable;
export const TODAY = istDateKey();

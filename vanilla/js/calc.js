// CreditFlow Calculation Engine
import { daysBetween } from './format.js';

export const PLATFORM_FEE_RATE = 0.01;
export const PLATFORM_FEE_CAP = 20;

export function platformFeeFor(saleAmount) {
  if (saleAmount <= 0) return 0;
  return Math.min(Math.round(saleAmount * PLATFORM_FEE_RATE), PLATFORM_FEE_CAP);
}

export function repaymentFor(saleAmount, rate, outstanding) {
  if (saleAmount <= 0 || outstanding <= 0) return 0;
  return Math.min(Math.round(saleAmount * rate), Math.max(outstanding, 0));
}

export function splitPayment(saleAmount, rate, outstanding) {
  const repayment = repaymentFor(saleAmount, rate, outstanding);
  const platformFee = repayment > 0 ? platformFeeFor(saleAmount) : 0;
  const merchantPayout = Math.max(saleAmount - repayment - platformFee, 0);
  return { repayment, merchantPayout, platformFee };
}

export function repaidTotal(creditAmount, outstanding) {
  return Math.max(creditAmount - outstanding, 0);
}

export function repaidPercent(creditAmount, outstanding) {
  if (creditAmount <= 0) return 0;
  return Math.min((repaidTotal(creditAmount, outstanding) / creditAmount) * 100, 100);
}

export function evaluateState(input) {
  if (input.outstanding <= 0) return 'completed';
  if (input.paused) return 'paused';
  if (input.daysSinceLastPayment >= 21) return 'default';
  if (input.paceRatio < 0.5 && input.daysBelowPace >= 14) return 'high_risk';
  if (input.paceRatio < 0.7 && input.daysBelowPace >= 7) return 'at_risk';
  if (input.daysSinceLastPayment >= 3) return 'low_activity';
  return 'on_track';
}

export function analyseSeries(series, agreement) {
  const ordered = [...series].sort((a, b) => (a.date < b.date ? -1 : 1));
  const today = ordered[ordered.length - 1];
  const todayKey = today?.date ?? '';

  let daysSinceLastPayment = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].sales > 0) {
      daysSinceLastPayment = daysBetween(ordered[i].date, todayKey);
      break;
    }
    daysSinceLastPayment = daysBetween(ordered[i].date, todayKey);
  }

  const last30 = ordered.slice(-30);
  const activeDays = last30.filter((d) => d.sales > 0).length || 1;
  const avgDailySales = last30.reduce((sum, d) => sum + d.sales, 0) / Math.max(activeDays, 1);

  const baselineWindow = ordered.slice(-30, -7);
  const baselineActive = baselineWindow.filter((d) => d.sales > 0).length || 1;
  const baselineDailySales =
    baselineWindow.reduce((sum, d) => sum + d.sales, 0) / Math.max(baselineActive, 1);
  const expectedDailyRepayment = Math.max(baselineDailySales * agreement.rate, 1);
  const last7 = ordered.slice(-7);
  const actualDailyRepayment =
    last7.reduce((sum, d) => sum + d.repaymentRouted, 0) / Math.max(last7.length, 1);
  const paceRatio = actualDailyRepayment / expectedDailyRepayment;

  let daysBelowPace = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].sales > 0 && ordered[i].repaymentRouted < 0.7 * expectedDailyRepayment) {
      daysBelowPace++;
    } else {
      break;
    }
  }

  const week = ordered.slice(-7);
  const month = ordered.slice(-30);
  const todayRepayment = today?.repaymentRouted ?? 0;

  const dailyRepaymentCapacity = Math.max(avgDailySales * agreement.rate, 50);
  const projectedCompletionDays =
    agreement.outstanding > 0 && avgDailySales > 0
      ? Math.ceil(agreement.outstanding / dailyRepaymentCapacity)
      : null;

  return {
    state: evaluateState({
      outstanding: agreement.outstanding,
      creditAmount: agreement.creditAmount,
      daysSinceLastPayment,
      paceRatio,
      daysBelowPace,
      paused: Boolean(agreement.paused),
    }),
    daysSinceLastPayment,
    paceRatio,
    daysBelowPace,
    avgDailySales,
    baselineDailySales,
    todaySales: today?.sales ?? 0,
    todayRepayment,
    weekRepayment: week.reduce((sum, d) => sum + d.repaymentRouted, 0),
    monthRepayment: month.reduce((sum, d) => sum + d.repaymentRouted, 0),
    projectedCompletionDays,
  };
}

export function estimatedDaysToRepay(creditAmount, rate, sampleDailySales) {
  const daily = Math.max(sampleDailySales * rate, 1);
  return Math.ceil(creditAmount / daily);
}

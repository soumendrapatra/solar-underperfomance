/**
 * Prescriptive Financial Quantification Engine.
 * Computes energy loss (kWh), immediate revenue loss (INR), 30-day forward projections,
 * and soiling cleaning optimization economics.
 * Pure JavaScript, no external dependencies.
 */

export const DEFAULT_TARIFF_INR_PER_KWH = 3.15

/**
 * Quantifies financial impact and projected revenue risk.
 *
 * @param {number} lostKWh - Energy lost over the evaluated period (kWh)
 * @param {number} periodDays - Duration of evaluated period in days
 * @param {object} [options]
 * @param {number} [options.tariff=3.15] - Tariff in INR/kWh
 * @param {number} [options.dcCapacityKwp=12400] - Plant DC capacity in kWp
 * @returns {{
 *   lostKWh: number,
 *   lostRevenue: number,
 *   lostKWhPerDay: number,
 *   lostRevenuePerDay: number,
 *   projected30DayLossKWh: number,
 *   projected30DayLossInr: number,
 *   tariff: number
 * }}
 */
export function quantifyFinancialLoss(lostKWh, periodDays = 7, options = {}) {
  const tariff = options.tariff ?? DEFAULT_TARIFF_INR_PER_KWH
  const days = Math.max(1, periodDays)

  const lostKWhPerDay = lostKWh / days
  const lostRevenue = lostKWh * tariff
  const lostRevenuePerDay = lostKWhPerDay * tariff

  const projected30DayLossKWh = Math.round(lostKWhPerDay * 30 * 10) / 10
  const projected30DayLossInr = Math.round(lostRevenuePerDay * 30)

  return {
    lostKWh: Math.round(lostKWh * 10) / 10,
    lostRevenue: Math.round(lostRevenue),
    lostKWhPerDay: Math.round(lostKWhPerDay * 10) / 10,
    lostRevenuePerDay: Math.round(lostRevenuePerDay),
    projected30DayLossKWh,
    projected30DayLossInr,
    tariff,
  }
}

/**
 * Calculates soiling cleaning economics and optimal wash trigger date.
 *
 * @param {object} params
 * @param {number} params.dailySoilingLossKWh - Current daily energy loss attributable to soiling (kWh/day)
 * @param {number} [params.soilingRatePerDay=0.0025] - Daily soiling accumulation rate fraction
 * @param {number} [params.tariff=3.15] - Tariff in INR/kWh
 * @param {number} [params.dcCapacityKwp=12400] - Plant DC capacity in kWp (12.4 MWp)
 * @param {number} [params.cleaningCostPerKwp=2.2] - Washing contractor cost (INR ~2.2/kWp = ~INR 27,280 for 12.4 MWp)
 * @returns {{
 *   cleaningCostInr: number,
 *   currentDailyLossInr: number,
 *   revenueGainPerDay: number,
 *   paybackDays: number,
 *   isCleaningRecommendedNow: boolean,
 *   recommendedCleaningDaysFromNow: number,
 *   recommendedCleaningDate: string,
 *   netMonthlyBenefitInr: number
 * }}
 */
export function evaluateSoilingEconomics(params) {
  const {
    dailySoilingLossKWh,
    soilingRatePerDay = 0.0025,
    tariff = DEFAULT_TARIFF_INR_PER_KWH,
    dcCapacityKwp = 12400,
    cleaningCostPerKwp = 2.2,
  } = params

  const cleaningCostInr = Math.round(dcCapacityKwp * cleaningCostPerKwp)
  const currentDailyLossInr = Math.round(dailySoilingLossKWh * tariff)
  const revenueGainPerDay = currentDailyLossInr

  // Payback period (days) = Cleaning Cost / Daily Recoverable Revenue
  const paybackDays = revenueGainPerDay > 0
    ? Math.round((cleaningCostInr / revenueGainPerDay) * 10) / 10
    : 999

  // Optimal cleaning triggers when payback is under 7 days (or daily loss exceeds amortized cleaning threshold)
  const isCleaningRecommendedNow = paybackDays <= 7.0 && currentDailyLossInr >= (cleaningCostInr / 14)

  // Forward projection to optimal wash date
  let daysUntilOptimal = 0
  if (!isCleaningRecommendedNow) {
    const dailyLossGrowth = (dcCapacityKwp * 4.5 * soilingRatePerDay) * tariff
    const neededDailyLoss = cleaningCostInr / 7.0
    const gap = Math.max(0, neededDailyLoss - currentDailyLossInr)
    daysUntilOptimal = dailyLossGrowth > 0 ? Math.ceil(gap / dailyLossGrowth) : 10
  }

  const recDate = new Date()
  recDate.setDate(recDate.getDate() + daysUntilOptimal)
  const recDateStr = recDate.toISOString().slice(0, 10)

  // Projected net 30-day benefit post-cleaning: (30 * revenueGainPerDay) - cleaningCost
  const netMonthlyBenefitInr = Math.max(0, Math.round(revenueGainPerDay * 30 - cleaningCostInr))

  return {
    cleaningCostInr,
    currentDailyLossInr,
    revenueGainPerDay,
    paybackDays,
    isCleaningRecommendedNow,
    recommendedCleaningDaysFromNow: daysUntilOptimal,
    recommendedCleaningDate: recDateStr,
    netMonthlyBenefitInr,
  }
}

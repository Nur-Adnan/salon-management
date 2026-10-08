// Divide safely: a rate is 0 when there's nothing to divide by (no appointments
// in a period => a 0% no-show rate, not NaN/Infinity).
export function safeRate(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : numerator / denominator;
}

// Total inventory value = Σ(qtyOnHand × unitCost), all integer minor units.
export function inventoryValue(rows: { qtyOnHand: number; unitCost: number }[]): number {
  return rows.reduce((n, r) => n + r.qtyOnHand * r.unitCost, 0);
}

// Average Order Value = net revenue / sales count (rounded to nearest integer minor unit).
export function calculateAov(totalNetRevenue: number, salesCount: number): number {
  if (salesCount <= 0) return 0;
  return Math.round(totalNetRevenue / salesCount);
}

// Churn rate = inactive customers / total customer base.
export function calculateChurnRate(inactiveCustomers: number, totalCustomers: number): number {
  return safeRate(inactiveCustomers, totalCustomers);
}

export interface ForecastPoint {
  date: string;
  projected: number;
  lowerBound: number;
  upperBound: number;
}

export interface ForecastResult {
  isEstimate: true;
  model: 'seasonal_moving_average';
  explanation: string;
  historicalDays: number;
  forecastPoints: ForecastPoint[];
}

/**
 * Explainable, transparent forecasting:
 * Uses historical daily data to compute:
 * 1. Base level from weighted 14-day exponential/moving average.
 * 2. Day-of-week seasonality index (e.g. Fri/Sat peak multiplier vs Mon/Tue quiet multiplier).
 * 3. Residual standard deviation for realistic confidence intervals.
 */
export function calculateExplainableForecast(
  history: { date: string; value: number }[],
  daysAhead: number = 7,
): ForecastResult {
  if (!history.length) {
    return {
      isEstimate: true,
      model: 'seasonal_moving_average',
      explanation: 'Insufficient historical data for projection.',
      historicalDays: 0,
      forecastPoints: [],
    };
  }

  // 1. Calculate overall mean
  const totalVal = history.reduce((sum, h) => sum + h.value, 0);
  const overallMean = Math.max(1, totalVal / history.length);

  // 2. Day of week totals (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const daySums = new Array(7).fill(0);
  const dayCounts = new Array(7).fill(0);

  for (const h of history) {
    const d = new Date(h.date);
    const day = d.getUTCDay();
    daySums[day] += h.value;
    dayCounts[day] += 1;
  }

  // Seasonality multiplier per day of week
  const daySeasonality = daySums.map((sum, day) => {
    const count = dayCounts[day];
    if (!count) return 1.0;
    const dayAvg = sum / count;
    return dayAvg / overallMean;
  });

  // 3. Weighted recent baseline (last 14 days have higher weights)
  const recentDays = history.slice(-14);
  let weightedSum = 0;
  let weightTotal = 0;
  recentDays.forEach((h, idx) => {
    const weight = idx + 1; // 1 to 14
    weightedSum += h.value * weight;
    weightTotal += weight;
  });
  const baseline = weightTotal > 0 ? weightedSum / weightTotal : overallMean;

  // 4. Residual standard deviation for bounds
  const residuals = history.map((h) => {
    const day = new Date(h.date).getUTCDay();
    const expected = baseline * (daySeasonality[day] ?? 1.0);
    return Math.abs(h.value - expected);
  });
  const avgError = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
  const marginOfError = Math.round(avgError * 1.5);

  // 5. Generate future projections
  const lastDate = new Date(history[history.length - 1]!.date);
  const forecastPoints: ForecastPoint[] = [];

  for (let i = 1; i <= daysAhead; i++) {
    const nextDate = new Date(lastDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + i);
    const dateStr = nextDate.toISOString().slice(0, 10);
    const day = nextDate.getUTCDay();

    const seasonalFactor = daySeasonality[day] ?? 1.0;
    const projected = Math.max(0, Math.round(baseline * seasonalFactor));
    const lowerBound = Math.max(0, projected - marginOfError);
    const upperBound = projected + marginOfError;

    forecastPoints.push({
      date: dateStr,
      projected,
      lowerBound,
      upperBound,
    });
  }

  return {
    isEstimate: true,
    model: 'seasonal_moving_average',
    explanation:
      'Weighted recent 14-day moving average adjusted for day-of-week salon seasonality patterns.',
    historicalDays: history.length,
    forecastPoints,
  };
}

/**
 * Converts tabular arrays to RFC 4180 compliant CSV string.
 */
export function convertToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));

  return [headerLine, ...rowLines].join('\r\n');
}

import type { ForecastPoint, TimePoint } from "@/lib/types";

function round(value: number) {
  return Number(value.toFixed(1));
}

function addMonths(date: Date, count: number) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0));
}

export function buildPlaceholderForecast(actuals: TimePoint[], months = 12): ForecastPoint[] {
  if (actuals.length === 0) {
    return [];
  }

  const ordered = [...actuals].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered.at(-1);

  if (!latest) {
    return [];
  }

  const lastDate = new Date(latest.date);
  const trailing6 = ordered.slice(-6);
  const trailing12 = ordered.slice(-12);
  const trailing6Avg =
    trailing6.reduce((sum, point) => sum + point.value, 0) / Math.max(trailing6.length, 1);
  const trailing12Avg =
    trailing12.reduce((sum, point) => sum + point.value, 0) / Math.max(trailing12.length, 1);
  const yearAgo = ordered.length > 12 ? ordered.at(-13)?.value ?? trailing12Avg : trailing12Avg;
  const yoyGrowth = yearAgo > 0 ? (latest.value - yearAgo) / yearAgo : 0.04;
  const overallAverage =
    ordered.reduce((sum, point) => sum + point.value, 0) / Math.max(ordered.length, 1);
  const monthFactors = Array.from({ length: 12 }, (_, month) => {
    const matching = ordered.filter((point) => new Date(point.date).getUTCMonth() === month);
    if (matching.length === 0 || overallAverage === 0) {
      return 1;
    }

    const monthAverage = matching.reduce((sum, point) => sum + point.value, 0) / matching.length;
    return monthAverage / overallAverage;
  });

  return Array.from({ length: months }, (_, index) => {
    const step = index + 1;
    const targetDate = addMonths(lastDate, step);
    const seasonalFactor = monthFactors[targetDate.getUTCMonth()] ?? 1;
    const drift = 1 + (yoyGrowth / 12) * step;
    const smoothedBase = trailing6Avg * 0.65 + trailing12Avg * 0.35;
    const yhat = Math.max(smoothedBase * drift * (0.82 + seasonalFactor * 0.18), 0);
    const bandWidth = yhat * (0.08 + step * 0.0125);
    const outerBandWidth = bandWidth * 1.45;

    return {
      date: targetDate.toISOString().slice(0, 10),
      value: round(yhat),
      lo80: round(Math.max(yhat - bandWidth, 0)),
      hi80: round(yhat + bandWidth),
      lo95: round(Math.max(yhat - outerBandWidth, 0)),
      hi95: round(yhat + outerBandWidth),
      step,
      isPlaceholder: true
    };
  });
}

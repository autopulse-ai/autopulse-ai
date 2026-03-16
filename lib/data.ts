import { unstable_cache } from "next/cache";
import { getPool, isDatabaseConfigured } from "@/lib/db";
import { buildPlaceholderForecast } from "@/lib/forecast";
import type {
  ExploreComparisonSeries,
  ExploreComparisonResponse,
  ExploreFilters,
  ExploreInitialData,
  ExploreSeriesOption,
  MarketSnapshot,
  Metric,
  RankedItem,
  RoadmapPhase,
  SeriesDetail,
  SeriesSummary,
  TimePoint
} from "@/lib/types";

type QuerySeriesRow = {
  series_id: string;
  ts_key: string;
  oem_name: string;
  model_name: string | null;
  drive_type: string;
  aggregation_level: string;
  period_date: string;
  registrations_value: string | number;
};

type SeriesCatalogRow = {
  series_id: string;
  ts_key: string;
  oem_name: string;
  model_name: string | null;
  drive_type: string;
  aggregation_level: string;
  latest_period: string;
  latest_value: string | number;
};

type SnapshotMonthlyRow = {
  period_date: string;
  value: string | number;
};

type SnapshotCountRow = {
  min_period: string;
  series_count: string | number;
  oem_count: string | number;
  drive_type_count: string | number;
};

type SnapshotRankedRow = {
  label: string;
  value: string | number;
};

type SnapshotSpotlightRow = {
  series_id: string;
  ts_key: string;
  oem_name: string;
  model_name: string | null;
  drive_type: string;
  latest_value: string | number;
  previous_year_value: string | number;
  latest_period: string;
};

const EXPLORE_RANGE_OPTIONS = [
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 24 months" },
  { value: "36", label: "Last 36 months" }
] as const;

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatMonth(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function parseNumber(value: string | number) {
  return Number(value);
}

function sortUnique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeCatalogRow(row: SeriesCatalogRow): ExploreSeriesOption {
  return {
    seriesId: row.series_id,
    tsKey: row.ts_key,
    oemName: row.oem_name,
    modelName: row.model_name ?? row.oem_name,
    driveType: row.drive_type,
    aggregationLevel: row.aggregation_level,
    latestPeriod: row.latest_period,
    latestValue: parseNumber(row.latest_value)
  };
}

function applySeriesRange(points: TimePoint[], range: string) {
  if (range === "all") {
    return points.slice(-36);
  }

  const months = Number(range);

  if (!Number.isFinite(months) || months <= 0) {
    return points.slice(-24);
  }

  return points.slice(-months);
}

function buildExploreFilters(options: ExploreSeriesOption[]): ExploreFilters {
  return {
    oems: sortUnique(options.map((option) => option.oemName)),
    models: sortUnique(options.map((option) => option.modelName)),
    driveTypes: sortUnique(options.map((option) => option.driveType)),
    ranges: [...EXPLORE_RANGE_OPTIONS]
  };
}

function filterSeriesOptions(
  options: ExploreSeriesOption[],
  {
    oem,
    model,
    driveType
  }: {
    oem?: string;
    model?: string;
    driveType?: string;
  }
) {
  return options.filter((option) => {
    if (oem && option.oemName !== oem) {
      return false;
    }

    if (model && option.modelName !== model) {
      return false;
    }

    if (driveType && option.driveType !== driveType) {
      return false;
    }

    return true;
  });
}

function buildSelectionMetrics(
  comparedSeries: ExploreComparisonSeries[],
  totalMatchingSeries: number,
  selectedRange: string
): Metric[] {
  const latestTotal = comparedSeries.reduce((sum, series) => sum + (series.points.at(-1)?.value ?? 0), 0);
  const previousYearTotal = comparedSeries.reduce((sum, series) => sum + series.previousYearValue, 0);
  const latestPeriod = comparedSeries
    .map((series) => series.points.at(-1)?.date)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right))
    .at(-1);
  const yoy =
    previousYearTotal > 0 ? (latestTotal - previousYearTotal) / previousYearTotal : undefined;
  const visibleDates = comparedSeries
    .flatMap((series) => series.points.map((point) => point.date))
    .sort((left, right) => left.localeCompare(right));
  const firstDate = visibleDates[0];
  const lastDate = visibleDates.at(-1);

  return [
    {
      label: "Selected basket latest month",
      value: formatNumber(latestTotal),
      change:
        latestPeriod && yoy !== undefined
          ? `${formatMonth(latestPeriod)} vs. PY ${formatPercent(yoy)}`
          : latestPeriod
            ? formatMonth(latestPeriod)
            : "No series selected",
      tone: yoy !== undefined ? (yoy >= 0 ? "positive" : "caution") : "neutral"
    },
    {
      label: "Matching series",
      value: formatNumber(totalMatchingSeries),
      change: `${comparedSeries.length} selected for chart`,
      tone: "neutral"
    },
    {
      label: "Visible history",
      value: selectedRange === "all" ? "All" : `${selectedRange}M`,
      change:
        firstDate && lastDate
          ? `${formatMonth(firstDate)} to ${formatMonth(lastDate)}`
          : "Adjust filters to load series",
      tone: "neutral"
    }
  ];
}

function buildSeriesMetrics(
  latestValue: number,
  previousYearValue: number,
  forecastValues: number[]
): Metric[] {
  const yoy = previousYearValue > 0 ? (latestValue - previousYearValue) / previousYearValue : 0;
  const threeMonth = forecastValues[2] ?? forecastValues.at(-1) ?? latestValue;
  const twelveMonth = forecastValues[11] ?? forecastValues.at(-1) ?? latestValue;

  return [
    {
      label: "Latest actual",
      value: formatNumber(latestValue),
      change: `vs. PY ${formatPercent(yoy)}`,
      tone: yoy >= 0 ? "positive" : "caution"
    },
    {
      label: "3-month placeholder",
      value: formatNumber(threeMonth),
      change: "Synthetic until `ml.fact_forecasts` is populated",
      tone: "neutral"
    },
    {
      label: "12-month placeholder",
      value: formatNumber(twelveMonth),
      change: "Confidence bands are simulated",
      tone: "neutral"
    }
  ];
}

function createSyntheticSeries(label: string, base: number, points: number, growth = 0.035) {
  const start = new Date(Date.UTC(2023, 0, 31));

  return Array.from({ length: points }, (_, index) => {
    const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index + 1, 0));
    const seasonal = 1 + Math.sin((index / 12) * Math.PI * 2) * 0.09;
    const trend = 1 + growth * (index / 12);
    const pulse = index % 5 === 0 ? 1.04 : 0.98;

    return {
      date: target.toISOString().slice(0, 10),
      value: Number((base * seasonal * trend * pulse).toFixed(1)),
      label
    };
  });
}

function buildFallbackSnapshot(): MarketSnapshot {
  const monthlyTotals = createSyntheticSeries("market", 241000, 24).map(({ date, value }) => ({
    date,
    value
  }));
  const latest = monthlyTotals.at(-1)?.value ?? 0;
  const yearAgo = monthlyTotals.at(-13)?.value ?? latest;
  const yoy = yearAgo > 0 ? (latest - yearAgo) / yearAgo : 0;

  return {
    status: "fallback",
    statusMessage: "Showing demo data because the Supabase tables could not be queried yet.",
    latestPeriod: monthlyTotals.at(-1)?.date ?? new Date().toISOString().slice(0, 10),
    heroMetrics: [
      {
        label: "Latest market month",
        value: formatCompact(latest),
        change: `vs. PY ${formatPercent(yoy)}`,
        tone: yoy >= 0 ? "positive" : "caution"
      },
      {
        label: "Active model series",
        value: "4",
        change: "Demo spotlight set",
        tone: "neutral"
      },
      {
        label: "History coverage",
        value: "Jan 2023 to Dec 2024",
        change: "Demo mode",
        tone: "neutral"
      }
    ],
    monthlyTotals,
    topOems: [
      { label: "Volkswagen", value: 187400, detail: "Rolling 12-month total view" },
      { label: "BMW", value: 132900, detail: "Rolling 12-month total view" },
      { label: "Mercedes-Benz", value: 127300, detail: "Rolling 12-month total view" },
      { label: "Audi", value: 116200, detail: "Rolling 12-month total view" },
      { label: "Skoda", value: 95800, detail: "Rolling 12-month total view" },
      { label: "Hyundai", value: 88400, detail: "Rolling 12-month total view" }
    ],
    driveTypeMix: [
      { label: "Total", value: 241000, detail: "Primary reporting series" },
      { label: "Electric_BEV", value: 51200, detail: "Recorded source label" },
      { label: "Hybrid", value: 46300, detail: "Recorded source label" },
      { label: "Petrol", value: 78200, detail: "Recorded source label" },
      { label: "Diesel", value: 29800, detail: "Recorded source label" }
    ],
    seriesSpotlight: [
      {
        seriesId: "fallback-bmw-x1",
        tsKey: "BMW_X1_Total",
        oemName: "BMW",
        modelName: "X1",
        driveType: "Total",
        latestValue: 7540,
        previousYearValue: 6940,
        latestPeriod: monthlyTotals.at(-1)?.date ?? ""
      },
      {
        seriesId: "fallback-vw-golf",
        tsKey: "VOLKSWAGEN_GOLF_Total",
        oemName: "Volkswagen",
        modelName: "Golf",
        driveType: "Total",
        latestValue: 7110,
        previousYearValue: 6955,
        latestPeriod: monthlyTotals.at(-1)?.date ?? ""
      },
      {
        seriesId: "fallback-mb-gla",
        tsKey: "MERCEDES_GLA_Total",
        oemName: "Mercedes-Benz",
        modelName: "GLA",
        driveType: "Total",
        latestValue: 6825,
        previousYearValue: 6440,
        latestPeriod: monthlyTotals.at(-1)?.date ?? ""
      },
      {
        seriesId: "fallback-audi-q4",
        tsKey: "AUDI_Q4_Total",
        oemName: "Audi",
        modelName: "Q4",
        driveType: "Total",
        latestValue: 6610,
        previousYearValue: 5930,
        latestPeriod: monthlyTotals.at(-1)?.date ?? ""
      }
    ]
  };
}

function buildFallbackSeries(tsKey: string): SeriesDetail {
  const actuals = createSyntheticSeries(tsKey, 6200, 24).map(({ date, value }) => ({ date, value }));
  const forecast = buildPlaceholderForecast(actuals);
  const latestValue = actuals.at(-1)?.value ?? 0;
  const previousYearValue = actuals.at(-13)?.value ?? latestValue;
  const [oemName = "AutoPulse", modelName = "Series", driveType = "Total"] = tsKey.split("_");

  return {
    seriesId: "fallback-series",
    status: "fallback",
    statusMessage: "Showing demo history because the live Supabase query was not available.",
    tsKey,
    oemName,
    modelName,
    driveType,
    aggregationLevel: "model_total",
    actuals,
    forecast,
    summaryMetrics: buildSeriesMetrics(
      latestValue,
      previousYearValue,
      forecast.map((point) => point.value)
    )
  };
}

function transformSeries(rows: QuerySeriesRow[]): SeriesDetail {
  const ordered = rows
    .map((row) => ({
      date: row.period_date,
      value: parseNumber(row.registrations_value)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestValue = ordered.at(-1)?.value ?? 0;
  const previousYearValue = ordered.at(-13)?.value ?? latestValue;
  const forecast = buildPlaceholderForecast(ordered);
  const header = rows[0];

  return {
    seriesId: header.series_id,
    status: "live",
    statusMessage: "Historical registrations are live from Supabase. Forecasts are placeholders.",
    tsKey: header.ts_key,
    oemName: header.oem_name,
    modelName: header.model_name ?? header.oem_name,
    driveType: header.drive_type,
    aggregationLevel: header.aggregation_level,
    actuals: ordered,
    forecast,
    summaryMetrics: buildSeriesMetrics(
      latestValue,
      previousYearValue,
      forecast.map((point) => point.value)
    )
  };
}

function buildSnapshotFromSeries(allSeriesRows: QuerySeriesRow[]): MarketSnapshot {
  const marketSeries = allSeriesRows
    .filter((row) => row.drive_type === "Total")
    .reduce<Map<string, number>>((accumulator, row) => {
      const value = accumulator.get(row.period_date) ?? 0;
      accumulator.set(row.period_date, value + parseNumber(row.registrations_value));
      return accumulator;
    }, new Map<string, number>());

  const monthlyTotals: TimePoint[] = [...marketSeries.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24)
    .map(([date, value]) => ({ date, value }));

  const latestPeriod = monthlyTotals.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const latestValue = monthlyTotals.at(-1)?.value ?? 0;
  const yearAgoValue = monthlyTotals.at(-13)?.value ?? latestValue;
  const yoy = yearAgoValue > 0 ? (latestValue - yearAgoValue) / yearAgoValue : 0;

  const latestPeriodRows = allSeriesRows.filter(
    (row) => row.period_date === latestPeriod && row.drive_type === "Total"
  );
  const previousYearRows = new Map(
    allSeriesRows
      .filter((row) => row.period_date === monthlyTotals.at(-13)?.date && row.drive_type === "Total")
      .map((row) => [row.series_id, parseNumber(row.registrations_value)])
  );

  const topOemMap = latestPeriodRows.reduce<Map<string, number>>((accumulator, row) => {
    const value = accumulator.get(row.oem_name) ?? 0;
    accumulator.set(row.oem_name, value + parseNumber(row.registrations_value));
    return accumulator;
  }, new Map<string, number>());

  const driveTypeMap = allSeriesRows
    .filter((row) => row.period_date === latestPeriod)
    .reduce<Map<string, number>>((accumulator, row) => {
      const value = accumulator.get(row.drive_type) ?? 0;
      accumulator.set(row.drive_type, value + parseNumber(row.registrations_value));
      return accumulator;
    }, new Map<string, number>());

  const seriesSpotlight: SeriesSummary[] = latestPeriodRows
    .map((row) => ({
      seriesId: row.series_id,
      tsKey: row.ts_key,
      oemName: row.oem_name,
      modelName: row.model_name ?? row.oem_name,
      driveType: row.drive_type,
      latestValue: parseNumber(row.registrations_value),
      previousYearValue: previousYearRows.get(row.series_id) ?? 0,
      latestPeriod
    }))
    .sort((a, b) => b.latestValue - a.latestValue)
    .slice(0, 8);

  const topOems: RankedItem[] = [...topOemMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({
      label,
      value,
      detail: `Latest month ${formatMonth(latestPeriod)}`
    }));

  const driveTypeMix: RankedItem[] = [...driveTypeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({
      label,
      value,
      detail: "Source label from KBA-derived dataset"
    }));

  return {
    status: "live",
    statusMessage: "Historical registrations are loaded from Supabase. Forecast cards use placeholders for now.",
    latestPeriod,
    heroMetrics: [
      {
        label: "Latest market month",
        value: formatCompact(latestValue),
        change: `vs. PY ${formatPercent(yoy)}`,
        tone: yoy >= 0 ? "positive" : "caution"
      },
      {
        label: "Active model series",
        value: formatNumber(new Set(allSeriesRows.map((row) => row.ts_key)).size),
        change: `${formatNumber(new Set(allSeriesRows.map((row) => row.oem_name)).size)} OEMs tracked`,
        tone: "neutral"
      },
      {
        label: "History coverage",
        value: `${formatMonth(allSeriesRows[0]?.period_date ?? latestPeriod)} to ${formatMonth(latestPeriod)}`,
        change: `${formatNumber(new Set(allSeriesRows.map((row) => row.drive_type)).size)} drive-type labels in source`,
        tone: "neutral"
      }
    ],
    monthlyTotals,
    topOems,
    driveTypeMix,
    seriesSpotlight
  };
}

function buildSeriesDetailFromRows(allSeriesRows: QuerySeriesRow[], tsKey: string): SeriesDetail | null {
  const matchingRows = allSeriesRows.filter((row) => row.ts_key === tsKey);

  if (matchingRows.length === 0) {
    return null;
  }

  return transformSeries(matchingRows);
}

async function loadHistoricalRows() {
  if (!isDatabaseConfigured()) {
    throw new Error("Database credentials missing.");
  }

  const pool = getPool();
  const result = await pool.query<QuerySeriesRow>(
    `
      SELECT
        ds.id::text AS series_id,
        ds.ts_key,
        o.oem_name,
        m.model_name,
        dt.display_name AS drive_type,
        ds.aggregation_level,
        fr.period_date::text,
        fr.registrations_value
      FROM core.fact_registrations fr
      JOIN core.dim_series ds ON ds.id = fr.series_id
      JOIN core.dim_oem o ON o.id = ds.oem_id
      LEFT JOIN core.dim_model m ON m.id = ds.model_id
      JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
      WHERE ds.model_id IS NOT NULL
      ORDER BY fr.period_date ASC
    `
  );

  return result.rows;
}

async function loadLiveMarketSnapshot(): Promise<MarketSnapshot> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database credentials missing.");
  }

  const pool = getPool();
  const [monthlyResult, countResult, topOemsResult, driveTypeResult, spotlightResult] =
    await Promise.all([
      pool.query<SnapshotMonthlyRow>(
        `
          WITH latest_period AS (
            SELECT MAX(fr.period_date) AS latest_period
            FROM core.fact_registrations fr
            JOIN core.dim_series ds ON ds.id = fr.series_id
            WHERE ds.model_id IS NOT NULL
          ),
          cutoff AS (
            SELECT
              latest_period,
              (latest_period - INTERVAL '23 months')::date AS min_period
            FROM latest_period
          )
          SELECT
            fr.period_date::text AS period_date,
            SUM(fr.registrations_value)::float8 AS value
          FROM core.fact_registrations fr
          JOIN core.dim_series ds ON ds.id = fr.series_id
          JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
          JOIN cutoff c ON fr.period_date BETWEEN c.min_period AND c.latest_period
          WHERE ds.model_id IS NOT NULL
            AND dt.display_name = 'Total'
          GROUP BY fr.period_date
          ORDER BY fr.period_date ASC
        `
      ),
      pool.query<SnapshotCountRow>(
        `
          SELECT
            MIN(fr.period_date)::text AS min_period,
            COUNT(DISTINCT ds.ts_key)::int AS series_count,
            COUNT(DISTINCT o.id)::int AS oem_count,
            COUNT(DISTINCT dt.display_name)::int AS drive_type_count
          FROM core.fact_registrations fr
          JOIN core.dim_series ds ON ds.id = fr.series_id
          JOIN core.dim_oem o ON o.id = ds.oem_id
          JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
          WHERE ds.model_id IS NOT NULL
        `
      ),
      pool.query<SnapshotRankedRow>(
        `
          WITH latest_period AS (
            SELECT MAX(fr.period_date) AS latest_period
            FROM core.fact_registrations fr
            JOIN core.dim_series ds ON ds.id = fr.series_id
            WHERE ds.model_id IS NOT NULL
          )
          SELECT
            o.oem_name AS label,
            SUM(fr.registrations_value)::float8 AS value
          FROM core.fact_registrations fr
          JOIN core.dim_series ds ON ds.id = fr.series_id
          JOIN core.dim_oem o ON o.id = ds.oem_id
          JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
          JOIN latest_period lp ON fr.period_date = lp.latest_period
          WHERE ds.model_id IS NOT NULL
            AND dt.display_name = 'Total'
          GROUP BY o.oem_name
          ORDER BY value DESC
          LIMIT 6
        `
      ),
      pool.query<SnapshotRankedRow>(
        `
          WITH latest_period AS (
            SELECT MAX(fr.period_date) AS latest_period
            FROM core.fact_registrations fr
            JOIN core.dim_series ds ON ds.id = fr.series_id
            WHERE ds.model_id IS NOT NULL
          )
          SELECT
            dt.display_name AS label,
            SUM(fr.registrations_value)::float8 AS value
          FROM core.fact_registrations fr
          JOIN core.dim_series ds ON ds.id = fr.series_id
          JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
          JOIN latest_period lp ON fr.period_date = lp.latest_period
          WHERE ds.model_id IS NOT NULL
          GROUP BY dt.display_name
          ORDER BY value DESC
          LIMIT 6
        `
      ),
      pool.query<SnapshotSpotlightRow>(
        `
          WITH latest_period AS (
            SELECT MAX(fr.period_date) AS latest_period
            FROM core.fact_registrations fr
            JOIN core.dim_series ds ON ds.id = fr.series_id
            WHERE ds.model_id IS NOT NULL
          ),
          previous_period AS (
            SELECT
              latest_period,
              (latest_period - INTERVAL '12 months')::date AS previous_period
            FROM latest_period
          )
          SELECT
            ds.id::text AS series_id,
            ds.ts_key,
            o.oem_name,
            m.model_name,
            dt.display_name AS drive_type,
            latest.registrations_value AS latest_value,
            COALESCE(previous.registrations_value, 0) AS previous_year_value,
            lp.latest_period::text AS latest_period
          FROM latest_period lp
          JOIN core.fact_registrations latest ON latest.period_date = lp.latest_period
          JOIN core.dim_series ds ON ds.id = latest.series_id
          JOIN core.dim_oem o ON o.id = ds.oem_id
          LEFT JOIN core.dim_model m ON m.id = ds.model_id
          JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
          LEFT JOIN previous_period pp ON true
          LEFT JOIN core.fact_registrations previous
            ON previous.series_id = latest.series_id
           AND previous.period_date = pp.previous_period
          WHERE ds.model_id IS NOT NULL
            AND dt.display_name = 'Total'
          ORDER BY latest.registrations_value DESC
          LIMIT 8
        `
      )
    ]);

  const monthlyTotals: TimePoint[] = monthlyResult.rows.map((row) => ({
    date: row.period_date,
    value: parseNumber(row.value)
  }));
  const latestPeriod = monthlyTotals.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const latestValue = monthlyTotals.at(-1)?.value ?? 0;
  const yearAgoValue = monthlyTotals.at(-13)?.value ?? latestValue;
  const yoy = yearAgoValue > 0 ? (latestValue - yearAgoValue) / yearAgoValue : 0;
  const counts = countResult.rows[0];

  return {
    status: "live",
    statusMessage: "Historical registrations are loaded from Supabase. Forecast cards use placeholders for now.",
    latestPeriod,
    heroMetrics: [
      {
        label: "Latest market month",
        value: formatCompact(latestValue),
        change: `vs. PY ${formatPercent(yoy)}`,
        tone: yoy >= 0 ? "positive" : "caution"
      },
      {
        label: "Active model series",
        value: formatNumber(parseNumber(counts?.series_count ?? 0)),
        change: `${formatNumber(parseNumber(counts?.oem_count ?? 0))} OEMs tracked`,
        tone: "neutral"
      },
      {
        label: "History coverage",
        value: `${formatMonth(counts?.min_period ?? latestPeriod)} to ${formatMonth(latestPeriod)}`,
        change: `${formatNumber(parseNumber(counts?.drive_type_count ?? 0))} drive-type labels in source`,
        tone: "neutral"
      }
    ],
    monthlyTotals,
    topOems: topOemsResult.rows.map((row) => ({
      label: row.label,
      value: parseNumber(row.value),
      detail: `Latest month ${formatMonth(latestPeriod)}`
    })),
    driveTypeMix: driveTypeResult.rows.map((row) => ({
      label: row.label,
      value: parseNumber(row.value),
      detail: "Source label from KBA-derived dataset"
    })),
    seriesSpotlight: spotlightResult.rows.map((row) => ({
      seriesId: row.series_id,
      tsKey: row.ts_key,
      oemName: row.oem_name,
      modelName: row.model_name ?? row.oem_name,
      driveType: row.drive_type,
      latestValue: parseNumber(row.latest_value),
      previousYearValue: parseNumber(row.previous_year_value),
      latestPeriod: row.latest_period
    }))
  };
}

const loadLiveMarketSnapshotCached = unstable_cache(loadLiveMarketSnapshot, ["market-snapshot"], {
  revalidate: 300
});

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  try {
    return await loadLiveMarketSnapshotCached();
  } catch {
    return buildFallbackSnapshot();
  }
}

export async function getHomePageData(): Promise<{
  snapshot: MarketSnapshot;
  featuredSeries: SeriesDetail | null;
}> {
  const snapshot = await getMarketSnapshot();
  const featuredSeriesKey = snapshot.seriesSpotlight[0]?.tsKey ?? "BMW_X1_Total";

  try {
    return {
      snapshot,
      featuredSeries: await getSeriesDetail(featuredSeriesKey)
    };
  } catch {
    return {
      snapshot,
      featuredSeries: buildFallbackSeries(featuredSeriesKey)
    };
  }
}

export async function getSeriesDetail(tsKey: string): Promise<SeriesDetail | null> {
  try {
    if (!isDatabaseConfigured()) {
      return buildFallbackSeries(tsKey);
    }

    const pool = getPool();
    const result = await pool.query<QuerySeriesRow>(
      `
        SELECT
          ds.id::text AS series_id,
          ds.ts_key,
          o.oem_name,
          m.model_name,
          dt.display_name AS drive_type,
          ds.aggregation_level,
          fr.period_date::text,
          fr.registrations_value
        FROM core.fact_registrations fr
        JOIN core.dim_series ds ON ds.id = fr.series_id
        JOIN core.dim_oem o ON o.id = ds.oem_id
        LEFT JOIN core.dim_model m ON m.id = ds.model_id
        JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
        WHERE ds.ts_key = $1
        ORDER BY fr.period_date ASC
      `,
      [tsKey]
    );

    if (result.rows.length === 0) {
      return buildFallbackSeries(tsKey);
    }

    return transformSeries(result.rows);
  } catch {
    return buildFallbackSeries(tsKey);
  }
}

export async function getExploreSeriesCatalog(): Promise<ExploreSeriesOption[]> {
  try {
    if (!isDatabaseConfigured()) {
      return [];
    }

    const pool = getPool();
    const result = await pool.query<SeriesCatalogRow>(
      `
        WITH latest_period AS (
          SELECT MAX(fr.period_date) AS latest_period
          FROM core.fact_registrations fr
          JOIN core.dim_series ds ON ds.id = fr.series_id
          WHERE ds.model_id IS NOT NULL
        ),
        cutoff AS (
          SELECT
            latest_period,
            (latest_period - INTERVAL '35 months')::date AS min_period
          FROM latest_period
        ),
        top_oems AS (
          SELECT ds.oem_id
          FROM core.fact_registrations fr
          JOIN core.dim_series ds ON ds.id = fr.series_id
          JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
          JOIN latest_period lp ON fr.period_date = lp.latest_period
          WHERE ds.model_id IS NOT NULL
            AND dt.display_name = 'Total'
          GROUP BY ds.oem_id
          ORDER BY SUM(fr.registrations_value) DESC
          LIMIT 5
        ),
        latest_fact AS (
          SELECT DISTINCT ON (fr.series_id)
            fr.series_id,
            fr.period_date,
            fr.registrations_value
          FROM core.fact_registrations fr
          JOIN cutoff c ON fr.period_date BETWEEN c.min_period AND c.latest_period
          ORDER BY fr.series_id, fr.period_date DESC
        )
        SELECT
          ds.id::text AS series_id,
          ds.ts_key,
          o.oem_name,
          m.model_name,
          dt.display_name AS drive_type,
          ds.aggregation_level,
          lf.period_date::text AS latest_period,
          lf.registrations_value AS latest_value
        FROM core.dim_series ds
        JOIN top_oems top ON top.oem_id = ds.oem_id
        JOIN core.dim_oem o ON o.id = ds.oem_id
        LEFT JOIN core.dim_model m ON m.id = ds.model_id
        JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
        JOIN latest_fact lf ON lf.series_id = ds.id
        WHERE ds.model_id IS NOT NULL
        ORDER BY lf.registrations_value DESC, ds.ts_key ASC
      `
    );

    return result.rows.map(normalizeCatalogRow);
  } catch {
    return [];
  }
}

function getFallbackExploreCatalog(): ExploreSeriesOption[] {
  return buildFallbackSnapshot().seriesSpotlight.map((series) => ({
    seriesId: series.seriesId,
    tsKey: series.tsKey,
    oemName: series.oemName,
    modelName: series.modelName,
    driveType: series.driveType,
    aggregationLevel: "model_total",
    latestPeriod: series.latestPeriod,
    latestValue: series.latestValue
  }));
}

function isPreferredOem(option: ExploreSeriesOption, preferredLabel: string) {
  const normalizedOem = option.oemName.toLowerCase();
  const normalizedLabel = preferredLabel.toLowerCase();

  if (normalizedLabel === "vw") {
    return normalizedOem.includes("volkswagen") || normalizedOem === "vw";
  }

  return normalizedOem.includes(normalizedLabel);
}

function findDefaultExploreSeriesIds(catalog: ExploreSeriesOption[]) {
  const preferredLabels = ["Mercedes", "BMW", "VW"];
  const selected = new Set<string>();

  for (const preferredLabel of preferredLabels) {
    const preferred = catalog
      .filter((option) => isPreferredOem(option, preferredLabel))
      .sort((left, right) => {
        const totalBias = Number(right.driveType === "Total") - Number(left.driveType === "Total");
        if (totalBias !== 0) {
          return totalBias;
        }

        return right.latestValue - left.latestValue;
      })[0];

    if (preferred) {
      selected.add(preferred.seriesId);
    }
  }

  for (const option of catalog) {
    if (selected.size >= 3) {
      break;
    }

    selected.add(option.seriesId);
  }

  return [...selected].slice(0, 3);
}

async function loadExploreSeriesRows(selectedSeriesIds: string[]) {
  const pool = getPool();
  const result = await pool.query<QuerySeriesRow>(
    `
      WITH latest_period AS (
        SELECT MAX(fr.period_date) AS latest_period
        FROM core.fact_registrations fr
        JOIN core.dim_series ds ON ds.id = fr.series_id
        WHERE ds.model_id IS NOT NULL
      ),
      cutoff AS (
        SELECT
          latest_period,
          (latest_period - INTERVAL '35 months')::date AS min_period
        FROM latest_period
      )
      SELECT
        ds.id::text AS series_id,
        ds.ts_key,
        o.oem_name,
        m.model_name,
        dt.display_name AS drive_type,
        ds.aggregation_level,
        fr.period_date::text,
        fr.registrations_value
      FROM core.fact_registrations fr
      JOIN core.dim_series ds ON ds.id = fr.series_id
      JOIN core.dim_oem o ON o.id = ds.oem_id
      LEFT JOIN core.dim_model m ON m.id = ds.model_id
      JOIN core.dim_drive_type dt ON dt.id = ds.drive_type_id
      JOIN cutoff c ON fr.period_date BETWEEN c.min_period AND c.latest_period
      WHERE ds.id = ANY($1::uuid[])
      ORDER BY fr.period_date ASC
    `,
    [selectedSeriesIds]
  );

  return result.rows;
}

function buildComparisonSeries(
  catalog: ExploreSeriesOption[],
  rows: QuerySeriesRow[],
  selectedSeriesIds: string[],
  range: string
) {
  const metadataBySeriesId = new Map(catalog.map((series) => [series.seriesId, series]));
  const grouped = rows.reduce<Map<string, TimePoint[]>>((accumulator, row) => {
    const points = accumulator.get(row.series_id) ?? [];
    points.push({
      date: row.period_date,
      value: parseNumber(row.registrations_value)
    });
    accumulator.set(row.series_id, points);
    return accumulator;
  }, new Map<string, TimePoint[]>());

  return selectedSeriesIds
    .map((seriesId) => {
      const points = grouped.get(seriesId) ?? [];
      const metadata = metadataBySeriesId.get(seriesId);

      if (!metadata || points.length === 0) {
        return null;
      }

      return {
        seriesId,
        tsKey: metadata.tsKey,
        oemName: metadata.oemName,
        modelName: metadata.modelName,
        driveType: metadata.driveType,
        label: `${metadata.oemName} ${metadata.modelName} · ${metadata.driveType}`,
        latestValue: points.at(-1)?.value ?? 0,
        previousYearValue: points.at(-13)?.value ?? points.at(-1)?.value ?? 0,
        points: applySeriesRange(points, range)
      };
    })
    .filter((series): series is ExploreComparisonSeries => Boolean(series));
}

function buildFallbackComparisonResponse(
  selectedSeriesIds: string[],
  range: string
): ExploreComparisonResponse {
  const catalog = getFallbackExploreCatalog();
  const effectiveSelectedIds =
    selectedSeriesIds.length > 0 ? selectedSeriesIds.slice(0, 3) : findDefaultExploreSeriesIds(catalog);
  const comparedSeries = effectiveSelectedIds
    .map((seriesId) => {
      const metadata = catalog.find((option) => option.seriesId === seriesId);

      if (!metadata) {
        return null;
      }

      const points = applySeriesRange(
        createSyntheticSeries(metadata.tsKey, metadata.latestValue * 0.86, 36).map(({ date, value }) => ({
          date,
          value
        })),
        range
      );

      return {
        seriesId: metadata.seriesId,
        tsKey: metadata.tsKey,
        oemName: metadata.oemName,
        modelName: metadata.modelName,
        driveType: metadata.driveType,
        label: `${metadata.oemName} ${metadata.modelName} · ${metadata.driveType}`,
        latestValue: points.at(-1)?.value ?? metadata.latestValue,
        previousYearValue: points.at(-13)?.value ?? points.at(-1)?.value ?? metadata.latestValue,
        points
      };
    })
    .filter((series): series is ExploreComparisonSeries => Boolean(series));

  return {
    comparedSeries,
    heroMetrics: buildSelectionMetrics(comparedSeries, catalog.length, range),
    selectedIds: effectiveSelectedIds,
    totalMatchingSeries: catalog.length
  };
}

export async function getExploreComparisonData({
  selectedSeriesIds,
  range,
  catalog
}: {
  selectedSeriesIds: string[];
  range: string;
  catalog?: ExploreSeriesOption[];
}): Promise<ExploreComparisonResponse> {
  const catalogData = catalog && catalog.length > 0 ? catalog : await getExploreSeriesCatalog();
  const effectiveSelectedIds = (selectedSeriesIds.length > 0
    ? selectedSeriesIds
    : findDefaultExploreSeriesIds(catalogData)
  )
    .filter((seriesId, index, source) => source.indexOf(seriesId) === index)
    .slice(0, 3);

  if (!isDatabaseConfigured() || catalogData.length === 0) {
    return buildFallbackComparisonResponse(effectiveSelectedIds, range);
  }

  try {
    const rows = await loadExploreSeriesRows(effectiveSelectedIds);
    const comparedSeries = buildComparisonSeries(catalogData, rows, effectiveSelectedIds, range);

    return {
      comparedSeries,
      heroMetrics: buildSelectionMetrics(comparedSeries, catalogData.length, range),
      selectedIds: effectiveSelectedIds,
      totalMatchingSeries: catalogData.length
    };
  } catch {
    return buildFallbackComparisonResponse(effectiveSelectedIds, range);
  }
}

export async function getExploreInitialData(): Promise<ExploreInitialData> {
  const liveCatalog = await getExploreSeriesCatalog();
  const catalog = liveCatalog.length > 0 ? liveCatalog : getFallbackExploreCatalog();
  const defaults = findDefaultExploreSeriesIds(catalog);
  const comparison = await getExploreComparisonData({
    selectedSeriesIds: defaults,
    range: "24",
    catalog
  });

  return {
    ...comparison,
    filters: buildExploreFilters(catalog),
    catalog
  };
}

export function getRoadmapPhases(): RoadmapPhase[] {
  return [
    {
      phase: "Phase 1",
      timing: "Now",
      headline: "Public-facing credibility MVP",
      items: [
        "Launch landing page with live historical charts and clear value messaging.",
        "Add deeper market dashboard pages for OEM, model, and drive-type exploration.",
        "Expose placeholder forecasts so the UX is ready before live ML outputs arrive."
      ]
    },
    {
      phase: "Phase 2",
      timing: "Next",
      headline: "Monetizable dashboard core",
      items: [
        "Replace placeholders with `ml.fact_forecasts` and confidence intervals.",
        "Add subscription gates, authentication, and export-ready CSV downloads.",
        "Introduce saved filters for 3, 6, and 12 month views across OEM and model pages."
      ]
    },
    {
      phase: "Phase 3",
      timing: "After",
      headline: "API and workflow productization",
      items: [
        "Publish an authenticated Forecast API for model, OEM, horizon, and scenario endpoints.",
        "Add methodology pages, forecast metadata, and run traceability from `ml_run` tables.",
        "Create alerts and newsletter digests around material forecast moves."
      ]
    },
    {
      phase: "Phase 4",
      timing: "Differentiation",
      headline: "AI narratives and scenario intelligence",
      items: [
        "Connect news and exogenous features to explain forecast changes.",
        "Generate optimistic, neutral, and pessimistic narratives per series.",
        "Ship collaboration features: report snapshots, share links, and client-ready exports."
      ]
    }
  ];
}

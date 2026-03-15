export type TimePoint = {
  date: string;
  value: number;
};

export type SeriesPoint = TimePoint & {
  seriesId: string;
};

export type ForecastPoint = TimePoint & {
  lo80: number;
  hi80: number;
  lo95: number;
  hi95: number;
  step: number;
  isPlaceholder: true;
};

export type Metric = {
  label: string;
  value: string;
  change?: string;
  tone?: "positive" | "neutral" | "caution";
};

export type RankedItem = {
  label: string;
  value: number;
  detail?: string;
};

export type SeriesSummary = {
  seriesId: string;
  tsKey: string;
  oemName: string;
  modelName: string;
  driveType: string;
  latestValue: number;
  previousYearValue: number;
  latestPeriod: string;
};

export type MarketSnapshot = {
  status: "live" | "fallback";
  statusMessage: string;
  latestPeriod: string;
  heroMetrics: Metric[];
  monthlyTotals: TimePoint[];
  topOems: RankedItem[];
  driveTypeMix: RankedItem[];
  seriesSpotlight: SeriesSummary[];
};

export type SeriesDetail = {
  seriesId: string;
  status: "live" | "fallback";
  statusMessage: string;
  tsKey: string;
  oemName: string;
  modelName: string;
  driveType: string;
  aggregationLevel: string;
  actuals: TimePoint[];
  forecast: ForecastPoint[];
  summaryMetrics: Metric[];
};

export type ExploreSeriesOption = {
  seriesId: string;
  tsKey: string;
  oemName: string;
  modelName: string;
  driveType: string;
  aggregationLevel: string;
  latestPeriod: string;
  latestValue: number;
};

export type ExploreComparisonSeries = {
  seriesId: string;
  tsKey: string;
  oemName: string;
  modelName: string;
  driveType: string;
  label: string;
  latestValue: number;
  previousYearValue: number;
  points: TimePoint[];
};

export type ExploreFilters = {
  oems: string[];
  models: string[];
  driveTypes: string[];
  ranges: Array<{
    value: string;
    label: string;
  }>;
};

export type ExploreComparisonResponse = {
  comparedSeries: ExploreComparisonSeries[];
  heroMetrics: Metric[];
  selectedIds: string[];
  totalMatchingSeries: number;
};

export type ExploreInitialData = ExploreComparisonResponse & {
  filters: ExploreFilters;
  catalog: ExploreSeriesOption[];
};

export type RoadmapPhase = {
  phase: string;
  timing: string;
  headline: string;
  items: string[];
};

import type { ForecastPoint, TimePoint } from "@/lib/types";

function describeLine(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function projectSeries(values: number[], width: number, height: number, padding: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return values.map((value, index) => {
    const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });
}

function buildBandPath(
  forecast: ForecastPoint[],
  band: "80" | "95",
  width: number,
  height: number,
  padding: number,
  allValues: number[]
) {
  if (forecast.length === 0) {
    return "";
  }

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(max - min, 1);
  const totalPoints = forecast.length;
  const projectY = (value: number) =>
    height - padding - ((value - min) / range) * (height - padding * 2);

  const upper = forecast.map((point, index) => {
    const x = padding + (index / Math.max(totalPoints - 1, 1)) * (width - padding * 2);
    const y = projectY(band === "80" ? point.hi80 : point.hi95);
    return { x, y };
  });
  const lower = [...forecast]
    .reverse()
    .map((point, reverseIndex) => {
      const index = totalPoints - reverseIndex - 1;
      const x = padding + (index / Math.max(totalPoints - 1, 1)) * (width - padding * 2);
      const y = projectY(band === "80" ? point.lo80 : point.lo95);
      return { x, y };
    });

  return `${describeLine(upper)} ${lower.map((point) => `L ${point.x} ${point.y}`).join(" ")} Z`;
}

function sortDates(values: string[]) {
  return values.sort((left, right) => left.localeCompare(right));
}

export function TrendChart({
  actuals,
  forecast,
  label
}: {
  actuals: TimePoint[];
  forecast?: ForecastPoint[];
  label: string;
}) {
  const width = 720;
  const height = 320;
  const padding = 24;
  const actualValues = actuals.map((point) => point.value);
  const forecastValues = forecast?.map((point) => point.value) ?? [];
  const allValues = [...actualValues, ...forecastValues];
  const actualCoords = projectSeries(actualValues, width, height, padding);
  const forecastCoords = projectSeries(forecastValues, width, height, padding);
  const actualPath = describeLine(actualCoords);
  const forecastPath =
    forecastCoords.length > 0
      ? describeLine([
          actualCoords.at(-1) ?? { x: padding, y: height - padding },
          ...forecastCoords
        ])
      : "";
  const band95 = forecast ? buildBandPath(forecast, "95", width, height, padding, allValues) : "";
  const band80 = forecast ? buildBandPath(forecast, "80", width, height, padding, allValues) : "";

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-fill-actual-strong)" />
            <stop offset="100%" stopColor="var(--chart-fill-actual-soft)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="28" fill="transparent" />
        {[0.2, 0.4, 0.6, 0.8].map((tick) => (
          <line
            key={tick}
            x1={padding}
            y1={height * tick}
            x2={width - padding}
            y2={height * tick}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="5 8"
          />
        ))}
        {band95 ? <path d={band95} fill="var(--chart-band-95)" /> : null}
        {band80 ? <path d={band80} fill="var(--chart-band-80)" /> : null}
        {actualPath ? (
          <path
            d={`${actualPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`}
            fill="url(#actualGradient)"
            opacity="0.65"
          />
        ) : null}
        <path
          d={actualPath}
          fill="none"
          stroke="var(--chart-line-actual)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {forecastPath ? (
          <path
            d={forecastPath}
            fill="none"
            stroke="var(--chart-line-forecast)"
            strokeWidth="4"
            strokeDasharray="8 8"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="chart-key">
        <span>
          <i className="actual-dot" />
          Actual registrations
        </span>
        {forecast ? (
          <span>
            <i className="forecast-dot" />
            Placeholder forecast
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MultiSeriesTrendChart({
  series,
  label
}: {
  series: Array<{
    seriesId: string;
    label: string;
    points: TimePoint[];
  }>;
  label: string;
}) {
  const width = 860;
  const height = 360;
  const padding = 28;
  const palette = [
    "var(--chart-line-actual)",
    "var(--chart-line-forecast)",
    "var(--chart-line-third)"
  ];
  const allPoints = series.flatMap((item) => item.points);

  if (allPoints.length === 0) {
    return (
      <div className="empty-state">
        <p>No historical rows match the current filter set.</p>
      </div>
    );
  }

  const dates = sortDates([...new Set(allPoints.map((point) => point.date))]);
  const minValue = Math.min(...allPoints.map((point) => point.value));
  const maxValue = Math.max(...allPoints.map((point) => point.value));
  const range = Math.max(maxValue - minValue, 1);
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const projectedSeries = series.map((item, index) => {
    const sortedPoints = [...item.points].sort((left, right) => left.date.localeCompare(right.date));
    const coords = sortedPoints.map((point) => {
      const position = dateIndex.get(point.date) ?? 0;
      const x = padding + (position / Math.max(dates.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - minValue) / range) * (height - padding * 2);
      return { x, y };
    });

    return {
      seriesId: item.seriesId,
      label: item.label,
      color: palette[index % palette.length],
      path: describeLine(coords)
    };
  });

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <rect x="0" y="0" width={width} height={height} rx="28" fill="transparent" />
        {[0.2, 0.4, 0.6, 0.8].map((tick) => (
          <line
            key={tick}
            x1={padding}
            y1={height * tick}
            x2={width - padding}
            y2={height * tick}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="5 8"
          />
        ))}
        {projectedSeries.map((item) => (
          <path
            key={item.seriesId}
            d={item.path}
            fill="none"
            stroke={item.color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="chart-key multi">
        {projectedSeries.map((item) => (
          <span key={item.seriesId}>
            <i className="legend-swatch" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

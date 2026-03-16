import Link from "next/link";
import type { Metric, RankedItem, RoadmapPhase, SeriesSummary } from "@/lib/types";

function toneClass(tone?: Metric["tone"]) {
  if (tone === "positive") {
    return "metric-change positive";
  }

  if (tone === "caution") {
    return "metric-change caution";
  }

  return "metric-change";
}

export function HeroMetricGrid({ items }: { items: Metric[] }) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <article className="metric-card" key={item.label}>
          <p className="metric-label">{item.label}</p>
          <h3 className="metric-value">{item.value}</h3>
          {item.change ? (
            <p className={toneClass(item.tone)}>
              {item.tone === "positive" ? "↑ " : item.tone === "caution" ? "↓ " : ""}
              {item.change}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  description
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{kicker}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function RankedList({
  title,
  subtitle,
  items
}: {
  title: string;
  subtitle: string;
  items: RankedItem[];
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <article className="panel ranked-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="ranked-list">
        {items.map((item) => (
          <div className="ranked-row" key={item.label}>
            <div className="ranked-copy">
              <div>
                <strong>{item.label}</strong>
                {item.detail ? <span>{item.detail}</span> : null}
              </div>
              <b>{new Intl.NumberFormat("en-US").format(item.value)}</b>
            </div>
            <div className="ranked-bar-track">
              <div
                className="ranked-bar-fill"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function SpotlightTable({ items }: { items: SeriesSummary[] }) {
  return (
    <article className="panel spotlight-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Series spotlight</p>
          <h3>High-volume tracked model series</h3>
        </div>
        <Link href="/explore" className="text-link">
          Open dashboard
        </Link>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Series</th>
              <th>Drive type</th>
              <th>Latest month</th>
              <th>vs. previous year</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const yoy =
                item.previousYearValue > 0
                  ? ((item.latestValue - item.previousYearValue) / item.previousYearValue) * 100
                  : 0;

              return (
                <tr key={item.tsKey}>
                  <td>
                    <Link href={`/series/${encodeURIComponent(item.tsKey)}`} className="series-link">
                      <span>{item.oemName}</span>
                      <strong>{item.modelName}</strong>
                    </Link>
                  </td>
                  <td>{item.driveType}</td>
                  <td>{new Intl.NumberFormat("en-US").format(item.latestValue)}</td>
                  <td className={yoy >= 0 ? "positive" : "caution"}>
                    {yoy >= 0 ? "+" : ""}
                    {yoy.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function PillarGrid() {
  const pillars = [
    {
      title: "Forecast dashboards",
      copy: "3, 6, and 12 month views built for fast interpretation instead of BI-style clutter."
    },
    {
      title: "CSV and API delivery",
      copy: "The product model stays export-first so analysts can drop forecasts straight into workflows."
    },
    {
      title: "News-linked context",
      copy: "The UX is prepared for explanatory news and exogenous signals to sit next to every forecast."
    },
    {
      title: "Scenario agent",
      copy: "Optimistic, neutral, and pessimistic narratives become a thin layer over forecast runs later."
    }
  ];

  return (
    <div className="pillar-grid">
      {pillars.map((pillar) => (
        <article className="panel feature-card" key={pillar.title}>
          <p className="eyebrow">Platform pillar</p>
          <h3>{pillar.title}</h3>
          <p>{pillar.copy}</p>
        </article>
      ))}
    </div>
  );
}

export function MarketTicker({
  items
}: {
  items: Array<{
    label: string;
    value: number;
    change: number;
  }>;
}) {
  const loop = [...items, ...items];

  return (
    <div className="market-ticker panel">
      <div className="market-ticker-track">
        {loop.map((item, index) => (
          <div className="ticker-item" key={`${item.label}-${index}`}>
            <span className="ticker-label">{item.label}</span>
            <strong>{new Intl.NumberFormat("en-US").format(item.value)}</strong>
            <b className={item.change >= 0 ? "positive" : "caution"}>
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(1)}%
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapabilitiesGrid() {
  const capabilities = [
    {
      title: "Market Monitoring",
      copy: "Track vehicle registrations across OEMs and models with a live market-wide view.",
      glyph: "M"
    },
    {
      title: "AI Forecasts",
      copy: "Prepare the interface for 3-, 6-, and 12-month forecast workflows and confidence bands.",
      glyph: "AI"
    },
    {
      title: "Model-Level Insights",
      copy: "Dive into thousands of model series and compare them with product-grade charting.",
      glyph: "Δ"
    }
  ];

  return (
    <div className="capabilities-grid">
      {capabilities.map((capability) => (
        <article className="panel capability-card" key={capability.title}>
          <div className="capability-glyph" aria-hidden="true">
            {capability.glyph}
          </div>
          <p className="eyebrow">Platform capability</p>
          <h3>{capability.title}</h3>
          <p>{capability.copy}</p>
        </article>
      ))}
    </div>
  );
}

export function RoadmapTimeline({ phases }: { phases: RoadmapPhase[] }) {
  return (
    <div className="roadmap-grid">
      {phases.map((phase) => (
        <article className="panel roadmap-card" key={phase.phase}>
          <div className="roadmap-head">
            <span>{phase.phase}</span>
            <b>{phase.timing}</b>
          </div>
          <h3>{phase.headline}</h3>
          <ul className="roadmap-list">
            {phase.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

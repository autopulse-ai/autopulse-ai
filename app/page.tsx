import Link from "next/link";
import { TrendChart } from "@/components/charts";
import {
  HeroMetricGrid,
  PillarGrid,
  RankedList,
  SectionHeading,
  SpotlightTable
} from "@/components/ui";
import { getMarketSnapshot, getRoadmapPhases, getSeriesDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await getMarketSnapshot();
  const featuredSeriesKey = snapshot.seriesSpotlight[0]?.tsKey ?? "BMW_X1_Total";
  const featuredSeries = await getSeriesDetail(featuredSeriesKey);
  const roadmap = getRoadmapPhases();

  return (
    <div className="page-stack">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Germany-first forecasting intelligence</p>
          <h1>Vehicle registration history today, forecast-ready product experience tomorrow.</h1>
          <p className="hero-text">
            This MVP connects to the current Supabase data model, visualizes historical KBA-backed
            registrations, and prepares the product surface for 3, 6, and 12 month forecasts.
          </p>
          <div className="hero-actions">
            <Link href="/explore" className="button-primary">
              Open market dashboard
            </Link>
            <Link href="/roadmap" className="button-secondary">
              View feature roadmap
            </Link>
          </div>
          <p className="status-chip">{snapshot.statusMessage}</p>
        </div>
        <div className="hero-panel panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Landing preview</p>
              <h3>Market registrations with forecast placeholders</h3>
            </div>
            <span className="badge">{new Date(snapshot.latestPeriod).getUTCFullYear()}</span>
          </div>
          <TrendChart
            actuals={snapshot.monthlyTotals}
            forecast={featuredSeries?.forecast.slice(0, 12)}
            label="Market activity with placeholder forecast preview"
          />
        </div>
      </section>

      <HeroMetricGrid items={snapshot.heroMetrics} />

      <section className="content-section">
        <SectionHeading
          kicker="Market pulse"
          title="A decision-first landing page"
          description="The first screen prioritizes current market movement, top OEMs, source-aware drive-type labels, and quick paths into model series detail."
        />
        <div className="two-column-grid">
          <RankedList
            title="Top OEMs"
            subtitle={`Latest month ${new Date(snapshot.latestPeriod).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
              timeZone: "UTC"
            })}`}
            items={snapshot.topOems}
          />
          <RankedList
            title="Drive-type labels in source"
            subtitle="Current schema shape"
            items={snapshot.driveTypeMix}
          />
        </div>
      </section>

      <section className="content-section">
        <SectionHeading
          kicker="Forecast preview"
          title="Placeholder forecast cards until live ML outputs land"
          description="The UI already reserves space for model-generated forecasts and confidence bands, but labels them clearly as placeholders until `ml.fact_forecasts` is populated."
        />
        <div className="three-column-grid">
          {(featuredSeries?.summaryMetrics ?? []).map((metric) => (
            <article className="panel summary-card" key={metric.label}>
              <p className="eyebrow">{metric.label}</p>
              <h3>{metric.value}</h3>
              {metric.change ? <p className="metric-change">{metric.change}</p> : null}
            </article>
          ))}
        </div>
        {featuredSeries ? (
          <article className="panel spotlight-series">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Featured series</p>
                <h3>
                  {featuredSeries.oemName} {featuredSeries.modelName} · {featuredSeries.driveType}
                </h3>
              </div>
              <Link
                href={`/series/${encodeURIComponent(featuredSeries.tsKey)}`}
                className="text-link"
              >
                Open detail page
              </Link>
            </div>
            <TrendChart
              actuals={featuredSeries.actuals}
              forecast={featuredSeries.forecast}
              label={`${featuredSeries.tsKey} historical and placeholder forecast`}
            />
          </article>
        ) : null}
      </section>

      <section className="content-section">
        <SectionHeading
          kicker="Product shape"
          title="The landing page is anchored in the business plan"
          description="The current design keeps the four product pillars visible from the start so the MVP can grow directly into subscriptions, exports, APIs, and scenario intelligence."
        />
        <PillarGrid />
      </section>

      <section className="content-section">
        <SectionHeading
          kicker="Explore next"
          title="Additional pages already mapped"
          description="This first version includes a dashboard page for market exploration, a model-series detail page, and a roadmap page that converts the business plan into an implementation sequence."
        />
        <div className="page-link-grid">
          <Link href="/explore" className="panel page-link-card">
            <p className="eyebrow">Dashboard</p>
            <h3>Explore market data</h3>
            <p>OEM rankings, source labels, and tracked series in one view.</p>
          </Link>
          <Link href="/roadmap" className="panel page-link-card">
            <p className="eyebrow">Roadmap</p>
            <h3>See the feature plan</h3>
            <p>Business-plan-driven sequence for turning the MVP into a monetizable product.</p>
          </Link>
          <article className="panel page-link-card muted-card">
            <p className="eyebrow">Next step</p>
            <h3>Live forecasts</h3>
            <p>
              Swap the placeholder layer with `ml_run`, `ml_run_series`, and `ml.fact_forecasts`
              once the backend starts writing predictions.
            </p>
          </article>
        </div>
      </section>

      <section className="content-section">
        <SectionHeading
          kicker="Tracked now"
          title="Model series already surfaced in the app"
          description="The current data model is enough to start browsing high-volume series and preparing users for richer filters later."
        />
        <SpotlightTable items={snapshot.seriesSpotlight} />
      </section>

      <section className="content-section">
        <SectionHeading
          kicker="Roadmap snapshot"
          title="What comes after this landing page MVP"
          description="The first roadmap steps stay focused on turning historical registrations into a usable, forecast-ready product, then layering on monetization and explainability."
        />
        <div className="three-column-grid">
          {roadmap.slice(0, 3).map((phase) => (
            <article className="panel summary-card" key={phase.phase}>
              <p className="eyebrow">
                {phase.phase} · {phase.timing}
              </p>
              <h3>{phase.headline}</h3>
              <p>{phase.items[0]}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

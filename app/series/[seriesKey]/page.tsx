import { notFound } from "next/navigation";
import { TrendChart } from "@/components/charts";
import { HeroMetricGrid, SectionHeading } from "@/components/ui";
import { getSeriesDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SeriesPage({
  params
}: {
  params: Promise<{ seriesKey: string }>;
}) {
  const { seriesKey } = await params;
  const detail = await getSeriesDetail(decodeURIComponent(seriesKey));

  if (!detail) {
    notFound();
  }

  return (
    <div className="page-stack">
      <section className="content-section">
        <SectionHeading
          kicker="Series detail"
          title={`${detail.oemName} ${detail.modelName} · ${detail.driveType}`}
          description={`${detail.statusMessage} Aggregation level: ${detail.aggregationLevel}.`}
        />
        <HeroMetricGrid items={detail.summaryMetrics} />
      </section>

      <section className="content-section">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Historical + forecast placeholder</p>
              <h3>{detail.tsKey}</h3>
            </div>
          </div>
          <TrendChart
            actuals={detail.actuals}
            forecast={detail.forecast}
            label={`${detail.tsKey} actual registrations and placeholder forecast`}
          />
        </article>
      </section>
    </div>
  );
}

import { ExploreDashboard } from "@/components/explore-dashboard";
import { SectionHeading } from "@/components/ui";
import { getExploreInitialData } from "@/lib/data";

export const revalidate = 300;

export default async function ExplorePage() {
  const initialData = await getExploreInitialData();

  return (
    <div className="page-stack">
      <section className="content-section">
        <SectionHeading
          kicker="Explore"
          title="Historical comparison dashboard"
          description="Search the live model catalog, pick up to three series, and compare historical registrations with a Chart.js line chart."
        />
      </section>
      <ExploreDashboard initialData={initialData} />
    </div>
  );
}

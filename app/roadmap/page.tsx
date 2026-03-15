import { RoadmapTimeline, SectionHeading } from "@/components/ui";
import { getRoadmapPhases } from "@/lib/data";

export default function RoadmapPage() {
  const roadmap = getRoadmapPhases();

  return (
    <div className="page-stack">
      <section className="content-section">
        <SectionHeading
          kicker="Roadmap"
          title="Feature plan based on the business plan"
          description="The next product steps are sequenced around what the business plan actually needs: conversion-ready dashboards first, monetization second, API delivery third, and AI differentiation last."
        />
        <RoadmapTimeline phases={roadmap} />
      </section>
    </div>
  );
}

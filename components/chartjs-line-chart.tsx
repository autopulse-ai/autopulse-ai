"use client";

import { useEffect, useRef } from "react";
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  type ChartConfiguration
} from "chart.js";
import type { ExploreComparisonSeries } from "@/lib/types";

Chart.register(
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

function formatLabel(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  });
}

function readThemePalette() {
  const styles = getComputedStyle(document.documentElement);

  return {
    text: styles.getPropertyValue("--text").trim() || "#eef4fb",
    muted: styles.getPropertyValue("--muted").trim() || "rgba(222, 232, 244, 0.72)",
    border: styles.getPropertyValue("--line").trim() || "rgba(163, 194, 223, 0.12)",
    background: styles.getPropertyValue("--bg-soft").trim() || "rgba(8, 20, 36, 0.92)",
    actual: styles.getPropertyValue("--chart-line-actual").trim() || "#25c7ff",
    forecast: styles.getPropertyValue("--chart-line-forecast").trim() || "#ffab52",
    third: styles.getPropertyValue("--chart-line-third").trim() || "#86b7ff"
  };
}

export function ChartJsLineChart({
  series,
  title
}: {
  series: ExploreComparisonSeries[];
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || series.length === 0) {
      return;
    }

    const palette = readThemePalette();
    const labels = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.date))))
      .sort((left, right) => left.localeCompare(right))
      .map(formatLabel);
    const rawDates = Array.from(
      new Set(series.flatMap((item) => item.points.map((point) => point.date)))
    ).sort((left, right) => left.localeCompare(right));
    const datasets = series.map((item, index) => {
      const colorScale = [
        { border: palette.actual, background: "rgba(37, 199, 255, 0.16)" },
        { border: palette.forecast, background: "rgba(255, 171, 82, 0.16)" },
        { border: palette.third, background: "rgba(134, 183, 255, 0.16)" }
      ];
      const color = colorScale[index % colorScale.length];
      const pointsByDate = new Map(item.points.map((point) => [point.date, point.value]));

      return {
        label: item.label,
        data: rawDates.map((date) => pointsByDate.get(date) ?? null),
        borderColor: color.border,
        backgroundColor: color.background,
        borderWidth: 3,
        tension: 0.28,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true
      };
    });
    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: palette.text,
              boxWidth: 12,
              boxHeight: 12
            }
          },
          title: {
            display: true,
            text: title,
            color: palette.text,
            padding: {
              bottom: 18
            },
            font: {
              size: 16,
              weight: 600
            }
          },
          tooltip: {
            backgroundColor: palette.background,
            titleColor: palette.text,
            bodyColor: palette.text,
            borderColor: palette.border,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: {
              color: palette.muted,
              maxRotation: 0
            },
            grid: {
              color: "rgba(163, 194, 223, 0.06)"
            }
          },
          y: {
            ticks: {
              color: palette.muted
            },
            grid: {
              color: "rgba(163, 194, 223, 0.08)"
            }
          }
        }
      }
    };

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [series, title]);

  if (series.length === 0) {
    return (
      <div className="empty-state">
        <p>Select up to three model series to populate the comparison chart.</p>
      </div>
    );
  }

  return (
    <div className="chartjs-shell">
      <canvas ref={canvasRef} />
    </div>
  );
}

"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChartJsLineChart } from "@/components/chartjs-line-chart";
import { HeroMetricGrid } from "@/components/ui";
import type {
  ExploreComparisonResponse,
  ExploreInitialData,
  ExploreSeriesOption
} from "@/lib/types";

function matchesSearch(option: ExploreSeriesOption, query: string) {
  if (!query.trim()) {
    return true;
  }

  const haystack = `${option.modelName} ${option.tsKey} ${option.oemName}`.trim();

  try {
    return new RegExp(query, "i").test(haystack);
  } catch {
    return haystack.toLowerCase().includes(query.toLowerCase());
  }
}

function sortByRelevance(options: ExploreSeriesOption[]) {
  return [...options].sort((left, right) => right.latestValue - left.latestValue);
}

export function ExploreDashboard({ initialData }: { initialData: ExploreInitialData }) {
  const [selectedOem, setSelectedOem] = useState("");
  const [selectedDriveType, setSelectedDriveType] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [range, setRange] = useState("24");
  const [selectedIds, setSelectedIds] = useState(initialData.selectedIds);
  const [comparison, setComparison] = useState<ExploreComparisonResponse>({
    comparedSeries: initialData.comparedSeries,
    heroMetrics: initialData.heroMetrics,
    selectedIds: initialData.selectedIds,
    totalMatchingSeries: initialData.totalMatchingSeries
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const deferredQuery = useDeferredValue(modelQuery);

  const filteredOptions = useMemo(() => {
    return sortByRelevance(
      initialData.catalog.filter((option) => {
        if (selectedOem && option.oemName !== selectedOem) {
          return false;
        }

        if (selectedDriveType && option.driveType !== selectedDriveType) {
          return false;
        }

        return matchesSearch(option, deferredQuery);
      })
    );
  }, [deferredQuery, initialData.catalog, selectedDriveType, selectedOem]);

  const selectedOptions = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return initialData.catalog.filter((option) => selectedSet.has(option.seriesId));
  }, [initialData.catalog, selectedIds]);
  const chartRows = useMemo(() => {
    return comparison.comparedSeries
      .flatMap((series) =>
        series.points.map((point) => ({
          key: `${series.seriesId}-${point.date}`,
          date: point.date,
          oemName: series.oemName,
          modelName: series.modelName,
          driveType: series.driveType,
          registrations: point.value,
          tsKey: series.tsKey
        }))
      )
      .sort((left, right) => {
        const dateComparison = right.date.localeCompare(left.date);

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return left.oemName.localeCompare(right.oemName);
      })
      .slice(0, 12);
  }, [comparison.comparedSeries]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadComparison() {
      if (selectedIds.length === 0) {
        setComparison((current) => ({
          ...current,
          comparedSeries: [],
          heroMetrics: current.heroMetrics,
          selectedIds: []
        }));
        return;
      }

      setStatus("loading");

      try {
        const response = await fetch("/api/explore-series", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            range,
            selectedSeriesIds: selectedIds
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Failed to load comparison data.");
        }

        const data = (await response.json()) as ExploreComparisonResponse;
        setComparison(data);
        setStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setStatus("error");
      }
    }

    const initialKey = `${initialData.selectedIds.join(",")}|24`;
    const currentKey = `${selectedIds.join(",")}|${range}`;

    if (currentKey === initialKey) {
      return;
    }

    void loadComparison();

    return () => controller.abort();
  }, [initialData.selectedIds, range, selectedIds]);

  function addSeries(seriesId: string) {
    setSelectedIds((current) => {
      if (current.includes(seriesId) || current.length >= 3) {
        return current;
      }

      return [...current, seriesId];
    });
  }

  function removeSeries(seriesId: string) {
    setSelectedIds((current) => current.filter((id) => id !== seriesId));
  }

  return (
    <div className="page-stack">
      <HeroMetricGrid items={comparison.heroMetrics} />

      <section className="content-section">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Series picker</p>
              <h3>Search models instead of browsing raw series IDs</h3>
            </div>
          </div>

          <div className="explore-controls">
            <label className="field-group">
              <span>OEM</span>
              <select value={selectedOem} onChange={(event) => setSelectedOem(event.target.value)}>
                <option value="">All OEMs</option>
                {initialData.filters.oems.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Drive Type</span>
              <select
                value={selectedDriveType}
                onChange={(event) => setSelectedDriveType(event.target.value)}
              >
                <option value="">All drive types</option>
                {initialData.filters.driveTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group field-group-grow">
              <span>Model search</span>
              <input
                type="text"
                value={modelQuery}
                onChange={(event) => setModelQuery(event.target.value)}
                placeholder="Try Golf, X1, GLA, or regex like ^EQ"
              />
            </label>

            <label className="field-group">
              <span>Range</span>
              <select value={range} onChange={(event) => setRange(event.target.value)}>
                {initialData.filters.ranges.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="selection-strip">
            <div>
              <p className="eyebrow">Selected series</p>
              <div className="chip-row">
                {selectedOptions.map((option) => (
                  <button
                    type="button"
                    key={option.seriesId}
                    className="selection-chip"
                    onClick={() => removeSeries(option.seriesId)}
                  >
                    {option.oemName} {option.modelName} · {option.driveType}
                    <span>Remove</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="support-copy">
              Up to three series can be compared at once. The default basket is the highest-volume
              live model for Mercedes, BMW, and Volkswagen.
            </p>
          </div>

          <div className="candidate-list">
            {filteredOptions.slice(0, 18).map((option) => {
              const isSelected = selectedIds.includes(option.seriesId);

              return (
                <article key={option.seriesId} className="candidate-card">
                  <div>
                    <p className="eyebrow">{option.oemName}</p>
                    <h4>{option.modelName}</h4>
                    <p className="candidate-meta">
                      {option.driveType} · latest {new Intl.NumberFormat("en-US").format(option.latestValue)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={isSelected ? "button-secondary" : "button-primary"}
                    onClick={() =>
                      isSelected ? removeSeries(option.seriesId) : addSeries(option.seriesId)
                    }
                  >
                    {isSelected ? "Selected" : "Add"}
                  </button>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      <section className="content-section">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Comparison chart</p>
              <h3>Historical registrations for the selected series</h3>
            </div>
            <span className="badge">
              {status === "loading" ? "Loading" : `${comparison.comparedSeries.length} series`}
            </span>
          </div>
          <ChartJsLineChart
            series={comparison.comparedSeries}
            title="Historical registrations by selected model series"
          />
        </article>
      </section>

      <section className="content-section">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Current selection</p>
              <h3>Chart dataframe</h3>
            </div>
          </div>
          {status === "error" ? <p className="support-copy">Could not refresh chart data.</p> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>OEM</th>
                  <th>Model</th>
                  <th>Engine Type</th>
                  <th>Registrations</th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {new Date(row.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        timeZone: "UTC"
                      })}
                    </td>
                    <td>{row.oemName}</td>
                    <td>{row.modelName}</td>
                    <td>{row.driveType}</td>
                    <td>{new Intl.NumberFormat("en-US").format(row.registrations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

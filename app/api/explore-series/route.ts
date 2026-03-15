import { NextResponse } from "next/server";
import { getExploreComparisonData } from "@/lib/data";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    selectedSeriesIds?: string[];
    range?: string;
  };
  const selectedSeriesIds = Array.isArray(body.selectedSeriesIds)
    ? body.selectedSeriesIds.filter((value): value is string => typeof value === "string").slice(0, 3)
    : [];
  const range = typeof body.range === "string" ? body.range : "24";
  const data = await getExploreComparisonData({
    selectedSeriesIds,
    range
  });

  return NextResponse.json(data);
}

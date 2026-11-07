import coverage from "@/data/coverage.json";

/** Active land-sourcing regions (mirrors data/keywords + coverage.json). */
export const COVERED_REGIONS: string[] = coverage.regions;

/** Lowercase town tokens for location heuristics / score boost. */
export const COVERAGE_TOWNS: string[] = [...coverage.towns].sort(
  (a, b) => b.length - a.length,
);

export const GEOGRAPHY_LABEL =
  coverage.label ?? "UK land regions (GM + neighbouring high-value markets)";

export function locationInCoverage(
  location: string | null | undefined,
): boolean {
  const loc = (location ?? "").toLowerCase();
  if (!loc) return false;
  if (COVERED_REGIONS.some((r) => loc.includes(r.toLowerCase()))) return true;
  return COVERAGE_TOWNS.some((t) => loc.includes(t));
}

export function titleCaseTown(token: string): string {
  return token
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

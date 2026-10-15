import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api-client";

export interface UzDistrict {
  /** Official SOATO code. What a profile stores. */
  code: string;
  uz: string;
  ru: string;
}

export interface UzRegion extends UzDistrict {
  districts: UzDistrict[];
}

/**
 * Regions with their districts, from the server rather than the bundle.
 *
 * The server validates the code it is sent, so a list baked into the app
 * would be a second source of truth that falls behind and starts sending
 * values the API refuses. Cached for an hour — Uzbekistan does not
 * reorganise often, and when it does the fix is a server deploy, not an app
 * release.
 */
export function useRegions() {
  const query = useQuery({
    queryKey: ["regions"] as const,
    queryFn: () => api<UzRegion[]>("/regions", { auth: false }),
    staleTime: 60 * 60_000,
  });

  return { ...query, regions: query.data ?? [] };
}

/**
 * The region a code belongs to, and the district itself when the code is one.
 *
 * A district SOATO nests under its region's, but this matches on the actual
 * lists rather than on string prefixes — three of them are coded a level
 * deeper than the rest, and a prefix rule would quietly mis-sort those.
 */
export function findPlace(
  regions: UzRegion[],
  code: string | null | undefined,
) {
  if (!code) return { region: null, district: null };

  for (const region of regions) {
    if (region.code === code) return { region, district: null };

    const district = region.districts.find((d) => d.code === code);
    if (district) return { region, district };
  }

  return { region: null, district: null };
}

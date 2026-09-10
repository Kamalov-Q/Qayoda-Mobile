import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../api/listings.api";

/** The Home strip. Public endpoint, so guests see it too. */
export function useLatestListings(limit = 10) {
  return useQuery({
    queryKey: ["listings", "latest", limit] as const,
    queryFn: () => listingApi.getLatest(limit),
    staleTime: 60_000,
  });
}

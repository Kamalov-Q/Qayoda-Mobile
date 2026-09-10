import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../api/listings.api";

/** The one number every price on screen hangs on. Refreshes twice a day. */
export function useRates() {
  return useQuery({
    queryKey: ["rates"] as const,
    queryFn: listingApi.getRates,
    staleTime: 6 * 3_600_000,
    gcTime: 24 * 3_600_000,
  });
}

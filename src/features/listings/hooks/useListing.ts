import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../api/listings.api";

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ["listings", "detail", id],
    queryFn: () => listingApi.getById(id!),
    enabled: !!id,
  });
}

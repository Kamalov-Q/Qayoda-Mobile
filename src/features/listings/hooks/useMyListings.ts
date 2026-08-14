import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../api/listings.api";

export function useMyListings() {
  return useQuery({
    queryKey: ["listings", "mine"],
    queryFn: listingApi.getMine,
  });
}

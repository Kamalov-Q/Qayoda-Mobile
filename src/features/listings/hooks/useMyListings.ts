import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../api/listings.api";
import { useAuthStore } from "../../auth/store/auth.store";

export function useMyListings() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  return useQuery({
    queryKey: ["listings", "mine"],
    queryFn: listingApi.getMine,
    enabled: authed,
  });
}

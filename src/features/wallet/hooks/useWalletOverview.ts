import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { walletApi } from "../api/wallet.api";
import { useAuthStore } from "../../auth/store/auth.store";

/**
 * The live wallet (balance, providers) for every screen that shows the card.
 * One query key, so a top-up refreshing ["wallet"] updates them all; and a
 * refetch on focus, because a payment finishes OUTSIDE the app (Click, Paynet)
 * and the user comes back to whichever screen they left.
 */
export function useWalletOverview() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const query = useQuery({
    queryKey: ["wallet", "overview"],
    queryFn: () => walletApi.overview(),
    enabled: authed,
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (authed) refetch();
    }, [authed, refetch])
  );

  return query;
}

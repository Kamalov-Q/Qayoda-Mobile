import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tariffsApi, type Tariff } from "../api/tariffs.api";

const KEY = ["tariffs"] as const;

/**
 * The price list.
 *
 * Cached for a few minutes rather than per screen: every charged action
 * needs it, an admin changes it rarely, and a price that disagrees between
 * the post form and the confirmation is worse than one that is a minute old.
 */
export function useTariffs() {
  const query = useQuery({
    queryKey: KEY,
    queryFn: tariffsApi.list,
    staleTime: 5 * 60_000,
  });

  const byAction = useMemo(() => {
    const map = new Map<string, Tariff[]>();
    for (const tariff of query.data ?? []) {
      const list = map.get(tariff.action) ?? [];
      list.push(tariff);
      map.set(tariff.action, list);
    }
    return map;
  }, [query.data]);

  return {
    ...query,
    tariffs: query.data ?? [],
    /** Every tariff for one action, cheapest first (the server orders them). */
    forAction: (action: string) => byAction.get(action) ?? [],
    /**
     * The single price for a one-off action.
     *
     * Undefined means "not charged": either no tariff exists for it or the
     * admin deactivated the only one. Callers must treat that as free rather
     * than as an error — an unpriced action is how the feature behaves
     * before anybody sets a price.
     */
    priceOf: (action: string): string | undefined =>
      byAction.get(action)?.[0]?.price,
  };
}

export function useBonusTiers() {
  const query = useQuery({
    queryKey: ["tariffs", "bonus-tiers"] as const,
    queryFn: tariffsApi.bonusTiers,
    staleTime: 5 * 60_000,
  });
  return { ...query, tiers: query.data ?? [] };
}

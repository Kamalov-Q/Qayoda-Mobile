import { api } from "@/src/lib/api-client";

/**
 * The actions the server charges for by itself. An admin may invent other
 * codes in the dashboard; those are listed but nothing charges them until
 * a feature sells them, so the app only ever looks up these three.
 */
export const BUILT_IN_ACTIONS = [
  "LISTING_POST",
  "STORY_POST",
  "LISTING_PROMOTE",
] as const;

export type TariffAction = (typeof BUILT_IN_ACTIONS)[number];

export interface Tariff {
  id: string;
  /** One of BUILT_IN_ACTIONS, or an admin's own code. */
  action: string;
  nameUz: string;
  nameRu: string;
  /** So'm as a decimal string — `numeric` comes out of Postgres that way. */
  price: string;
  /** Set only for the actions that buy time, e.g. LISTING_PROMOTE. */
  durationDays: number | null;
  isActive: boolean;
}

export interface BonusTier {
  id: string;
  minAmount: string;
  percent: number;
  isActive: boolean;
}

export const tariffsApi = {
  /** Public: no session needed, because a price is not a secret. */
  list: () => api<Tariff[]>("/tariffs", { auth: false }),
  bonusTiers: () => api<BonusTier[]>("/tariffs/bonus-tiers", { auth: false }),
};

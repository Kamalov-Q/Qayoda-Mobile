// src/features/price-bids/api/price-bids.api.ts
//
// Price negotiation: a buyer offers a number, the seller answers it.
//
// Deliberately not called an "offer" anywhere in here — `Offer` in
// listings.api.ts is the ASKING price the seller published, and a codebase
// where the word means both is one where every call site needs a second look.
import { api } from "@/src/lib/api-client";
import type { OfferPurpose } from "@/src/features/listings/api/listings.api";

/** Mirrors BIDS_PAGE on the server. */
export const BIDS_PAGE = 50;

/** Mirrors BID_TTL_DAYS. Shown in the sheet before the bid is sent. */
export const BID_TTL_DAYS = 7;

/** The discounts the sheet offers as one-tap chips. */
export const BID_PRESETS = [5, 10, 15] as const;

export type PriceBidStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "COUNTERED"
  | "WITHDRAWN"
  | "EXPIRED";

/** Who put the number on the table — the buyer, or the seller countering. */
export type PriceBidDirection = "BUYER" | "SELLER";

export interface PriceBid {
  id: string;
  listingId: string;
  conversationId: string | null;
  messageId: string | null;
  /** The buyer, on both directions — the pair identifies the negotiation. */
  bidderId: string;
  ownerId: string;
  /** Who made THIS number. Whoever is not them may answer it. */
  authorId: string;
  direction: PriceBidDirection;
  status: PriceBidStatus;
  purpose: OfferPurpose;
  amount: number;
  currency: string;
  /** What was being asked when the bid was made. Null on older rows. */
  askingAmount: number | null;
  askingCurrency: string | null;
  expiresAt: string;
  respondedAt: string | null;
  supersededById: string | null;
  createdAt: string;
}

export interface CreateBidInput {
  amount: number;
  currency?: string;
  purpose?: OfferPurpose;
  note?: string;
}

export interface PriceBidPage {
  total: number;
  items: PriceBid[];
}

/**
 * The advert an offer is against, as `/me/bids` carries it.
 *
 * Only on that endpoint. A card in a chat thread is already surrounded by
 * the listing it belongs to, so the by-id call does not pay for this; a flat
 * list of amounts with nothing to attach them to is unreadable without it.
 */
export interface PriceBidListing {
  id: string;
  title: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "SOLD";
}

/** Null when the advert has since been deleted outright. */
export type MyPriceBid = PriceBid & { listing: PriceBidListing | null };

export interface MyPriceBidPage {
  total: number;
  items: MyPriceBid[];
}

/** Settled bids show their outcome and nothing to press. */
export const isBidOpen = (bid: PriceBid): boolean => bid.status === "PENDING";

/**
 * Whether this person is the one who has to answer.
 *
 * Not "am I the owner": a counter-offer reverses who is waiting on whom, and
 * a card that puts Accept in front of the person who just pressed Send is a
 * card that gets pressed by accident.
 */
export const canRespondTo = (bid: PriceBid, userId: string | undefined) =>
  !!userId && isBidOpen(bid) && bid.authorId !== userId &&
  (bid.bidderId === userId || bid.ownerId === userId);

export const priceBidsApi = {
  create: (listingId: string, input: CreateBidInput) =>
    api<PriceBid>(`/listings/${listingId}/bids`, {
      method: "POST",
      body: input,
    }),

  forListing: (listingId: string, limit = BIDS_PAGE, offset = 0) =>
    api<PriceBidPage>(
      `/listings/${listingId}/bids?limit=${limit}&offset=${offset}`,
    ),

  mine: (limit = BIDS_PAGE, offset = 0) =>
    api<MyPriceBidPage>(`/me/bids?limit=${limit}&offset=${offset}`),

  /**
   * The bids behind a page of chat messages, in one request.
   *
   * Ids the caller is not party to come back missing rather than as an
   * error — a thread may legitimately contain none of theirs.
   */
  byIds: (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve([] as PriceBid[])
      : api<PriceBid[]>(`/bids?ids=${ids.slice(0, 100).join(",")}`),

  accept: (id: string, note?: string) =>
    api<PriceBid>(`/bids/${id}/accept`, { method: "POST", body: { note } }),

  decline: (id: string, note?: string) =>
    api<PriceBid>(`/bids/${id}/decline`, { method: "POST", body: { note } }),

  counter: (id: string, input: CreateBidInput) =>
    api<PriceBid>(`/bids/${id}/counter`, { method: "POST", body: input }),

  withdraw: (id: string) => api<PriceBid>(`/bids/${id}`, { method: "DELETE" }),
};

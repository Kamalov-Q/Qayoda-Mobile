// src/features/price-bids/hooks/usePriceBids.ts
import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import {
  BIDS_PAGE,
  priceBidsApi,
  type CreateBidInput,
  type PriceBid,
} from "../api/price-bids.api";

const listingKey = (listingId: string) =>
  ["price-bids", "listing", listingId] as const;
const bidsKey = (ids: string[]) => ["price-bids", "byIds", ids] as const;

/**
 * Every bid on one advert.
 *
 * The owner gets all of them; anybody else gets their own. The server
 * decides which — a client that asked for "mine" or "all" would be a client
 * that could ask for the wrong one.
 */
export function useListingBids(listingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: listingKey(listingId ?? ""),
    queryFn: () => priceBidsApi.forListing(listingId!),
    enabled: !!listingId && enabled,
    staleTime: 30_000,
  });
}

/**
 * The bids behind the cards in a chat thread.
 *
 * One request for the whole page rather than one per card: a thread that has
 * been haggled over twenty times is still one round trip. `ids` is sorted so
 * the same set of messages is the same cache key however they arrived.
 */
export function useBidsByIds(ids: string[]) {
  // Memoised, not computed in the hook body: the chat re-renders on every
  // keystroke of a typing indicator and on every socket event, and this used
  // to allocate a Set and a sorted copy each time. React Query compares the
  // key structurally so it never refetched — it just churned.
  const sorted = useMemo(() => [...new Set(ids)].sort(), [ids]);
  return useQuery({
    queryKey: bidsKey(sorted),
    queryFn: () => priceBidsApi.byIds(sorted),
    enabled: sorted.length > 0,
    staleTime: 15_000,
  });
}

/**
 * Every negotiation you are in, newest first, paged.
 *
 * Both directions in one list — see the endpoint. Paged the same way the
 * activity lists are, so it can hand itself straight to ActivityList.
 */
export function useMyBids() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  const query = useInfiniteQuery({
    queryKey: ["price-bids", "mine"] as const,
    queryFn: ({ pageParam }) => priceBidsApi.mine(BIDS_PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.items.length < BIDS_PAGE
        ? undefined
        : pages.length * BIDS_PAGE,
    enabled: authed,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}

/**
 * Everything a write to a bid can invalidate.
 *
 * Bids live in two caches — the listing's list and the by-id set the chat
 * cards read — and both sit under the `price-bids` prefix, so one call
 * covers them; invalidating `listingKey` as well, as this used to, was the
 * same query twice. The thread gains a message, and the conversation list
 * shows that message as its preview, so both of those are genuinely stale.
 *
 * NOT the notification cache. Every notification a bid writes goes to the
 * OTHER party — you cannot answer your own bid — so the actor's own bell
 * never changes here, and the push handler already invalidates it on the
 * device that does receive one.
 */
function invalidateAfterWrite(bid: PriceBid) {
  void queryClient.invalidateQueries({ queryKey: ["price-bids"] });
  if (bid.conversationId) {
    void queryClient.invalidateQueries({
      queryKey: ["chat", "messages", bid.conversationId],
    });
    void queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
  }
}

/** Place a bid. Never optimistic — the server decides the asking price it
 *  is measured against, and a card showing a discount the server rejected is
 *  worse than a card that takes a moment to appear. */
export function useCreateBid(listingId: string | undefined) {
  return useMutation({
    mutationFn: (input: CreateBidInput) =>
      priceBidsApi.create(listingId!, input),
    onSuccess: invalidateAfterWrite,
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useAcceptBid() {
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      priceBidsApi.accept(id, note),
    onSuccess: invalidateAfterWrite,
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useDeclineBid() {
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      priceBidsApi.decline(id, note),
    onSuccess: invalidateAfterWrite,
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useCounterBid() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateBidInput }) =>
      priceBidsApi.counter(id, input),
    onSuccess: invalidateAfterWrite,
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useWithdrawBid() {
  return useMutation({
    mutationFn: (id: string) => priceBidsApi.withdraw(id),
    onSuccess: invalidateAfterWrite,
    onError: (e) => toast.error(errorMessage(e)),
  });
}

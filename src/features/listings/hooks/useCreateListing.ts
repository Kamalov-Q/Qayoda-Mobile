import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  type CreateListingInput,
  type MarkSoldInput,
  listingApi,
} from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { handleChargeError } from "@/src/features/tariffs/lib/charge-errors";

export function useCreateListing() {
  return useMutation({
    mutationFn: (input: CreateListingInput) => listingApi.create(input),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "counts"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "viewport"] });
      // Posting is charged, so the balance just moved.
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      toast.successKey("listings.created");
      router.replace(`/listing/${listing.id}`);
    },
    // Running out of balance is the one refusal with a fix, and it gets a
    // dialog pointing at it rather than a toast that scrolls away.
    onError: handleChargeError,
  });
}

/**
 * Archive and its inverse. Neither navigates: the two are one toggle on the
 * detail screen, and bouncing the user back to the list after archiving would
 * take away the undo before they could reach it.
 */
export function useArchiveListing() {
  return useMutation({
    mutationFn: (id: string) => listingApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.successKey("listings.archived");
    },
    // Nothing was showing archive failures: mutate() swallows the rejection,
    // so the row simply stayed put with no explanation.
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * Marking a listing sold.
 *
 * Shaped like useRestoreListing rather than useArchiveListing: the response
 * is the updated listing, so the detail screen flips to its sold state
 * immediately instead of waiting out the refetch.
 */
export function useMarkSoldListing() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MarkSoldInput }) =>
      listingApi.markSold(id, input),
    onSuccess: (listing) => {
      queryClient.setQueryData(["listings", "detail", listing.id], listing);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      // The sale closed every open offer on it, so the bid caches and the
      // threads those closures wrote into are both stale.
      queryClient.invalidateQueries({ queryKey: ["price-bids"] });
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      toast.successKey("listings.soldToast");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useRestoreListing() {
  return useMutation({
    mutationFn: (id: string) => listingApi.restore(id),
    onSuccess: (listing) => {
      // The response is the fresh listing, so the detail screen can flip
      // without waiting for the refetch the invalidation kicks off.
      queryClient.setQueryData(["listings", "detail", listing.id], listing);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.successKey("listings.restored");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { CreateListingInput, listingApi } from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

export function useCreateListing() {
  return useMutation({
    mutationFn: (input: CreateListingInput) => listingApi.create(input),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "viewport"] });
      toast.successKey("listings.created");
      router.replace(`/listing/${listing.id}`);
    },
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

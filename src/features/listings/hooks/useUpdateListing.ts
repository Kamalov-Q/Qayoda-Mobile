import { useMutation } from "@tanstack/react-query";
import {
  UpdateListingInput,
  listingApi,
  Listing,
  type ImageInput,
} from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

/**
 * An edit, as the owner means it: the fields, the geometry and the photos.
 *
 * `images` is a separate endpoint on the server (PUT /listings/:id/images,
 * which diffs the list and orphans whatever was dropped), so a save that
 * touches photos is two requests — but one mutation, one toast and one cache
 * write, because to the person pressing Save it was one action.
 *
 * Leave `images` undefined when the set has not changed. Sending it anyway
 * makes the server delete and recreate every row and queue the old files for
 * deletion, which is a lot of work to end up where it started.
 */
export interface UpdateListingPayload extends UpdateListingInput {
  images?: ImageInput[];
}

export function useUpdateListing(listingId: string) {
  return useMutation({
    mutationFn: async ({ images, ...input }: UpdateListingPayload) => {
      const updated = await listingApi.update(listingId, input);
      // Second, and only when asked: the fields are what the form is mostly
      // about, and a failed photo write should not look like a failed save
      // of the price.
      return images ? listingApi.updateImages(listingId, images) : updated;
    },
    onSuccess: (updated: Listing) => {
      queryClient.setQueryData(["listings", "detail", listingId], updated);
      queryClient.invalidateQueries({
        queryKey: ["listings", "detail", listingId],
      });
      queryClient.invalidateQueries({ queryKey: ["listings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "viewport"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "feed"] });
      toast.successKey("listings.updatedSuccess");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

import { useMutation } from "@tanstack/react-query";
import { UpdateListingInput, listingApi, Listing } from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

export function useUpdateListing(listingId: string) {
  return useMutation({
    mutationFn: (input: UpdateListingInput) =>
      listingApi.update(listingId, input),
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

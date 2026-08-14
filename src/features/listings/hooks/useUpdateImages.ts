import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { ImageInput, listingApi } from "../api/listings.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";

export function useUpdateImages(listingId: string) {
  return useMutation({
    // Goes through listingApi rather than a second hand-written path — the
    // duplicate here had `/listing/` (singular) and 404'd.
    mutationFn: (images: ImageInput[]) =>
      listingApi.updateImages(listingId, images),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["listings", "detail", listingId],
      });
      queryClient.invalidateQueries({ queryKey: ["listings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "viewport"] });
      toast.successKey("listings.imagesUpdated");
      // Deep-linked straight into this screen there is nothing to go back to,
      // and a bare router.back() would leave the user stranded on it.
      if (router.canGoBack()) router.back();
      else router.replace(`/listing/${listingId}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/src/components/ui/Toast";
import { errorMessage } from "@/src/lib/api-error";
import { useIsAuthed } from "@/src/features/auth/guest";
import {
  verificationApi,
  type SubmitVerificationInput,
  type VerificationState,
} from "../api/verification.api";

const KEY = ["verification", "me"] as const;

/**
 * Where this account stands with the badge.
 *
 * Only asked when signed in — the badge is a property of an account, and a
 * guest has none to ask about.
 */
export function useVerification() {
  const authed = useIsAuthed();

  return useQuery<VerificationState>({
    queryKey: KEY,
    queryFn: verificationApi.mine,
    enabled: authed,
    // A decision arrives while the app is closed, not while it is open, so
    // the useful moment to re-ask is a cold look at the screen.
    staleTime: 60_000,
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitVerificationInput) =>
      verificationApi.submit(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// src/features/profile/hooks/useProfile.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { profileApi, Profile } from "../api/profile.api";
import { queryClient } from "../../../lib/query-client";
import { useAuthStore } from "../../auth/store/auth.store";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/api-error";

export const PROFILE_KEY = ["profile"] as const;

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: profileApi.get });
}

/**
 * Every profile mutation returns the fresh ProfileResponse, so the cache is
 * written directly instead of invalidated — no follow-up GET. The auth store's
 * session user carries a copy of name/surname (the account tab renders from
 * it), so it is synced here too or the header would show the old name until
 * the next token refresh.
 */
function applyProfile(profile: Profile) {
  queryClient.setQueryData(PROFILE_KEY, profile);

  const { accessToken, user, setSession } = useAuthStore.getState();
  if (accessToken && user) {
    setSession(accessToken, {
      ...user,
      name: profile.name ?? "",
      surname: profile.surname ?? "",
    });
  }
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: (profile) => {
      applyProfile(profile);
      toast.successKey("profile.updated");
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: profileApi.uploadAvatar,
    onSuccess: (profile) => {
      applyProfile(profile);
      toast.successKey("profile.photoUpdated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: (profile) => {
      applyProfile(profile);
      toast.successKey("profile.photoRemoved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

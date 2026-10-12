// src/features/profile/hooks/useProfile.ts
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { profileApi, Profile } from "../api/profile.api";
import { queryClient } from "../../../lib/query-client";
import { useAuthStore } from "../../auth/store/auth.store";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/api-error";

export const PROFILE_KEY = ["profile"] as const;

export function useProfile() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const query = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: profileApi.get,
    enabled: authed,
  });

  // The session user is a copy minted at sign-in, and half the app draws the
  // badge and the name from it. Nothing refreshed it but a token refresh, so
  // somebody verified this morning kept seeing an unverified account until
  // they signed out and in again. Whenever the real profile lands, the copy
  // follows it.
  const profile = query.data;
  useEffect(() => {
    if (profile) syncSession(profile);
  }, [profile]);

  return query;
}

/** Writes the parts of a profile the session user also carries. */
function syncSession(profile: Profile) {
  const { accessToken, user, setSession } = useAuthStore.getState();
  if (!accessToken || !user) return;

  if (
    user.name === profile.name &&
    user.surname === profile.surname &&
    user.avatarUrl === profile.avatarUrl &&
    user.phoneNumber === profile.phoneNumber &&
    user.isVerifiedRealtor === profile.isVerifiedRealtor
  ) {
    // Nothing moved. Setting it anyway would publish a new object to every
    // subscriber of the store on every profile fetch.
    return;
  }

  setSession(accessToken, {
    ...user,
    name: profile.name,
    surname: profile.surname,
    avatarUrl: profile.avatarUrl,
    phoneNumber: profile.phoneNumber,
    isVerifiedRealtor: profile.isVerifiedRealtor,
  });
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
  syncSession(profile);
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

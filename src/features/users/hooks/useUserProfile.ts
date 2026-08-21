import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../api/users.api";

export const userProfileKey = (id: string) => ["users", "profile", id] as const;

/**
 * The card behind an avatar tap. Kept warm for a minute: bouncing between a
 * thread and the profile is a normal loop, and neither the contact details nor
 * the ad list changes at conversation speed.
 */
export function useUserProfile(id: string | undefined) {
  return useQuery({
    queryKey: userProfileKey(id ?? ""),
    queryFn: () => usersApi.getProfile(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

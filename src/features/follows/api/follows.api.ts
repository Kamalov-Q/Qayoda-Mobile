import { api } from "@/src/lib/api-client";

export interface FollowState {
  /** Whether the viewer follows this person. False for guests. */
  following: boolean;
  /** Whether they follow the viewer back — worth saying on a profile. */
  followsYou: boolean;
  followerCount: number;
  followingCount: number;
}

export interface FollowPerson {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
  isVerifiedRealtor: boolean;
  followerCount: number;
  /** Drives the button on the row, so a list is actionable in place. */
  followedByMe: boolean;
}

export interface FollowPage {
  total: number;
  items: FollowPerson[];
}

export const FOLLOW_PAGE = 25;

export const followsApi = {
  /** Public: the counts are printed on the profile either way. */
  state: (userId: string) => api<FollowState>(`/users/${userId}/follow`),

  /** Idempotent both ways; returns the fresh state, counts included. */
  setFollow: (userId: string, next: boolean) =>
    api<FollowState>(`/users/${userId}/follow`, {
      method: next ? "PUT" : "DELETE",
    }),

  /**
   * `q` narrows the list by name on the SERVER, not here.
   *
   * These lists page at 25, so filtering the loaded pages in the component
   * would search whatever happened to be scrolled into memory and quietly
   * miss the rest — which is the kind of search that looks like it works.
   */
  followers: (userId: string, limit = FOLLOW_PAGE, offset = 0, q?: string) =>
    api<FollowPage>(
      `/users/${userId}/followers?limit=${limit}&offset=${offset}` +
        (q?.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""),
    ),

  following: (userId: string, limit = FOLLOW_PAGE, offset = 0, q?: string) =>
    api<FollowPage>(
      `/users/${userId}/following?limit=${limit}&offset=${offset}` +
        (q?.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""),
    ),
};

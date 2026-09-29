import { api } from "@/src/lib/api-client";

/** What a story is made of. A caption can ride on any of them. */
export type StoryType = "IMAGE" | "VIDEO" | "TEXT";

/** How long a story may be left up — Telegram's four choices. */
export const STORY_HOURS = [6, 12, 24, 48] as const;
export type StoryHours = (typeof STORY_HOURS)[number];

/** Mirrors STORY_BODY_MAX on the server. */
export const STORY_BODY_MAX = 600;

/**
 * The backgrounds a text story can sit on. Index into this, not a colour
 * string — the server stores the index, so a palette change repaints every
 * story ever posted rather than stranding them on last year's colours.
 */
export const STORY_BACKGROUNDS = [
  ["#059669", "#047857"],
  ["#2563EB", "#1D4ED8"],
  ["#DB2777", "#9D174D"],
  ["#EA580C", "#C2410C"],
  ["#7C3AED", "#5B21B6"],
  ["#0F172A", "#334155"],
] as const;

export interface StoryAuthor {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
  isVerifiedRealtor: boolean;
}

export interface Story {
  id: string;
  authorId: string;
  type: StoryType;
  /** The photo or the video. Null on a text-only story. */
  mediaUrl: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  /** Videos only — how long the progress bar takes to fill. */
  durationSec: number | null;
  /** The caption, or the whole story when the type is TEXT. */
  body: string | null;
  /** Index into STORY_BACKGROUNDS. */
  background: number;
  /** A listing of the author's to send viewers to. */
  listingId: string | null;
  viewCount: number;
  reactionCount: number;
  expiresAt: string;
  createdAt: string;
  /** Whether this viewer has already watched it. */
  seen: boolean;
}

/** One story opened on its own, with who posted it and your reaction. */
export interface StoryDetail extends Story {
  author: StoryAuthor | null;
  myReaction: string | null;
}

/** Everything one person has up, as the tray shows it. */
export interface StoryGroup {
  author: StoryAuthor | null;
  isMine: boolean;
  hasUnseen: boolean;
  latestAt: string;
  stories: Story[];
}

export interface StoryViewer {
  viewer: StoryAuthor | null;
  reaction: string | null;
  seenAt: string;
}

export interface CreateStoryInput {
  type: StoryType;
  mediaUrl?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  body?: string;
  background?: number;
  listingId?: string;
  hours?: StoryHours;
}

/** The reactions the viewer offers. Telegram's set, near enough. */
export const STORY_REACTIONS = ["❤️", "🔥", "👍", "😍", "👏", "😮"] as const;

export const storiesApi = {
  /** Public: a signed-out reader sees the same stories, none of them seen. */
  tray: () => api<{ groups: StoryGroup[] }>("/stories", { auth: false }),

  get: (id: string) => api<StoryDetail>(`/stories/${id}`, { auth: false }),

  create: (input: CreateStoryInput) =>
    api<StoryDetail>("/stories", { method: "POST", body: input }),

  /** Deduplicated server-side, so calling it on every open is correct. */
  markSeen: (id: string) =>
    api<{ viewCount: number; counted: boolean }>(`/stories/${id}/view`, {
      method: "POST",
    }),

  /** The same emoji again takes it back; a different one replaces it. */
  react: (id: string, emoji: string) =>
    api<{ reactionCount: number; myReaction: string | null }>(
      `/stories/${id}/reaction`,
      { method: "PUT", body: { emoji } },
    ),

  /** The poster's list, and nobody else's. */
  viewers: (id: string, limit = 50, offset = 0) =>
    api<{ total: number; items: StoryViewer[] }>(
      `/stories/${id}/viewers?limit=${limit}&offset=${offset}`,
    ),

  remove: (id: string) =>
    api<{ success: boolean }>(`/stories/${id}`, { method: "DELETE" }),
};

import { api } from "@/src/lib/api-client";

export interface BlockedPerson {
  id: string;
  name: string | null;
  surname: string | null;
  avatarThumbUrl: string | null;
  blockedAt: string;
}

export const blocksApi = {
  list: () => api<BlockedPerson[]>("/me/blocks"),

  /** Both idempotent, so a double tap can never error. */
  block: (userId: string) =>
    api<{ blocked: boolean }>(`/users/${userId}/block`, { method: "PUT" }),

  unblock: (userId: string) =>
    api<{ blocked: boolean }>(`/users/${userId}/block`, { method: "DELETE" }),
};

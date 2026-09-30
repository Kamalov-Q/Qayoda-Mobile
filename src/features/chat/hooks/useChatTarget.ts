import { useMemo } from "react";
import { router } from "expo-router";
import { useConversations } from "./useConversations";
import { useUserProfile } from "../../users/hooks/useUserProfile";
import { useAuthStore } from "../../auth/store/auth.store";
import { requirePhone } from "../../auth/guest";

/**
 * How to start writing to somebody.
 *
 * Conversations in this app are bound to a listing, so "message this person"
 * is really two different actions: reopen the thread you already have with
 * them, or start one about the newest thing they have posted — which is what
 * you would have tapped through to anyway.
 *
 * Shared between the profile and the story viewer so the button means the
 * same thing in both, and so neither has to know that rule.
 */
export function useChatTarget(userId: string | undefined) {
  const viewerId = useAuthStore((s) => s.user?.id);
  const { data: conversations } = useConversations();
  // Their listings come with their profile card, which both callers want for
  // the phone number anyway.
  const { data: profile } = useUserProfile(userId);

  const target = useMemo(() => {
    if (!userId || userId === viewerId) return null;

    const existing = conversations?.find((c) => c.other.id === userId);
    if (existing) return { kind: "existing" as const, id: existing.id };

    const listing = profile?.listings?.[0];
    return listing ? { kind: "new" as const, listingId: listing.id } : null;
  }, [userId, viewerId, conversations, profile?.listings]);

  /** Opens the thread. Gated on a phone, like every other way of writing. */
  const openChat = () => {
    if (!target) return;
    requirePhone(() =>
      target.kind === "existing"
        ? // No `prefill`: that seeds the composer with the listing-enquiry
          // boilerplate, which is right when you arrive from an advert and
          // wrong when you arrive from a person.
          router.push({ pathname: "/chat/[id]", params: { id: target.id } })
        : router.push({
            pathname: "/chat/[id]",
            params: { id: "new", listingId: target.listingId },
          }),
    );
  };

  return {
    target,
    openChat,
    /** Their number, when they have one and the viewer may see it. */
    phone: profile?.phoneNumber ?? null,
    isMe: !!userId && userId === viewerId,
  };
}

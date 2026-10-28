// src/features/notifications/inboxGroups.ts
//
// "Five people liked your video", instead of five rows that say it once each.
//
// The server already stops the SAME person's like being written twice inside
// a day (LIKE_DEDUPE_HOURS), which is the other half of this problem. It
// cannot collapse five DIFFERENT people: each of those is a real, separate
// row that somebody might want to tap through to. So the collapsing happens
// here, where it is presentation and reversible, rather than in the table,
// where it would be a row that was never written.
import type { AppNotification, NotificationKind } from "./api/notifications.api";

/**
 * Kinds where only the actor differs between rows.
 *
 * Deliberately a list rather than a rule. The kinds left OUT are the point:
 *
 *  - the five PRICE_BID_* kinds, because each is a DIFFERENT NUMBER. "3 price
 *    offers" hides the only fact that matters and is worse than three rows.
 *  - money, because each row is a distinct transaction with its own amount.
 *  - VIDEO_READY / VIDEO_FAILED / VIDEO_AWAITING_PAYMENT, because each is
 *    about one specific upload and each needs its own action.
 */
const GROUPABLE: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  "VIDEO_LIKE",
  "VIDEO_COMMENT",
  "COMMENT_REPLY",
  "LISTING_COMMENT",
  "LISTING_COMMENT_REPLY",
  "LISTING_REVIEW",
  "NEW_FOLLOWER",
]);

export interface NotificationGroup {
  /** The newest row in the group — what the row is drawn from. */
  lead: AppNotification;
  /**
   * Every row folded in, newest first and including the lead. Tapping marks
   * all of them read: the reader has just been shown that all of them
   * happened, so leaving four unread would make the bell argue with the
   * screen they are looking at.
   */
  ids: string[];
  /** How many rows this one stands for. 1 for an ordinary row. */
  count: number;
  /** Names of the others, for "Ali and 4 others". Deduped, lead excluded. */
  otherActors: string[];
}

const keyOf = (n: AppNotification): string =>
  // NEW_FOLLOWER references nothing, so its key is the kind alone and every
  // adjacent follow folds together. Everything else groups per thing.
  `${n.kind}|${n.videoId ?? n.listingId ?? n.conversationId ?? ""}`;

const actorName = (n: AppNotification): string | null =>
  [n.actor?.name, n.actor?.surname].filter(Boolean).join(" ") || null;

/**
 * Collapse ADJACENT rows only.
 *
 * Not "all rows with the same key", which would be stronger and wrong: the
 * list arrives newest first, so reordering to gather a like from last week
 * next to one from this morning would put a stale row at the top and move
 * everything under it. Adjacency means the collapse never changes the order
 * of what is on screen — it only joins rows that were already neighbours.
 *
 * Read state is part of the key in effect: a read row is never folded into
 * an unread group, because the group wears one wash for all of them and
 * would otherwise claim rows as new that the reader had already seen.
 */
export function groupNotifications(
  items: AppNotification[],
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  let lastKey: string | null = null;

  for (const item of items) {
    const groupable = GROUPABLE.has(item.kind);
    const key = groupable ? `${keyOf(item)}|${item.read}` : null;
    const previous = groups[groups.length - 1];

    if (key !== null && key === lastKey && previous) {
      previous.ids.push(item.id);
      previous.count += 1;
      const name = actorName(item);
      // The lead's own name is already printed in bold at the front of the
      // row, so it is not one of the "others" — a second like from the same
      // person must not turn one row into "Ali and Ali".
      if (
        name &&
        name !== actorName(previous.lead) &&
        !previous.otherActors.includes(name)
      ) {
        previous.otherActors.push(name);
      }
      continue;
    }

    groups.push({
      lead: item,
      ids: [item.id],
      count: 1,
      otherActors: [],
    });
    lastKey = key;
  }

  return groups;
}

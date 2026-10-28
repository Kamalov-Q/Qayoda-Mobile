// src/features/notifications/inboxPreview.ts
//
// The second line of an inbox row: the fact the notification is actually
// about.
//
// Every row used to read "somebody offered a price on your advert" and
// nothing more, so the only way to learn WHAT was offered was to open the
// thread — and the whole point of an inbox is deciding what is worth opening.
// The facts are already on the row: `meta` carries the amount a bid was for,
// the sum a top-up cleared and the stars a review gave. This prints them.
//
// Nothing here fetches anything. A preview that costs a request is a preview
// that arrives after the decision it was meant to inform.
import type { AppNotification } from "./api/notifications.api";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/** Same rule as the bid sheet: so'm says so'm, everything else shows a $. */
const unitFor = (currency: string | null) =>
  currency === "UZS" || currency === null ? "so'm" : "$";

const money = (amount: number, currency: string | null): string =>
  `${Math.round(amount).toLocaleString("ru-RU").replace(/ /g, " ")} ${unitFor(currency)}`;

/**
 * One short line, or null when the row has nothing extra to say.
 *
 * Null is the common case and must stay cheap: a follow, a comment or a video
 * going live is fully described by its own sentence, and a second line
 * repeating it in other words is noise with a layout cost.
 */
export function inboxPreview(n: AppNotification): string | null {
  const meta = n.meta;
  if (!meta) return null;

  switch (n.kind) {
    // The number on the table. The one fact that decides whether this is
    // worth opening right now.
    case "PRICE_BID_RECEIVED":
    case "PRICE_BID_COUNTERED":
    case "PRICE_BID_ACCEPTED":
    case "PRICE_BID_DECLINED":
    case "PRICE_BID_EXPIRED": {
      const amount = num(meta.amount);
      return amount === null ? null : money(amount, str(meta.currency));
    }

    // Signed, because a wallet row that does not say which way the money
    // went is a wallet row nobody trusts. A bonus is shown separately: it is
    // the part the user did not pay for, and rolling it into one figure is
    // how a top-up looks like it charged the wrong amount.
    case "TOPUP_SUCCEEDED":
    case "TOPUP_FAILED": {
      const amount = num(meta.amount);
      if (amount === null) return null;
      const bonus = num(meta.bonusAmount);
      const head = `+${money(amount, str(meta.currency))}`;
      return bonus && bonus > 0
        ? `${head} (+${money(bonus, str(meta.currency))})`
        : head;
    }

    // Five glyphs, not a number: the row is read at a glance and "4" next to
    // a star means both four stars and four reviews depending on who is
    // looking.
    case "LISTING_REVIEW": {
      const rating = num(meta.rating);
      if (rating === null) return null;
      const whole = Math.max(0, Math.min(5, Math.round(rating)));
      return "★".repeat(whole) + "☆".repeat(5 - whole);
    }

    default:
      return null;
  }
}

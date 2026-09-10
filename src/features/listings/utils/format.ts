// Localised formatters for listing values. These are hooks so that components
// showing prices and specs re-render when the language changes — a pure helper
// reading the store would keep stale text on screen until something else
// happened to re-render it.
import { useCallback } from "react";
import { useT } from "../../../i18n";
import { usePreferences } from "../../../lib/preferences";
import { useRates } from "../hooks/useRates";

/**
 * The description field is plain text but the API column is HTML, so what the
 * user typed is escaped — not passed through — before it is wrapped. Typing an
 * angle bracket must not turn into markup on the way back out.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * The API stores descriptions as HTML. React Native has no HTML renderer, so a
 * raw string would put literal `<p>` tags on screen — this flattens it to text
 * rather than pulling in a renderer for what is a few paragraphs of prose.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * `(price, currency, purpose) => "$1,200/oy"` — in the VIEWER's currency:
 * the stored price converts through the CBU rate whenever the seller quoted
 * in the other one. No rate yet (first boot, offline) → shown as stored.
 */
export function usePriceFormatter() {
  const t = useT();
  const target = usePreferences((s) => s.currency);
  const { data: rates } = useRates();

  return useCallback(
    (price: string | number, currency: string, purpose?: string) => {
      const suffix =
        purpose === "RENT_MONTHLY"
          ? t("listings.perMonth")
          : purpose === "RENT_DAILY"
            ? t("listings.perDay")
            : "";

      let value = Number(price);
      let shown = currency;
      if (currency !== target && rates?.usdToUzs) {
        value =
          currency === "USD" ? value * rates.usdToUzs : value / rates.usdToUzs;
        shown = target;
      }

      const body =
        shown === "UZS"
          ? `${Math.round(value)
              .toLocaleString("en-US")
              .replace(/,/g, " ")} ${t("listings.som")}`
          : `$${Math.round(value).toLocaleString("en-US")}`;
      return body + suffix;
    },
    [t, target, rates],
  );
}

interface Specs {
  areaM2?: string | number | null;
  rooms?: number | null;
  floor?: number | null;
}

/** The "80 m² · 3 xona · 5-qavat" summary line, with empty parts dropped. */
export function useSpecsFormatter() {
  const t = useT();
  return useCallback(
    ({ areaM2, rooms, floor }: Specs) =>
      [
        areaM2 ? `${Number(areaM2)} m²` : null,
        rooms ? t("listings.roomsShort", { count: rooms }) : null,
        floor ? t("listings.floorShort", { floor }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    [t],
  );
}

/** "Bugun" / "5 kun oldin" — the freshness stamp on feed cards. */
export function useRelativeDate() {
  const t = useT();
  return useCallback(
    (iso: string | null) => {
      if (!iso) return null;
      const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
      if (!Number.isFinite(days) || days < 0) return null;
      if (days === 0) return t("listings.today");
      if (days < 30) return t("listings.daysAgo", { count: days });
      return t("listings.monthsAgo", { count: Math.floor(days / 30) });
    },
    [t],
  );
}

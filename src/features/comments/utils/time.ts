import { useCallback } from "react";
import { useT } from "@/src/i18n";

/**
 * "hozir" / "5 daqiqa" / "2 soat" / "3 kun oldin".
 *
 * Finer than the feed's freshness stamp on purpose: a listing posted today
 * and one posted this morning are the same listing, but a comment left a
 * minute ago and one left this morning are different conversations.
 */
export function useCommentTime() {
  const t = useT();

  return useCallback(
    (iso: string) => {
      const ms = Date.now() - new Date(iso).getTime();
      if (!Number.isFinite(ms) || ms < 0) return "";

      const minutes = Math.floor(ms / 60_000);
      if (minutes < 1) return t("comments.justNow");
      if (minutes < 60) return t("comments.minutesAgo", { count: minutes });

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t("comments.hoursAgo", { count: hours });

      const days = Math.floor(hours / 24);
      if (days < 30) return t("listings.daysAgo", { count: days });
      return t("listings.monthsAgo", { count: Math.floor(days / 30) });
    },
    [t],
  );
}

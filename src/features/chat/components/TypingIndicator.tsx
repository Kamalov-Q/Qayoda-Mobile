import { useQuery, skipToken } from "@tanstack/react-query";
import { Text } from "react-native";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";

/**
 * Reads the cache entry useChatSocket writes on every `typing` event — there
 * is nothing to fetch, since typing state only ever arrives over the socket.
 *
 * `queryFn: skipToken` rather than a bare `enabled: false`: v5 still validates
 * that a query has a fetcher and logged "No queryFn was passed as an option"
 * on every mount. skipToken is the supported way to say "never fetch this",
 * and it keeps the subscription that makes setQueryData re-render us.
 */
export function TypingIndicator({
  conversationId,
}: {
  conversationId: string;
}) {
  const { text } = useTheme();
  const t = useT();
  const { data } = useQuery<{ isTyping: boolean; kind: string } | null>({
    queryKey: ["chat", "typing", conversationId],
    queryFn: skipToken,
  });

  if (!data?.isTyping) return null;

  const label =
    data.kind === "voice"
      ? t("chat.typingVoice")
      : data.kind === "video"
        ? t("chat.typingVideo")
        : t("chat.typing");

  return (
    <Text
      style={{
        ...text.caption,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
      }}
    >
      {label}
    </Text>
  );
}

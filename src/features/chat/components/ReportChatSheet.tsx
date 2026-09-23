// src/features/chat/components/ReportChatSheet.tsx
// Chat reports: the shared sheet, wired to the conversation endpoint and the
// `chatReport.*` strings. `messageId` pins the message the report came from
// when it was opened by long-pressing one.
import { ReportSheet } from "../../moderation/ReportSheet";
import { useT } from "../../../i18n";
import { chatApi, CHAT_REPORT_REASONS, type ChatReportReason } from "../api/chat.api";

interface Props {
  conversationId: string;
  visible: boolean;
  onClose: () => void;
  messageId?: string;
}

export function ReportChatSheet({
  conversationId,
  visible,
  onClose,
  messageId,
}: Props) {
  const t = useT();
  return (
    <ReportSheet<ChatReportReason>
      visible={visible}
      onClose={onClose}
      reasons={CHAT_REPORT_REASONS}
      title={t("chatReport.title")}
      // Says plainly what reporting costs in privacy: a moderator will be
      // able to read this thread.
      subtitle={`${t("chatReport.subtitle")} ${t("chatReport.notice")}`}
      labelFor={(key) => t(`chatReport.${key}` as Parameters<typeof t>[0])}
      submit={(reason, comment) =>
        chatApi.report(conversationId, reason, comment, messageId)
      }
      sentKey="chatReport.sent"
      alreadyKey="chatReport.already"
    />
  );
}

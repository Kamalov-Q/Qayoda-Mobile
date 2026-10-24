import { ReportSheet } from "@/src/features/moderation/ReportSheet";
import { useT } from "@/src/i18n";
import {
  VIDEO_REPORT_REASONS,
  videosApi,
  type VideoReportReason,
} from "../api/videos.api";

/**
 * Video reports: the shared sheet, wired to the video endpoint.
 *
 * The reasons are the video list, and the labels come from `report.*` — four
 * of the five are the same words as for a listing, because "nomaqbul
 * kontent" does not change meaning depending on what it is attached to.
 */
export function ReportVideoSheet({
  videoId,
  commentId,
  visible,
  onClose,
}: {
  videoId: string;
  /** Set to flag one comment under the reel instead of the reel itself. */
  commentId?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();

  return (
    <ReportSheet<VideoReportReason>
      visible={visible}
      onClose={onClose}
      reasons={VIDEO_REPORT_REASONS}
      title={t("report.title")}
      subtitle={t(
        commentId ? "report.commentSubtitle" : "report.videoSubtitle",
      )}
      labelFor={(key) => t(`report.${key}` as Parameters<typeof t>[0])}
      // Same sheet, same six reasons, same queue — only the target differs,
      // which is also how the server sees it.
      submit={(reason, comment) =>
        commentId
          ? videosApi.reportComment(videoId, commentId, reason, comment)
          : videosApi.report(videoId, reason, comment)
      }
      sentKey="report.sent"
      alreadyKey={commentId ? "report.alreadyComment" : "report.alreadyVideo"}
    />
  );
}

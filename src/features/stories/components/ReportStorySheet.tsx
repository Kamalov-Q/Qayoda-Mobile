// Story reports: the shared moderation sheet, wired to the story endpoint and
// the `storyReport.*` strings. A report keeps a copy of what it was about on
// the server, so it still means something after the story has expired.
import { ReportSheet } from "@/src/features/moderation/ReportSheet";
import { useT } from "@/src/i18n";
import {
  storiesApi,
  STORY_REPORT_REASONS,
  type StoryReportReason,
} from "../api/stories.api";

interface Props {
  storyId: string;
  visible: boolean;
  onClose: () => void;
}

export function ReportStorySheet({ storyId, visible, onClose }: Props) {
  const t = useT();
  return (
    <ReportSheet<StoryReportReason>
      visible={visible}
      onClose={onClose}
      reasons={STORY_REPORT_REASONS}
      title={t("storyReport.title")}
      subtitle={t("storyReport.subtitle")}
      labelFor={(key) => t(`storyReport.${key}` as Parameters<typeof t>[0])}
      submit={(reason, comment) => storiesApi.report(storyId, reason, comment)}
      sentKey="stories.reported"
      alreadyKey="storyReport.already"
    />
  );
}

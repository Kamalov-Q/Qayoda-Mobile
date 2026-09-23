// src/features/listings/components/ReportListingSheet.tsx
// Listing reports: the shared sheet, wired to the listing endpoint and the
// `report.*` strings.
import { ReportSheet } from "../../moderation/ReportSheet";
import { useT } from "../../../i18n";
import { listingApi, REPORT_REASONS, type ReportReason } from "../api/listings.api";

interface Props {
  listingId: string;
  visible: boolean;
  onClose: () => void;
}

export function ReportListingSheet({ listingId, visible, onClose }: Props) {
  const t = useT();
  return (
    <ReportSheet<ReportReason>
      visible={visible}
      onClose={onClose}
      reasons={REPORT_REASONS}
      title={t("report.title")}
      subtitle={t("report.subtitle")}
      labelFor={(key) => t(`report.${key}` as Parameters<typeof t>[0])}
      submit={(reason, comment) => listingApi.report(listingId, reason, comment)}
      sentKey="report.sent"
      alreadyKey="report.already"
    />
  );
}

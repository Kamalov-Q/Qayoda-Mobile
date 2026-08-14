import { memo } from "react";
import { spacing } from "../../theme/tokens";
import { useT } from "../../i18n";
import { MapIconButton } from "./MapIconButton";

interface Props {
  onPress: () => void;
  loading: boolean;
  bottomOffset: number;
}

/** The locate control, pinned to a map's bottom-right corner. */
export const MyLocationButton = memo(function MyLocationButton({
  onPress,
  loading,
  bottomOffset,
}: Props) {
  const t = useT();

  return (
    <MapIconButton
      icon="locate"
      label={t("location.myLocation")}
      onPress={onPress}
      loading={loading}
      style={{ position: "absolute", right: spacing.md, bottom: bottomOffset }}
    />
  );
});

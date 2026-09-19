// src/features/chat/components/PresenceStatus.tsx
import { memo } from "react";
import { Text, View } from "react-native";
import { radii, spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useLanguage } from "../../../i18n";
import { PulseHalo } from "../../../components/ui/PulseHalo";
import { formatPresence, type Presence } from "../hooks/usePresence";

/**
 * Dot + words. The dot alone is colour-only information, so the label always
 * rides with it. Renders nothing while presence is unknown (loading, or a
 * signed-out viewer) rather than guessing "offline".
 */
export const PresenceStatus = memo(function PresenceStatus({
  presence,
  prefix,
}: {
  presence: Presence | null | undefined;
  /** Leading words, e.g. "Sotuvchi" → "Sotuvchi · onlayn". */
  prefix?: string;
}) {
  const { colors, text } = useTheme();
  const language = useLanguage();
  if (!presence) return null;

  const label = formatPresence(presence, language);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
      accessibilityRole="text"
      accessibilityLabel={prefix ? `${prefix}: ${label}` : label}
    >
      <View
        style={{
          width: 8,
          height: 8,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {presence.online ? <PulseHalo size={8} color={colors.success} /> : null}
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: radii.pill,
            backgroundColor: presence.online
              ? colors.success
              : colors.textFaint,
          }}
        />
      </View>
      <Text
        style={{
          ...text.caption,
          color: presence.online ? colors.success : colors.textMuted,
        }}
      >
        {prefix ? `${prefix} · ${label}` : label}
      </Text>
    </View>
  );
});

import { memo, useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, sizing, spacing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";
import { SelectSheet } from "../../components/ui";
import { toast } from "../../components/ui/Toast";
import {
  availableNavTargets,
  navTargets,
  openNavTarget,
  type NavTarget,
} from "../../lib/navigation-apps";

interface Props {
  latitude: number;
  longitude: number;
  /** Named on the pin in apps that show one. */
  label?: string | null;
  /** Smaller, for a row that already has words in it. */
  compact?: boolean;
  style?: object;
}

/**
 * "Take me there" — the one thing a map of somewhere you might go is for, and
 * the one thing our own map cannot do. It hands the place to whatever the
 * reader actually navigates with.
 *
 * A labelled pill rather than another round glyph: the map already floats
 * three of those, and this is the only control on it that leaves the app.
 *
 * The picker appears only when there is a choice to make. One target — a
 * phone with a single maps app, or none, where the web link stands in — opens
 * straight away, because a sheet with one row is a tap that asks permission
 * to do the obvious.
 */
export const NavigateButton = memo(function NavigateButton({
  latitude,
  longitude,
  label,
  compact,
  style,
}: Props) {
  const { colors, shadow } = useTheme();
  const t = useT();
  const [options, setOptions] = useState<NavTarget[] | null>(null);

  const go = useCallback(
    async (target: NavTarget) => {
      if (!(await openNavTarget(target))) {
        toast.error(t("location.navigateFailed"));
      }
    },
    [t],
  );

  const onPress = useCallback(async () => {
    const found = await availableNavTargets(
      navTargets(latitude, longitude, label),
    );

    if (found.length === 1) {
      await go(found[0]);
      return;
    }
    setOptions(found);
  }, [latitude, longitude, label, go]);

  return (
    <>
      <Pressable
        onPress={() => void onPress()}
        accessibilityRole="button"
        accessibilityLabel={t("location.navigate")}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            height: compact ? 34 : sizing.controlMd,
            paddingHorizontal: compact ? spacing.md : spacing.lg,
            borderRadius: radii.pill,
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            // The floating one needs to lift off the map; in a row it would
            // just look like it had come unstuck.
            ...(compact ? null : shadow.raised),
          },
          style,
        ]}
      >
        <Ionicons
          name="navigate"
          size={compact ? 15 : 18}
          color={colors.onPrimary}
        />
        <Text
          style={{
            ...type.bodyStrong,
            fontSize: compact ? 13 : 15,
            color: colors.onPrimary,
          }}
        >
          {t("location.navigate")}
        </Text>
      </Pressable>

      <SelectSheet
        visible={!!options}
        title={t("location.navigateTitle")}
        options={(options ?? []).map((o) => ({
          value: o.key,
          label: o.label,
          icon:
            o.icon === "navigate"
              ? ("navigate-outline" as const)
              : o.icon === "globe"
                ? ("globe-outline" as const)
                : ("map-outline" as const),
        }))}
        // Nothing is "selected" here — these are actions, and a tick beside
        // the last app somebody used would be a preference this does not keep.
        value=""
        onSelect={(key) => {
          const target = options?.find((o) => o.key === key);
          if (target) void go(target);
        }}
        onClose={() => setOptions(null)}
      />
    </>
  );
});

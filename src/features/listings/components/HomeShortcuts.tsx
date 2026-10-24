// src/features/listings/components/HomeShortcuts.tsx
//
// The map card and the two tiles under it, at the top of the feed.
//
// The map used to be the third option in the grid / list / map switch, which
// put the app's one genuinely distinctive view behind an icon the size of a
// fingernail, in a row that otherwise only answers "how should these be
// shaped". A map is not a shape of a list — it is a different question
// ("where?"), and it earns a card that says so.
import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { radii, spacing, type, weight } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";

export const HomeShortcuts = memo(function HomeShortcuts({
  onOpenMap,
}: {
  /** The map is a mode of the home screen, not a route — see home.tsx. */
  onOpenMap: () => void;
}) {
  const { colors, shadow } = useTheme();
  const t = useT();

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        onPress={onOpenMap}
        accessibilityRole="button"
        accessibilityLabel={t("listings.mapButton")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.xl,
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          ...shadow.card,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.onPrimary,
          }}
        >
          <Ionicons name="map" size={22} color={colors.primary} />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{ ...type.bodyStrong, fontSize: 16, color: colors.onPrimary }}
          >
            {t("listings.mapCardTitle")}
          </Text>
          <Text
            style={{ ...type.caption, color: colors.onPrimary, opacity: 0.85 }}
          >
            {t("listings.mapCardHint")}
          </Text>
        </View>

        <MapGlance />
      </Pressable>

      {/* Two, not four. Joymee's row carries mortgage and advice tiles as
          well; this app has neither, and a tile that opens nothing is worse
          than a gap. */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <ShortcutTile
          icon="people-outline"
          label={t("users.title")}
          onPress={() => router.push("/users")}
        />
        <ShortcutTile
          icon="videocam-outline"
          label={t("videos.title")}
          onPress={() => router.push("/explore-videos")}
        />
      </View>
    </View>
  );
});

const ShortcutTile = memo(function ShortcutTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={text.caption} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});


/**
 * The scrap of map on the right of the card.
 *
 * Drawn, not fetched. A real tile here would be a network request and a
 * MapKit layer for a thumbnail nobody reads as a map of anywhere — it is a
 * texture that says "map" and two price flags that say what the map is FOR,
 * which is the whole point the card is making. It also keeps the card
 * working offline and off the MapKit quota.
 *
 * Translucent white over the card's own fill rather than its own colour, so
 * it reads as a window cut into the card instead of a sticker on it.
 */
const MapGlance = memo(function MapGlance() {
  const { colors } = useTheme();
  const W = 96;
  const H = 62;

  return (
    <View
      style={{
        width: W,
        height: H,
        borderRadius: radii.md,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.16)",
      }}
    >
      <Svg width={W} height={H}>
        {/* Streets: two long diagonals and the blocks between them. Angled
            rather than square, because a grid of right angles at this size
            reads as a table. */}
        <Path
          d={`M-10 ${H * 0.72} L${W + 10} ${H * 0.22}`}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={5}
          fill="none"
        />
        <Path
          d={`M${W * 0.26} -10 L${W * 0.62} ${H + 10}`}
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={3.5}
          fill="none"
        />
        <Path
          d={`M-10 ${H * 0.26} L${W + 10} ${H * 0.04}`}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={2.5}
          fill="none"
        />
        <Rect
          x={W * 0.68}
          y={H * 0.56}
          width={W * 0.3}
          height={H * 0.3}
          rx={3}
          fill="rgba(255,255,255,0.18)"
        />
      </Svg>

      {/* Two price flags, as the card's actual claim: the map is where you
          see what things cost without opening any of them. */}
      <PriceFlag label="97 000" top={6} left={5} />
      <PriceFlag label="58 000" top={H * 0.52} left={W * 0.36} />

      <View
        style={{
          position: "absolute",
          right: 4,
          bottom: 3,
        }}
      >
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.onPrimary}
        />
      </View>
    </View>
  );
});

/** One price tag on the glance — a pill with a little tail, as a map pin. */
function PriceFlag({
  label,
  top,
  left,
}: {
  label: string;
  top: number;
  left: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        top,
        left,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: radii.sm,
        backgroundColor: colors.onPrimary,
      }}
    >
      <Text
        style={{ fontSize: 8.5, color: colors.primary, ...weight("700") }}
      >
        {label}
      </Text>
    </View>
  );
}

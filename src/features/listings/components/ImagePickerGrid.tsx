// Photo grid with drag-and-drop ordering.
//
// Order is meaningful — position 0 is the listing's cover — and the old grid
// expressed that through two hidden gestures (tap to promote, long-press to
// delete), which nothing on screen announced. Now the tile is dragged where it
// belongs and deleted with a visible button, and "primary" is simply first.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { resolveMediaUrl } from "../../../lib/media-url";
import { MAX_IMAGES, type ManagedImage } from "../hooks/useImageUpload";

const GAP = spacing.sm;
const MIN_TILE = 88;

interface Props {
  images: ManagedImage[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onRetry: () => void;
  onReorder: (from: number, to: number) => void;
}

/** Slot geometry. The grid is uniform, so a point maps straight to an index. */
function slotOf(index: number, cols: number, tile: number) {
  return {
    x: (index % cols) * (tile + GAP),
    y: Math.floor(index / cols) * (tile + GAP),
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const ImagePickerGrid = memo(function ImagePickerGrid({
  images,
  onAdd,
  onRemove,
  onRetry,
  onReorder,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const [width, setWidth] = useState(0);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // The gesture callbacks land here through runOnJS, one frame behind the
  // render that set the state — refs keep them reading the live values.
  const dragFrom = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);

  const hasErrors = images.some((i) => i.status === "error");
  const canAdd = images.length < MAX_IMAGES;

  const cols = width
    ? Math.max(3, Math.floor((width + GAP) / (MIN_TILE + GAP)))
    : 3;
  const tile = width ? (width - GAP * (cols - 1)) / cols : MIN_TILE;

  // While a tile is held, the others shuffle around its would-be slot; the
  // committed order only changes on drop.
  const ordered = useMemo(() => {
    if (!dragKey || hover === null) return images;
    const from = images.findIndex((i) => i.key === dragKey);
    return from < 0 ? images : move(images, from, hover);
  }, [images, dragKey, hover]);

  const rows = Math.ceil((images.length + (canAdd ? 1 : 0)) / cols);
  const height = rows > 0 ? rows * (tile + GAP) - GAP : 0;

  const beginDrag = useCallback(
    (key: string, index: number) => {
      dragFrom.current = index;
      hoverRef.current = index;
      setDragKey(key);
      setHover(index);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [],
  );

  const hoverAt = useCallback((index: number) => {
    if (hoverRef.current === index) return;
    hoverRef.current = index;
    setHover(index);
    void Haptics.selectionAsync();
  }, []);

  const endDrag = useCallback(() => {
    const from = dragFrom.current;
    const to = hoverRef.current;
    dragFrom.current = null;
    hoverRef.current = null;
    setDragKey(null);
    setHover(null);
    if (from !== null && to !== null && from !== to) onReorder(from, to);
  }, [onReorder]);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={text.label}>
          {t("images.section")}
          <Text style={{ color: colors.danger }}> *</Text>
        </Text>
        <Text style={text.caption}>
          {t("images.counter", { count: images.length, max: MAX_IMAGES })}
        </Text>
      </View>

      {/* Absolutely positioned tiles rather than a wrapping row: a dragged
          tile has to leave the flow, and the rest have to animate into the
          slot it vacated. */}
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height }}
      >
        {width
          ? ordered.map((img, index) => (
              <ImageTile
                key={img.key}
                image={img}
                index={index}
                sourceIndex={images.findIndex((i) => i.key === img.key)}
                cols={cols}
                tile={tile}
                count={images.length}
                active={dragKey === img.key}
                onBeginDrag={beginDrag}
                onHover={hoverAt}
                onEndDrag={endDrag}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))
          : null}

        {width && canAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t("images.add")}
            style={({ pressed }) => ({
              position: "absolute",
              ...slotOf(images.length, cols, tile),
              width: tile,
              height: tile,
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: colors.borderStrong,
              backgroundColor: pressed ? colors.surfaceRaised : "transparent",
              justifyContent: "center",
              alignItems: "center",
            })}
          >
            <Ionicons name="add" size={26} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={text.caption}>{t("images.hint")}</Text>

      {hasErrors ? (
        <Text style={{ ...type.caption, color: colors.danger }}>
          {t("images.someFailed")}
        </Text>
      ) : null}
    </View>
  );
});

const ImageTile = memo(function ImageTile({
  image: img,
  index,
  sourceIndex,
  cols,
  tile,
  count,
  active,
  onBeginDrag,
  onHover,
  onEndDrag,
  onRemove,
  onRetry,
}: {
  image: ManagedImage;
  index: number;
  /** Position in the committed list — what a reorder is measured from. */
  sourceIndex: number;
  cols: number;
  tile: number;
  count: number;
  active: boolean;
  onBeginDrag: (key: string, index: number) => void;
  onHover: (index: number) => void;
  onEndDrag: () => void;
  onRemove: (key: string) => void;
  onRetry: () => void;
}) {
  const { colors, shadow } = useTheme();
  const t = useT();

  const slot = slotOf(index, cols, tile);
  const x = useSharedValue(slot.x);
  const y = useSharedValue(slot.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lastHover = useSharedValue(-1);
  const lifted = useSharedValue(0);

  // Springs the tile into its slot whenever the order changes, and again on
  // drop — `active` going false is the only signal there, since the tile may
  // be landing in the very slot it started from.
  useEffect(() => {
    if (active) return;
    x.value = withTiming(slot.x, { duration: 180 });
    y.value = withTiming(slot.y, { duration: 180 });
    lifted.value = withTiming(0, { duration: 140 });
  }, [active, slot.x, slot.y, x, y, lifted]);

  const pan = Gesture.Pan()
    // Only after a deliberate hold: a plain drag has to stay available to the
    // scroll view the form lives in.
    .activateAfterLongPress(180)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
      lastHover.value = index;
      lifted.value = withTiming(1, { duration: 140 });
      runOnJS(onBeginDrag)(img.key, sourceIndex);
    })
    .onUpdate((e) => {
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;

      const col = Math.round(x.value / (tile + GAP));
      const row = Math.round(y.value / (tile + GAP));
      const target = Math.min(
        Math.max(row * cols + Math.min(Math.max(col, 0), cols - 1), 0),
        count - 1,
      );

      if (target !== lastHover.value) {
        lastHover.value = target;
        runOnJS(onHover)(target);
      }
    })
    .onFinalize(() => {
      lastHover.value = -1;
      runOnJS(onEndDrag)();
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: 1 + lifted.value * 0.08 },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: tile,
            height: tile,
            // Static, not animated: the held tile has to paint over its
            // neighbours the whole time it is up, and z-order is not something
            // to interpolate.
            zIndex: active ? 10 : 0,
          },
          style,
          active ? shadow.raised : null,
        ]}
      >
        <Pressable
          onPress={() => img.status === "error" && onRetry()}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            index === 0 ? t("images.primary") : t("images.section")
          }
          accessibilityHint={t("images.hint")}
          style={{ width: "100%", height: "100%" }}
        >
          <Image
            // Existing images come back as API-relative paths; local picks are
            // file:// URIs. resolveMediaUrl handles both.
            source={{ uri: resolveMediaUrl(img.displayUri) }}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radii.md,
              borderWidth: index === 0 ? 2 : 1,
              borderColor: index === 0 ? colors.primary : colors.border,
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />

          {index === 0 ? (
            <View
              style={{
                position: "absolute",
                bottom: 4,
                left: 4,
                right: 4,
                alignItems: "center",
                backgroundColor: colors.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: radii.sm,
              }}
            >
              <Text
                style={{
                  ...type.caption,
                  fontSize: 10,
                  fontWeight: "700",
                  color: colors.onPrimary,
                }}
                numberOfLines={1}
              >
                {t("images.primary")}
              </Text>
            </View>
          ) : null}

          {img.status === "uploading" ? (
            <Overlay background={colors.overlay}>
              <ActivityIndicator color="#FFFFFF" />
            </Overlay>
          ) : null}

          {img.status === "error" ? (
            <Overlay background={colors.danger}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text
                style={{
                  ...type.caption,
                  fontSize: 10,
                  color: "#FFFFFF",
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {t("images.retryHint")}
              </Text>
            </Overlay>
          ) : null}
        </Pressable>

        {/* Deleting used to be a long-press, which is now the drag — and an
            invisible gesture was never a good home for a destructive one. */}
        <Pressable
          onPress={() => onRemove(img.key)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("images.remove")}
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={15} color={colors.text} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
});

function Overlay({
  background,
  children,
}: {
  background: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        gap: 2,
        backgroundColor: background,
        opacity: 0.85,
        borderRadius: radii.md,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
}

import { memo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, type } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { useT } from "../../../i18n";
import { resolveMediaUrl } from "../../../lib/media-url";
import { MAX_IMAGES, type ManagedImage } from "../hooks/useImageUpload";

const TILE = 90;

interface Props {
  images: ManagedImage[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onRetry: () => void;
  onMakePrimary?: (key: string) => void;
}

export const ImagePickerGrid = memo(function ImagePickerGrid({
  images,
  onAdd,
  onRemove,
  onRetry,
  onMakePrimary,
}: Props) {
  const { colors, text } = useTheme();
  const t = useT();
  const hasErrors = images.some((i) => i.status === "error");

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{ flexDirection: "row", justifyContent: "space-between" }}
      >
        <Text style={text.label}>{t("images.section")}</Text>
        <Text style={text.caption}>
          {t("images.counter", { count: images.length, max: MAX_IMAGES })}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {images.map((img, idx) => (
          <Pressable
            key={img.key}
            onLongPress={() => onRemove(img.key)}
            onPress={() => {
              if (img.status === "error") onRetry();
              else if (onMakePrimary && idx !== 0) onMakePrimary(img.key);
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={
              idx === 0 ? t("images.primary") : t("images.section")
            }
            accessibilityHint={t("images.hint")}
            style={{ width: TILE, height: TILE }}
          >
            <Image
              // Existing images come back as API-relative paths; local picks
              // are file:// URIs. resolveMediaUrl handles both.
              source={{ uri: resolveMediaUrl(img.displayUri) }}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: radii.md,
                borderWidth: idx === 0 ? 2 : 1,
                borderColor: idx === 0 ? colors.primary : colors.border,
              }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />

            {idx === 0 ? (
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
        ))}

        {images.length < MAX_IMAGES ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={t("images.add")}
            style={({ pressed }) => ({
              width: TILE,
              height: TILE,
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

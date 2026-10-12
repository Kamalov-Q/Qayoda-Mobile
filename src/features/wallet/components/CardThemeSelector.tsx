import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/useTheme";
import {
  PRESET_CARD_THEMES,
  useCardThemeStore,
} from "@/src/features/wallet/store/cardTheme.store";

const CUSTOM_PALETTE = [
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#A855F7", // Amethyst
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow
  "#84CC16", // Lime
  "#14B8A6", // Teal
  "#94A3B8", // Titanium Slate
];

export function CardThemeSelector() {
  const { colors, scheme } = useTheme();
  const { currentTheme, customHex, setThemeById, setCustomColor } =
    useCardThemeStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [inputHex, setInputHex] = useState(customHex);

  const handleSelectPreset = (id: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setThemeById(id);
  };

  const handleApplyCustom = (hex: string) => {
    let clean = hex.trim();
    if (!clean.startsWith("#")) {
      clean = `#${clean}`;
    }
    // Basic hex regex
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(clean)) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setCustomColor(clean);
      setModalVisible(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Ionicons name="color-palette-outline" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Karta rangi
          </Text>
        </View>
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          Bosib almashtiring (USD 🔄 UZS)
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {PRESET_CARD_THEMES.map((theme) => {
          const isSelected = currentTheme.id === theme.id;
          return (
            <Pressable
              key={theme.id}
              onPress={() => handleSelectPreset(theme.id)}
              accessibilityRole="button"
              accessibilityLabel={theme.name}
              style={({ pressed }) => [
                styles.themeCircle,
                {
                  backgroundColor: theme.accent,
                  borderColor: isSelected ? colors.text : "transparent",
                  transform: [{ scale: pressed ? 0.92 : isSelected ? 1.08 : 1 }],
                  shadowColor: theme.accent,
                  shadowOpacity: isSelected ? 0.6 : 0.2,
                  shadowRadius: isSelected ? 6 : 2,
                },
              ]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </Pressable>
          );
        })}

        {/* Custom Color Trigger */}
        <Pressable
          onPress={() => {
            setInputHex(customHex);
            setModalVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Maxsus rang tanlash"
          style={({ pressed }) => [
            styles.customButton,
            {
              backgroundColor: currentTheme.isCustom
                ? currentTheme.accent
                : scheme === "dark"
                  ? colors.surfaceRaised
                  : "#F3F4F6",
              borderColor: currentTheme.isCustom ? colors.text : colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons
            name="add"
            size={16}
            color={currentTheme.isCustom ? "#FFFFFF" : colors.text}
          />
          <Text
            style={[
              styles.customButtonText,
              { color: currentTheme.isCustom ? "#FFFFFF" : colors.text },
            ]}
          >
            Maxsus
          </Text>
        </Pressable>
      </ScrollView>

      {/* Custom Color Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons
                  name="color-wand-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Maxsus rang tanlash
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Quick Swatches Grid */}
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Tavsiya etilgan ranglar
            </Text>
            <View style={styles.paletteGrid}>
              {CUSTOM_PALETTE.map((hex) => {
                const isSelected = inputHex.toLowerCase() === hex.toLowerCase();
                return (
                  <Pressable
                    key={hex}
                    onPress={() => {
                      setInputHex(hex);
                      handleApplyCustom(hex);
                    }}
                    style={({ pressed }) => [
                      styles.paletteSwatch,
                      {
                        backgroundColor: hex,
                        borderColor: isSelected ? colors.text : "transparent",
                        borderWidth: isSelected ? 2.5 : 0,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Manual Hex Input */}
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              HEX kodi
            </Text>
            <View
              style={[
                styles.hexInputRow,
                {
                  backgroundColor:
                    scheme === "dark" ? colors.surfaceRaised : "#F3F4F6",
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.previewDot,
                  {
                    backgroundColor: inputHex.startsWith("#")
                      ? inputHex
                      : `#${inputHex}`,
                  },
                ]}
              />
              <TextInput
                value={inputHex}
                onChangeText={setInputHex}
                placeholder="#8B5CF6"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                maxLength={7}
                style={[styles.hexTextInput, { color: colors.text }]}
              />
              <Pressable
                onPress={() => handleApplyCustom(inputHex)}
                style={({ pressed }) => [
                  styles.applyButton,
                  {
                    backgroundColor: colors.text,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.applyButtonText, { color: colors.bg }]}>
                  Qo&apos;llash
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  hintText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  scrollList: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  themeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
  },
  customButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  customButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  paletteSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  hexInputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 8,
  },
  previewDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  hexTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    padding: 0,
  },
  applyButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  applyButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
});

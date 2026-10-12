// app/wallet/history.tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";

export default function WalletHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useT();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("wallet.historyTitle")}
        </Text>

        {/* Empty placeholder to balance header center */}
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Empty State */}
      <View style={styles.content}>
        <Text style={[styles.emptyText, { color: colors.textFaint }]}>
          {t("wallet.noHistory")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  headerRightPlaceholder: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});

import { memo } from "react";
import { Text, View } from "react-native";
import { radii, spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { usePriceFormatter } from "../utils/format";

interface Props {
  price: string | number;
  currency: string;
  purpose?: string;
}

export const OfferBadge = memo(function OfferBadge({
  price,
  currency,
  purpose,
}: Props) {
  const { colors } = useTheme();
  const formatPrice = usePriceFormatter();

  return (
    <View
      style={{
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.sm,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: 14 }}>
        {formatPrice(price, currency, purpose)}
      </Text>
    </View>
  );
});

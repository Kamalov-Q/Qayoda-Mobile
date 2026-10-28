// src/features/listings/components/MarkSoldSheet.tsx
//
// "It sold — what for?"
//
// Asked, not optional. The number is the point: on its own it tells a seller
// what their property went for, and across every sale on the platform it is
// the only honest answer to "what is anything actually worth around here",
// which is the one question a property marketplace exists to answer and the
// one it cannot answer from asking prices alone.
//
// Which is also why the figure is not shown publicly. A seller who knows the
// whole map can read it reports a flattering number, and a dataset of
// flattering numbers is worse than none — it looks like data. The server
// keeps it in its own owner-guarded place; see the ListingSale entity.
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, TextField } from "@/src/components/ui";
import { radii, spacing, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import type { Listing, OfferPurpose } from "../api/listings.api";
import { useMarkSoldListing } from "../hooks/useCreateListing";

/** numeric(14,2) on both listing_sales.price and listing_offers.price. */
const MAX_DIGITS = 12;

const digitsOf = (v: string) => v.replace(/[^0-9]/g, "").slice(0, MAX_DIGITS);

/** 54000000 -> "54 000 000". What the reader needs while typing. */
const groupDigits = (digits: string) =>
  digits.replace(/\B(?=([0-9]{3})+(?![0-9]))/g, " ");

const unitFor = (currency: string) => (currency === "UZS" ? "so'm" : "$");

const formatPrice = (amount: number, currency: string) =>
  `${groupDigits(String(Math.round(amount)))} ${unitFor(currency)}`;

interface Props {
  visible: boolean;
  onClose: () => void;
  listing: Listing;
  /** Fired after the server has confirmed, so the caller can navigate away. */
  onSold?: () => void;
}

export function MarkSoldSheet({ visible, onClose, listing, onSold }: Props) {
  const { colors } = useTheme();

  return (
    // Driven by `visible` but with the BODY unmounted while closed — the
    // pattern BidSheet and Dialog both use. A sheet that remembers last
    // night's number is a sheet that sends it when somebody taps the button
    // out of habit, and this one writes a figure that reporting depends on.
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        // "padding" on Android too: with edge-to-edge the window stops
        // resizing for the keyboard, and the number pad buries the sheet's
        // own confirm button (see Screen.tsx, same finding).
        <KeyboardAvoidingView
          behavior="padding"
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: colors.overlay,
          }}
        >
          <SheetBody listing={listing} onClose={onClose} onSold={onSold} />
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}

function SheetBody({ listing, onClose, onSold }: Omit<Props, "visible">) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const markSold = useMarkSoldListing();

  // Every offer still live on the advert. More than one and the seller has
  // to say which sold: filing a sale figure against a rent asking price
  // produces a number that looks right and compares nothing. The server
  // refuses with SALE_PURPOSE_REQUIRED rather than guessing, so this is the
  // UI half of a rule the API already enforces.
  const offers = useMemo(
    () => (listing.offers ?? []).filter((o) => o.isActive),
    [listing.offers],
  );

  const [purpose, setPurpose] = useState<OfferPurpose | null>(
    offers.length === 1 ? offers[0].purpose : null,
  );
  const offer = offers.find((o) => o.purpose === purpose) ?? null;

  const [amount, setAmount] = useState("");
  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && !!offer;

  // How far off the asking price they landed, printed live while they type.
  // Not validation — a sale over asking is real and a sale at a third of it
  // is usually a typo, and the seller is the only one who can tell which.
  // Same currency only: a percentage across two currencies is computed from
  // a rate the reader never saw.
  // Both sides are quoted in the offer's own currency — the amount field
  // carries its unit — so there is no cross-currency case to guard here, the
  // way BidCard has to.
  const delta =
    offer && valid && Number(offer.price) > 0
      ? Math.round((1 - parsed / Number(offer.price)) * 100)
      : null;

  const submit = () => {
    if (!valid || markSold.isPending || !offer) return;
    markSold.mutate(
      {
        id: listing.id,
        input: {
          amount: parsed,
          currency: offer.currency === "UZS" ? "UZS" : "USD",
          purpose: offer.purpose,
        },
      },
      {
        onSuccess: () => {
          onClose();
          onSold?.();
        },
      },
    );
  };

  return (
    <>
      <Pressable
        style={{ position: "absolute", inset: 0 }}
        accessibilityElementsHidden
        importantForAccessibility="no"
        onPress={onClose}
      />

      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.xxl,
          borderTopRightRadius: radii.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          gap: spacing.md,
          ...shadow.raised,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 44,
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.borderStrong,
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ ...text.heading, flex: 1 }}>
            {t("listings.markSoldConfirmTitle")}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={{ ...text.caption, marginTop: -spacing.sm }}>
          {t("listings.soldPriceHint")}
        </Text>

        {/* Only when there is a choice to make. One live offer and the
            question is noise — the app already knows the answer. */}
        {offers.length > 1 ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {offers.map((o) => {
              const selected = purpose === o.purpose;
              return (
                <Pressable
                  key={o.purpose}
                  onPress={() => setPurpose(o.purpose)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.xs,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    alignItems: "center",
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected
                      ? colors.primarySoft
                      : colors.surfaceRaised,
                  }}
                >
                  <Text
                    style={{
                      ...type.bodyStrong,
                      color: selected ? colors.primary : colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {t(`purposes.${o.purpose}`)}
                  </Text>
                  <Text
                    style={{ ...type.caption, color: colors.textMuted }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatPrice(Number(o.price), o.currency)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : offer ? (
          <Text
            style={text.caption}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t("bids.asking", {
              price: formatPrice(Number(offer.price), offer.currency),
            })}
          </Text>
        ) : null}

        <TextField
          value={groupDigits(amount)}
          onChangeText={(v) => setAmount(digitsOf(v))}
          placeholder={t("listings.soldPricePlaceholder")}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={submit}
          suffix={offer ? unitFor(offer.currency) : undefined}
          editable={!!offer}
        />

        {delta !== null && delta !== 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Ionicons
              name={delta > 0 ? "trending-down" : "trending-up"}
              size={14}
              color={colors.textFaint}
            />
            <Text style={{ ...type.caption, color: colors.textFaint, flex: 1 }}>
              {delta > 0
                ? t("listings.soldBelowAsking", { percent: delta })
                : t("listings.soldAboveAsking", { percent: -delta })}
            </Text>
          </View>
        ) : null}

        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={14}
            color={colors.textFaint}
          />
          {/* Said out loud, because it changes what people type. A seller
              who assumes this is public rounds it up. */}
          <Text style={{ ...type.caption, color: colors.textFaint, flex: 1 }}>
            {t("listings.soldPricePrivate")}
          </Text>
        </View>

        <Text style={{ ...type.caption, color: colors.textFaint }}>
          {t("listings.markSoldConfirmMessage")}
        </Text>

        <Button
          title={t("listings.markSold")}
          onPress={submit}
          disabled={!valid}
          loading={markSold.isPending}
        />
      </View>
    </>
  );
}

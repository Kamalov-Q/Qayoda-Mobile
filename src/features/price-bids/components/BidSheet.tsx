// src/features/price-bids/components/BidSheet.tsx
//
// Where a buyer puts a number on an advert.
//
// The −5/−10/−15% chips are INPUT HELPERS and nothing more: each one fills
// the field with an absolute amount computed from the asking price, and the
// amount is what gets sent. A percentage sent to the server would stop being
// true the moment the seller edited their price.
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  View,
  Text,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, TextField } from "@/src/components/ui";
import { spacing, radii, type } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import type { OfferPurpose } from "@/src/features/listings/api/listings.api";
import {
  BID_PRESETS,
  BID_TTL_DAYS,
  type PriceBid,
} from "../api/price-bids.api";
import { useCounterBid, useCreateBid } from "../hooks/usePriceBids";

/**
 * The widest number the chain accepts.
 *
 * price_bids.amount is numeric(14,2) — twelve digits before the decimal, and
 * listing_offers.price is the same — so this is the real ceiling rather than
 * a guess. Enforced by clamping DIGITS in the handler, never by maxLength on
 * the input: the field now displays a GROUPED string, and a character limit
 * on that would cut a number off mid-thousand as the spaces ate the budget.
 */
const MAX_BID_DIGITS = 12;

const digitsOf = (v: string) =>
  v.replace(/[^0-9]/g, "").slice(0, MAX_BID_DIGITS);

/** 5890000000 -> "5 890 000 000". What the reader needs while typing. */
const groupDigits = (digits: string) =>
  digits.replace(/\B(?=([0-9]{3})+(?![0-9]))/g, " ");

const unitFor = (currency: string) => (currency === "UZS" ? "so'm" : "$");

/** Currency-aware, unlike listings' formatPrice which always prints a $. */
export function formatBid(amount: number, currency: string): string {
  const n = Math.round(amount).toLocaleString("ru-RU").replace(/ /g, " ");
  return `${n} ${unitFor(currency)}`;
}

/**
 * The same amount, short enough to fit in a chip.
 *
 * So'm prices run to ten and eleven digits — "5 890 000 000 so'm" already
 * fills a third of the sheet, and the next listing up overflows it. The chips
 * are INPUT HELPERS: tapping one puts the exact figure in the field, so the
 * label only has to say WHICH number it is, not spell it out. The exact value
 * is still on screen twice — in the asking line and in the field itself.
 */
export function compactBid(
  amount: number,
  currency: string,
  units: { mln: string; mlrd: string },
): string {
  const unit = unitFor(currency);
  const abs = Math.abs(amount);
  // Trailing zeros after the comma claim precision that is not there:
  // "6,20 mlrd" and "6,2 mlrd" are the same number, and one of them lies.
  const trim = (n: number, places: number) =>
    String(Number(n.toFixed(places))).replace(".", ",");

  if (abs >= 1e9) return `${trim(amount / 1e9, 2)} ${units.mlrd} ${unit}`;
  if (abs >= 1e7) return `${trim(amount / 1e6, 1)} ${units.mln} ${unit}`;
  return formatBid(amount, currency);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  /** The asking price this bid is measured against. */
  askingAmount: number;
  askingCurrency: string;
  /** Required when the advert carries more than one asking price. */
  purpose?: OfferPurpose;
  /** Fired once the bid is placed, with the thread it landed in. */
  onPlaced?: (conversationId: string | null) => void;
  /**
   * The bid being answered, when this sheet is a counter rather than an
   * opening offer.
   *
   * One sheet for both: a counter IS a bid with the direction reversed, and
   * two components that differ by which endpoint they call is two components
   * to keep in step.
   */
  counterOf?: PriceBid | null;
}

export function BidSheet({ visible, onClose, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    // Mounted and driven by `visible`, like every other sheet here — see
    // SelectSheet for the iOS dismissal race this avoids. The BODY, though,
    // is unmounted while closed, which is what makes reopening start on an
    // empty field without an effect reaching in to clear it. A sheet that
    // remembers last night's number is a sheet that sends it when somebody
    // taps the button out of habit. Dialog.tsx does the same thing.
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        // The sheet is a Modal, so it sits OUTSIDE the Screen that would
        // otherwise lift it — without this the number pad covered the amount
        // field and the send button both. "padding" on Android too, not just
        // iOS: with edge-to-edge the window stops resizing for the keyboard,
        // and leaving the behavior undefined there is what buries a bottom
        // sheet's own controls (see Screen.tsx, same finding).
        <KeyboardAvoidingView
          behavior="padding"
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: colors.overlay,
          }}
        >
          <SheetBody onClose={onClose} {...rest} />
        </KeyboardAvoidingView>
      ) : null}
    </Modal>
  );
}

function SheetBody({
  onClose,
  listingId,
  askingAmount,
  askingCurrency,
  purpose,
  onPlaced,
  counterOf,
}: Omit<Props, "visible">) {
  const { colors, text, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const units = { mln: t("bids.unitMln"), mlrd: t("bids.unitMlrd") };
  const create = useCreateBid(listingId);
  const counter = useCounterBid();
  const pending = counterOf ? counter.isPending : create.isPending;

  const [amount, setAmount] = useState("");
  const [preset, setPreset] = useState<number | null>(null);

  const presets = useMemo(
    () =>
      BID_PRESETS.map((pct) => ({
        pct,
        value: Math.round((askingAmount * (100 - pct)) / 100),
      })),
    [askingAmount],
  );

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = () => {
    if (!valid || pending) return;
    const done = {
      onSuccess: (bid: PriceBid) => {
        onClose();
        onPlaced?.(bid.conversationId);
      },
    };

    if (counterOf) {
      counter.mutate(
        {
          id: counterOf.id,
          input: { amount: parsed, currency: askingCurrency },
        },
        done,
      );
      return;
    }
    create.mutate({ amount: parsed, currency: askingCurrency, purpose }, done);
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
              {t(counterOf ? "bids.counterTitle" : "bids.sheetTitle")}
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

          <Text
            style={{ ...text.caption, marginTop: -spacing.sm }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t("bids.asking", {
              price: formatBid(askingAmount, askingCurrency),
            })}
          </Text>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {presets.map((p) => {
              const selected = preset === p.pct;
              return (
                <Pressable
                  key={p.pct}
                  onPress={() => {
                    setPreset(p.pct);
                    setAmount(String(p.value));
                  }}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
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
                  >
                    −{p.pct}%
                  </Text>
                  <Text
                    style={{ ...type.caption, color: colors.textMuted }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {compactBid(p.value, askingCurrency, units)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            value={groupDigits(amount)}
            onChangeText={(v) => {
              setAmount(digitsOf(v));
              // Typing means they have left the chip behind; keeping it lit
              // would claim a discount the number no longer matches.
              setPreset(null);
            }}
            placeholder={t("bids.amountPlaceholder")}
            keyboardType="number-pad"
            returnKeyType="send"
            onSubmitEditing={submit}
            suffix={unitFor(askingCurrency)}
          />

          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
          >
            <Ionicons name="time-outline" size={14} color={colors.textFaint} />
            <Text style={{ ...type.caption, color: colors.textFaint, flex: 1 }}>
              {t("bids.ttlHint", { days: BID_TTL_DAYS })}
            </Text>
          </View>

          <Button
            title={t("bids.send")}
            onPress={submit}
            disabled={!valid}
            loading={pending}
          />

          {/* Said where the commitment would be made, not in a terms page:
              accepting agrees a number and nothing else. */}
          <Text
            style={{ ...type.caption, color: colors.textFaint, textAlign: "center" }}
          >
            {t("bids.notAContract")}
          </Text>
      </View>
    </>
  );
}

// app/verify-profile.tsx — applying for the verified badge.
//
// Three photographs: both sides of a passport, and the applicant holding it.
// The third is the one that matters — the first two prove a document exists,
// only the selfie ties it to the person asking.
//
// Everything here is one screen with four faces: the form, waiting, the
// badge, and a refusal with a way back to the form.
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Button, HEADER_EDGES } from "../src/components/ui";
import { toast } from "../src/components/ui/Toast";
import { spacing, radii } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { useT, type TranslationKey } from "../src/i18n";
import { errorMessage } from "../src/lib/api-error";
import { requirePhone } from "../src/features/auth/guest";
import { useRelativeDate } from "../src/features/listings/utils/format";
import { verificationApi } from "../src/features/verification/api/verification.api";
import {
  useSubmitVerification,
  useVerification,
} from "../src/features/verification/hooks/useVerification";

/**
 * Wide enough that a moderator can read a passport number off it. Bigger than
 * the app's other uploads on purpose — this is the one photo whose small
 * print is the whole point of sending it.
 */
const DOC_WIDTH = 2000;

/** The three slots, in the order they are asked for. */
const SLOTS = [
  {
    key: "passportFrontUrl",
    label: "verify.passportFront",
    icon: "card-outline",
  },
  {
    key: "passportBackUrl",
    label: "verify.passportBack",
    icon: "document-outline",
  },
  { key: "selfieUrl", label: "verify.selfie", icon: "person-outline" },
] as const;

type SlotKey = (typeof SLOTS)[number]["key"];

/** One slot's local picture and, once uploaded, the URL to send. */
interface Slot {
  uri: string;
  url: string | null;
}

export default function VerifyProfileScreen() {
  const { colors, text } = useTheme();
  const t = useT();
  const relativeDate = useRelativeDate();

  const { data, isLoading } = useVerification();
  const submit = useSubmitVerification();

  const [slots, setSlots] = useState<Partial<Record<SlotKey, Slot>>>({});
  const [uploading, setUploading] = useState<SlotKey | null>(null);
  /** Set when a rejected applicant asks to try again. */
  const [reapplying, setReapplying] = useState(false);

  const pick = useCallback(async (key: SlotKey) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled) return;

    const original = result.assets[0].uri;
    // Shown straight away, uploaded behind it: a document photo is several
    // megabytes and waiting for the round trip to see what you picked makes
    // the slot feel broken.
    setSlots((s) => ({ ...s, [key]: { uri: original, url: null } }));
    setUploading(key);

    try {
      // Downscaled and re-encoded on the device, like every other upload
      // here — a raw 12MP photo is slow to send over a phone connection and
      // no more readable once it arrives.
      let uri = original;
      try {
        const rendered = await ImageManipulator.manipulate(original)
          .resize({ width: DOC_WIDTH })
          .renderAsync();
        const saved = await rendered.saveAsync({
          compress: 0.9,
          format: SaveFormat.JPEG,
        });
        uri = saved.uri;
      } catch {
        // Unreadable by the manipulator — send the original and let the
        // server decide.
      }

      const url = await verificationApi.uploadDocument(uri);
      setSlots((s) => ({ ...s, [key]: { uri: original, url } }));
    } catch (error) {
      setSlots((s) => ({ ...s, [key]: undefined }));
      toast.error(errorMessage(error));
    } finally {
      setUploading(null);
    }
  }, []);

  const onSubmit = () => {
    const front = slots.passportFrontUrl?.url;
    const back = slots.passportBackUrl?.url;
    const selfie = slots.selfieUrl?.url;
    if (!front || !back || !selfie) return;

    // A number is the thing the passport is being matched against, and the
    // server refuses without one — asking here turns that 403 into "add
    // your number", which is a thing a person can act on.
    requirePhone(() =>
      submit.mutate(
        {
          passportFrontUrl: front,
          passportBackUrl: back,
          selfieUrl: selfie,
        },
        {
          onSuccess: () => {
            toast.successKey("verify.sent");
            setSlots({});
            setReapplying(false);
          },
        },
      ),
    );
  };

  if (isLoading) {
    return (
      <Screen edges={HEADER_EDGES}>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const status = data?.isVerified ? "APPROVED" : data?.request?.status;

  // ---- already carrying the badge ----------------------------------------
  if (data?.isVerified) {
    return (
      <Screen edges={HEADER_EDGES}>
          <Verdict
          icon="checkmark-circle"
          tone="success"
          title={t("verify.verifiedTitle")}
          body={t("verify.verifiedBody")}
        />
      </Screen>
    );
  }

  // ---- waiting on a moderator --------------------------------------------
  if (status === "PENDING") {
    return (
      <Screen edges={HEADER_EDGES}>
          <Verdict
          icon="time-outline"
          tone="neutral"
          title={t("verify.pendingTitle")}
          body={t("verify.pendingBody")}
          footnote={
            data?.request
              ? `${t("verify.sentAt")} ${relativeDate(data.request.createdAt)}`
              : undefined
          }
        />
      </Screen>
    );
  }

  const rejected = status === "REJECTED" && !reapplying;
  const ready =
    !!slots.passportFrontUrl?.url &&
    !!slots.passportBackUrl?.url &&
    !!slots.selfieUrl?.url;

  return (
    <Screen edges={HEADER_EDGES} scroll>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        {/* Turned down: what they were told, and the way back in. The reason
            also arrived in support, which is where any argument about it
            belongs — so this points there rather than repeating itself. */}
        {rejected ? (
          <>
            <Verdict
              icon="close-circle"
              tone="danger"
              title={t("verify.rejectedTitle")}
              body={data?.request?.rejectionReason ?? t("verify.rejectedBody")}
            />
            <View style={{ gap: spacing.sm }}>
              <Button
                title={t("verify.tryAgain")}
                onPress={() => setReapplying(true)}
              />
              <Button
                title={t("support.title")}
                variant="ghost"
                onPress={() => router.push("/support")}
              />
            </View>
          </>
        ) : (
          <>
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={36}
                  color={colors.primary}
                />
              </View>
              <Text style={{ ...text.heading, textAlign: "center" }}>
                {t("verify.heading")}
              </Text>
              <Text style={{ ...text.caption, textAlign: "center" }}>
                {t("verify.intro")}
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              {SLOTS.map((slot) => (
                <DocumentSlot
                  key={slot.key}
                  label={t(slot.label)}
                  icon={slot.icon}
                  slot={slots[slot.key]}
                  busy={uploading === slot.key}
                  onPress={() => void pick(slot.key)}
                />
              ))}
            </View>

            <View style={{ gap: spacing.xs }}>
              <Rule ok labelKey="verify.ruleLight" />
              <Rule ok labelKey="verify.ruleFace" />
              <Rule ok={false} labelKey="verify.ruleBlurry" />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Note icon="lock-closed-outline" labelKey="verify.privacy" />
              <Note icon="time-outline" labelKey="verify.timeline" />
            </View>

            <Button
              title={t("verify.submit")}
              onPress={onSubmit}
              disabled={!ready || !!uploading}
              loading={submit.isPending}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

/** One upload slot: empty and dashed, or the picture that filled it. */
function DocumentSlot({
  label,
  icon,
  slot,
  busy,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  slot: Slot | undefined;
  busy: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: 1,
        // Dashed while it is a thing to do, solid once it is done — the
        // difference is visible across the whole list at a glance.
        borderStyle: slot ? "solid" : "dashed",
        borderColor: slot ? colors.primary : colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <View
        style={{
          width: 56,
          height: 44,
          borderRadius: radii.md,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceRaised,
        }}
      >
        {slot ? (
          <Image
            source={{ uri: slot.uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name={icon} size={22} color={colors.textFaint} />
        )}
      </View>

      <Text style={{ ...text.bodyStrong, flex: 1 }}>{label}</Text>

      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={slot?.url ? "checkmark-circle" : "add-circle-outline"}
          size={24}
          color={slot?.url ? colors.primary : colors.textFaint}
        />
      )}
    </Pressable>
  );
}

/** One do or don't under the slots. */
function Rule({ ok, labelKey }: { ok: boolean; labelKey: TranslationKey }) {
  const { colors, text } = useTheme();
  const t = useT();

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
    >
      <Ionicons
        name={ok ? "checkmark-circle" : "close-circle"}
        size={18}
        color={ok ? colors.success : colors.danger}
      />
      <Text style={{ ...text.caption, flex: 1 }}>{t(labelKey)}</Text>
    </View>
  );
}

/** A quieter line: what happens to the files, and how long it takes. */
function Note({
  icon,
  labelKey,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: TranslationKey;
}) {
  const { colors, text } = useTheme();
  const t = useT();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Ionicons name={icon} size={14} color={colors.textFaint} />
      <Text style={{ ...text.caption, flex: 1 }}>{t(labelKey)}</Text>
    </View>
  );
}

/** The three answers an application can end at, in one shape. */
function Verdict({
  icon,
  tone,
  title,
  body,
  footnote,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: "success" | "danger" | "neutral";
  title: string;
  body: string;
  footnote?: string;
}) {
  const { colors, text } = useTheme();

  const accent =
    tone === "success"
      ? colors.success
      : tone === "danger"
        ? colors.danger
        : colors.primary;

  return (
    <Card>
      <View style={{ alignItems: "center", gap: spacing.sm, padding: spacing.sm }}>
        <Ionicons name={icon} size={44} color={accent} />
        <Text style={{ ...text.heading, textAlign: "center" }}>{title}</Text>
        <Text style={{ ...text.caption, textAlign: "center" }}>{body}</Text>
        {footnote ? (
          <Text style={{ ...text.caption, color: colors.textFaint }}>
            {footnote}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

// app/(tabs)/account.tsx
import { useState } from "react";
import { Text, View, Pressable, Switch } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  ImageViewer,
  LanguageSwitcher,
  Screen,
  Section,
  TAB_EDGES,
} from "../../src/components/ui";
import { spacing, radii, type } from "../../src/theme/tokens";
import { useTheme } from "../../src/theme/useTheme";
import { useT, useLanguage, type TranslationKey } from "../../src/i18n";
import { usePreferences } from "../../src/lib/preferences";
import { confirm } from "../../src/lib/alerts";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { useLogout } from "../../src/features/auth/hooks/useAuth";
import { useIsAuthed } from "../../src/features/auth/guest";
import { RedirectToSignIn } from "../../src/features/auth/components/RedirectToSignIn";
import { useProfile } from "../../src/features/profile/hooks/useProfile";
import { resolveMediaUrl } from "../../src/lib/media-url";
import { useListingCounts } from "../../src/features/listings/hooks/useMyListings";
import { ProfileHeader } from "../../src/features/users/components/ProfileHeader";
import { VirtualCard } from "../../src/features/wallet/components/VirtualCard";
import { useWalletOverview } from "../../src/features/wallet/hooks/useWalletOverview";
import { SocialRow } from "../../src/features/users/components/SocialRow";

const LINKS = [
  {
    key: "mine",
    labelKey: "profile.linkMyListings" as TranslationKey,
    icon: "business-outline",
    href: "/(tabs)/places" as Href,
  },
  {
    key: "wallet",
    labelKey: "profile.linkWallet" as TranslationKey,
    icon: "wallet-outline",
    href: "/wallet" as unknown as Href,
  },
  {
    key: "saved",
    labelKey: "profile.linkSaved" as TranslationKey,
    icon: "heart-outline",
    href: "/saved" as Href,
  },
  {
    key: "add",
    labelKey: "profile.linkAdd" as TranslationKey,
    icon: "add-circle-outline",
    href: "/add" as Href,
  },
  {
    key: "about",
    labelKey: "profile.linkAbout" as TranslationKey,
    icon: "information-circle-outline",
    href: "/(tabs)/about" as Href,
  },
] as const;

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { text, colors } = useTheme();
  const t = useT();
  const language = useLanguage();

  // Counts reuse the queries the other tabs already keep warm, so this screen
  // costs no extra requests once either has been visited.
  const { data: counts } = useListingCounts();
  // Full profile (avatar, phone) lives behind /profile, not the session user.
  const { data: profile } = useProfile();
  // Two URLs, two jobs: the thumb is what the 76pt circle needs, and blowing
  // it up to full screen would show its compression. The viewer gets the
  // original, falling back to the thumb for accounts uploaded before the
  // full-size column existed.
  const avatarUri = resolveMediaUrl(profile?.avatarThumbUrl);
  const fullAvatarUri = resolveMediaUrl(
    profile?.avatarUrl ?? profile?.avatarThumbUrl,
  );
  const [viewingAvatar, setViewingAvatar] = useState(false);
  const activeCount = counts?.mineActive;

  // Each language is written in itself — someone who has the app stuck in a
  // language they can't read needs to recognise their own on this list.

  const authed = useIsAuthed();
  const { data: wallet } = useWalletOverview();

  // Theme and language are device preferences, not account ones, so a guest
  // keeps them; everything personal collapses into the sign-in prompt.
  if (!authed) {
    return (
      <Screen style={{ paddingTop: spacing.md }} edges={TAB_EDGES}>
        <View style={{ gap: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={text.display}>{t("tabs.profile")}</Text>
            {/* Language sits out here rather than behind the gear: it is the
                one app-level control somebody may need BEFORE they can read
                the menu that would otherwise hold it. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <LanguageSwitcher />
              <Pressable
                onPress={() => router.push("/settings")}
                accessibilityRole="button"
                accessibilityLabel={t("settings.title")}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </View>
          <RedirectToSignIn />
        </View>
      </Screen>
    );
  }

  const onLogout = () =>
    confirm({
      titleKey: "auth.logoutConfirmTitle",
      messageKey: "auth.logoutConfirmMessage",
      confirmKey: "auth.logout",
      destructive: true,
      onConfirm: () => logout.mutate(),
    });

  return (
    <Screen style={{ paddingTop: spacing.md }} edges={TAB_EDGES}>
      <View style={{ gap: spacing.xl }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={text.display}>{t("tabs.profile")}</Text>
          {/* Language out here, the rest of the app-shaped things (sign-in
              methods, location, theme, about) behind the gear. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <LanguageSwitcher />
            <Pressable
              onPress={() => router.push("/settings")}
              accessibilityRole="button"
              accessibilityLabel={t("settings.title")}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* The same component the public profile uses, so this tab and
            /profile/[id] cannot drift apart again. No actions: there is
            nothing to do about yourself that belongs beside your own name. */}
        <ProfileHeader
          avatarUri={avatarUri ?? null}
          name={[user?.name, user?.surname].filter(Boolean).join(" ")}
          // The live profile first: the session copy was minted at sign-in
          // and still says no for somebody approved this morning.
          verified={profile?.isVerifiedRealtor ?? user?.isVerifiedRealtor}
          onPressPhoto={
            fullAvatarUri ? () => setViewingAvatar(true) : undefined
          }
          // The same two lines the public profile carries, so the two
          // headers are the same height and the same shape. Presence has no
          // meaning about yourself, so line one is how people reach you.
          subtitle={
            <Text style={text.caption} numberOfLines={1}>
              {user?.phoneNumber ?? user?.email}
            </Text>
          }
          meta={
            profile ? (
              <Text style={text.caption}>
                {t("userProfile.memberSince", {
                  date: new Date(profile.createdAt).toLocaleDateString(
                    language,
                    { year: "numeric", month: "long" },
                  ),
                })}
              </Text>
            ) : null
          }
          photoBadge={
            /* On the photo rather than off in a corner: editing your
               identity belongs where the identity is. */
            <Pressable
              onPress={() => router.push("/profile/edit")}
              accessibilityRole="button"
              accessibilityLabel={t("profile.edit")}
              hitSlop={8}
              style={({ pressed }) => ({
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 34,
                height: 34,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: colors.bg,
                backgroundColor: pressed
                  ? colors.primaryPressed
                  : colors.primary,
              })}
            >
              <Ionicons name="pencil" size={15} color={colors.onPrimary} />
            </Pressable>
          }
        />

        {/* The same two the public profile shows, so you can see what
            other people see. */}
        {profile?.bio ? (
          <Text style={{ ...text.body, textAlign: "center" }}>
            {profile.bio}
          </Text>
        ) : null}

        <SocialRow links={profile?.socialLinks} />

        {/* The numbers, in the panel the public profile uses — but these
            are yours, so each column is a way in rather than a fact. */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.lg,
            overflow: "hidden",
          }}
        >
          <StatCell
            label={t("profile.statListings")}
            value={counts?.mine}
            onPress={() => router.push("/(tabs)/places")}
          />
          <StatCell
            label={t("profile.statActive")}
            value={activeCount}
            divider
            onPress={() => router.push("/(tabs)/places")}
          />
          <StatCell
            label={t("profile.statSaved")}
            value={counts?.saved}
            divider
            onPress={() => router.push("/saved")}
          />
        </View>

        {/* Growen City Virtual Card (Tap to flip UZS <-> USD, top-up button opens wallet) */}
        <VirtualCard
          phone={user?.phoneNumber}
          userId={user?.id}
          accountNo={wallet?.accountNo}
          name={[user?.name, user?.surname].filter(Boolean).join(" ")}
          balance={wallet?.balance ?? 0}
          variant="compact"
          onPressTopup={() => router.push("/wallet" as any)}
          topupLabel={t("wallet.topupButton")}
        />

        {/* Right under the card whose balance it explains. It used to be
            reachable only through the top-up screen, so checking a past
            payment meant pretending to start a new one. */}
        <Pressable
          onPress={() => router.push("/wallet/history" as Href)}
          accessibilityRole="button"
          accessibilityLabel={t("wallet.historyTitle")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginTop: -spacing.sm,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
          })}
        >
          <Ionicons name="receipt-outline" size={20} color={colors.primary} />
          <Text style={{ ...text.bodyStrong, flex: 1 }}>
            {t("wallet.historyTitle")}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </Pressable>

        {/* Push, on or off, for THIS phone.
            Here rather than behind the gear because it is the one setting
            people go looking for the moment an app becomes noisy — and the
            moment they stop hearing from it. Switching it off unregisters
            this device's token, so the server stops having anywhere to send;
            the inbox below carries on either way. */}
        <PushToggle />

        <Section title={t("profile.links")}>
          <Card flush>
            {LINKS.map((link, index) => (
              <Pressable
                key={link.key}
                onPress={() => router.push(link.href)}
                accessibilityRole="button"
                accessibilityLabel={t(link.labelKey)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : "transparent",
                })}
              >
                <Ionicons name={link.icon} size={20} color={colors.primary} />
                <Text style={{ ...text.bodyStrong, flex: 1 }}>
                  {t(link.labelKey)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textFaint}
                />
              </Pressable>
            ))}
          </Card>
        </Section>

        <Button
          title={t("auth.logout")}
          icon="log-out-outline"
          variant="danger"
          onPress={onLogout}
          loading={logout.isPending}
        />
      </View>

      {/* Mounted only while open, so a dismissed viewer cannot hold the last
          photo's zoom for the next one. */}
      {viewingAvatar ? (
        <ImageViewer
          uri={fullAvatarUri ?? null}
          onClose={() => setViewingAvatar(false)}
        />
      ) : null}
    </Screen>
  );
}

function StatCell({
  label,
  value,
  divider,
  onPress,
}: {
  label: string;
  /** undefined while the backing query has not resolved yet. */
  value: number | undefined;
  divider?: boolean;
  onPress: () => void;
}) {
  const { colors, text } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? "—"}`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 2,
        paddingVertical: spacing.md,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      <Text style={text.heading}>{value ?? "—"}</Text>
      <Text style={{ ...type.caption, fontSize: 12, color: colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The push switch.
 *
 * A row, not a Settings entry: the state has to be readable at a glance, so
 * the control says which way it is pointing without being opened.
 */
function PushToggle() {
  const { colors, text } = useTheme();
  const t = useT();
  const enabled = usePreferences((s) => s.pushEnabled);
  const setEnabled = usePreferences((s) => s.setPushEnabled);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: -spacing.sm,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Ionicons
        name={enabled ? "notifications" : "notifications-off-outline"}
        size={20}
        color={enabled ? colors.primary : colors.textMuted}
      />
      <View style={{ flex: 1 }}>
        <Text style={text.bodyStrong}>{t("profile.pushTitle")}</Text>
        <Text style={{ ...text.caption, color: colors.textMuted }}>
          {t(enabled ? "profile.pushOn" : "profile.pushOff")}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        accessibilityLabel={t("profile.pushTitle")}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

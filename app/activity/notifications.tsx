// The inbox: what happened to the things you made.
//
// Rows, not pushes — there is no device-token plumbing in this app yet, so
// this is where a notification lives and the bell's dot is how you learn
// there is one. Opening the screen is what marks them read.
import { useEffect } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Avatar,
  EmptyState,
  HEADER_EDGES,
  LoadingView,
} from "@/src/components/ui";
import { radii, spacing, weight } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT, type TranslationKey } from "@/src/i18n";
import { errorMessage } from "@/src/lib/api-error";
import { useAuthStore } from "@/src/features/auth/store/auth.store";
import { RedirectToSignIn } from "@/src/features/auth/components/RedirectToSignIn";
import { useCommentTime } from "@/src/features/comments/utils/time";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/src/features/notifications/hooks/useNotifications";
import type {
  AppNotification,
  NotificationKind,
} from "@/src/features/notifications/api/notifications.api";

/** The glyph and tone each kind wears. */
const LOOK: Record<
  NotificationKind,
  { icon: keyof typeof Ionicons.glyphMap; tone: "primary" | "danger" }
> = {
  VIDEO_READY: { icon: "checkmark-circle", tone: "primary" },
  VIDEO_FAILED: { icon: "alert-circle", tone: "danger" },
  VIDEO_AWAITING_PAYMENT: { icon: "wallet", tone: "danger" },
  VIDEO_LIKE: { icon: "heart", tone: "danger" },
  VIDEO_COMMENT: { icon: "chatbubble", tone: "primary" },
  COMMENT_REPLY: { icon: "return-down-forward", tone: "primary" },
  NEW_FOLLOWER: { icon: "person-add", tone: "primary" },
  FOLLOWED_USER_POSTED: { icon: "play-circle", tone: "primary" },

  LISTING_COMMENT: { icon: "chatbubble-ellipses", tone: "primary" },
  LISTING_COMMENT_REPLY: { icon: "return-down-forward", tone: "primary" },
  LISTING_REVIEW: { icon: "star", tone: "primary" },

  CHAT_MESSAGE: { icon: "mail", tone: "primary" },

  // Money is the one place "danger" earns its red: a failed charge and a
  // tariff about to lapse are both things that stop working if ignored.
  TOPUP_SUCCEEDED: { icon: "wallet", tone: "primary" },
  TOPUP_FAILED: { icon: "alert-circle", tone: "danger" },
  TARIFF_PAID: { icon: "ribbon", tone: "primary" },
  TARIFF_EXPIRING: { icon: "time", tone: "danger" },
};

const TEXT: Record<NotificationKind, TranslationKey> = {
  VIDEO_READY: "notifications.videoReady",
  VIDEO_FAILED: "notifications.videoFailed",
  VIDEO_AWAITING_PAYMENT: "notifications.videoAwaitingPayment",
  VIDEO_LIKE: "notifications.videoLike",
  VIDEO_COMMENT: "notifications.videoComment",
  COMMENT_REPLY: "notifications.commentReply",
  NEW_FOLLOWER: "notifications.newFollower",
  FOLLOWED_USER_POSTED: "notifications.followedUserPosted",

  LISTING_COMMENT: "notifications.listingComment",
  LISTING_COMMENT_REPLY: "notifications.listingCommentReply",
  LISTING_REVIEW: "notifications.listingReview",

  CHAT_MESSAGE: "notifications.chatMessage",

  TOPUP_SUCCEEDED: "notifications.topupSucceeded",
  TOPUP_FAILED: "notifications.topupFailed",
  TARIFF_PAID: "notifications.tariffPaid",
  TARIFF_EXPIRING: "notifications.tariffExpiring",
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const t = useT();
  const authed = useAuthStore((s) => s.status === "authenticated");
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();

  // Opening the list is what reads it — a per-row read state the UI never
  // shows is bookkeeping nobody can act on. Fired once, on mount.
  const { mutate: read } = markRead;
  useEffect(() => {
    read(undefined);
  }, [read]);

  /**
   * A guest has no inbox, and the query that would fill one is disabled for
   * them — so the screen used to render its empty state and tell somebody
   * with no account that they had "no notifications yet". That is a true
   * sentence about the wrong thing: there is nothing to have yet, because
   * there is nobody to have it.
   */
  if (!authed) {
    return (
      <Screen scroll={false} edges={HEADER_EDGES}>
        <Stack.Screen options={{ title: t("notifications.title") }} />
        <RedirectToSignIn />
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("notifications.title") }} />

      {list.isLoading ? (
        <LoadingView />
      ) : list.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t("listings.loadError")}
          description={list.error ? errorMessage(list.error) : undefined}
          actionLabel={t("common.retry")}
          onAction={list.refetch}
        />
      ) : (
        <FlatList<AppNotification>
          data={list.items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{
            padding: spacing.md,
            gap: spacing.xs,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => void list.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={t("notifications.empty")}
              description={t("notifications.emptyHint")}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) {
              void list.fetchNextPage();
            }
          }}
          renderItem={({ item }) => (
            <NotificationRow notification={item} onRead={read} />
          )}
        />
      )}
    </Screen>
  );
}

function NotificationRow({
  notification: n,
  onRead,
}: {
  notification: AppNotification;
  /** Marks THIS row read — see the tap handler for why that is not redundant. */
  onRead: (ids: string[]) => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const timeAgo = useCommentTime();

  const look = LOOK[n.kind];
  const tone = look.tone === "danger" ? colors.danger : colors.primary;
  const name =
    [n.actor?.name, n.actor?.surname].filter(Boolean).join(" ") || null;

  // Where the row goes. A notification that cannot be opened is a toast that
  // outlived its welcome, so every kind lands somewhere: the video, the
  // person, or — for one waiting to be paid for — the shelf with the button.
  const open = () => {
    // Opening the screen marks everything read, so this is usually a no-op.
    // It is not redundant for a row that ARRIVED while the screen was open:
    // that one missed the on-mount sweep, and tapping it is the clearest
    // possible statement that it has been seen.
    if (!n.read) onRead([n.id]);

    if (n.kind === "VIDEO_AWAITING_PAYMENT" || n.kind === "VIDEO_FAILED") {
      router.push("/videos/mine");
      return;
    }
    // Money lands on the wallet, which is where the balance and the button
    // to fix a failure both are.
    if (
      n.kind === "TOPUP_SUCCEEDED" ||
      n.kind === "TOPUP_FAILED" ||
      n.kind === "TARIFF_PAID" ||
      n.kind === "TARIFF_EXPIRING"
    ) {
      router.push("/wallet");
      return;
    }
    // Checked before videoId and listingId: a chat row carries neither, but
    // the order is what keeps it that way if one is ever added.
    if (n.conversationId) {
      router.push(`/chat/${n.conversationId}`);
      return;
    }
    if (n.videoId) {
      router.push(`/videos/${n.videoId}`);
      return;
    }
    // A comment or review opens the listing it was left on, not the
    // commenter: the thing being discussed is what the reader came for.
    if (n.listingId) {
      router.push(`/listing/${n.listingId}`);
      return;
    }
    if (n.actor) router.push(`/profile/${n.actor.id}`);
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.lg,
        // Unread rows carry a wash rather than a dot: the whole row is the
        // thing you have not seen, and a 6pt dot on a list of twenty is a
        // game of spot-the-difference.
        backgroundColor: n.read
          ? pressed
            ? colors.surfaceRaised
            : "transparent"
          : colors.primarySoft,
      })}
    >
      {n.actor ? (
        <Avatar
          name={name ?? t("chat.unknownUser")}
          uri={n.actor.avatarThumbUrl ?? undefined}
          size={40}
        />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <Ionicons name={look.icon} size={20} color={tone} />
        </View>
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.body} numberOfLines={2}>
          {name ? <Text style={weight("700")}>{name} </Text> : null}
          {t(TEXT[n.kind])}
          {/* Which ad it was about. Someone with twenty live listings cannot
              act on "left a review" without being told on what. */}
          {n.listing?.title ? (
            <Text style={weight("600")}> · {n.listing.title}</Text>
          ) : null}
        </Text>
        <Text style={{ ...text.caption, color: colors.textFaint }}>
          {timeAgo(n.createdAt)}
        </Text>
      </View>

      {/* The clip it is about, where there is one. */}
      {n.video?.thumbUrl ? (
        <Image
          source={{ uri: n.video.thumbUrl }}
          style={{
            width: 34,
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceRaised,
          }}
          contentFit="cover"
        />
      ) : (
        <Ionicons name={look.icon} size={16} color={tone} />
      )}
    </Pressable>
  );
}

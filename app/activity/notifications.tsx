// The inbox: what happened to the things you made.
//
// Rows, not pushes — there is no device-token plumbing in this app yet, so
// this is where a notification lives and the bell's dot is how you learn
// there is one. Opening the screen is what marks them read.
import { useEffect, useMemo } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { Stack, router } from "expo-router";
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
import type { NotificationKind } from "@/src/features/notifications/api/notifications.api";
import { notificationRoute } from "@/src/features/notifications/notificationTarget";
import { inboxPreview } from "@/src/features/notifications/inboxPreview";
import {
  groupNotifications,
  type NotificationGroup,
} from "@/src/features/notifications/inboxGroups";

/** The glyph and tone each kind wears. */
const LOOK: Partial<
  Record<
    NotificationKind,
    { icon: keyof typeof Ionicons.glyphMap; tone: "primary" | "danger" }
  >
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

  PRICE_BID_RECEIVED: { icon: "pricetag", tone: "primary" },
  PRICE_BID_COUNTERED: { icon: "swap-horizontal", tone: "primary" },
  PRICE_BID_ACCEPTED: { icon: "checkmark-circle", tone: "primary" },
  PRICE_BID_DECLINED: { icon: "close-circle", tone: "danger" },
  PRICE_BID_EXPIRED: { icon: "time", tone: "danger" },

  // Money is the one place "danger" earns its red: a failed charge and a
  // tariff about to lapse are both things that stop working if ignored.
  TOPUP_SUCCEEDED: { icon: "wallet", tone: "primary" },
  TOPUP_FAILED: { icon: "alert-circle", tone: "danger" },
  TARIFF_PAID: { icon: "ribbon", tone: "primary" },
  TARIFF_EXPIRING: { icon: "time", tone: "danger" },
};

/**
 * What an unrecognised kind looks like.
 *
 * The server can add a kind at any time, and a build already on somebody's
 * phone cannot be taught about it. Before this, LOOK[kind] came back
 * undefined and the next line read .tone off it — so one unknown row took
 * the whole inbox screen down. A generic bell and the kind's own name is a
 * worse row than a written one and an infinitely better one than a crash.
 */
const UNKNOWN_LOOK = {
  icon: "notifications-outline" as keyof typeof Ionicons.glyphMap,
  tone: "primary" as const,
};

const TEXT: Partial<Record<NotificationKind, TranslationKey>> = {
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

  PRICE_BID_RECEIVED: "notifications.priceBidReceived",
  PRICE_BID_COUNTERED: "notifications.priceBidCountered",
  PRICE_BID_ACCEPTED: "notifications.priceBidAccepted",
  PRICE_BID_DECLINED: "notifications.priceBidDeclined",
  PRICE_BID_EXPIRED: "notifications.priceBidExpired",

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

  // Five people liking the same video is one row, not five. Memoised on the
  // page array rather than recomputed per render: this runs over every row
  // the inbox has loaded, and the list re-renders on every refetch.
  const groups = useMemo(() => groupNotifications(list.items), [list.items]);

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
        <FlatList<NotificationGroup>
          data={groups}
          keyExtractor={(g) => g.lead.id}
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
            <NotificationRow group={item} onRead={read} />
          )}
        />
      )}
    </Screen>
  );
}

function NotificationRow({
  group,
  onRead,
}: {
  group: NotificationGroup;
  /** Marks THESE rows read — see the tap handler for why that is not redundant. */
  onRead: (ids: string[]) => void;
}) {
  const { colors, text } = useTheme();
  const t = useT();
  const timeAgo = useCommentTime();

  const n = group.lead;
  const look = LOOK[n.kind] ?? UNKNOWN_LOOK;
  const tone = look.tone === "danger" ? colors.danger : colors.primary;
  const name =
    [n.actor?.name, n.actor?.surname].filter(Boolean).join(" ") || null;

  // The fact the row is about: the amount offered, the sum that cleared, the
  // stars given. Null for the kinds their own sentence already describes.
  const preview = inboxPreview(n);

  // An advert that has been taken down or sold still has a row about it, and
  // the row should say so rather than opening a screen that explains nothing.
  const listingGone =
    n.listing?.status === "ARCHIVED" || n.listing?.status === "SOLD";

  // Where the row goes. Shared with the push tap handler — see
  // notificationTarget: a tap on the lock screen and a tap here must land in
  // the same place, and they were two copies of this ladder before.
  const open = () => {
    // Opening the screen marks everything read, so this is usually a no-op.
    // It is not redundant for a row that ARRIVED while the screen was open:
    // that one missed the on-mount sweep, and tapping it is the clearest
    // possible statement that it has been seen. All of a group's ids, not
    // just the lead's — the reader has been shown that all of them happened.
    const unread = group.lead.read ? [] : group.ids;
    if (unread.length) onRead(unread);

    router.push(notificationRoute(n) as never);
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
          {/* "and 4 others", when this row stands for several. The count is
              of ROWS, not of named people: two likes from one person inside
              the dedupe window are one row, and somebody whose profile was
              deleted has no name to list. */}
          {group.count > 1 ? (
            <Text style={weight("700")}>
              {t("notifications.andOthers", { count: group.count - 1 })}{" "}
            </Text>
          ) : null}
          {/* An unknown kind still gets its line: the server's own name for
              it reads as noise, but it reads, and the row stays tappable. */}
          {TEXT[n.kind] ? t(TEXT[n.kind]!) : t("notifications.title")}
          {/* Which ad it was about. Someone with twenty live listings cannot
              act on "left a review" without being told on what. */}
          {n.listing?.title ? (
            <Text style={weight("600")}> · {n.listing.title}</Text>
          ) : null}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
          }}
        >
          <Text style={{ ...text.caption, color: colors.textFaint }}>
            {timeAgo(n.createdAt)}
          </Text>
          {preview ? (
            <Text
              style={{ ...text.caption, color: colors.text, flexShrink: 1 }}
              numberOfLines={1}
            >
              · {preview}
            </Text>
          ) : null}
          {listingGone ? (
            <Text
              style={{ ...text.caption, color: colors.textMuted }}
              numberOfLines={1}
            >
              · {t(`statuses.${n.listing!.status}` as TranslationKey)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* What it is about, in one picture. The video's frame if there is one,
          otherwise the advert's cover — which used to be a grey glyph, so the
          half of the inbox that is about the actual product was the half you
          could not skim. */}
      {n.video?.thumbUrl ?? n.listing?.thumbUrl ? (
        <Image
          source={{ uri: (n.video?.thumbUrl ?? n.listing?.thumbUrl)! }}
          style={{
            width: 34,
            // A reel is portrait and a listing photo is landscape; one shape
            // for both would crop whichever it was not drawn for.
            height: n.video?.thumbUrl ? 48 : 34,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceRaised,
            opacity: listingGone ? 0.45 : 1,
          }}
          contentFit="cover"
        />
      ) : (
        <Ionicons name={look.icon} size={16} color={tone} />
      )}
    </Pressable>
  );
}

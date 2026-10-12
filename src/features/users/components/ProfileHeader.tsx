import { memo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { spacing } from "@/src/theme/tokens";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";
import { StoryAvatar } from "@/src/features/stories/components/StoryAvatar";
import { ActionIcons, type ActionIcon } from "./ActionIcons";
import { VerifiedBadge } from "./VerifiedBadge";

interface Props {
  /** Drives the story ring, and where tapping the photo leads when they
   *  have one up. Null for an account that no longer exists. */
  userId: string | null | undefined;
  avatarUri: string | null | undefined;
  name: string;
  verified?: boolean;
  online?: boolean;
  /** The line under the name — presence, or when they were last seen. */
  subtitle?: ReactNode;
  /** A quieter line under that: member since, the number spelled out. */
  meta?: ReactNode;
  /** What you can do about them. Empty on your own profile. */
  actions?: ActionIcon[];
  /** Opens the photo full-size. Omitted when there is no photo to open. */
  onPressPhoto?: () => void;
  /** Makes the name tappable — for the places that are ABOUT somebody
   *  rather than being their profile, like a seller on a listing. */
  onPressName?: () => void;
  /** Sits over the photo's bottom-right corner: the edit pencil, on your
   *  own. */
  photoBadge?: ReactNode;
  avatarSize?: number;
}

/**
 * How a person is presented, everywhere.
 *
 * There used to be three of these — the profile screen, the account tab and
 * the seller block on a listing — and they had drifted into three different
 * designs for the same six facts, so the app looked like it had been built
 * by three teams. This is the one layout: photo, name, badge, a line about
 * them, and a row of round actions.
 *
 * What differs between the places is the DATA, not the shape: which actions
 * apply, whether there is a photo to open, what the line under the name
 * says. All of it comes in as props.
 */
export const ProfileHeader = memo(function ProfileHeader({
  userId,
  avatarUri,
  name,
  verified,
  online,
  subtitle,
  meta,
  actions,
  onPressPhoto,
  onPressName,
  photoBadge,
  avatarSize = 104,
}: Props) {
  const { text } = useTheme();
  const t = useT();

  const heading = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        // Bounded, so a long name cannot push itself and the badge past the
        // edges of the screen — which is what made one profile's name look
        // a size bigger than the next one's.
        maxWidth: "100%",
      }}
    >
      <Text
        style={{ ...text.display, textAlign: "center", flexShrink: 1 }}
        numberOfLines={1}
        // Shrinks rather than ellipsising: a name is the one thing on this
        // screen worth reading in full, and "Quvomiddin Kamal…" is a worse
        // answer than two points smaller.
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {name}
      </Text>
      {/* The badge belongs next to the name, not in a panel further down: it
          is a claim about this person, and it is only worth anything where
          their name is. */}
      {verified ? <VerifiedBadge size={26} /> : null}
    </View>
  );

  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <View>
        {/* Rings when they have a story up and opens it on tap; otherwise
            the photo, full-size, when there is a bigger version to show. An
            initials circle has none, and a press effect that leads nowhere
            is worse than none. */}
        <StoryAvatar
          userId={userId}
          uri={avatarUri}
          name={name}
          size={avatarSize}
          online={online}
          onPress={onPressPhoto}
        />
        {photoBadge}
      </View>

      {onPressName ? (
        <Pressable
          onPress={onPressName}
          accessibilityRole="button"
          accessibilityLabel={t("userProfile.openProfile")}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {heading}
        </Pressable>
      ) : (
        heading
      )}

      {subtitle}
      {meta}

      {actions?.length ? <ActionIcons actions={actions} /> : null}
    </View>
  );
});

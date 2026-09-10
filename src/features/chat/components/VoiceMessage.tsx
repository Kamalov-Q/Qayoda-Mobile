import { memo, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { toast } from "../../../components/ui/Toast";

/**
 * The device has one earpiece, so one clip sounds at a time. Each bubble owns
 * its own Audio.Sound and there is no shared parent to hang this off — the list
 * renders them as independent rows — so the current player is tracked at module
 * scope: whoever starts playing pauses whoever was.
 *
 * Paused, not rewound: coming back to a half-heard message should resume it,
 * which is what tapping the same bubble twice already does.
 */
let activePlayer: (() => Promise<void>) | null = null;

/** Silences the previous player, then takes ownership. */
async function claimPlayback(pauseSelf: () => Promise<void>) {
  if (activePlayer && activePlayer !== pauseSelf) await activePlayer();
  activePlayer = pauseSelf;
}

/** Gives up ownership, but only if it is still ours to give up. */
function releasePlayback(pauseSelf: () => Promise<void>) {
  if (activePlayer === pauseSelf) activePlayer = null;
}

interface Props {
  url: string;
  waveform: number[] | null;
  durationSec: number | null;
  /** Sent by me — the bubble behind it is filled with the accent colour. */
  mine: boolean;
}

export const VoiceMessage = memo(function VoiceMessage({
  url,
  waveform,
  durationSec,
  mine,
}: Props) {
  const { colors } = useTheme();
  const sound = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  // Stable for the component's lifetime — it closes over nothing that changes
  // (a ref and a setState are both fixed identities), so it doubles as this
  // instance's key in the registry above.
  const pauseSelf = useRef(async () => {
    // Swallowed: pausing a clip that has already been unloaded throws, and
    // this runs on behalf of the *next* bubble — letting it reject there would
    // mean a stale sound stops the new one from ever starting.
    await sound.current?.pauseAsync().catch(() => {});
    setPlaying(false);
  }).current;

  useEffect(
    () => () => {
      // Scrolling a playing message out of the list windows it away; leaving it
      // registered would let an unmounted bubble own the audio channel.
      releasePlayback(pauseSelf);
      void sound.current?.unloadAsync();
    },
    [pauseSelf],
  );

  const toggle = async () => {
    // The first tap has to fetch the whole clip before it can play, and a
    // second tap during that gap used to start a second download — two sounds
    // loaded, two playing over each other, and the first one leaked because
    // the ref only holds the last.
    if (loading) return;

    if (playing) {
      await pauseSelf();
      releasePlayback(pauseSelf);
      return;
    }

    if (!sound.current) {
      setLoading(true);
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: url },
          {},
          (st: AVPlaybackStatus) => {
            if (!st.isLoaded) return;
            setProgress(
              st.durationMillis
                ? (st.positionMillis ?? 0) / st.durationMillis
                : 0,
            );
            if (st.didJustFinish) {
              setPlaying(false);
              setProgress(0);
              releasePlayback(pauseSelf);
              void s.setPositionAsync(0);
            }
          },
        );
        sound.current = s;
      } catch {
        toast.errorKey("chat.voiceLoadError");
        return;
      } finally {
        setLoading(false);
      }
    }

    // Before playAsync, so the two clips never overlap even for a frame.
    await claimPlayback(pauseSelf);
    await sound.current.playAsync();
    setPlaying(true);
  };

  const bars = waveform?.length ? waveform : Array<number>(40).fill(40);
  const fg = mine ? colors.onPrimary : colors.primary;
  // Unplayed bars sit behind the played ones: a wash of the same hue rather
  // than a second palette colour, so it works on either bubble fill.
  const bg = mine ? "rgba(255,255,255,0.4)" : colors.primaryBorder;

  const mm = Math.floor((durationSec ?? 0) / 60);
  const ss = String((durationSec ?? 0) % 60).padStart(2, "0");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minWidth: 200,
      }}
    >
      <Pressable
        onPress={() => void toggle()}
        hitSlop={6}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: mine ? "rgba(255,255,255,0.25)" : colors.primarySoft,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Ionicons name={playing ? "pause" : "play"} size={16} color={fg} />
        )}
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 1.5,
          flex: 1,
          height: 28,
        }}
      >
        {bars.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(3, (v / 100) * 26),
              borderRadius: 2,
              backgroundColor: i / bars.length <= progress ? fg : bg,
            }}
          />
        ))}
      </View>

      <Text style={{ color: fg, fontSize: 11 }}>
        {mm}:{ss}
      </Text>
    </View>
  );
});

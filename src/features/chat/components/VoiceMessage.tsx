import { memo, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
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
  const player = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  // The clip's own length, learned once it loads. Messages sent before the
  // recorder's duration bug was fixed carry 0, and their bubbles would read
  // 0:00 forever otherwise.
  const [loadedSec, setLoadedSec] = useState(0);
  // Cleared the moment the clip reports itself loaded; fires if it never does.
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable for the component's lifetime — it closes over nothing that changes
  // (a ref and a setState are both fixed identities), so it doubles as this
  // instance's key in the registry above.
  const pauseSelf = useRef(async () => {
    // Swallowed: pausing a clip that has already been released throws, and
    // this runs on behalf of the *next* bubble — letting it reject there would
    // mean a stale player stops the new one from ever starting.
    try {
      player.current?.pause();
    } catch {
      // released
    }
    setPlaying(false);
  }).current;

  useEffect(
    () => () => {
      // Scrolling a playing message out of the list windows it away; leaving it
      // registered would let an unmounted bubble own the audio channel.
      releasePlayback(pauseSelf);
      if (loadTimer.current) clearTimeout(loadTimer.current);
      try {
        player.current?.remove();
      } catch {
        // already released
      }
    },
    [pauseSelf],
  );

  const toggle = async () => {
    if (playing) {
      await pauseSelf();
      releasePlayback(pauseSelf);
      return;
    }

    if (!player.current) {
      try {
        // Voice notes should sound through the mute switch, like every
        // messenger — and this also resets the mode after a recording.
        void setAudioModeAsync({ playsInSilentMode: true });
        const p = createAudioPlayer({ uri: url });
        setLoading(true);
        // The event API exists at runtime (AudioPlayer is a SharedObject
        // EventEmitter) but its types resolve through expo's nested
        // expo-modules-core copy, which tsc can't see from here.
        (
          p as AudioPlayer & {
            addListener(
              event: "playbackStatusUpdate",
              listener: (status: AudioStatus) => void,
            ): void;
          }
        ).addListener("playbackStatusUpdate", (st: AudioStatus) => {
          if (st.isLoaded) {
            setLoading(false);
            if (loadTimer.current) clearTimeout(loadTimer.current);
          }
          if (st.duration > 0) setLoadedSec(Math.ceil(st.duration));
          setProgress(st.duration ? st.currentTime / st.duration : 0);
          if (st.didJustFinish) {
            setPlaying(false);
            setProgress(0);
            releasePlayback(pauseSelf);
            p.pause();
            void p.seekTo(0);
          }
        });
        player.current = p;

        // A clip that never loads (missing file, wrong content type, no
        // network) otherwise leaves the button spinning forever with no sound
        // and no explanation. Give up, say so, and drop the player so the next
        // tap retries from scratch rather than waiting on the dead one.
        loadTimer.current = setTimeout(() => {
          if (!player.current) return;
          console.warn("[VoiceMessage] clip did not load:", url);
          setLoading(false);
          setPlaying(false);
          releasePlayback(pauseSelf);
          try {
            player.current.remove();
          } catch {
            // already released
          }
          player.current = null;
          toast.errorKey("chat.voiceLoadError");
        }, 12_000);
      } catch {
        setLoading(false);
        toast.errorKey("chat.voiceLoadError");
        return;
      }
    }

    // Before play, so the two clips never overlap even for a frame.
    await claimPlayback(pauseSelf);
    player.current.play();
    setPlaying(true);
  };

  const bars = waveform?.length ? waveform : Array<number>(40).fill(40);
  const fg = mine ? colors.onPrimary : colors.primary;
  // Unplayed bars sit behind the played ones: a wash of the same hue rather
  // than a second palette colour, so it works on either bubble fill.
  const bg = mine ? "rgba(255,255,255,0.4)" : colors.primaryBorder;

  // The stored length when it is real, else whatever the loaded clip reports.
  const seconds = durationSec || loadedSec;
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

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

import { memo, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { toast } from "../../../components/ui/Toast";

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

  useEffect(
    () => () => {
      void sound.current?.unloadAsync();
    },
    [],
  );

  const toggle = async () => {
    // The first tap has to fetch the whole clip before it can play, and a
    // second tap during that gap used to start a second download — two sounds
    // loaded, two playing over each other, and the first one leaked because
    // the ref only holds the last.
    if (loading) return;

    if (playing) {
      await sound.current?.pauseAsync();
      setPlaying(false);
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

import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import { Alert } from "react-native";

export function useVoiceRecorder() {
  const recording = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const start = useCallback(async (): Promise<boolean> => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Mikrofon",
        "Ovozli xabar uchun mikrofonga ruxsat berishingiz kerak",
      );
      return false;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    rec.setOnRecordingStatusUpdate((s) => setDurationMs(s.durationMillis ?? 0));
    await rec.startAsync();
    recording.current = rec;
    setIsRecording(true);
    return true;
  }, []);

  const stop = useCallback(async (): Promise<{
    uri: string;
    durationSec: number;
  } | null> => {
    const rec = recording.current;
    recording.current = null;
    setIsRecording(false);
    if (!rec) return null;

    await rec.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = rec.getURI();
    const durationSec = Math.round(durationMs / 1000);
    if (!uri || durationSec < 1) return null;
    return { uri, durationSec };
  }, [durationMs]);

  const cancel = useCallback(async () => {
    const rec = recording.current;
    recording.current = null;
    setIsRecording(false);
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {
        // already stopped
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }
  }, []);

  return { isRecording, durationMs, start, stop, cancel };
}

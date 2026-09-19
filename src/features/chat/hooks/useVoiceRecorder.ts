import { useCallback, useState } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Alert } from "react-native";

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isRecording, setIsRecording] = useState(false);
  const durationMs = isRecording ? recorderState.durationMillis : 0;

  const start = useCallback(async (): Promise<boolean> => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Mikrofon",
        "Ovozli xabar uchun mikrofonga ruxsat berishingiz kerak",
      );
      return false;
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    return true;
  }, [recorder]);

  const stop = useCallback(async (): Promise<{
    uri: string;
    durationSec: number;
  } | null> => {
    if (!isRecording) return null;
    setIsRecording(false);

    await recorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    const uri = recorder.uri;
    const durationSec = Math.round(durationMs / 1000);
    if (!uri || durationSec < 1) return null;
    return { uri, durationSec };
  }, [recorder, isRecording, durationMs]);

  const cancel = useCallback(async () => {
    setIsRecording(false);
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  }, [recorder]);

  return { isRecording, durationMs, start, stop, cancel };
}

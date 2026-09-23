import { useCallback, useEffect, useRef, useState } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Alert } from "react-native";
import type { RecordingStatus } from "expo-audio";

/**
 * How long to wait for iOS to finish writing the recording after stop().
 *
 * This is not belt-and-braces: uploading immediately shipped a file that was
 * 26 bytes of audio inside a 57KB block iOS had pre-allocated but not yet
 * filled, with a header claiming 0.07s. Every voice message was silent, and
 * the size never revealed it — the file is full-size from the first moment.
 */
const FINALISE_TIMEOUT_MS = 4000;

/**
 * Hold-to-talk recording.
 *
 * Both halves are driven by a finger that does not wait: press-in starts an
 * async chain (permission → audio mode → prepare) and press-out can land in
 * the middle of it. So intent is tracked in a ref the handlers set
 * synchronously, and the async chain checks it before it actually records —
 * otherwise a quick tap left the recorder running with nobody to stop it, and
 * the composer counted seconds forever.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isRecording, setIsRecording] = useState(false);
  const [tickedMs, setTickedMs] = useState(0);

  /** The finger's intent, set synchronously; the async chain obeys it. */
  const wants = useRef(false);
  /** A start still in flight, so stop() can wait for it instead of racing it. */
  const starting = useRef<Promise<void> | null>(null);
  /** Mirrors isRecording for the async paths, which see stale state. */
  const recording = useRef(false);
  /** Newest length seen, for stop() to read without waiting for a render. */
  const latestMs = useRef(0);

  /**
   * The recorder is polled here rather than trusted through
   * useAudioRecorderState: that hook reported 0 throughout on iOS, which both
   * froze the counter at "0s" and sent every voice message as 0:00. Asking
   * getStatus() directly is the same call it makes, without whatever is
   * dropping the updates. Its value is still folded in, in case a platform
   * reports one and not the other.
   */
  useEffect(() => {
    if (!isRecording) return;
    const read = () => {
      const ms = Math.max(
        recorder.getStatus?.().durationMillis ?? 0,
        recorderState.durationMillis ?? 0,
        // Never go backwards mid-recording: a momentary 0 from either source
        // would make the counter stutter.
        latestMs.current,
      );
      latestMs.current = ms;
      setTickedMs(ms);
    };
    read();
    const timer = setInterval(read, 200);
    return () => clearInterval(timer);
  }, [isRecording, recorder, recorderState.durationMillis]);

  const durationMs = isRecording ? tickedMs : 0;

  const start = useCallback(async (): Promise<boolean> => {
    wants.current = true;

    const run = (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        wants.current = false;
        Alert.alert(
          "Mikrofon",
          "Ovozli xabar uchun mikrofonga ruxsat berishingiz kerak",
        );
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();

      // Released while we were getting ready: never start.
      if (!wants.current) return;

      recorder.record();
      latestMs.current = 0;
      setTickedMs(0);
      recording.current = true;
      setIsRecording(true);
    })();

    starting.current = run;
    try {
      await run;
    } catch {
      wants.current = false;
      recording.current = false;
      setIsRecording(false);
    } finally {
      starting.current = null;
    }
    return recording.current;
  }, [recorder]);

  const stop = useCallback(async (): Promise<{
    uri: string;
    durationSec: number;
  } | null> => {
    wants.current = false;
    // A start still running would otherwise begin recording right after this
    // returned — the stuck-counter bug.
    if (starting.current) await starting.current.catch(() => undefined);
    if (!recording.current) return null;

    // Read the length BEFORE stopping: stopping resets the recorder's status,
    // and reading it after was what made every voice message 0:00.
    const recordedMs = Math.max(
      recorder.getStatus?.().durationMillis ?? 0,
      latestMs.current,
    );

    recording.current = false;
    setIsRecording(false);

    // Subscribed BEFORE stop(): the recorder may report itself finished
    // within the same tick, and a listener added afterwards would miss it.
    const finished = new Promise<string | null>((resolve) => {
      let done = false;
      const settle = (value: string | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          sub?.remove();
        } catch {
          // already gone
        }
        resolve(value);
      };
      const timer = setTimeout(() => settle(null), FINALISE_TIMEOUT_MS);
      const sub = (
        recorder as unknown as {
          addListener(
            event: "recordingStatusUpdate",
            listener: (status: RecordingStatus) => void,
          ): { remove(): void };
        }
      ).addListener("recordingStatusUpdate", (status) => {
        if (status.isFinished) settle(status.url ?? null);
      });
    });

    await recorder.stop();
    const finalUrl = await finished;
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    // The finished event carries the written file; recorder.uri is the same
    // path, and is the fallback if the event never arrives.
    const uri = finalUrl ?? recorder.uri;
    // Round up, not to nearest: a 1.4s note is not a 1-second note.
    const durationSec = Math.max(1, Math.ceil(recordedMs / 1000));
    // Below a second is a mis-tap, not a message.
    if (!uri || recordedMs < 900) return null;
    return { uri, durationSec };
  }, [recorder]);

  const cancel = useCallback(async () => {
    wants.current = false;
    if (starting.current) await starting.current.catch(() => undefined);
    recording.current = false;
    setIsRecording(false);
    latestMs.current = 0;
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [recorder]);

  return { isRecording, durationMs, start, stop, cancel };
}

import { useState } from "react";
import {
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { Directory, File, Paths } from "expo-file-system";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "../../theme/tokens";
import { t } from "../../i18n";
import { toast } from "./Toast";
import { notify } from "../../lib/alerts";

const MAX_SCALE = 4;

/** The two controls floating over the photo. Dark discs, not palette surfaces:
 *  the backdrop is always black here, whatever the app's scheme. */
const chromeButton = {
  position: "absolute",
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
} as const;

/** Saving to the camera roll has no web equivalent — the browser's own image
 *  context menu covers it there, so the button is native-only. */
const CAN_SAVE = Platform.OS !== "web";

async function saveToLibrary(uri: string) {
  // writeOnly: saving needs no read access, and iOS shows the lighter
  // "add to library" prompt for it.
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    notify("chat.galleryPermissionTitle", "chat.galleryPermissionMessage");
    return;
  }

  // MediaLibrary only takes local files, so the remote image is pulled into
  // the cache first. Cache, not documents: the copy is disposable once the
  // asset is in the gallery, and the OS can reclaim it.
  const downloads = new Directory(Paths.cache, "chat-downloads");
  if (!downloads.exists) downloads.create({ intermediates: true });

  const file = await File.downloadFileAsync(uri, downloads, {
    idempotent: true, // same photo saved twice must not throw
  });

  try {
    await MediaLibrary.saveToLibraryAsync(file.uri);
    toast.successKey("chat.imageSaved");
  } finally {
    file.delete();
  }
}

/**
 * Full-screen photo view: pinch, pan, double-tap to zoom, tap to dismiss, and
 * save to the camera roll on native.
 *
 * Shared rather than chat's own, because every place the app shows a photo
 * shows it small — a 220pt chat bubble, a 76pt avatar — and small is not the
 * only size anyone wants to see it at.
 */
export function ImageViewer({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!uri || saving) return;
    setSaving(true);
    try {
      await saveToLibrary(uri);
    } catch {
      // The URL, the disk and the gallery can each refuse; none of them is
      // worth its own message here.
      toast.errorKey("chat.saveImageError");
    } finally {
      setSaving(false);
    }
  };

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    x.value = withTiming(0);
    y.value = withTiming(0);
  };

  const close = () => {
    // Reset before unmounting, or the next photo opens at the last zoom level.
    scale.value = 1;
    x.value = 0;
    y.value = 0;
    onClose();
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(1, startScale.value * e.scale),
      );
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
      }
    });

  // Panning only makes sense once the photo is bigger than the screen.
  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
      } else {
        scale.value = withTiming(2.5);
      }
    });

  // Single tap dismisses, but only at rest — otherwise it fires while the user
  // is lining up a zoomed photo.
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1) runOnJS(close)();
      else runOnJS(reset)();
    });

  const gesture = Gesture.Exclusive(
    Gesture.Simultaneous(pinch, pan),
    doubleTap,
    singleTap,
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  if (!uri) return null;

  return (
    <Modal visible transparent statusBarTranslucent onRequestClose={close}>
      {/* A Modal is its own native view tree: on Android the gestures inside
          it are dead unless the content has its own root. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, style]}>
            <Image
              source={{ uri }}
              style={{ width, height }}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={120}
            />
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={close}
          hitSlop={12}
          accessibilityLabel={t("common.close")}
          style={[chromeButton, { top: insets.top + spacing.sm, left: spacing.md }]}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>

        {CAN_SAVE ? (
          <Pressable
            onPress={() => void onSave()}
            hitSlop={12}
            disabled={saving}
            accessibilityLabel={t("chat.saveImage")}
            style={[
              chromeButton,
              { top: insets.top + spacing.sm, right: spacing.md },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#FFFFFF" />
            )}
          </Pressable>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

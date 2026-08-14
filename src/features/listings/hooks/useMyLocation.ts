import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { confirm, notify } from "../../../lib/alerts";

export interface Coords {
  latitude: number;
  longitude: number;
}

export function useMyLocation() {
  const [loading, setLoading] = useState(false);

  const locate = useCallback(async (): Promise<Coords | null> => {
    setLoading(true);

    try {
      // Permanently denied is a dead end for requestPermissions — asking again
      // resolves "denied" without ever showing a prompt, so send the user to
      // the OS settings instead. Notices go through the in-app dialog: RN's
      // Alert is an empty no-op on react-native-web.
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === "denied" && !current.canAskAgain) {
        if (Platform.OS === "web") {
          notify("location.title", "location.permissionBlocked");
        } else {
          confirm({
            titleKey: "location.title",
            messageKey: "location.permissionBlocked",
            confirmKey: "location.openSettings",
            onConfirm: () => {
              Linking.openSettings().catch(() => {});
            },
          });
        }
        return null;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        notify("location.title", "location.permissionMessage");
        return null;
      }

      // A cached fix keeps the button instant; only fall back to a live one,
      // which can take seconds outdoors and longer indoors.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 30_000 });
      const pos =
        last ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
    } catch {
      notify("location.title", "location.unavailable");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { locate, loading };
}

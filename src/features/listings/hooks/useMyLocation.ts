import { useCallback, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { confirm, notify } from "../../../lib/alerts";
import { toast } from "../../../components/ui/Toast";

export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * Resolves to true once the app may read the device's position.
 *
 * Permanently denied is a dead end for requestPermissions — asking again
 * resolves "denied" without ever showing a prompt, so send the user to the OS
 * settings instead. Notices go through the in-app dialog: RN's Alert is an
 * empty no-op on react-native-web.
 */
async function ensureForegroundPermission(): Promise<boolean> {
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
    return false;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    notify("location.title", "location.permissionMessage");
    return false;
  }
  return true;
}

export function useMyLocation() {
  const [loading, setLoading] = useState(false);

  const locate = useCallback(async (): Promise<Coords | null> => {
    setLoading(true);

    try {
      if (!(await ensureForegroundPermission())) return null;

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

/** Never throws: a geocoder that is unreachable, rate-limited or simply
 *  unsure is the same "no result" to the caller. */
async function geocodeQuietly(query: string) {
  try {
    return await Location.geocodeAsync(query);
  } catch {
    return [];
  }
}

/**
 * Address → coordinates, for moving a map camera somewhere by name.
 *
 * Native only (`geocodeAsync` has no web implementation), which is fine: the
 * only screen using it is the polygon editor, and that is already a "open the
 * app on your phone" stub in the browser.
 */
export function useGeocode() {
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string): Promise<Coords | null> => {
    const q = query.trim();
    if (!q) return null;

    setLoading(true);
    try {
      let results = await geocodeQuietly(q);

      // Android's Geocoder is permission-gated and answers with an empty list
      // rather than an error when it is not held. Asked for only once a search
      // has actually come back empty — prompting for the user's location the
      // moment they type a street name is a bad trade for a lookup that
      // usually works without it.
      if (!results.length && Platform.OS === "android") {
        const held = await Location.getForegroundPermissionsAsync();
        if (!held.granted && (await ensureForegroundPermission())) {
          results = await geocodeQuietly(q);
        }
      }

      const first = results[0];
      if (!first) {
        toast.errorKey("map.searchNotFound");
        return null;
      }

      return { latitude: first.latitude, longitude: first.longitude };
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, loading };
}

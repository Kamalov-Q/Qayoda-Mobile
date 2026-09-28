import { Linking, Platform } from "react-native";

/**
 * Sending someone to a place, in whatever they navigate with.
 *
 * Every entry is a deep link that asks for a ROUTE, not just a pin: the point
 * of leaving the app is to be told where to turn. The web links at the bottom
 * of the list always work, so the reader is never offered nothing.
 *
 * iOS only reports a custom scheme as openable when the scheme is listed in
 * `LSApplicationQueriesSchemes` (see app.json) — without that, `canOpenURL`
 * answers false for an app that is installed and sitting on the home screen.
 */
export interface NavTarget {
  key: string;
  /** Shown in the picker. Product names, deliberately untranslated. */
  label: string;
  icon: "navigate" | "map" | "globe";
  /** Tried first; `web` is the fallback when it cannot be opened. */
  app?: string;
  web: string;
}

/** Yandex is the default here: it is what Tashkent actually navigates with. */
export function navTargets(
  lat: number,
  lng: number,
  label?: string | null,
): NavTarget[] {
  const point = `${lat},${lng}`;
  const name = encodeURIComponent(label?.trim() || "");
  // A browser cannot open `yandexnavi://`, and unlike a phone it fails
  // silently — the tab simply does nothing. On web every target is its link.
  const native = Platform.OS !== "web";

  const targets: NavTarget[] = [
    {
      key: "yandex-navi",
      label: "Yandex Navigator",
      icon: "navigate",
      app: native
        ? `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`
        : undefined,
      web: `https://yandex.uz/maps/?rtext=~${point}&rtt=auto`,
    },
    {
      key: "yandex-maps",
      label: "Yandex Maps",
      icon: "map",
      app: native
        ? `yandexmaps://build_route_on_map?lat_to=${lat}&lon_to=${lng}`
        : undefined,
      web: `https://yandex.uz/maps/?rtext=~${point}&rtt=auto`,
    },
    {
      key: "google",
      label: "Google Maps",
      icon: "map",
      app: !native
        ? undefined
        : Platform.OS === "ios"
          ? `comgooglemaps://?daddr=${point}&directionsmode=driving`
          : // The geo: scheme is Android's own, and Google Maps answers it.
            `geo:${point}?q=${point}${name ? `(${name})` : ""}`,
      web: `https://www.google.com/maps/dir/?api=1&destination=${point}`,
    },
  ];

  if (Platform.OS === "ios") {
    targets.push({
      key: "apple",
      label: "Apple Maps",
      icon: "map",
      app: `maps://?daddr=${point}&dirflg=d`,
      web: `https://maps.apple.com/?daddr=${point}&dirflg=d`,
    });
  }

  return targets;
}

/**
 * The targets this phone can actually act on.
 *
 * Asked once when the picker opens rather than at render time: `canOpenURL`
 * crosses the native bridge per entry, and the answer cannot change while a
 * sheet is on screen. An app that cannot be reached still earns its row —
 * `open` falls back to the browser, which is a worse trip but not a dead end.
 */
export async function availableNavTargets(
  targets: NavTarget[],
): Promise<NavTarget[]> {
  const checked = await Promise.all(
    targets.map(async (target) => {
      if (!target.app) return { target, installed: true };
      try {
        return { target, installed: await Linking.canOpenURL(target.app) };
      } catch {
        return { target, installed: false };
      }
    }),
  );

  const installed = checked.filter((c) => c.installed).map((c) => c.target);

  // Nothing detected (a bare emulator, a missing plist entry) is not a reason
  // to show an empty sheet: every target has a web link that works.
  return installed.length ? installed : targets;
}

/** Opens one, falling back to its web link. Resolves to false if neither took. */
export async function openNavTarget(target: NavTarget): Promise<boolean> {
  if (target.app) {
    try {
      await Linking.openURL(target.app);
      return true;
    } catch {
      // Installed-but-refusing, or never installed — the browser still knows
      // the way.
    }
  }

  try {
    await Linking.openURL(target.web);
    return true;
  } catch {
    return false;
  }
}

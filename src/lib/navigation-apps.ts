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
      // `build_route_on_map` is a Navigator action; Yandex Maps ignored it and
      // just opened on wherever it was last. Maps takes the same route
      // request its website does.
      app: native
        ? `yandexmaps://maps.yandex.ru/?rtext=~${point}&rtt=auto`
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
          : // Not geo: — that is answered by whichever map app is the
            // default, so "Google Maps" opened Yandex on phones that have it.
            // google.navigation: is Google Maps' own, and starts a route.
            `google.navigation:q=${point}&mode=d`,
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
  if (installed.length) return installed;

  // No maps app at all: one browser route rather than a sheet of app names
  // that would each quietly open a web page instead of the app they promise.
  const google = targets.find((t) => t.key === "google") ?? targets[0];
  return [{ ...google, app: undefined }];
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

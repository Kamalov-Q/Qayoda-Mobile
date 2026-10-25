// src/features/notifications/pushSupport.ts
//
// Whether this binary carries expo-notifications' native code.
//
// The same guard mapSupport.ts applies to MapKit, and for the same reason:
// `import * as Notifications from "expo-notifications"` binds its native
// module on import, so on a build without it the import THROWS — and since
// the push hook is mounted in the root layout, that took the entire app
// down at startup with "Cannot find native module 'ExpoPushTokenManager'".
//
// That is not a hypothetical. Every dev build made before expo-notifications
// was added hits it, which is every device that has not been prebuilt and
// rebuilt since. Push is a best-effort layer over an inbox that already
// works by polling; it must never be the reason the app will not open.
import { requireOptionalNativeModule } from "expo";

export const PUSH_SUPPORTED =
  requireOptionalNativeModule("ExpoPushTokenManager") != null;

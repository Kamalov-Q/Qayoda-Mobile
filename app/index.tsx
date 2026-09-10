// app/index.tsx
import { Redirect } from "expo-router";
import { usePreferences } from "../src/lib/preferences";

export default function Index() {
  const introSeen = usePreferences((s) => s.introSeen);
  // The very first open — guest or not — walks the intro once; the flag
  // persists, so every later visit lands straight on the tabs. (A user who
  // somehow skips it, e.g. an old install, still gets it after first login —
  // goHomeAfterAuth checks the same flag.)
  if (!introSeen) return <Redirect href="/intro" />;
  return <Redirect href="/(tabs)/home" />;
}

// app/index.tsx
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/features/auth/store/auth.store";

export default function Index() {
  const status = useAuthStore((s) => s.status);
  // status can't be 'loading' here — root layout gates rendering until bootstrap finishes
  return (
    <Redirect
      href={status === "authenticated" ? "/(tabs)/home" : "/(auth)/welcome"}
    />
  );
}

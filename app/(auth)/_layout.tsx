import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { useTheme } from "../../src/theme/useTheme";

export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);
  const { colors } = useTheme();
  if (status === "authenticated") return <Redirect href="/(tabs)/sotuv" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Without this the transition flashes the default white scene
        // background between dark screens.
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

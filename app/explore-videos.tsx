// app/explore-videos.tsx — the video explore grid.
//
// Posters three across with their view counts, searchable by caption. The
// Videos tab is the reel pager — one clip at a time, chosen for you. This is
// the other half of the same feature: everything at once, scanned rather
// than watched, so somebody can go looking instead of being shown.
//
// Reached from the tile under the map card on the home screen. Tapping a
// poster opens that reel full-screen.
import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { DebouncedTextField, Screen, HEADER_EDGES } from "@/src/components/ui";
import { spacing } from "@/src/theme/tokens";
import { useT } from "@/src/i18n";
import { VideoResults } from "@/src/features/search/components/VideoResults";

export default function ExploreVideosScreen() {
  const t = useT();
  const [search, setSearch] = useState("");

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("videos.title") }} />

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <DebouncedTextField
          placeholder={t("search.videosPlaceholder")}
          icon="search-outline"
          initialValue={search}
          onChangeDebounced={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          round
        />
      </View>

      <VideoResults query={search} />
    </Screen>
  );
}

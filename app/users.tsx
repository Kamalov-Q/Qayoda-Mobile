// app/users.tsx — the sellers directory.
//
// Everyone with a live listing, busiest first, narrowed by name as you type.
// Reached from the two tiles under the map card on the home screen, which is
// where somebody who wants a person rather than a property looks.
//
// Browse and search are one list, not two modes: the directory is always
// there and the field filters it, so backspacing out of a search restores
// the list instead of emptying the screen.
import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { DebouncedTextField, Screen, HEADER_EDGES } from "@/src/components/ui";
import { spacing } from "@/src/theme/tokens";
import { useT } from "@/src/i18n";
import { PeopleResults } from "@/src/features/search/components/PeopleResults";

export default function UsersScreen() {
  const t = useT();
  const [search, setSearch] = useState("");

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("users.title") }} />

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <DebouncedTextField
          placeholder={t("users.searchPlaceholder")}
          icon="search-outline"
          initialValue={search}
          onChangeDebounced={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          round
        />
      </View>

      <PeopleResults query={search} />
    </Screen>
  );
}

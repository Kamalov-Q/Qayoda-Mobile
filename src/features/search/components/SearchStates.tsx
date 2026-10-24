// The two states every search segment shares before it has results: nothing
// typed yet, and a request in flight.
//
// Extracted because People and Videos had the same wrapper copied into both,
// and because the distinction it carries is easy to lose. "Type two letters"
// and "nothing found" look alike on screen and are opposite facts — telling
// someone their search matched nothing when they have typed one character is
// the one of the two that is actually wrong.
import { View, ActivityIndicator } from "react-native";
import { EmptyState } from "@/src/components/ui";
import { useTheme } from "@/src/theme/useTheme";
import { useT } from "@/src/i18n";

/** Centres its child under the floating header bar. */
function Centred({
  children,
  paddingTop,
}: {
  children: React.ReactNode;
  paddingTop: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingTop,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/** Shown while the query is too short to ask about. */
export function SearchIdle({
  minLength,
  paddingTop,
}: {
  minLength: number;
  paddingTop: number;
}) {
  const t = useT();
  return (
    <Centred paddingTop={paddingTop}>
      <EmptyState
        icon="search-outline"
        title={t("search.typeToSearch", { count: minLength })}
      />
    </Centred>
  );
}

/** Shown while the first page is in flight. */
export function SearchLoading({ paddingTop }: { paddingTop: number }) {
  const { colors } = useTheme();
  return (
    <Centred paddingTop={paddingTop}>
      <ActivityIndicator color={colors.primary} />
    </Centred>
  );
}

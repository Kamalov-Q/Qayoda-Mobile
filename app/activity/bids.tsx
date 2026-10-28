// Every price negotiation you are in — the one view of them outside the chat
// threads they live in. The endpoint has existed since the feature shipped
// and had nothing in front of it, so an offer you made on an advert you never
// went back to was effectively invisible until it expired.
import { Stack } from "expo-router";
import { Screen, HEADER_EDGES } from "../../src/components/ui";
import { useT } from "../../src/i18n";
import { useAuthStore } from "../../src/features/auth/store/auth.store";
import { ActivityList } from "../../src/features/activity/components/ActivityList";
import { BidRow } from "../../src/features/price-bids/components/BidRow";
import { useMyBids } from "../../src/features/price-bids/hooks/usePriceBids";

export default function MyBidsScreen() {
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id);
  const query = useMyBids();

  return (
    <Screen style={{ padding: 0 }} scroll={false} edges={HEADER_EDGES}>
      <Stack.Screen options={{ title: t("bids.myTitle") }} />

      <ActivityList
        query={query}
        keyOf={(bid) => bid.id}
        emptyIcon="pricetag-outline"
        emptyTitle="bids.myEmpty"
        emptyHint="bids.myEmptyHint"
        renderItem={(bid) => <BidRow bid={bid} viewerId={userId} />}
      />
    </Screen>
  );
}

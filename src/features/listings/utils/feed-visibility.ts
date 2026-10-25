// src/features/listings/utils/feed-visibility.ts
//
// Which feed cards are actually on screen.
//
// A store rather than a prop, for one reason: the feed's FlatList learns
// this from onViewableItemsChanged, and routing it down as React state
// would re-render the whole home screen on every scroll settle — a bigger
// cost than the timers this exists to switch off. A zustand write happens
// outside React, and each slider subscribes to the single boolean it cares
// about, so only cards whose visibility actually flipped re-render.
import { create } from "zustand";

interface FeedVisibility {
  /** Ids of the listing cards currently in the viewport. */
  visible: ReadonlySet<string>;
  setVisible: (ids: string[]) => void;
}

const EMPTY: ReadonlySet<string> = new Set<string>();

export const useFeedVisibilityStore = create<FeedVisibility>((set) => ({
  visible: EMPTY,
  setVisible: (ids) =>
    set((state) => {
      // Same membership, same object: a fresh Set on every settle would
      // notify every subscriber even when nothing entered or left.
      if (
        ids.length === state.visible.size &&
        ids.every((id) => state.visible.has(id))
      ) {
        return state;
      }
      return { visible: new Set(ids) };
    }),
}));

/**
 * Whether this card is on screen.
 *
 * `undefined` means "not in a tracked list" — the photo rails and the saved
 * screen use the same slider without viewability wiring, and they should
 * keep behaving exactly as they did.
 *
 * Selects a boolean, not the Set, so a subscriber only re-renders when its
 * own answer changes.
 */
export function useIsCardVisible(id: string | undefined): boolean {
  return useFeedVisibilityStore((s) =>
    id === undefined ? true : s.visible.has(id),
  );
}

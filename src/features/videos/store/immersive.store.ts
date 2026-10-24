import { create } from "zustand";

/**
 * Whether a reel is being held for a clear look at it.
 *
 * Press and hold on a clip and everything drawn over it gets out of the way:
 * the scrim, the caption, the action rail, the feed's own header row and the
 * tab bar. That last one is the reason this is a store rather than a prop.
 * The flag is set deep inside a page of the pager and read by the tabs
 * layout, which is three screens up and not on the pager's path at all.
 *
 * The tab bar FADES rather than unmounting. Removing it would shorten the
 * pager by 58pt mid-gesture, every page would be re-measured at the new
 * height, and the feed would land somewhere other than where the finger
 * found it — a worse bug than the bar being visible for the second somebody
 * holds a clip down.
 */
interface ImmersiveState {
  /** True only while a finger is down on a reel. */
  immersive: boolean;
  setImmersive: (on: boolean) => void;
}

export const useImmersiveStore = create<ImmersiveState>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
}));

// src/features/map/locationPickerStore.ts
// Hands a location picker page its starting value and where to send the
// result. The pickers used to be Modals rendered by the post form, with the
// value and onSave passed as props; as routes they can't take props, so the
// form parks the same two things here before navigating, and the page reads
// them back. In memory only — nothing here needs to survive a restart.
import { create } from "zustand";

export type LngLat = [number, number];

export type PickerRequest =
  | { kind: "pin"; initial: LngLat | null; onSave: (point: LngLat) => void }
  | { kind: "polygon"; initial: LngLat[]; onSave: (ring: LngLat[]) => void };

interface State {
  request: PickerRequest | null;
  open: (request: PickerRequest) => void;
  clear: () => void;
}

export const useLocationPicker = create<State>((set) => ({
  request: null,
  open: (request) => set({ request }),
  clear: () => set({ request: null }),
}));

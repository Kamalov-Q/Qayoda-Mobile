import { create } from "zustand";

/**
 * The Click top-up the user is paying for right now.
 *
 * Click sends the user back to a fixed address (growencity://wallet/result,
 * CLICK_RETURN_URL on the server) that carries no payment id, so the result
 * screen needs another way to know which payment to check. Set just before
 * the checkout opens, read by app/wallet/result.tsx.
 *
 * Memory only, on purpose: if the OS killed the app while the user was in
 * Click, the result screen falls back to refreshing the balance — a stale id
 * restored from disk days later would report on the wrong payment.
 */
interface PendingTopup {
  paymentId: string;
  amount: number;
}

export const usePendingTopupStore = create<{
  pending: PendingTopup | null;
  setPending: (p: PendingTopup | null) => void;
}>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));

import { router } from "expo-router";
import { ApiError } from "@/src/lib/api-client";
import { showDialog } from "@/src/components/ui/Dialog";
import { toast } from "@/src/components/ui/Toast";
import { errorMessage } from "@/src/lib/api-error";
import { formatThousands } from "@/src/features/wallet/components/VirtualCard";

/** The server sends both numbers with the refusal, so the app can name them. */
interface InsufficientFunds {
  required: string;
  balance: string;
}

function insufficientFunds(error: unknown): InsufficientFunds | null {
  if (!(error instanceof ApiError) || error.code !== "INSUFFICIENT_FUNDS") {
    return null;
  }

  const body = error as unknown as Partial<InsufficientFunds>;
  return body.required != null && body.balance != null
    ? { required: String(body.required), balance: String(body.balance) }
    : null;
}

/**
 * What to do when a charged action is refused.
 *
 * Running out of balance is not an error to toast and forget — it is the one
 * failure the person can actually fix, and the fix is one screen away. So it
 * gets a dialog naming both numbers and offering the top-up, while every
 * other failure stays a toast.
 *
 * Shared by every charged action, because "you need 5 000 so'm" phrased three
 * different ways in three places is how a paywall starts to feel arbitrary.
 */
export function handleChargeError(error: unknown): void {
  const short = insufficientFunds(error);

  if (!short) {
    toast.error(errorMessage(error));
    return;
  }

  showDialog({
    titleKey: "tariffs.notEnough",
    messageKey: "tariffs.notEnoughBody",
    params: {
      required: formatThousands(short.required),
      balance: formatThousands(short.balance),
    },
    confirmKey: "tariffs.topUp",
    cancelKey: "common.cancel",
    onConfirm: () => router.push("/wallet"),
  });
}

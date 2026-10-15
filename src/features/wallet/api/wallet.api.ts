import { api } from "@/src/lib/api-client";

export type TopupProvider = "CLICK" | "PAYME" | "PAYNET";
export type PaymentStatus = "CREATED" | "PREPARED" | "PAID" | "CANCELLED";

export interface CreateTopupRequest {
  amount: number;
  provider: TopupProvider;
  clientId?: string;
}

export interface CreateTopupResponse {
  paymentId: string;
  status: PaymentStatus;
  provider: TopupProvider;
  payUrl: string;
  bonusPreview: {
    percent: number;
    amount: string;
  };
}

export interface TopupStatusResponse {
  id: string;
  provider: TopupProvider;
  status: PaymentStatus;
  amount: string;
  bonusAmount: string | null;
  paidAt: string | null;
}

export interface WalletOverview {
  balance: string;
  balanceTiyin: number;
  providers: TopupProvider[];
}

export type TxKind =
  | "TOPUP"
  | "TOPUP_BONUS"
  | "LISTING_POST"
  | "STORY_POST"
  | "LISTING_PROMOTE"
  | "REFUND"
  | "ADMIN_ADJUST";

export interface WalletTransactionItem {
  id: string;
  userId: string;
  amount: string;
  kind: TxKind;
  referenceId: string | null;
  balanceAfter: string;
  note: string | null;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  items: WalletTransactionItem[];
  total: number;
  limit: number;
  offset: number;
}

export type FiscalStatus = "NONE" | "BY_PROVIDER" | "PENDING" | "SENDING" | "SENT" | "FAILED";

/** The provider payment behind a top-up, its bonus or its reversal. */
export interface TransactionPayment {
  id: string;
  /** Our order number — the one Click shows on its receipt. */
  orderNo: number;
  provider: TopupProvider;
  status: PaymentStatus;
  amount: string;
  bonusAmount: string;
  providerTxnId: string | null;
  fiscalStatus: FiscalStatus;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface WalletTransactionDetail extends WalletTransactionItem {
  listingId: string | null;
  payment: TransactionPayment | null;
}

export const walletApi = {
  overview: (): Promise<WalletOverview> => api("/wallet"),

  createTopup: (body: CreateTopupRequest): Promise<CreateTopupResponse> =>
    api("/wallet/topup", { method: "POST", body }),

  getTopupStatus: (id: string): Promise<TopupStatusResponse> =>
    api(`/wallet/topup/${id}`),

  getTransaction: (id: string): Promise<WalletTransactionDetail> =>
    api(`/wallet/transactions/${id}`),

  getTransactions: (params?: {
    limit?: number;
    offset?: number;
  }): Promise<WalletTransactionsResponse> => {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.offset) search.set("offset", String(params.offset));
    const qs = search.toString();
    return api(`/wallet/transactions${qs ? `?${qs}` : ""}`);
  },
};


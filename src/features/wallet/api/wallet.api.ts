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
  /**
   * The public account number ("Hisob raqami") — what the user types into
   * Paynet to pay into this wallet. Short and never reused, unlike the
   * account's uuid.
   */
  accountNo: number;
}

export type TxKind =
  | "TOPUP"
  | "TOPUP_BONUS"
  | "LISTING_POST"
  | "LISTING_PROMOTE"
  | "VIDEO_POST"
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

/** The Paynet checkout link, built server-side. */
export interface PaynetLinkResponse {
  /** The number the payer types into Paynet ("Hisob raqami"). */
  accountNo: number;
  payUrl: string;
}

export const walletApi = {
  overview: (): Promise<WalletOverview> => api("/wallet"),

  /**
   * Paynet is push-model: there is no order to create, only a link to open.
   * The server builds it from PAYNET_MERCHANT_ID and the user's account
   * number — which is why it is asked for rather than assembled here. The
   * app used to hardcode the merchant id, so changing it meant a release.
   */
  paynetLink: (amount?: number): Promise<PaynetLinkResponse> =>
    api(`/wallet/paynet-link${amount ? `?amount=${amount}` : ""}`),

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


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

export const walletApi = {
  overview: (): Promise<WalletOverview> => api("/wallet"),

  createTopup: (body: CreateTopupRequest): Promise<CreateTopupResponse> =>
    api("/wallet/topup", { method: "POST", body }),

  getTopupStatus: (id: string): Promise<TopupStatusResponse> =>
    api(`/wallet/topup/${id}`),
};

import { api, fetchAuthenticatedAsset } from "./api";

export interface PaymentQrConfiguration {
  configured: boolean;
  imageUrl: string | null;
  updatedAt: string | null;
}

export const EMPTY_PAYMENT_QR: PaymentQrConfiguration = {
  configured: false,
  imageUrl: null,
  updatedAt: null,
};

export async function fetchPaymentQrConfiguration(): Promise<PaymentQrConfiguration> {
  const response = await api.get<PaymentQrConfiguration>("/payment-qr");
  return {
    configured: Boolean(response.configured && response.imageUrl),
    imageUrl: response.imageUrl || null,
    updatedAt: response.updatedAt || null,
  };
}

export async function fetchPaymentQrObjectUrl(imageUrl: string): Promise<string> {
  const image = await fetchAuthenticatedAsset(imageUrl);
  return URL.createObjectURL(image);
}

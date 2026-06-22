import { apiFetch } from "./client";

export interface DonationTransaction {
  id: number;
  type: "credit" | "debit";
  amount: number;
  description: string | null;
  receipt_key: string | null;
  transaction_date: string;
  created_at: string;
  created_by_name: string;
}

export interface DonationData {
  transactions: DonationTransaction[];
  total_credit: number;
  total_debit: number;
  balance: number;
}

export interface DonationPayload {
  type: string;
  amount: number;
  description?: string;
  receipt_key?: string;
  transaction_date: string;
}

export function getDonations(
  params: { type?: string; year?: number; month?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.year) query.set("year", String(params.year));
  if (params.month) query.set("month", String(params.month));
  const qs = query.toString();
  return apiFetch(`/donations${qs ? `?${qs}` : ""}`) as Promise<DonationData>;
}

export function getDonationReceiptUrl(id: number, download = false) {
  return apiFetch(`/donations/${id}/receipt?download=${download}`) as Promise<{
    url: string;
  }>;
}

export function getReceiptUploadUrl(filename: string, content_type: string) {
  return apiFetch("/donations/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename, content_type }),
  }) as Promise<{ upload_url: string; key: string }>;
}

export function createDonation(data: DonationPayload) {
  return apiFetch("/donations", {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{ id: number; message: string }>;
}

export function updateDonation(id: number, data: DonationPayload) {
  return apiFetch(`/donations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }) as Promise<{ message: string }>;
}

export function deleteDonation(id: number) {
  return apiFetch(`/donations/${id}`, {
    method: "DELETE",
  }) as Promise<null>;
}

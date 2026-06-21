import { apiFetch } from "./client";
import type { PendingPayments, OverdueEntry, PaymentHistory } from "../types";

export const createPaymentSession = (data: {
  parent_id: number;
  total_amount: number;
  payment_method: string;
  notes?: string;
  paid_at: string;
  fee_payments: {
    child_id: number;
    month: number;
    year: number;
    amount: number;
  }[];
}) =>
  apiFetch("/payments/session", { method: "POST", body: JSON.stringify(data) });

export const createRegistrationPayment = (
  childId: number,
  data: {
    amount: number;
    payment_method: string;
    paid_at: string;
  },
) =>
  apiFetch(`/payments/registration/${childId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getPendingPayments = (childId: number) =>
  apiFetch(`/payments/pending/${childId}`) as Promise<PendingPayments>;

export const getPaymentHistory = (parentId: number) =>
  apiFetch(`/payments/history/${parentId}`) as Promise<PaymentHistory>;

export const getOverduePayments = () =>
  apiFetch("/payments/overdue") as Promise<OverdueEntry[]>;

import { apiFetch } from "./client";
import type { ReportParent, ReportChild } from "../types";

export interface ReportFilters {
  parent_id?: number;
  child_id?: number;
  month?: number;
  year?: number;
}

export interface MyReportFilters {
  child_id?: number;
  month?: number;
  year?: number;
}

export interface MyReportData {
  parent_id: number;
  parent_name: string;
  is_active: boolean;
  children: ReportChild[];
}

export const getPaymentSummary = (filters: ReportFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.parent_id !== undefined)
    params.set("parent_id", String(filters.parent_id));
  if (filters.child_id !== undefined)
    params.set("child_id", String(filters.child_id));
  if (filters.month !== undefined) params.set("month", String(filters.month));
  if (filters.year !== undefined) params.set("year", String(filters.year));
  const query = params.toString();
  return apiFetch(
    `/reports/payment-summary${query ? `?${query}` : ""}`,
  ) as Promise<ReportParent[]>;
};

export const getMyPaymentSummary = (filters: MyReportFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.child_id !== undefined)
    params.set("child_id", String(filters.child_id));
  if (filters.month !== undefined) params.set("month", String(filters.month));
  if (filters.year !== undefined) params.set("year", String(filters.year));
  const query = params.toString();
  return apiFetch(
    `/reports/my-payment-summary${query ? `?${query}` : ""}`,
  ) as Promise<MyReportData>;
};

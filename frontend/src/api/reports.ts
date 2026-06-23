import { apiFetch } from "./client";
import { API_URL } from "../config";
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

export const exportReport = async (filters: ReportFilters = {}): Promise<void> => {
  const params = new URLSearchParams();
  if (filters.parent_id !== undefined) params.set("parent_id", String(filters.parent_id));
  if (filters.child_id !== undefined)  params.set("child_id",  String(filters.child_id));
  if (filters.year !== undefined)      params.set("year",       String(filters.year));
  if (filters.month !== undefined)     params.set("month",      String(filters.month));

  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_URL}/reports/export?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  a.download = match ? match[1] : "jmr-report.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

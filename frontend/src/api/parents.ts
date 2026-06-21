import { apiFetch } from "./client";
import type { Parent, ParentDetail } from "../types";

export const getParents = () => apiFetch("/parents/") as Promise<Parent[]>;

export const getParent = (id: number, includeInactive = false) =>
  apiFetch(
    `/parents/${id}${includeInactive ? "?include_inactive=true" : ""}`,
  ) as Promise<ParentDetail>;

export const createParent = (data: {
  parent_name: string;
  email?: string;
  address?: string;
  phone_numbers: string[];
}) => apiFetch("/parents/", { method: "POST", body: JSON.stringify(data) });

export const updateParent = (
  id: number,
  data: {
    parent_name?: string;
    email?: string;
    address?: string;
    phone_numbers?: string[];
  },
) => apiFetch(`/parents/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteParent = (id: number) =>
  apiFetch(`/parents/${id}`, { method: "DELETE" });

export const sendOnboarding = (id: number) =>
  apiFetch(`/parents/${id}/send-onboarding`, { method: "POST" });

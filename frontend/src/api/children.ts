import { apiFetch } from "./client";
import type { Child, ServiceType } from "../types";

export const getServiceTypes = (includeInactive = false) =>
  apiFetch(
    `/children/service-types${includeInactive ? "?include_inactive=true" : ""}`,
  ) as Promise<ServiceType[]>;

export const toggleServiceTypeStatus = (id: number, is_active: boolean) =>
  apiFetch(`/children/service-types/${id}/status?is_active=${is_active}`, {
    method: "PATCH",
  }) as Promise<{ message: string }>;

export const createServiceType = (data: {
  name: string;
  description?: string;
  monthly_fee: number;
  registration_fee: number;
}) =>
  apiFetch("/children/service-types", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateServiceType = (
  id: number,
  data: {
    name?: string;
    description?: string;
    monthly_fee?: number;
    registration_fee?: number;
  },
) =>
  apiFetch(`/children/service-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const getChildrenByParent = (
  parentId: number,
  includeInactive = false,
) =>
  apiFetch(
    `/children/parent/${parentId}?include_inactive=${includeInactive}`,
  ) as Promise<Child[]>;

export const createChild = (data: {
  parent_id: number;
  name: string;
  dob?: string;
  service_type_ids: number[];
}) => apiFetch("/children/", { method: "POST", body: JSON.stringify(data) });

export const updateChild = (
  id: number,
  data: {
    name?: string;
    dob?: string;
    service_type_ids?: number[];
  },
) => apiFetch(`/children/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const toggleChildStatus = (id: number, is_active: boolean) =>
  apiFetch(`/children/${id}/status?is_active=${is_active}`, {
    method: "PATCH",
  });

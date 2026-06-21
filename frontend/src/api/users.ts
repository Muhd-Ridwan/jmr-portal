import { apiFetch } from "./client";
import type { StaffUser } from "../types";

export const getUsers = () => apiFetch("/users/") as Promise<StaffUser[]>;

export const createAdmin = (data: {
  name: string;
  email: string;
  password: string;
  phone_num?: string;
  address?: string;
}) =>
  apiFetch("/users/admin", {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{ id: number; message: string }>;

export const createStaffUser = (data: {
  name: string;
  email: string;
  password: string;
  phone_num?: string;
  address?: string;
}) =>
  apiFetch("/users/user", {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{ id: number; message: string }>;

export const deleteUser = (id: number) =>
  apiFetch(`/users/${id}`, { method: "DELETE" });

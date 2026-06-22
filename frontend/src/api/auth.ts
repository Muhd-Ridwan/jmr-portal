// To trigger push CICD
import { apiFetch } from "./client";

export const login = (email: string, password: string) =>
  apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });

export const setup = (name: string, email: string, password: string) =>
  apiFetch("/auth/setup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });

export const forgotPassword = (email: string) =>
  apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token: string, new_password: string) =>
  apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  });

export const refreshAccessToken = (refreshToken: string) =>
  apiFetch(`/auth/refresh?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
  }) as Promise<{ access_token: string; token_type: string }>;

export const updateProfile = (data: {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
  language?: string;
}) =>
  apiFetch("/users/me", {
    method: "PUT",
    body: JSON.stringify(data),
  }) as Promise<{ message: string }>;

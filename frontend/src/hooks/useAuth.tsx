import { createContext, useContext, useState, type ReactNode } from "react";
import i18next from "i18next";
import { apiFetch } from "../api/client";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "user";
}

interface AuthContextType {
  user: AuthUser | null;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  updateToken: (accessToken: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: Number(payload.sub),
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem("access_token");
    return token ? parseJwt(token) : null;
  });

  async function login(accessToken: string, refreshToken: string) {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    setUser(parseJwt(accessToken));
    try {
      const profile = (await apiFetch("/users/me")) as { language?: string };
      const lang = profile?.language || "en";
      localStorage.setItem("user_language", lang);
      i18next.changeLanguage(lang);
    } catch {
      // keep current language if fetch fails
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }

  function updateToken(accessToken: string) {
    localStorage.setItem("access_token", accessToken);
    setUser(parseJwt(accessToken));
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateToken, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

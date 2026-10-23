import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPost, clearToken, getToken, setToken, setUnauthorizedHandler } from "@/lib/api";

export type Role = "admin" | "teacher" | "finance";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiGet<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiPost<LoginResponse>("/auth/login", { email, password });
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

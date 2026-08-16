"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, apiPost, tokenStore } from "./api";
import { disconnectSocket } from "./socket";
import type { User } from "./types";

interface LoginResult {
  twoFactorRequired?: boolean;
  challengeToken?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    name: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: User }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const acceptSession = useCallback(
    (data: { user: User; accessToken: string; refreshToken: string }) => {
      tokenStore.set(data.accessToken, data.refreshToken);
      setUser(data.user);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const data = await apiPost<
        | { twoFactorRequired: true; challengeToken: string }
        | { user: User; accessToken: string; refreshToken: string }
      >("/api/auth/login", { email, password });
      if ("twoFactorRequired" in data && data.twoFactorRequired) {
        return { twoFactorRequired: true, challengeToken: data.challengeToken };
      }
      acceptSession(data as { user: User; accessToken: string; refreshToken: string });
      return {};
    },
    [acceptSession],
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string) => {
      const data = await apiPost<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/api/auth/2fa/verify", { challengeToken, code });
      acceptSession(data);
    },
    [acceptSession],
  );

  const register = useCallback(
    async (payload: { email: string; password: string; username: string; name: string }) => {
      const data = await apiPost<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>("/api/auth/register", payload);
      acceptSession(data);
    },
    [acceptSession],
  );

  const logout = useCallback(() => {
    const refresh = tokenStore.refresh;
    if (refresh) {
      apiPost("/api/auth/logout", { refreshToken: refresh }).catch(() => undefined);
    }
    tokenStore.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, verifyTwoFactor, register, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

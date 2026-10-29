import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiConfig } from '../api/client';
import { authApi } from '../api/services';
import type {
  AuthResponse,
  RegisterDoctorRequest,
  RegisterOtpResponse,
} from '../api/types';
import { DEFAULT_API_URL } from '../config';
import { storage } from '../utils/storage';

interface AuthContextValue {
  ready: boolean;
  user: AuthResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (dto: RegisterDoctorRequest) => Promise<RegisterOtpResponse>;
  verifyOtp: (email: string, otpCode: string) => Promise<void>;
  resendOtp: (email: string) => Promise<RegisterOtpResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthResponse | null>(null);

  const applySession = useCallback(async (session: AuthResponse | null) => {
    apiConfig.setToken(session?.token ?? null);
    setUser(session);
    await storage.setAuth(session);
  }, []);

  const logout = useCallback(async () => {
    await applySession(null);
    await storage.setPatientId(null);
  }, [applySession]);

  useEffect(() => {
    (async () => {
      apiConfig.setBaseUrl(DEFAULT_API_URL);
      await storage.setApiUrl(null);

      const saved = await storage.getAuth<AuthResponse>();
      if (saved?.token && new Date(saved.expiration).getTime() > Date.now()) {
        apiConfig.setToken(saved.token);
        setUser(saved);
      } else if (saved) {
        await storage.setAuth(null);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    apiConfig.onUnauthorized(() => {
      logout();
    });
    return () => apiConfig.onUnauthorized(null);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email.trim(), password);
      await storage.setPatientId(null);
      await applySession(res);
    },
    [applySession],
  );

  const register = useCallback(
    async (dto: RegisterDoctorRequest): Promise<RegisterOtpResponse> => {
      return authApi.registerDoctor(dto);
    },
    [],
  );

  const verifyOtp = useCallback(
    async (email: string, otpCode: string) => {
      const res = await authApi.verifyOtp(email.trim(), otpCode.trim());
      await storage.setPatientId(null);
      await applySession(res);
    },
    [applySession],
  );

  const resendOtp = useCallback(
    async (email: string): Promise<RegisterOtpResponse> => {
      return authApi.resendOtp(email.trim());
    },
    [],
  );

  const value = useMemo(
    () => ({ ready, user, login, register, verifyOtp, resendOtp, logout }),
    [ready, user, login, register, verifyOtp, resendOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

export function firstNameOf(fullName: string | null | undefined) {
  if (!fullName) {
    return '';
  }
  const parts = fullName.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
  return parts[0] ?? '';
}

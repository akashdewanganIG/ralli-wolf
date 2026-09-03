"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { authService } from "../lib/api/services";
import {
  User,
  LoginRequest,
  LoginResult,
  LoginOtpResendResponse,
  LoginOtpVerifyRequest,
  LoginResponse,
  ApiError,
} from "../lib/api/types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (credentials: LoginRequest) => Promise<LoginResult>;
  resendLoginOtp: (mfaToken: string) => Promise<LoginOtpResendResponse>;

  loginWithOtp: (credentials: LoginOtpVerifyRequest) => Promise<User>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;

  mustChangePassword: boolean;

  markPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;
  const mustChangePassword = !!user?.mustChangePassword;

  const clearError = useCallback(() => setError(null), []);

  const markPasswordChanged = useCallback(() => {
    setUser(current =>
      current ? { ...current, mustChangePassword: false } : current
    );
  }, []);

  const persistAuthSession = (response: LoginResponse) => {
    const userData: User = response.user;

    setUser(userData);

    return userData;
  };

  const login = async (credentials: LoginRequest) => {
    try {
      clearError();

      const result = await authService.login(credentials);
      if (!result.mfaRequired) persistAuthSession(result);
      return result;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login failed");
      throw err;
    }
  };

  const resendLoginOtp = async (mfaToken: string) => {
    try {
      clearError();
      return await authService.resendLoginOtp(mfaToken);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Unable to send a sign-in code");
      throw err;
    }
  };

  const loginWithOtp = async (credentials: LoginOtpVerifyRequest) => {
    try {
      setIsLoading(true);
      clearError();
      const response = await authService.verifyLoginOtp(credentials);
      return persistAuthSession(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Unable to verify the sign-in code");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Logout failed");
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    resendLoginOtp,
    loginWithOtp,
    logout,
    error,
    clearError,
    mustChangePassword,
    markPasswordChanged,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

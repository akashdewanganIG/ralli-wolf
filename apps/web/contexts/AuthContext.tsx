"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { authService } from "../lib/api/services";
import {
  User,
  LoginRequest,
  LoginResult,
  isSignedIn,
  LoginOtpResendResponse,
  LoginOtpVerifyRequest,
  SignupRequest,
  LoginResponse,
  ApiError,
} from "../lib/api/types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Verifies the password and triggers the emailed code. Resolves with the
   * challenge to hand to `loginWithOtp`; it does not sign anyone in.
   */
  login: (credentials: LoginRequest) => Promise<LoginResult>;
  resendLoginOtp: (mfaToken: string) => Promise<LoginOtpResendResponse>;
  /** Completes sign-in by redeeming the emailed code. */
  loginWithOtp: (credentials: LoginOtpVerifyRequest) => Promise<User>;
  developerLogin: (credentials: LoginRequest) => Promise<User>;
  signup: (userData: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  isDeveloper: boolean;
  /** Account is still on its emailed password; the API blocks everything else. */
  mustChangePassword: boolean;
  /** Called once the user has set their own password. */
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
  const [isDeveloper, setIsDeveloper] = useState(false);
  const router = useRouter();

  const isAuthenticated = !!user;
  const mustChangePassword = !!user?.mustChangePassword;

  const clearError = useCallback(() => setError(null), []);

  const markPasswordChanged = useCallback(() => {
    setUser(current =>
      current ? { ...current, mustChangePassword: false } : current
    );
  }, []);

  const persistAuthSession = (
    response: LoginResponse,
    overrideIsDeveloper?: boolean,
    rememberMe = true
  ) => {
    const isDeveloperSession =
      overrideIsDeveloper ??
      response.isDeveloper ??
      response.user?.isDeveloper ??
      false;

    Cookies.set("auth_token", response.token, {
      expires: rememberMe ? 7 : undefined,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const userData: User = {
      ...response.user,
      isDeveloper: isDeveloperSession,
    };

    setUser(userData);
    setIsDeveloper(isDeveloperSession);

    return userData;
  };

  const login = async (credentials: LoginRequest) => {
    try {
      clearError();
      // Deliberately does not touch `isLoading`: no session exists yet, and
      // flipping it would blank the sign-in form mid-flow.
      const result = await authService.login(credentials);

      // An account whose only method is its password is signed in by /login
      // itself, with no second step to wait for. Store that session here so
      // the caller does not have to know which of the two answers it got.
      if (isSignedIn(result)) {
        persistAuthSession(result, undefined, false);
      }
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
      return persistAuthSession(response, undefined, false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Unable to verify the sign-in code");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const developerLogin = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      clearError();

      const response = await authService.developerLogin(credentials);
      return persistAuthSession(response, true);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Developer login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: SignupRequest) => {
    try {
      setIsLoading(true);
      clearError();

      const response = await authService.signup(userData);

      persistAuthSession(response, false);
      router.push("/");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Signup failed");
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
      Cookies.remove("auth_token");
      setUser(null);
      setIsDeveloper(false);
      window.location.href = "/login";
    }
  };

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get("auth_token");

      if (!token) {
        setIsLoading(false);
        setIsDeveloper(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        const sessionIsDeveloper = !!currentUser.isDeveloper;
        setUser({
          ...currentUser,
          isDeveloper: sessionIsDeveloper,
        });
        setIsDeveloper(sessionIsDeveloper);
      } catch {
        // Token is invalid, clear it
        Cookies.remove("auth_token");
        setUser(null);
        setIsDeveloper(false);
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
    developerLogin,
    signup,
    logout,
    error,
    clearError,
    isDeveloper,
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

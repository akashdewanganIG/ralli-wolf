import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import Cookies from "js-cookie";
import { config } from "../config";
import { ApiError } from "./types";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: 60000, // Increased to 60 seconds to allow backend retries to complete
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get("auth_token");
    // console.log('🔑 API Request:', {
    //   url: config.url,
    //   method: config.method,
    //   hasToken: !!token,
    //   tokenLength: token?.length || 0
    // });
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData - let axios handle it with boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  error => {
    const status = error?.response?.status;
    const code = error?.code;
    const url = error?.config?.url;

    // Ignore axios cancellation errors (navigation/unmount)
    if (code === "ERR_CANCELED") {
      return Promise.reject({
        message: "Request canceled",
        status: 0,
      } as ApiError);
    }

    // Only log unexpected errors. Suppress noisy logs for expected errors
    const isExpected404 = status === 404;
    const isExpected401 = status === 401; // Expected when not logged in
    if (!isExpected404 && !isExpected401) {
      // Log the raw error and a safe summary to ensure visibility in all environments
      try {
        console.error("Raw API Client Error:", error);
      } catch {
        console.error("Failed to log raw API error");
      }

      // Create safe summary with guaranteed non-undefined values
      const safeSummary = {
        message: error?.message || "No message",
        status: status ?? null,
        statusText: error?.response?.statusText || "No statusText",
        url: url || "No url",
        method: error?.config?.method || "No method",
        isNetworkError: !error?.response,
        isAxiosError: !!error?.isAxiosError,
        code: code || "No code",
        errorType: error?.constructor?.name || "Unknown",
      };

      // Log both as object (for console inspection) and as JSON string (for guaranteed visibility)
      console.error("API Client Error (summary):", safeSummary);
      try {
        const jsonSummary = JSON.stringify(safeSummary, null, 2);
        console.error("API Client Error (summary JSON):", jsonSummary);
      } catch {
        // If JSON.stringify fails, log a fallback
        console.error("API Client Error (summary - fallback):", {
          message: String(safeSummary.message),
          status:
            safeSummary.status !== null ? String(safeSummary.status) : "null",
          statusText: String(safeSummary.statusText),
          url: String(safeSummary.url),
          method: String(safeSummary.method),
          isNetworkError: String(safeSummary.isNetworkError),
          isAxiosError: String(safeSummary.isAxiosError),
          code: String(safeSummary.code),
          errorType: String(safeSummary.errorType),
        });
      }

      if (error?.response?.data) {
        try {
          console.error(
            "API Client Error (response.data):",
            JSON.stringify(error.response.data, null, 2)
          );
        } catch {
          console.error(
            "API Client Error (response.data):",
            error.response.data
          );
        }
      }
    }

    if (status === 401 && url !== "/api/auth/login") {
      // Only redirect if we're not already on the login page
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        console.warn("🔐 Authentication required - redirecting to login");
        // Clear token and redirect to login
        Cookies.remove("auth_token");
        window.location.href = "/login";
      }
    }

    // Transform error to our ApiError format
    const serverMsg =
      error?.response?.data?.error || error?.response?.data?.message;
    const apiError: ApiError = {
      message: serverMsg || error.message || "An error occurred",
      status: status || 500,
      code: error.response?.data?.code,
    };

    return Promise.reject(apiError);
  }
);

export default apiClient;

import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { config } from "../config";
import { notifyServiceAsleep } from "./service-asleep-notice";
import { ApiError } from "./types";
import { announceExpiredSession } from "../auth-events";

/**
 * A hibernating host answers with 429 at its edge, before the request ever
 * reaches the API, so retrying is safe for any method — nothing was executed.
 * Riding the cold start out here means callers never see a "service is waking"
 * state at all: the request simply takes longer and then succeeds.
 */
const HOSTING_WAKE_RETRY_BUDGET_MS = 60_000;
const HOSTING_WAKE_RETRY_DELAY_MS = 2_500;

type RetryableConfig = InternalAxiosRequestConfig & {
  hostingWakeRetryUntil?: number;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiUrl,
  timeout: 60000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: unknown) => {
    const axiosError = axios.isAxiosError(error) ? error : null;
    const status = axiosError?.response?.status ?? 0;
    const transportCode = axiosError?.code;
    const url = axiosError?.config?.url;
    const renderRouting = String(
      axiosError?.response?.headers?.["x-render-routing"] || ""
    );
    const isHostingServiceWaking =
      status === 429 && renderRouting.includes("hibernate-rate-limited");
    const responseData =
      typeof axiosError?.response?.data === "object" &&
      axiosError.response.data !== null &&
      !Array.isArray(axiosError.response.data)
        ? (axiosError.response.data as Record<string, unknown>)
        : null;

    if (axios.isCancel(error) || transportCode === "ERR_CANCELED") {
      return Promise.reject({
        message: "Request canceled",
        status: 0,
        code: "ERR_CANCELED",
      } as ApiError);
    }

    const retryConfig = axiosError?.config as RetryableConfig | undefined;
    const isAuthBootstrap = url === "/api/auth/me";
    if (isHostingServiceWaking && retryConfig && !isAuthBootstrap) {
      retryConfig.hostingWakeRetryUntil ??=
        Date.now() + HOSTING_WAKE_RETRY_BUDGET_MS;
      if (Date.now() < retryConfig.hostingWakeRetryUntil) {
        await new Promise(resolve =>
          setTimeout(resolve, HOSTING_WAKE_RETRY_DELAY_MS)
        );
        if (!retryConfig.signal?.aborted) return apiClient(retryConfig);
      }
    }

    // Reached only once the request is genuinely not going to succeed: either
    // the wake retry is spent, or this was the auth bootstrap that skips it. A
    // gateway status means the proxy could not reach the API at all, which for
    // a hosted API that sleeps is the same situation from the user's side.
    const isGatewayFailure = status === 502 || status === 503 || status === 504;
    if (isHostingServiceWaking || isGatewayFailure) {
      notifyServiceAsleep();
    }

    const isExpected404 = status === 404;
    const isExpected401 = status === 401;
    if (
      process.env.NODE_ENV !== "production" &&
      !isExpected404 &&
      !isExpected401
    ) {
      console.error("API request failed", {
        message:
          axiosError?.message ||
          (error instanceof Error ? error.message : "No message"),
        status: status || null,
        url: typeof url === "string" ? url.split(/[?#]/, 1)[0] : "No url",
        method: axiosError?.config?.method || "No method",
        code: transportCode || "No code",
      });
    }

    const requestAuthorization = String(
      axiosError?.config?.headers?.get("Authorization") || ""
    );
    const isStaffRequest = !requestAuthorization;
    const isCredentialOperation =
      typeof url === "string" &&
      url.startsWith("/api/auth/") &&
      url !== "/api/auth/me";
    if (
      status === 401 &&
      isStaffRequest &&
      !isCredentialOperation &&
      !isAuthBootstrap
    ) {
      if (typeof window !== "undefined") {
        const publicSessionPaths = [
          "/login",
          "/forgot-password",
          "/reset-password",
          "/subdealer",
          "/aakraman",
        ];
        const isPublicSessionPage = publicSessionPaths.some(path =>
          window.location.pathname.startsWith(path)
        );
        if (!isPublicSessionPage) {
          announceExpiredSession();
        }
      }
    }

    const serverMessage = [responseData?.error, responseData?.message].find(
      value => typeof value === "string" && value.trim()
    );
    const attemptsRemaining = responseData?.attemptsRemaining;
    const serverCode =
      typeof responseData?.code === "string" ? responseData.code : undefined;
    const apiError: ApiError = {
      message:
        (isHostingServiceWaking
          ? "The hosted service is starting. Please try again shortly."
          : typeof serverMessage === "string"
            ? serverMessage
            : null) ||
        axiosError?.message ||
        (error instanceof Error ? error.message : "An error occurred"),
      status,
      code: isHostingServiceWaking
        ? "HOSTING_SERVICE_WAKING"
        : (serverCode ?? transportCode),
      ...(typeof attemptsRemaining === "number" &&
      Number.isSafeInteger(attemptsRemaining)
        ? { attemptsRemaining }
        : {}),
    };

    return Promise.reject(apiError);
  }
);

export default apiClient;

import { ApiError } from "./types";

export interface ErrorDisplay {
  title: string;
  message: string;
  type: "error" | "warning" | "info";
}

function recordValue(error: unknown): Record<string, unknown> | null {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : null;
}

function apiErrorValue(error: unknown): ApiError | null {
  const record = recordValue(error);
  if (!record) return null;
  const message =
    typeof record.message === "string" && record.message.trim()
      ? record.message
      : null;
  const status =
    typeof record.status === "number" && Number.isInteger(record.status)
      ? record.status
      : 0;
  const code = typeof record.code === "string" ? record.code : undefined;
  if (!message && status === 0 && !code) return null;
  return {
    message: message ?? "An unexpected error occurred.",
    status,
    code,
  };
}

export function parseApiError(error: unknown): ErrorDisplay {
  const record = recordValue(error);
  const transportCode =
    typeof record?.code === "string" ? record.code.toUpperCase() : "";
  if (
    record?.name === "NetworkError" ||
    transportCode === "ERR_NETWORK" ||
    transportCode === "ECONNREFUSED"
  ) {
    return {
      title: "Network Error",
      message:
        "Unable to connect to the server. Please check your internet connection.",
      type: "error",
    };
  }
  if (["ECONNABORTED", "ETIMEDOUT"].includes(transportCode)) {
    return {
      title: "Request Timeout",
      message: "The request took too long to complete. Please try again.",
      type: "warning",
    };
  }

  const apiError = apiErrorValue(error);
  if (apiError) {
    switch (apiError.code) {
      case "P2002":
        return {
          title: "Duplicate Entry",
          message: "A record with this information already exists.",
          type: "error",
        };
      case "P2025":
        return {
          title: "Record Not Found",
          message: "The requested record could not be found.",
          type: "error",
        };
      case "P2003":
        return {
          title: "Foreign Key Constraint",
          message:
            "This record is referenced by other records and cannot be deleted.",
          type: "error",
        };
      default:
        break;
    }

    switch (apiError.status) {
      case 400:
        return {
          title: "Bad Request",
          message: apiError.message || "The request was invalid.",
          type: "error",
        };
      case 401:
        return {
          title: "Unauthorized",
          message: "You are not authorized to perform this action.",
          type: "error",
        };
      case 403:
        return {
          title: "Forbidden",
          message: "You do not have permission to access this resource.",
          type: "error",
        };
      case 404:
        return {
          title: "Not Found",
          message: "The requested resource was not found.",
          type: "error",
        };
      case 409:
        return {
          title: "Conflict",
          message:
            "There is a conflict with the current state of the resource.",
          type: "error",
        };
      case 422:
        return {
          title: "Validation Error",
          message: apiError.message || "The provided data is invalid.",
          type: "error",
        };
      case 429:
        return {
          title: "Too Many Requests",
          message: "You have made too many requests. Please try again later.",
          type: "warning",
        };
      case 500:
        return {
          title: "Server Error",
          message: "An internal server error occurred. Please try again later.",
          type: "error",
        };
      case 503:
        return {
          title: "Service Unavailable",
          message:
            "The service is temporarily unavailable. Please try again later.",
          type: "warning",
        };
      default:
        return {
          title: "Error",
          message: apiError.message || "An unexpected error occurred.",
          type: "error",
        };
    }
  }

  return {
    title: "Unknown Error",
    message: "An unexpected error occurred. Please try again.",
    type: "error",
  };
}

export function getErrorMessage(error: unknown): string {
  const errorDisplay = parseApiError(error);
  return errorDisplay.message;
}

export function getErrorTitle(error: unknown): string {
  const errorDisplay = parseApiError(error);
  return errorDisplay.title;
}

export function isNetworkError(error: unknown): boolean {
  const record = recordValue(error);
  const code = typeof record?.code === "string" ? record.code : "";
  return record?.name === "NetworkError" || code === "ERR_NETWORK";
}

export function isTimeoutError(error: unknown): boolean {
  const record = recordValue(error);
  const code = typeof record?.code === "string" ? record.code : "";
  return code === "ECONNABORTED" || code === "ETIMEDOUT";
}

export function isValidationError(error: unknown): boolean {
  return apiErrorValue(error)?.status === 422;
}

export function isAuthError(error: unknown): boolean {
  const status = apiErrorValue(error)?.status;
  return status === 401 || status === 403;
}

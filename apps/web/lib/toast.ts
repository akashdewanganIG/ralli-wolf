"use client";

import { toast as sonner } from "sonner";
import { parseApiError } from "./api/errorHandler";

type ToastOptions = {
  description?: string;
  duration?: number;
};

export const toast = {
  success(title: string, options: ToastOptions = {}) {
    return sonner.success(title, options);
  },
  error(
    error: unknown,
    fallbackTitleOrOptions: string | ToastOptions = "Something went wrong",
    options: ToastOptions = {}
  ) {
    if (typeof error === "string") {
      return sonner.error(
        error,
        typeof fallbackTitleOrOptions === "object"
          ? fallbackTitleOrOptions
          : options
      );
    }
    const parsed = parseApiError(error);
    const fallbackTitle =
      typeof fallbackTitleOrOptions === "string"
        ? fallbackTitleOrOptions
        : "Something went wrong";
    const toastOptions =
      typeof fallbackTitleOrOptions === "object"
        ? fallbackTitleOrOptions
        : options;
    const title = parsed?.title || fallbackTitle;
    const description = parsed?.message;
    return sonner.error(title, { description, ...toastOptions });
  },
  info(title: string, options: ToastOptions = {}) {
    return sonner.info(title, options);
  },
  warning(title: string, options: ToastOptions = {}) {
    return sonner.warning(title, options);
  },
  loading(title: string, options: ToastOptions = {}) {
    return sonner.loading(title, options);
  },
  dismiss(id?: string | number) {
    return sonner.dismiss(id);
  },
  /**
   * Wrap a promise with loading/success/error toasts.
   * Backward compatible with previous signature.
   *
   * Examples:
   *  - toast.promise(apiCall(), { loading: 'Loading', success: 'Done', error: 'Failed' }, { duration: 5000 })
   *  - toast.promise(apiCall(), { loading: 'Loading', success: (res) => `Done: ${res.count}`, error: 'Failed' }, { duration: 5000 })
   */
  promise<T>(
    promise: Promise<T>,
    messages:
      | {
          loading: string;
          success: string | ((value: T) => string);
          error: string | ((error: unknown) => string);
        }
      | ((value: T) => { success?: string } | string),
    options: ToastOptions = {}
  ) {
    // If messages is a function, we assume success text will be resolved dynamically
    if (typeof messages === "function") {
      return sonner.promise(promise, {
        loading: "Loading...",
        success: (val: T) => {
          const res = messages(val);
          return typeof res === "string" ? res : res.success || "Success";
        },
        error: "Something went wrong",
        ...options,
      });
    }
    return sonner.promise(promise, { ...messages, ...options });
  },
};

export async function withActionToast<T>(
  action: Promise<T> | (() => Promise<T>),
  messages:
    | {
        loading: string;
        success: string | ((value: T) => string);
        error: string | ((error: unknown) => string);
      }
    | ((value: T) => { success?: string } | string),
  options: ToastOptions = {}
) {
  const run =
    typeof action === "function"
      ? (action as () => Promise<T>)
      : () => action as Promise<T>;
  return toast.promise(run(), messages, options);
}

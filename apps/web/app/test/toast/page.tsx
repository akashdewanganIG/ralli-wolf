"use client";

import React from "react";
import { toast, withActionToast } from "@/lib/toast";

export default function ToastTestPage() {
  const handleSuccess = () => {
    console.log("[toast-test] success click");
    toast.success("Success toast visible");
  };

  const handleError = () => {
    console.log("[toast-test] error click");
    const err = { message: "Explicit error for testing", status: 400 };
    toast.error(err);
  };

  const handleInfo = () => {
    console.log("[toast-test] info click");
    toast.info("Informational toast displayed");
  };

  const handleWarning = () => {
    console.log("[toast-test] warning click");
    toast.warning("Warning toast displayed");
  };

  const handlePromise = async () => {
    console.log("[toast-test] promise click");
    await withActionToast(new Promise(resolve => setTimeout(resolve, 1200)), {
      loading: "Working...",
      success: "Done!",
      error: "Failed",
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Toast Visibility Test
      </h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleSuccess}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          Success
        </button>
        <button
          type="button"
          onClick={handleError}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          Error
        </button>
        <button
          type="button"
          onClick={handleInfo}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          Info
        </button>
        <button
          type="button"
          onClick={handleWarning}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          Warning
        </button>
        <button
          type="button"
          onClick={handlePromise}
          style={{
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          Promise
        </button>
      </div>
      <p style={{ marginTop: 12 }}>
        Navigate to this page at <code>/test/toast</code> and click the buttons.
      </p>
    </div>
  );
}

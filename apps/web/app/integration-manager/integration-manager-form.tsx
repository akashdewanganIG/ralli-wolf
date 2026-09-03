"use client";

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/api/client";
import { Button, Input, Label } from "@repo/ui";

type Provider = "whatsapp" | "email";

type Meta = {
  exists: boolean;
  masked: string | null;
  updatedAt: string | null;
};

export function IntegrationManagerForm() {
  const [meta, setMeta] = useState<{ whatsapp: Meta; email: Meta } | null>(
    null
  );
  const [values, setValues] = useState<{ whatsapp: string; email: string }>({
    whatsapp: "",
    email: "",
  });
  const [config, setConfig] = useState<{
    email: { baseUrl: string; webhookSecretMasked: string | null };
    whatsapp: { baseUrl: string };
  }>({
    email: { baseUrl: "", webhookSecretMasked: null },
    whatsapp: { baseUrl: "" },
  });
  const [configDraft, setConfigDraft] = useState<{
    emailBaseUrl: string;
    emailWebhookSecret: string;
    whatsappBaseUrl: string;
  }>({ emailBaseUrl: "", emailWebhookSecret: "", whatsappBaseUrl: "" });
  const [saving, setSaving] = useState<{ [K in Provider]?: boolean }>({});
  const [savingConfig, setSavingConfig] = useState<{
    email?: boolean;
    whatsapp?: boolean;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get("/api/integrations/credentials"),
      apiClient.get("/api/integrations/config"),
    ])
      .then(([credRes, cfgRes]) => {
        if (!mounted) return;
        setMeta(credRes.data);
        const cfg = cfgRes.data as any;
        const emailBaseUrl = cfg?.email?.baseUrl?.value || "";
        const emailWebhookSecretMasked =
          cfg?.email?.webhookSecret?.masked || null;
        const whatsappBaseUrl = cfg?.whatsapp?.baseUrl?.value || "";
        setConfig({
          email: {
            baseUrl: emailBaseUrl,
            webhookSecretMasked: emailWebhookSecretMasked,
          },
          whatsapp: { baseUrl: whatsappBaseUrl },
        });
        setConfigDraft({
          emailBaseUrl,
          emailWebhookSecret: "",
          whatsappBaseUrl,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setMeta({
          whatsapp: { exists: false, masked: null, updatedAt: null },
          email: { exists: false, masked: null, updatedAt: null },
        });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const onSave = async (provider: Provider) => {
    setError(null);
    setSuccess(null);
    const value = values[provider]?.trim();
    if (!value || value.length < 8) {
      setError("Please enter a valid key (min 8 chars).");
      return;
    }
    setSaving(s => ({ ...s, [provider]: true }));
    try {
      await apiClient.put("/api/integrations/credentials", {
        provider,
        apiKey: value,
      });
      setSuccess(
        `${provider === "whatsapp" ? "WhatsApp" : "Email"} key saved.`
      );

      const res = await apiClient.get("/api/integrations/credentials");
      setMeta(res.data);
      setValues(v => ({ ...v, [provider]: "" }));
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(s => ({ ...s, [provider]: false }));
    }
  };

  const saveEmailConfig = async () => {
    setError(null);
    setSuccess(null);
    setSavingConfig(s => ({ ...s, email: true }));
    try {
      await apiClient.put("/api/integrations/config", {
        email: {
          baseUrl: configDraft.emailBaseUrl,
          webhookSecret: configDraft.emailWebhookSecret || undefined,
        },
      });
      const res = await apiClient.get("/api/integrations/config");
      const cfg = res.data as any;
      setConfig({
        email: {
          baseUrl: cfg?.email?.baseUrl?.value || "",
          webhookSecretMasked: cfg?.email?.webhookSecret?.masked || null,
        },
        whatsapp: config.whatsapp,
      });
      setConfigDraft(d => ({ ...d, emailWebhookSecret: "" }));
      setSuccess("Email config saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save email config");
    } finally {
      setSavingConfig(s => ({ ...s, email: false }));
    }
  };

  const saveWhatsappConfig = async () => {
    setError(null);
    setSuccess(null);
    setSavingConfig(s => ({ ...s, whatsapp: true }));
    try {
      await apiClient.put("/api/integrations/config", {
        whatsapp: {
          baseUrl: configDraft.whatsappBaseUrl,
        },
      });
      const res = await apiClient.get("/api/integrations/config");
      const cfg = res.data as any;
      setConfig({
        email: config.email,
        whatsapp: {
          baseUrl: cfg?.whatsapp?.baseUrl?.value || "",
        },
      });
      setSuccess("WhatsApp config saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save WhatsApp config");
    } finally {
      setSavingConfig(s => ({ ...s, whatsapp: false }));
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-destructive text-sm">{error}</div>}
      {success && (
        <div className="text-success-foreground text-sm">{success}</div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-2">WhatsApp (MSG91)</h2>
        <div className="space-y-2">
          <Label htmlFor="whatsappKey">API Key</Label>
          <Input
            id="whatsappKey"
            type="password"
            placeholder="Enter WhatsApp API key"
            value={values.whatsapp}
            onChange={e => setValues(v => ({ ...v, whatsapp: e.target.value }))}
          />
          <div className="text-xs text-muted-foreground">
            {meta?.whatsapp?.exists
              ? `Stored: ${meta.whatsapp.masked ?? "••••••"}`
              : "Not set"}
          </div>
          <Button
            onClick={() => onSave("whatsapp")}
            disabled={!!saving.whatsapp}
          >
            {saving.whatsapp ? "Saving..." : "Save WhatsApp Key"}
          </Button>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-medium mb-2">WhatsApp Configuration</h2>
        <div className="space-y-2">
          <Label htmlFor="waBaseUrl">MSG91 Base URL</Label>
          <Input
            id="waBaseUrl"
            type="text"
            placeholder="https://api.msg91.com/api/v5"
            value={configDraft.whatsappBaseUrl}
            onChange={e =>
              setConfigDraft(v => ({ ...v, whatsappBaseUrl: e.target.value }))
            }
          />
          <div className="text-xs text-muted-foreground">
            Current: {config.whatsapp.baseUrl || "Not set"}
          </div>
          <Button
            onClick={saveWhatsappConfig}
            disabled={!!savingConfig.whatsapp}
          >
            {savingConfig.whatsapp ? "Saving..." : "Save WhatsApp Base URL"}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Email (Brevo)</h2>
        <div className="space-y-2">
          <Label htmlFor="emailKey">API Key</Label>
          <Input
            id="emailKey"
            type="password"
            placeholder="Enter Email API key"
            value={values.email}
            onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
          />
          <div className="text-xs text-muted-foreground">
            {meta?.email?.exists
              ? `Stored: ${meta.email.masked ?? "••••••"}`
              : "Not set"}
          </div>
          <Button onClick={() => onSave("email")} disabled={!!saving.email}>
            {saving.email ? "Saving..." : "Save Email Key"}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Email Configuration</h2>
        <div className="space-y-2">
          <Label htmlFor="emailBaseUrl">Base URL</Label>
          <Input
            id="emailBaseUrl"
            type="text"
            placeholder="https://api.brevo.com/v3"
            value={configDraft.emailBaseUrl}
            onChange={e =>
              setConfigDraft(v => ({ ...v, emailBaseUrl: e.target.value }))
            }
          />
          <Label htmlFor="emailWebhookSecret">Webhook Secret</Label>
          <Input
            id="emailWebhookSecret"
            type="password"
            placeholder={
              config.email.webhookSecretMasked
                ? `Stored: ${config.email.webhookSecretMasked}`
                : "Enter secret"
            }
            value={configDraft.emailWebhookSecret}
            onChange={e =>
              setConfigDraft(v => ({
                ...v,
                emailWebhookSecret: e.target.value,
              }))
            }
          />
          <Button onClick={saveEmailConfig} disabled={!!savingConfig.email}>
            {savingConfig.email ? "Saving..." : "Save Email Config"}
          </Button>
        </div>
      </section>
    </div>
  );
}

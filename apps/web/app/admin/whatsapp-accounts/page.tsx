"use client";
import { useEffect, useState } from "react";
import { whatsappService } from "../../../lib/api/services";
import { MessagingAccount } from "../../../lib/api/types";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export default function WhatsappAccountsAdminPage() {
  const [accounts, setAccounts] = useState<MessagingAccount[]>([]);
  const [form, setForm] = useState({
    displayName: "",
    sourceHandle: "",
    apiKey: "",
    appName: "",
  });

  const load = async () => setAccounts(await whatsappService.listAccounts());
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const payload = {
      displayName: form.displayName,
      sourceHandle: form.sourceHandle,
      apiKey: form.apiKey,
      appName: form.appName,
    };
    await whatsappService.createAccount(payload);
    setForm({ displayName: "", sourceHandle: "", apiKey: "", appName: "" });
    await load();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>WhatsApp Accounts</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 520, marginBottom: 16 }}>
        <Input
          placeholder="Display Name"
          value={form.displayName}
          onChange={e => setForm({ ...form, displayName: e.target.value })}
        />
        <Input
          placeholder="Source Phone (E.164)"
          value={form.sourceHandle}
          onChange={e => setForm({ ...form, sourceHandle: e.target.value })}
        />
        <Input
          placeholder="API Key"
          value={form.apiKey}
          onChange={e => setForm({ ...form, apiKey: e.target.value })}
        />
        <Input
          placeholder="App Name"
          value={form.appName}
          onChange={e => setForm({ ...form, appName: e.target.value })}
        />
        <Button
          type="button"
          disabled={
            !form.displayName ||
            !form.sourceHandle ||
            !form.apiKey ||
            !form.appName
          }
          onClick={create}
        >
          Add Account
        </Button>
      </div>
      <table
        cellPadding={6}
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">Name</th>
            <th align="left">Source</th>
            <th align="left">Provider</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.displayName}</td>
              <td>{a.sourceHandle}</td>
              <td>{a.provider}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

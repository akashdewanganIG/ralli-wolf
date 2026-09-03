import apiClient from "./client";

export type TransferEntityInfo = {
  key: string;
  label: string;
  group: string;
  columns: string[];
  exportable: boolean;
  importable: boolean;
  requiredColumns: string[];
};

export type ImportOutcome = {
  entity: string;
  label: string;
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
};

export type ExportFormat = "xlsx" | "csv";

export const dataTransferService = {
  catalogue: async (): Promise<{ data: TransferEntityInfo[] }> =>
    (await apiClient.get("/api/data/catalogue")).data,

  exportEntity: async (
    entity: string,
    params: {
      format: ExportFormat;
      startPage?: number;
      endPage?: number;
      limit?: number;
    }
  ): Promise<Blob> =>
    (
      await apiClient.get(`/api/data/${entity}/export`, {
        params,
        responseType: "blob",
      })
    ).data as Blob,

  template: async (entity: string): Promise<Blob> =>
    (
      await apiClient.get(`/api/data/${entity}/template`, {
        responseType: "blob",
      })
    ).data as Blob,

  importEntity: async (
    entity: string,
    file: File
  ): Promise<{ data: ImportOutcome }> => {
    const form = new FormData();
    form.append("file", file);
    return (
      await apiClient.post(`/api/data/${entity}/import`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
};

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

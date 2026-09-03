export interface GstDetails {
  legalName: string;
  tradeName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  panNumber?: string;
  registrationDate?: string;
  businessType?: string;
  status?: string;
  jurisdiction?: string;
}

export class GstServiceUnavailableError extends Error {
  constructor(message = "GST verification service is unavailable") {
    super(message);
    this.name = "GstServiceUnavailableError";
  }
}

export class GstRecordNotFoundError extends Error {
  constructor(message = "GST registration could not be verified") {
    super(message);
    this.name = "GstRecordNotFoundError";
  }
}

interface GstApiResponse {
  flag?: boolean;
  message?: string;
  data?: {
    gstin?: string;
    lgnm?: string;
    tradeNam?: string;
    stj?: string;
    dty?: string;
    cxdt?: string;
    gstinStatus?: string;
    rgdt?: string;
    ctb?: string;
    sts?: string;
    pradr?: {
      adr?: string;
      addr?: {
        addr?: string;
        loc?: string;
        bno?: string;
        st?: string;
        bnm?: string;
        dst?: string;
        stcd?: string;
        pncd?: string;
        lg?: string;
        flno?: string;
        lt?: string;
        city?: string;
      };
    };
    errorMsg?: string | null;
  };
  error?: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function optionalProviderText(
  record: JsonRecord | null,
  key: string
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseGstProviderResponse(value: unknown): GstApiResponse {
  const root = asRecord(value);
  if (!root) {
    throw new GstServiceUnavailableError(
      "GST verification provider returned an invalid response"
    );
  }
  if (root.flag !== undefined && typeof root.flag !== "boolean") {
    throw new GstServiceUnavailableError(
      "GST verification provider returned an invalid response"
    );
  }

  const rawData = asRecord(root.data);
  if (root.data !== undefined && root.data !== null && !rawData) {
    throw new GstServiceUnavailableError(
      "GST verification provider returned an invalid response"
    );
  }
  const rawPrimaryAddress = asRecord(rawData?.pradr);
  if (
    rawData?.pradr !== undefined &&
    rawData.pradr !== null &&
    !rawPrimaryAddress
  ) {
    throw new GstServiceUnavailableError(
      "GST verification provider returned an invalid response"
    );
  }
  const rawAddress = asRecord(rawPrimaryAddress?.addr);
  if (
    rawPrimaryAddress?.addr !== undefined &&
    rawPrimaryAddress.addr !== null &&
    !rawAddress
  ) {
    throw new GstServiceUnavailableError(
      "GST verification provider returned an invalid response"
    );
  }
  const data = rawData
    ? {
        gstin: optionalProviderText(rawData, "gstin"),
        lgnm: optionalProviderText(rawData, "lgnm"),
        tradeNam: optionalProviderText(rawData, "tradeNam"),
        stj: optionalProviderText(rawData, "stj"),
        dty: optionalProviderText(rawData, "dty"),
        cxdt: optionalProviderText(rawData, "cxdt"),
        gstinStatus: optionalProviderText(rawData, "gstinStatus"),
        rgdt: optionalProviderText(rawData, "rgdt"),
        ctb: optionalProviderText(rawData, "ctb"),
        sts: optionalProviderText(rawData, "sts"),
        errorMsg: optionalProviderText(rawData, "errorMsg") ?? null,
        pradr: rawPrimaryAddress
          ? {
              adr: optionalProviderText(rawPrimaryAddress, "adr"),
              addr: rawAddress
                ? {
                    addr: optionalProviderText(rawAddress, "addr"),
                    loc: optionalProviderText(rawAddress, "loc"),
                    bno: optionalProviderText(rawAddress, "bno"),
                    st: optionalProviderText(rawAddress, "st"),
                    bnm: optionalProviderText(rawAddress, "bnm"),
                    dst: optionalProviderText(rawAddress, "dst"),
                    stcd: optionalProviderText(rawAddress, "stcd"),
                    pncd: optionalProviderText(rawAddress, "pncd"),
                    lg: optionalProviderText(rawAddress, "lg"),
                    flno: optionalProviderText(rawAddress, "flno"),
                    lt: optionalProviderText(rawAddress, "lt"),
                    city: optionalProviderText(rawAddress, "city"),
                  }
                : undefined,
            }
          : undefined,
      }
    : undefined;

  return {
    flag: typeof root.flag === "boolean" ? root.flag : undefined,
    message: optionalProviderText(root, "message"),
    error: optionalProviderText(root, "error"),
    data,
  };
}

export class GstService {
  private apiBaseUrl = "https://sheet.gstincheck.co.in/check";

  private getApiKey(): string | null {
    return process.env.GST_API_KEY || null;
  }

  async fetchGstDetails(gstNumber: string): Promise<GstDetails> {
    const normalized = gstNumber.trim().toUpperCase();

    if (!/^[0-9A-Z]{15}$/.test(normalized)) {
      throw new Error("Invalid GST number format");
    }

    const apiKey = this.getApiKey();

    if (!apiKey?.trim()) {
      throw new GstServiceUnavailableError(
        "GST verification is not configured"
      );
    }
    return this.fetchFromRealApi(normalized, apiKey.trim());
  }

  private async fetchFromRealApi(
    gstNumber: string,
    apiKey: string
  ): Promise<GstDetails> {
    const url = `${this.apiBaseUrl}/${encodeURIComponent(apiKey)}/${encodeURIComponent(gstNumber)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let response: Response;
      try {
        response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
          redirect: "error",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > 1_000_000) {
        throw new GstServiceUnavailableError(
          "GST verification provider returned an oversized response"
        );
      }

      const responseText = await response.text();
      if (responseText.length > 1_000_000) {
        throw new GstServiceUnavailableError(
          "GST verification provider returned an oversized response"
        );
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new GstRecordNotFoundError();
        }
        if (response.status === 401 || response.status === 403) {
          throw new GstServiceUnavailableError(
            "GST verification provider rejected its configured credentials"
          );
        }
        throw new GstServiceUnavailableError(
          `GST verification provider returned status ${response.status}`
        );
      }

      let data: GstApiResponse;
      try {
        if (!responseText || responseText.trim() === "") {
          throw new Error("Empty response from GST API");
        }
        data = parseGstProviderResponse(JSON.parse(responseText) as unknown);
      } catch {
        throw new GstServiceUnavailableError(
          "GST verification provider returned an invalid response"
        );
      }

      if (data.error || (data.data && data.data.errorMsg)) {
        throw new GstRecordNotFoundError();
      }

      if (data.flag === false || !data.data) {
        throw new GstRecordNotFoundError();
      }

      const gstData = data.data;

      if (!gstData.gstin || !gstData.lgnm) {
        throw new GstServiceUnavailableError(
          "GST verification provider omitted required registration fields"
        );
      }
      if (gstData.gstin && gstData.gstin.trim().toUpperCase() !== gstNumber) {
        throw new GstServiceUnavailableError(
          "GST verification provider returned a mismatched registration"
        );
      }

      const address = gstData.pradr?.addr || null;
      const fullAddressString = gstData.pradr?.adr || null;

      let fullAddress = fullAddressString;
      if (!fullAddress && address) {
        const addressParts = [
          address?.flno,
          address?.bno,
          address?.bnm,
          address?.st,
          address?.lg,
          address?.loc,
        ].filter(Boolean);
        fullAddress =
          addressParts.length > 0
            ? addressParts.join(", ")
            : address?.addr || null;
      }

      const stateName = address?.stcd || undefined;

      const registrationDate = gstData.rgdt
        ? this.parseProviderDate(gstData.rgdt)
        : null;

      return {
        legalName: gstData.lgnm,
        tradeName: gstData.tradeNam || undefined,
        address: fullAddress ? fullAddress : undefined,
        city: address?.loc || address?.dst || address?.city || undefined,
        state: stateName || undefined,
        pincode: address?.pncd || undefined,
        panNumber: gstNumber.substring(2, 12),
        registrationDate: registrationDate ? registrationDate : undefined,
        businessType: gstData.ctb || undefined,
        status:
          gstData.sts ||
          gstData.gstinStatus ||
          (gstData.cxdt ? "Cancelled" : undefined),
        jurisdiction: gstData.stj || undefined,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new GstServiceUnavailableError("GST verification timed out");
      }
      if (
        error instanceof Error &&
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        throw new GstServiceUnavailableError();
      }
      throw error;
    }
  }

  private parseProviderDate(dateStr: string): string | null {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr.trim());
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date.toISOString();
  }
}

export const gstService = new GstService();

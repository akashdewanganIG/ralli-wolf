import { assertProviderUrl } from "../utils/provider-url.js";

export class Msg91Service {
  private readonly baseUrl = "https://control.msg91.com/api/v5";

  private credentials(): { authKey: string; templateId: string } {
    const authKey = process.env.MSG91_AUTH_KEY?.trim();
    const templateId = process.env.MSG91_OTP_TEMPLATE_ID?.trim();
    if (!authKey || !templateId) {
      throw new Error("MSG91 OTP credentials are not configured");
    }
    return { authKey, templateId };
  }

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    try {
      const { authKey, templateId } = this.credentials();

      const cleanPhone = phone.replace(/\D/g, "");

      const finalPhone =
        cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const url = new URL(`${this.baseUrl}/otp`);
      url.searchParams.append("template_id", templateId);
      url.searchParams.append("mobile", finalPhone);
      url.searchParams.append("realTimeResponse", "1");
      url.searchParams.append("otp_length", "6");
      url.searchParams.append("otp_expiry", "10");
      assertProviderUrl(url.toString(), "msg91");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: "POST",
          body: otp ? JSON.stringify({ otp }) : undefined,
          headers: {
            authkey: authKey,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          redirect: "error",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json();
      return response.ok && data.type === "success";
    } catch {
      return false;
    }
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    try {
      const { authKey } = this.credentials();

      const cleanPhone = phone.replace(/\D/g, "");
      const finalPhone =
        cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const url = new URL(`${this.baseUrl}/otp/verify`);
      url.searchParams.append("otp", otp);
      url.searchParams.append("mobile", finalPhone);
      assertProviderUrl(url.toString(), "msg91");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: "GET",
          headers: { authkey: authKey },
          signal: controller.signal,
          redirect: "error",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json();
      return response.ok && data.type === "success";
    } catch {
      return false;
    }
  }
}

export const msg91Service = new Msg91Service();

export class Msg91Service {
  private authKey: string;
  private templateId: string;
  private baseUrl: string = "https://control.msg91.com/api/v5";

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || "";
    this.templateId = process.env.MSG91_OTP_TEMPLATE_ID || "";

    if (!this.authKey || !this.templateId) {
      console.warn(
        "MSG91_AUTH_KEY or MSG91_OTP_TEMPLATE_ID not set in environment variables."
      );
    }
  }

  /**
   * Send OTP via MSG91
   * @param phone Phone number with country code (e.g., 919876543210)
   * @returns Promise<boolean>
   */
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    try {
      // Ensure phone has no special chars
      const cleanPhone = phone.replace(/\D/g, "");
      // Ensure it starts with country code if missing (assuming 91 for India if 10 digits)
      const finalPhone =
        cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const url = new URL(`${this.baseUrl}/otp`);
      url.searchParams.append("template_id", this.templateId);
      url.searchParams.append("mobile", finalPhone);
      url.searchParams.append("authkey", this.authKey);
      url.searchParams.append("realTimeResponse", "1");
      url.searchParams.append("otp_length", "6");
      url.searchParams.append("otp_expiry", "60"); // 60 minutes? User url said 60. Usually minutes.

      const response = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          otp: otp,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.type === "success") {
        return true;
      } else {
        console.error("MSG91 Send OTP Failed:", data);
        return false;
      }
    } catch (error) {
      console.error("Error sending OTP via MSG91:", error);
      return false;
    }
  }

  /**
   * Verify OTP via MSG91
   * @param phone Phone number with country code
   * @param otp OTP to verify
   * @returns Promise<boolean>
   */
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    try {
      // Ensure phone has no special chars
      const cleanPhone = phone.replace(/\D/g, "");
      const finalPhone =
        cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const url = new URL(`${this.baseUrl}/otp/verify`);
      url.searchParams.append("otp", otp);
      url.searchParams.append("mobile", finalPhone);
      url.searchParams.append("authkey", this.authKey);

      const response = await fetch(url.toString(), {
        method: "GET", // The user provided URL implies GET or POST? Usually verify is GET or POST. Documentation says GET often for verify. The user link was just a URL, likely GET.
      });

      const data = await response.json();

      if (response.ok && data.type === "success") {
        return true;
      } else {
        console.error("MSG91 Verify OTP Failed:", data);
        return false;
      }
    } catch (error) {
      console.error("Error verifying OTP via MSG91:", error);
      return false;
    }
  }
}

export const msg91Service = new Msg91Service();

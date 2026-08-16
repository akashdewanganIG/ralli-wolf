/**
 * SMS Service using Fast2SMS API
 * Handles sending OTP messages via SMS
 */

import { prisma } from "@repo/db";
import * as nodeCrypto from "node:crypto";

function deriveKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "";
  const raw = key.startsWith("base64:")
    ? Buffer.from(key.slice(7), "base64")
    : key.startsWith("hex:")
      ? Buffer.from(key.slice(4), "hex")
      : Buffer.from(key, "utf8");
  return raw.length === 32
    ? raw
    : nodeCrypto.createHash("sha256").update(raw).digest();
}

function decryptGCM(cipherText: string, iv: string, authTag: string): string {
  const key = deriveKey();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(authTag, "base64");
  const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export class SmsService {
  private baseUrl: string = "https://www.fast2sms.com/dev/bulkV2";

  /**
   * Get Fast2SMS API key from database or environment
   */
  private async getApiKey(): Promise<string> {
    // Try to get from database (integration credentials)
    try {
      const row = await prisma.integrationCredential.findUnique({
        where: { provider: "sms" },
      });
      if (row?.encryptedApiKey && row.iv && row.authTag) {
        return decryptGCM(row.encryptedApiKey, row.iv, row.authTag);
      }
    } catch (error) {
      console.warn("Could not fetch SMS API key from database:", error);
    }

    // Fallback to environment variable
    const envKey = process.env.FAST2SMS_API_KEY;
    if (envKey) {
      return envKey;
    }

    throw new Error(
      "Fast2SMS API key not configured. Set FAST2SMS_API_KEY or configure in Integration Manager."
    );
  }

  /**
   * Send OTP via SMS using Fast2SMS
   * Uses Fast2SMS API format: https://www.fast2sms.com/dev/bulkV2
   * @param phone - Phone number in any format (will be normalized to 10 digits)
   * @param otp - 6-digit OTP code
   * @returns true if sent successfully, false otherwise
   */
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    // Normalize phone number to 10-digit format
    const normalizedPhone = this.normalizePhoneNumber(phone);

    // In development mode, if API key is not configured, just log the OTP
    if (process.env.NODE_ENV === "development") {
      try {
        await this.getApiKey();
      } catch (_error: any) {
        // API key not configured - this is fine in dev mode
        console.log(
          `[DEV MODE] SMS API not configured. OTP for ${normalizedPhone}: ${otp}`
        );
        return true; // Return true to allow testing without SMS service
      }
    }

    try {
      // Get API key and trim any whitespace
      const apiKey = (await this.getApiKey()).trim();

      // Prepare request data (Fast2SMS API format)
      // Note: If you get error 996 (website verification required), you can:
      // 1. Complete website verification in Fast2SMS dashboard, OR
      // 2. Change route from 'otp' to 'dlt' to use DLT SMS API
      const requestBody = {
        route: "otp",
        variables_values: otp,
        numbers: normalizedPhone,
      };

      // Debug logging (remove in production)
      if (process.env.NODE_ENV === "development") {
        console.log("[Fast2SMS Debug] API Key length:", apiKey.length);
        console.log(
          "[Fast2SMS Debug] Request body:",
          JSON.stringify(requestBody)
        );
        console.log("[Fast2SMS Debug] URL:", this.baseUrl);
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      // Send SMS using Fast2SMS API
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let responseData: any;
      try {
        const responseText = await response.text();
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("Failed to parse SMS API response:", parseError);
        responseData = {};
      }

      // Check response (Fast2SMS typically returns return: true for success)
      if (
        response.ok &&
        (responseData.return === true || responseData.status === "success")
      ) {
        console.log(`SMS sent successfully to ${normalizedPhone}`);
        return true;
      }

      // Handle specific Fast2SMS error codes
      if (responseData.status_code === 996) {
        console.error(
          "Fast2SMS API error: Website verification required. Complete website verification in Fast2SMS dashboard or use DLT SMS API route."
        );
        console.error("Error details:", responseData);
      } else {
        console.error("Fast2SMS API error:", responseData);
      }

      // In development, still return true even if API call fails
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[DEV MODE] SMS API call failed. OTP for ${normalizedPhone}: ${otp}`
        );
        return true;
      }

      return false;
    } catch (error: any) {
      // Handle fetch errors
      if (error.name === "AbortError") {
        console.error("Fast2SMS API request timed out");
      } else {
        console.error("Error sending SMS via Fast2SMS:", error.message);
      }

      // In development, log the OTP instead of failing
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[DEV MODE] SMS error occurred. OTP for ${normalizedPhone}: ${otp}`
        );
        return true; // Return true in dev mode to allow testing without SMS service
      }

      return false;
    }
  }

  /**
   * Normalize phone number to 10-digit format
   * Extracts 10 digits from input (removes country code, +, spaces, etc.)
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");

    // If it's 10 digits, return as is
    if (digits.length === 10) {
      return digits;
    }

    // If it's 12 digits and starts with 91 (Indian country code), extract last 10 digits
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }

    // If it's 11 digits and starts with 0, remove the leading 0
    if (digits.length === 11 && digits.startsWith("0")) {
      return digits.slice(1);
    }

    // If it's more than 10 digits, try to extract last 10 digits
    if (digits.length > 10) {
      return digits.slice(-10);
    }

    // If it's less than 10 digits, return as is (will likely fail API validation)
    return digits;
  }
}

export const smsService = new SmsService();

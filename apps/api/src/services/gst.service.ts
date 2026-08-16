/**
 * GST Service - Real API integration with GSTIN Check
 * API Endpoint: https://sheet.gstincheck.co.in/check/{api-key}/{gstin-number}
 * Falls back to mock data if API key is not configured or API fails
 */

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

interface GstApiResponse {
  flag?: boolean;
  message?: string;
  data?: {
    gstin?: string;
    lgnm?: string; // Legal name
    tradeNam?: string; // Trade name
    stj?: string; // State jurisdiction
    dty?: string; // Deity (Regular)
    cxdt?: string; // Cancellation date
    gstinStatus?: string;
    rgdt?: string; // Registration date
    ctb?: string; // Constitution of business
    sts?: string; // Status
    pradr?: {
      adr?: string; // Full address string
      addr?: {
        addr?: string;
        loc?: string; // Location/city
        bno?: string; // Building number
        st?: string; // Street
        bnm?: string; // Building name
        dst?: string; // District
        stcd?: string; // State code
        pncd?: string; // Pincode
        lg?: string; // Locality
        flno?: string; // Floor number
        lt?: string; // Locality type
        city?: string;
      };
    };
    adadr?: Array<any>; // Additional addresses
    nba?: string[]; // Nature of business activities
    errorMsg?: string | null;
  };
  error?: string;
  [key: string]: any; // Allow other fields
}

export class GstService {
  private apiBaseUrl = "https://sheet.gstincheck.co.in/check";

  /**
   * Get GST API key from environment
   * Tries multiple common variable names
   */
  private getApiKey(): string | null {
    return (
      process.env.GST_API_KEY ||
      process.env.GSTIN_CHECK_API_KEY ||
      process.env.GSTINCHECK_API_KEY ||
      null
    );
  }

  /**
   * Fetch GST details by GST number
   * Uses real API if configured, falls back to mock data
   */
  async fetchGstDetails(gstNumber: string): Promise<GstDetails> {
    // Normalize GST number
    const normalized = gstNumber.trim().toUpperCase();

    // Validate GST number format
    if (!/^[0-9A-Z]{15}$/.test(normalized)) {
      throw new Error("Invalid GST number format");
    }

    const apiKey = this.getApiKey();

    // If API key is configured, use real API
    if (apiKey) {
      try {
        return await this.fetchFromRealApi(normalized, apiKey);
      } catch (error: any) {
        console.error("GST API Error:", error.message);
        // Always fall back to mock data if API fails (even in production for now)
        // This ensures the registration flow can continue even if the API is down
        console.warn(
          `Falling back to mock GST data due to API error: ${error.message}`
        );
        return this.getMockData(normalized);
      }
    }

    // No API key configured, use mock data
    if (process.env.NODE_ENV === "development") {
      console.log("GST API key not configured, using mock data");
    }
    return this.getMockData(normalized);
  }

  /**
   * Fetch GST details from real API
   */
  private async fetchFromRealApi(
    gstNumber: string,
    apiKey: string
  ): Promise<GstDetails> {
    const url = `${this.apiBaseUrl}/${apiKey}/${gstNumber}`;

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Read response body once
      const responseText = await response.text();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("GST number not found");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("Invalid GST API key or unauthorized access");
        }
        throw new Error(
          `GST API error: ${response.status} - ${responseText || response.statusText}`
        );
      }

      // Parse JSON response
      let data: GstApiResponse;
      try {
        if (!responseText || responseText.trim() === "") {
          throw new Error("Empty response from GST API");
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse GST API response:", parseError);
        console.error("Response text:", responseText);
        throw new Error("Invalid JSON response from GST API");
      }

      // Handle case where API returns error in response body
      if (data.error || (data.data && data.data.errorMsg)) {
        throw new Error(
          data.error || data.data?.errorMsg || "Error from GST API"
        );
      }

      // Check if API indicates success
      if (data.flag === false || !data.data) {
        console.warn(
          "GST API returned no valid data for:",
          gstNumber,
          "Response:",
          JSON.stringify(data)
        );
        throw new Error(
          data.message || "GST number not found or no data available"
        );
      }

      // Extract the actual data from nested structure
      const gstData = data.data;

      // Check if we have valid data
      if (!gstData || (!gstData.gstin && !gstData.lgnm && !gstData.tradeNam)) {
        console.warn(
          "GST API returned no valid data for:",
          gstNumber,
          "Response:",
          JSON.stringify(data)
        );
        throw new Error("GST number not found or no data available");
      }

      // Extract address details (API uses pradr.addr structure)
      const address = gstData.pradr?.addr || null;
      const fullAddressString = gstData.pradr?.adr || null;

      // Build address string from components or use the full address string provided
      let fullAddress = fullAddressString;
      if (!fullAddress && address) {
        const addressParts = [
          address?.flno, // Floor number
          address?.bno, // Building number
          address?.bnm, // Building name
          address?.st, // Street
          address?.lg, // Locality
          address?.loc, // Location
        ].filter(Boolean);
        fullAddress =
          addressParts.length > 0
            ? addressParts.join(", ")
            : address?.addr || null;
      }

      // Extract state code (first 2 digits of GST number or from address)
      // Note: stcd in this API format is the state name, not code
      const stateCode = gstNumber.substring(0, 2);
      const stateName =
        address?.stcd || this.getStateNameFromCode(stateCode) || undefined;

      // Parse registration date (format: DD/MM/YYYY)
      let registrationDate: string | null = null;
      if (gstData.rgdt) {
        const dateParts = gstData.rgdt.split("/");
        if (dateParts.length === 3) {
          // Convert DD/MM/YYYY to ISO format
          registrationDate = new Date(
            `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
          ).toISOString();
        }
      }

      // Map API response to GstDetails interface
      return {
        legalName: gstData.lgnm || gstData.tradeNam || "N/A",
        tradeName: gstData.tradeNam || undefined,
        address: fullAddress ? fullAddress : undefined,
        city: address?.loc || address?.dst || address?.city || undefined,
        state: stateName || undefined,
        pincode: address?.pncd || undefined,
        panNumber: gstNumber.substring(2, 12), // PAN is embedded in GST number (chars 3-12)
        registrationDate: registrationDate ? registrationDate : undefined,
        businessType: gstData.ctb || undefined,
        status:
          gstData.sts || (gstData.cxdt ? "Cancelled" : "Active") || undefined,
        jurisdiction: gstData.stj || undefined,
      };
    } catch (error: any) {
      // Handle fetch errors
      if (error.name === "AbortError") {
        throw new Error("GST API request timed out");
      }
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error(
          "Failed to connect to GST API. Please check your internet connection."
        );
      }
      throw error;
    }
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    try {
      // Try parsing different date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    } catch {
      return null;
    }
  }

  /**
   * Get mock data (fallback when API is not configured or fails)
   */
  private getMockData(gstNumber: string): GstDetails {
    const stateCode = gstNumber.substring(0, 2);
    const panNumber = gstNumber.substring(2, 12);

    return {
      legalName: `Sample Business ${gstNumber.slice(-4)}`,
      tradeName: `Trade Name ${gstNumber.slice(-4)}`,
      address: `123 Business Street, Commercial Area`,
      city: this.getCityFromStateCode(stateCode),
      state: this.getStateFromStateCode(stateCode),
      pincode: "110001",
      panNumber: panNumber,
      registrationDate: new Date("2020-01-15").toISOString(),
      businessType: "Private Limited Company",
      status: "Active",
      jurisdiction: `${this.getStateFromStateCode(stateCode)} - Ward 1`,
    };
  }

  /**
   * Get state name from state code
   */
  private getStateNameFromCode(stateCode: string): string {
    return this.getStateFromStateCode(stateCode);
  }

  /**
   * Get city name from state code (mock mapping)
   */
  private getCityFromStateCode(stateCode: string): string {
    const cityMap: Record<string, string> = {
      "07": "Delhi",
      "09": "Haryana",
      "10": "Himachal Pradesh",
      "27": "Maharashtra",
      "29": "Karnataka",
      "33": "Tamil Nadu",
    };
    return cityMap[stateCode] || "Mumbai";
  }

  /**
   * Get state name from state code (mock mapping)
   */
  private getStateFromStateCode(stateCode: string): string {
    const stateMap: Record<string, string> = {
      "07": "Delhi",
      "09": "Haryana",
      "10": "Himachal Pradesh",
      "27": "Maharashtra",
      "29": "Karnataka",
      "33": "Tamil Nadu",
    };
    return stateMap[stateCode] || "Maharashtra";
  }
}

export const gstService = new GstService();

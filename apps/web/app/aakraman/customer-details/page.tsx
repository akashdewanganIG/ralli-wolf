"use client";

import logov3 from "@/app/assets/images/logos/logo_v1.png";
import { aakramanService } from "@/lib/api/services";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Loader2, Search, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

// Zod schema for customer details validation
const customerDetailsSchema = z.object({
  firmName: z.string().min(1, "Firm name is required"),
  ownerFirstName: z.string().min(1, "First name is required"),
  ownerLastName: z.string().min(1, "Last name is required"),
  contactNumber: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10 digit mobile number"),
  email: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter a valid 6 digit pincode")
    .optional()
    .or(z.literal("")),
  gst: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Enter a valid GST number (e.g., 29ABCDE1234F1Z5)"
    )
    .optional()
    .or(z.literal("")),
});

type CustomerDetailsFormData = z.infer<typeof customerDetailsSchema>;

// Indian states list
const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
  "Chandigarh",
];

const CUSTOMER_DETAILS_KEY = "aakraman_customer_details";

export default function CustomerDetailsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [stateSearchQuery, setStateSearchQuery] = useState("");
  const [formData, setFormData] = useState<CustomerDetailsFormData>({
    firmName: "",
    ownerFirstName: "",
    ownerLastName: "",
    contactNumber: "",
    email: "",
    city: "",
    state: "",
    pincode: "",
    gst: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CustomerDetailsFormData, string>>
  >({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<keyof CustomerDetailsFormData, boolean>>
  >({});

  // Check authentication
  useEffect(() => {
    if (!aakramanService.isAuthenticated()) {
      router.push("/aakraman");
      return;
    }

    // Load existing customer details if any
    const savedDetails = localStorage.getItem(CUSTOMER_DETAILS_KEY);
    if (savedDetails) {
      try {
        setFormData(JSON.parse(savedDetails));
      } catch (e) {
        console.error("Failed to parse saved customer details:", e);
      }
    }
  }, [router]);

  const validateField = (
    field: keyof CustomerDetailsFormData,
    value: string
  ) => {
    try {
      customerDetailsSchema.shape[field].parse(value);
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setFieldErrors(prev => ({
          ...prev,
          [field]: err.issues[0]?.message || "Invalid value",
        }));
      }
      return false;
    }
  };

  const handleBlur = (field: keyof CustomerDetailsFormData) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field] as string);
  };

  const handleInputChange = (
    field: keyof CustomerDetailsFormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touchedFields[field]) {
      validateField(field, value);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);

    // Mark all fields as touched
    const allFields = Object.keys(
      formData
    ) as (keyof CustomerDetailsFormData)[];
    setTouchedFields(
      allFields.reduce(
        (acc, field) => {
          acc[field] = true;
          return acc;
        },
        {} as Partial<Record<keyof CustomerDetailsFormData, boolean>>
      )
    );

    // Validate all fields
    try {
      customerDetailsSchema.parse(formData);

      // Save customer details to localStorage
      localStorage.setItem(CUSTOMER_DETAILS_KEY, JSON.stringify(formData));

      // Redirect to order booking page
      router.push("/aakraman/book-a-order");
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Partial<Record<keyof CustomerDetailsFormData, string>> =
          {};
        err.issues.forEach(issue => {
          if (issue.path[0]) {
            errors[issue.path[0] as keyof CustomerDetailsFormData] =
              issue.message;
          }
        });
        setFieldErrors(errors);
        setError("Please fill all required fields correctly");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-indigo-400 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-12 md:h-14 flex items-center justify-center">
                <Image
                  src={logov3}
                  alt="Aakraman Logo"
                  width={200}
                  height={75}
                  className="object-contain h-full w-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-6 h-6 text-yellow-500" />
              <CardTitle className="text-2xl">Customer Details</CardTitle>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Please fill in the customer details before proceeding to order
              booking
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="firmName">Firm Name *</Label>
                <Input
                  id="firmName"
                  value={formData.firmName}
                  onChange={e => handleInputChange("firmName", e.target.value)}
                  onBlur={() => handleBlur("firmName")}
                  placeholder="Enter firm name"
                  className="mt-1"
                />
                {touchedFields.firmName && fieldErrors.firmName && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.firmName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="ownerFirstName">Owner First Name *</Label>
                <Input
                  id="ownerFirstName"
                  value={formData.ownerFirstName}
                  onChange={e =>
                    handleInputChange("ownerFirstName", e.target.value)
                  }
                  onBlur={() => handleBlur("ownerFirstName")}
                  placeholder="First name"
                  className="mt-1"
                />
                {touchedFields.ownerFirstName && fieldErrors.ownerFirstName && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.ownerFirstName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="ownerLastName">Owner Last Name *</Label>
                <Input
                  id="ownerLastName"
                  value={formData.ownerLastName}
                  onChange={e =>
                    handleInputChange("ownerLastName", e.target.value)
                  }
                  onBlur={() => handleBlur("ownerLastName")}
                  placeholder="Last name"
                  className="mt-1"
                />
                {touchedFields.ownerLastName && fieldErrors.ownerLastName && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.ownerLastName}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="contactNumber">Contact Number *</Label>
                <Input
                  id="contactNumber"
                  value={formData.contactNumber}
                  onChange={e =>
                    handleInputChange(
                      "contactNumber",
                      e.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  onBlur={() => handleBlur("contactNumber")}
                  placeholder="10-digit number"
                  maxLength={10}
                  className="mt-1"
                />
                {touchedFields.contactNumber && fieldErrors.contactNumber && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.contactNumber}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => handleInputChange("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                  placeholder="email@example.com"
                  className="mt-1"
                />
                {touchedFields.email && fieldErrors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={e => handleInputChange("city", e.target.value)}
                  onBlur={() => handleBlur("city")}
                  placeholder="Enter city"
                  className="mt-1"
                />
                {touchedFields.city && fieldErrors.city && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.city}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="state">State *</Label>
                <Select
                  value={formData.state}
                  onValueChange={value => {
                    handleInputChange("state", value);
                    if (touchedFields.state) {
                      validateField("state", value);
                    }
                  }}
                  onOpenChange={open => {
                    if (!open) {
                      setStateSearchQuery("");
                      handleBlur("state");
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <div
                      className="p-2 border-b sticky top-0 bg-popover z-10"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search states..."
                          value={stateSearchQuery}
                          onChange={e => setStateSearchQuery(e.target.value)}
                          className="pl-8"
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (
                              e.key !== "Escape" &&
                              e.key !== "Enter" &&
                              e.key !== "Tab"
                            ) {
                              e.nativeEvent.stopImmediatePropagation();
                            }
                          }}
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          onFocus={e => {
                            e.stopPropagation();
                            e.currentTarget.focus();
                          }}
                          autoFocus={false}
                        />
                      </div>
                    </div>
                    {INDIAN_STATES.filter(state =>
                      state
                        .toLowerCase()
                        .includes(stateSearchQuery.toLowerCase())
                    ).map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touchedFields.state && fieldErrors.state && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.state}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="pincode">Pincode (Optional)</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={e =>
                    handleInputChange(
                      "pincode",
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  onBlur={() => handleBlur("pincode")}
                  placeholder="6-digit pincode"
                  maxLength={6}
                  className="mt-1"
                />
                {touchedFields.pincode && fieldErrors.pincode && (
                  <p className="text-xs text-red-500 mt-1">
                    {fieldErrors.pincode}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="gst">GST Number (Optional)</Label>
                <Input
                  id="gst"
                  value={formData.gst}
                  onChange={e =>
                    handleInputChange("gst", e.target.value.toUpperCase())
                  }
                  onBlur={() => handleBlur("gst")}
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                  className="mt-1"
                />
                {touchedFields.gst && fieldErrors.gst && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.gst}</p>
                )}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-indigo-400 hover:bg-indigo-500 text-black font-semibold mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue to Order Booking"
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

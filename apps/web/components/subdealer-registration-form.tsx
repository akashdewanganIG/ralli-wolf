"use client";

import { subdealerService } from "@/lib/api/services";
import { GstDetails } from "@/lib/api/types";
import { toast } from "@/lib/toast";
import {
  emailSchema,
  gstSchema,
  otpSchema,
  phoneSchema,
} from "@/lib/validation/subdealer";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  Shield,
} from "@repo/ui/icons";
import { useMemo, useState } from "react";

type Step = 1 | 2 | 3 | 4 | 5;

export function SubdealerRegistrationForm() {
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [gstDetails, setGstDetails] = useState<GstDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [existingUserData, setExistingUserData] = useState<any>(null);

  // Validation
  const phoneValidation = useMemo(() => {
    if (!phone) return { isValid: true, error: undefined };
    const result = phoneSchema.safeParse(phone);
    if (result.success) {
      return { isValid: true, error: undefined };
    }
    // Safely extract error message - ZodError has 'issues' property
    const errorMessage =
      result.error?.issues?.[0]?.message ||
      result.error?.message ||
      "Invalid phone number";
    return {
      isValid: false,
      error: errorMessage,
    };
  }, [phone]);

  const gstValidation = useMemo(() => {
    if (!gstNumber) return { isValid: true, error: undefined };
    const result = gstSchema.safeParse(gstNumber);
    if (result.success) {
      return { isValid: true, error: undefined };
    }
    // Safely extract error message - ZodError has 'issues' property
    const errorMessage =
      result.error?.issues?.[0]?.message ||
      result.error?.message ||
      "Invalid GST number";
    return {
      isValid: false,
      error: errorMessage,
    };
  }, [gstNumber]);

  const otpValidation = useMemo(() => {
    if (!otp) return { isValid: true, error: undefined };
    const result = otpSchema.safeParse(otp);
    if (result.success) {
      return { isValid: true, error: undefined };
    }
    // Safely extract error message - ZodError has 'issues' property
    const errorMessage =
      result.error?.issues?.[0]?.message ||
      result.error?.message ||
      "Invalid OTP";
    return {
      isValid: false,
      error: errorMessage,
    };
  }, [otp]);

  const emailValidation = useMemo(() => {
    if (!email) return { isValid: true, error: undefined }; // Optional field
    const result = emailSchema.safeParse(email);
    if (result.success) {
      return { isValid: true, error: undefined };
    }
    // Safely extract error message - ZodError has 'issues' property
    const errorMessage =
      result.error?.issues?.[0]?.message ||
      result.error?.message ||
      "Invalid email";
    return {
      isValid: false,
      error: errorMessage,
    };
  }, [email]);

  // Handle phone input - check if user exists
  const handlePhoneChange = async (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const previousLength = phone.length;
    const newPhone = digitsOnly.slice(0, 10);
    setPhone(newPhone);
    setError(null);

    // Show validation toast when user completes entering 10 digits
    if (newPhone.length === 10 && previousLength !== 10) {
      const result = phoneSchema.safeParse(newPhone);
      if (result.success) {
        toast.success("Phone number validated successfully");

        // Check if phone exists in database
        setLoading(true);
        try {
          const response = await subdealerService.checkPhone(newPhone);

          if (response.exists && response.data) {
            // Existing user - skip GST step
            setIsExistingUser(true);
            setExistingUserData(response.data);
            setGstDetails({
              legalName: response.data.legalName,
              gstNumber: response.data.gstNumber,
              tradeName: response.data.tradeName,
              address: response.data.address,
              city: response.data.city,
              state: response.data.state,
              pincode: response.data.pincode,
              panNumber: response.data.panNumber,
              businessType: response.data.businessType,
              status: response.data.status,
            } as GstDetails);
            toast.info(`Welcome back, ${response.data.legalName}!`);
            // Auto-advance to step 3 (skip GST)
            setTimeout(() => setStep(3), 100);
          } else {
            // New user - show GST step
            setIsExistingUser(false);
            setExistingUserData(null);
            // Auto-advance to step 2 (GST input)
            setTimeout(() => setStep(2), 100);
          }
        } catch (err: any) {
          console.error("Error checking phone:", err);
          // On error, assume new user and show GST step
          setIsExistingUser(false);
          toast.error(
            "Could not verify phone number. Please continue with registration."
          );
          setTimeout(() => setStep(2), 100);
        } finally {
          setLoading(false);
        }
      } else {
        const errorMessage =
          result.error?.issues?.[0]?.message ||
          "Phone number must be 10 digits and start with 6-9";
        toast.error(errorMessage);
      }
    }
  };
  // Handle GST input
  const handleGstChange = (value: string) => {
    const upperValue = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
    setGstNumber(upperValue.slice(0, 15));
    setError(null);
  };

  // Fetch GST details
  const handleFetchGst = async () => {
    if (!gstValidation.isValid) return;

    setLoading(true);
    setError(null);

    try {
      const response = await subdealerService.fetchGstDetails(gstNumber);
      if (response.success && response.data) {
        setGstDetails({ ...response.data, gstNumber });
        setStep(3);
        toast.success("GST details fetched successfully");
      } else {
        setError("Failed to fetch GST details");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch GST details";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Generate OTP
  const handleGenerateOtp = async () => {
    if (!phoneValidation.isValid) return;

    setLoading(true);
    setError(null);

    try {
      const response = await subdealerService.generateOtp(phone);
      if (response.success) {
        setStep(4);
        toast.success("OTP sent to your phone number");
      } else {
        setError("Failed to generate OTP");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to generate OTP";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and register
  // Verify OTP and register/login
  const handleVerifyOtp = async () => {
    if (!otpValidation.isValid) return;
    if (email && !emailValidation.isValid) return;

    setLoading(true);
    setError(null);

    try {
      if (isExistingUser) {
        // Login existing user
        const response = await subdealerService.login({ phone, otp });

        if (response.success && response.token) {
          localStorage.setItem("subdealer_token", response.token);
          setSuccess(true);
          setStep(5);
          toast.success("Login successful!");
        } else {
          setError("Login failed");
        }
      } else {
        // Register new user
        if (!gstDetails) return;

        const gstDetailsWithEmail = {
          ...gstDetails,
          email: email.trim() || undefined,
        };

        const response = await subdealerService.verifyOtpAndRegister({
          phone,
          otp,
          gstDetails: gstDetailsWithEmail,
        });

        if (response.success) {
          if ((response as any).token) {
            localStorage.setItem("subdealer_token", (response as any).token);
          }
          setSuccess(true);
          setStep(5);
          toast.success("Registration successful!");
        } else {
          setError("Verification failed");
        }
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || "Verification failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (step === 5 && success) {
    return (
      <PostVerificationFlow
        gstDetails={gstDetails}
        phone={phone}
        subdealerId={
          existingUserData?.id ||
          (localStorage.getItem("subdealer_token")
            ? JSON.parse(
                atob(
                  localStorage.getItem("subdealer_token")!.split(".")[1] || ""
                )
              ).id
            : null)
        }
      />
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Subdealer Registration
          </CardTitle>
          <CardDescription>
            Complete your registration by providing your phone number and GST
            details
          </CardDescription>
          <div className="flex gap-2 mt-2">
            <Badge
              variant={step >= 1 ? "default" : "outline"}
              className="flex items-center gap-1"
            >
              <Phone className="h-3 w-3" />
              Phone
            </Badge>
            <Badge
              variant={step >= 2 ? "default" : "outline"}
              className="flex items-center gap-1"
            >
              <Building2 className="h-3 w-3" />
              GST
            </Badge>
            <Badge
              variant={step >= 3 ? "default" : "outline"}
              className="flex items-center gap-1"
            >
              <Shield className="h-3 w-3" />
              Verify
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <FieldGroup className="space-y-4">
            {/* Step 1: Phone Number */}
            <Field>
              <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter 10-digit phone number"
                value={phone}
                onChange={e => handlePhoneChange(e.target.value)}
                maxLength={10}
                disabled={step > 1 || loading}
                aria-invalid={
                  phone && !phoneValidation.isValid ? true : undefined
                }
                size="lg"
              />
              {phone && !phoneValidation.isValid && (
                <FieldError>{phoneValidation.error}</FieldError>
              )}
              {step === 1 && phoneValidation.isValid && phone.length === 10 && (
                <FieldDescription className="text-success-foreground">
                  ✓ Valid phone number
                </FieldDescription>
              )}
            </Field>

            {/* Step 2: GST Number (shown when phone is valid) */}
            {!isExistingUser && step >= 2 && (
              <Field>
                <FieldLabel htmlFor="gst">GST Number</FieldLabel>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      id="gst"
                      type="text"
                      placeholder="Enter 15-character GST number"
                      value={gstNumber}
                      onChange={e => handleGstChange(e.target.value)}
                      maxLength={15}
                      disabled={step > 2 || loading}
                      size="lg"
                      className="uppercase"
                      aria-invalid={
                        gstNumber && !gstValidation.isValid ? true : undefined
                      }
                    />
                    {gstNumber && !gstValidation.isValid && (
                      <FieldError>{gstValidation.error}</FieldError>
                    )}
                  </div>
                  <div className="flex items-start sm:items-end">
                    <Button
                      onClick={handleFetchGst}
                      disabled={!gstValidation.isValid || loading || step > 2}
                      className="whitespace-nowrap w-full sm:w-auto"
                    >
                      {loading && step === 2 ? (
                        <>Fetching...</>
                      ) : (
                        "Fetch GST Details"
                      )}
                    </Button>
                  </div>
                </div>
              </Field>
            )}

            {/* Step 3: Prefilled GST Details + Generate OTP */}
            {step >= 3 && gstDetails && (
              <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    GST Details
                  </h3>
                  {gstDetails.status && (
                    <Badge
                      variant={
                        gstDetails.status === "Active" ? "default" : "secondary"
                      }
                    >
                      {gstDetails.status}
                    </Badge>
                  )}
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field className="md:col-span-2">
                    <FieldLabel>Legal Name</FieldLabel>
                    <Input
                      value={gstDetails.legalName || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel>Trade Name</FieldLabel>
                    <Input
                      value={gstDetails.tradeName || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel>Address</FieldLabel>
                    <Textarea
                      value={gstDetails.address || ""}
                      readOnly
                      size="lg"
                      className="min-h-[3.75rem] min-w-0 resize-none"
                      rows={4}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>City</FieldLabel>
                    <Input
                      value={gstDetails.city || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>State</FieldLabel>
                    <Input
                      value={gstDetails.state || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Pincode</FieldLabel>
                    <Input
                      value={gstDetails.pincode || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>PAN Number</FieldLabel>
                    <Input
                      value={gstDetails.panNumber || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Business Type</FieldLabel>
                    <Input
                      value={gstDetails.businessType || ""}
                      readOnly
                      size="lg"
                      className="min-w-0"
                    />
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel
                      htmlFor="email"
                      className="flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Email Address{" "}
                      <span className="text-muted-foreground font-normal">
                        (Optional)
                      </span>
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address (optional)"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      disabled={loading || step > 3}
                      size="lg"
                      className="min-w-0"
                      aria-invalid={
                        email && !emailValidation.isValid ? true : undefined
                      }
                    />
                    {email && !emailValidation.isValid && (
                      <FieldError>{emailValidation.error}</FieldError>
                    )}
                    {email && emailValidation.isValid && (
                      <FieldDescription className="text-success-foreground">
                        ✓ Valid email address
                      </FieldDescription>
                    )}
                    {!email && (
                      <FieldDescription>
                        Optional: Add your email address for notifications and
                        communication
                      </FieldDescription>
                    )}
                  </Field>
                </div>
                {step === 3 && (
                  <Button
                    onClick={handleGenerateOtp}
                    disabled={
                      loading || (email ? !emailValidation.isValid : false)
                    }
                    className="w-full"
                  >
                    {loading ? <>Generating OTP...</> : "Generate OTP"}
                  </Button>
                )}
              </div>
            )}

            {/* Step 4: OTP Verification */}
            {step >= 4 && (
              <Field>
                <FieldLabel htmlFor="otp">Enter OTP</FieldLabel>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={e => {
                    const digitsOnly = e.target.value.replace(/\D/g, "");
                    setOtp(digitsOnly.slice(0, 6));
                    setError(null);
                  }}
                  maxLength={6}
                  disabled={step > 4 || loading}
                  aria-invalid={
                    otp && !otpValidation.isValid ? true : undefined
                  }
                  size="lg"
                />
                {otp && !otpValidation.isValid && (
                  <FieldError>{otpValidation.error}</FieldError>
                )}
                <FieldDescription>
                  OTP has been sent to {phone}
                </FieldDescription>
                {step === 4 && (
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={
                      !otpValidation.isValid ||
                      loading ||
                      (email ? !emailValidation.isValid : false)
                    }
                    className="mt-4 w-full"
                  >
                    {loading ? (
                      <>Verifying...</>
                    ) : isExistingUser ? (
                      "Verify OTP & Login"
                    ) : (
                      "Verify OTP & Register"
                    )}
                  </Button>
                )}
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Post Verification Components ---

import {
  invoiceService,
  orderService,
  productService,
} from "@/lib/api/services";
import { Product } from "@/lib/api/types";
import { CheckCircle, FileUp, ShoppingCart, Trash2 } from "@repo/ui/icons";
import { SearchInput } from "@repo/ui/components/ui/search-input";
import { formatMoney } from "@/lib/utils/decimal";

function PostVerificationFlow({
  gstDetails,
  phone,
  subdealerId,
}: {
  gstDetails: GstDetails | null;
  phone: string;
  subdealerId: number | null;
}) {
  const [mode, setMode] = useState<"choice" | "upload" | "order">("choice");

  if (mode === "choice") {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-surface">
              <CheckCircle2 className="h-8 w-8 text-success-foreground" />
            </div>
            <CardTitle>Verification Successful!</CardTitle>
            <CardDescription>
              Welcome, {gstDetails?.legalName || "Subdealer"}. What would you
              like to do next?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setMode("upload")}
            >
              <FileUp className="h-8 w-8" />
              <span className="font-semibold">Upload Invoice</span>
              <span className="text-xs text-muted-foreground">
                Upload your past invoices
              </span>
            </Button>
            <Button
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setMode("order")}
            >
              <ShoppingCart className="h-8 w-8" />
              <span className="font-semibold">Book New Order</span>
              <span className="text-xs text-white/80">
                Browse catalog and place order
              </span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "upload") {
    return <InvoiceUploadView phone={phone} onBack={() => setMode("choice")} />;
  }

  if (mode === "order") {
    return (
      <OrderBookingView
        subdealerId={subdealerId}
        onBack={() => setMode("choice")}
      />
    );
  }

  return null;
}

function InvoiceUploadView({
  phone,
  onBack,
}: {
  phone: string;
  onBack: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await invoiceService.uploadInvoice(file, phone);
      toast.success("Invoice uploaded successfully!");
      setFile(null);
      // Optional: Navigate back or show success state
    } catch (err: any) {
      toast.error(err.message || "Failed to upload invoice");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Upload Invoice</CardTitle>
          <CardDescription>
            Upload your invoice file (PDF, JPG, PNG)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              id="invoice"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
          {file && (
            <div className="text-sm text-muted-foreground">
              Selected: {file.name}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} disabled={uploading}>
              Back
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1"
            >
              {uploading ? null : <FileUp className="mr-2 h-4 w-4" />}
              Upload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderBookingView({
  subdealerId,
  onBack,
}: {
  subdealerId: number | null;
  onBack: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputQuantities, setInputQuantities] = useState<
    Record<number, number>
  >({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{
    id: number;
    orderNumber: string;
    totalAmount: string | number;
  } | null>(null);

  // Fetch products on mount
  useState(() => {
    const fetchProducts = async () => {
      try {
        const res = await productService.getActiveProducts();
        if (res.success && Array.isArray(res.data)) {
          setProducts(res.data);
        }
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  });

  const handleInputChange = (productId: number, value: string) => {
    const qty = parseInt(value) || 0;
    setInputQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const addToCart = (productId: number) => {
    const qtyToAdd = inputQuantities[productId] || 1;
    if (qtyToAdd <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + qtyToAdd,
    }));
    setInputQuantities(prev => ({ ...prev, [productId]: 1 })); // Reset input to 1
    toast.success("Added to cart");
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => {
      const { [productId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmitOrder = () => {
    if (Object.keys(cart).length === 0) return;
    setShowConfirmation(true);
  };

  const confirmOrder = async () => {
    if (!subdealerId) {
      toast.error("Subdealer ID missing. Please login again.");
      return;
    }

    const lineItems = Object.entries(cart).map(([productId, quantity]) => ({
      productId: parseInt(productId),
      quantity,
    }));

    setSubmitting(true);
    try {
      const res = await orderService.createOrder({
        subdealerId,
        lineItems,
      });

      if (res.success && res.data) {
        setOrderSuccess(res.data);
        setCart({});
        setShowConfirmation(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
      setShowConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalCost = Object.entries(cart).reduce((sum, [pid, qty]) => {
    const product = products.find(p => p.id === parseInt(pid));
    return sum + (product ? Number(product.price) * qty : 0);
  }, 0);

  if (loading) {
    return <div className="flex justify-center p-8"></div>;
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 relative">
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirm Order</CardTitle>
              <CardDescription>
                Are you sure you want to place this order?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <span className="font-medium">{totalItems}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>{formatMoney(totalCost)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirmation(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={confirmOrder}
                  disabled={submitting}
                >
                  {submitting ? null : "Confirm Order"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-surface">
                <CheckCircle className="h-8 w-8 text-success-foreground" />
              </div>
              <CardTitle className="text-2xl text-success-foreground">
                Order Placed Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Order ID</p>
                <p className="text-xl font-bold font-mono">
                  {orderSuccess.orderNumber}
                </p>
                <div className="h-px bg-border my-2" />
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold">
                  {formatMoney(orderSuccess.totalAmount)}
                </p>
              </div>
              <Button className="w-full" onClick={onBack}>
                Return to Menu
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={onBack}>
          &larr; Back
        </Button>
        <h2 className="text-base sm:text-lg font-semibold">Book Order</h2>
        <div className="w-20" /> {/* Spacer */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search Bar */}
          <SearchInput
            placeholder="Search products by name or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="flex flex-col sm:flex-row overflow-hidden"
              >
                <div className="w-full sm:w-48 bg-muted flex items-center justify-center aspect-video sm:aspect-square">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="object-cover h-full w-full"
                    />
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {product.name}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {product.code}
                        </p>
                      </div>
                      <p className="font-bold text-lg">
                        {formatMoney(product.price)}
                      </p>
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Qty:</span>
                      <Input
                        type="number"
                        min="0"
                        size="sm"
                        className="w-20"
                        value={inputQuantities[product.id] || 0}
                        onChange={e =>
                          handleInputChange(product.id, e.target.value)
                        }
                      />
                    </div>
                    <Button
                      onClick={() => addToCart(product.id)}
                      className="flex-1 sm:flex-none"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to Cart
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No products found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Cart Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Your Cart
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(cart).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Your cart is empty
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {Object.entries(cart).map(([pid, qty]) => {
                    const product = products.find(p => p.id === parseInt(pid));
                    if (!product) return null;

                    return (
                      <div
                        key={pid}
                        className="flex gap-3 items-start pb-4 border-b last:border-0 last:pb-0"
                      >
                        <div className="h-16 w-16 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="object-cover h-full w-full"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-[0.625rem] text-muted-foreground">
                              No Img
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4
                            className="text-sm font-medium truncate"
                            title={product.name}
                          >
                            {product.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(product.price)} x {qty}
                          </p>

                          <div className="flex items-center justify-between mt-2">
                            {/* ---- NEW INPUT FIELD FOR QUANTITY ---- */}
                            <Input
                              type="number"
                              min={1}
                              size="sm"
                              className="w-16"
                              value={qty}
                              onChange={e => {
                                const newQty = parseInt(e.target.value, 10);
                                if (!isNaN(newQty) && newQty >= 1) {
                                  updateCartQuantity(product.id, newQty - qty); // keeps logic compatible
                                }
                              }}
                            />

                            {/* Remove button */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeFromCart(product.id)}
                              aria-label={`Remove ${product.name} from cart`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{totalItems}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatMoney(totalCost)}</span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={totalItems === 0 || submitting}
                  onClick={handleSubmitOrder}
                >
                  {submitting ? null : "Place Order"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";
import logov3 from "@/app/assets/images/logos/logo_v1.png";
import { aakramanService } from "@/lib/api/services";

const emailSchema = z.string().email("Enter a valid email address");
const otpSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6 digit OTP we just sent you");

type LoginField = "email" | "otp";

export default function AakramanLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "otp">("input");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<LoginField, string>>
  >({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<LoginField, boolean>>
  >({});

  // Check if already logged in
  useEffect(() => {
    if (aakramanService.isAuthenticated()) {
      router.push("/aakraman/customer-details");
    }
  }, [router]);

  const setFieldError = (field: LoginField, message?: string) => {
    setFieldErrors(prev => ({
      ...prev,
      [field]: message,
    }));
  };

  const validateField = (field: LoginField, value: string) => {
    const schema = field === "email" ? emailSchema : otpSchema;
    const result = schema.safeParse(value.trim());
    if (!result.success) {
      setFieldError(field, result.error.issues[0]?.message || "Invalid value");
      return false;
    }
    setFieldError(field);
    return true;
  };

  const handleBlur = (field: LoginField, value: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    validateField(field, value);
  };

  const handleSendOtp = async () => {
    setError("");
    if (!validateField("email", email)) {
      setTouchedFields(prev => ({ ...prev, email: true }));
      return;
    }

    setIsLoading(true);

    try {
      await aakramanService.sendEmailOtp(email);
      setStep("otp");
      setTouchedFields({});
      setFieldErrors({});
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to send OTP. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (!validateField("otp", otp)) {
      setTouchedFields(prev => ({ ...prev, otp: true }));
      return;
    }

    setIsLoading(true);

    try {
      const response = await aakramanService.verifyOtp({ email, otp });

      // Store token and redirect
      aakramanService.setToken(response.token);
      router.push("/aakraman/customer-details");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpStepReset = () => {
    setStep("input");
    setOtp("");
    setFieldErrors({});
    setTouchedFields({});
    setError("");
  };

  const getFieldHelper = (field: LoginField) =>
    touchedFields[field] && fieldErrors[field] ? fieldErrors[field] : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 opacity-60 mix-blend-screen bg-[radial-gradient(circle_at_top,rgba(248,250,252,0.12),transparent_45%)]" />
      <div className="absolute right-10 top-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="absolute left-16 bottom-10 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg rounded-3xl border-0 shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="relative mx-auto flex items-center justify-center overflow-hidden rounded-3xl">
              <Image
                src={logov3}
                height={200}
                width={200}
                alt="Aakraman logo"
                className="object-contain"
                priority
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold text-slate-900">
                {step === "input" ? "Sign in" : "Enter verification code"}
              </CardTitle>
              <CardDescription className="text-base">
                {step === "input"
                  ? "Enter your email address to receive a one-time code."
                  : `We sent a 6 digit OTP to your email.`}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {step === "input" ? (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-600"
                  >
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@business.com"
                    value={email}
                    onChange={e => {
                      const value = e.target.value;
                      setEmail(value);
                      if (touchedFields.email) {
                        validateField("email", value);
                      }
                    }}
                    onBlur={() => handleBlur("email", email)}
                    className="rounded-2xl border-slate-200"
                  />
                  {getFieldHelper("email") && (
                    <p className="text-xs font-medium text-red-600">
                      {getFieldHelper("email")}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSendOtp}
                  disabled={isLoading || !email || !!fieldErrors.email}
                  className="w-full rounded-2xl bg-amber-500 text-base font-semibold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:bg-amber-400 disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP
                    </>
                  ) : (
                    <>
                      Send OTP
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="otp"
                    className="text-sm font-medium text-slate-600"
                  >
                    6 digit OTP
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="••••••"
                    value={otp}
                    onChange={e => {
                      const value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setOtp(value);
                      if (touchedFields.otp) {
                        validateField("otp", value);
                      }
                    }}
                    onBlur={() => handleBlur("otp", otp)}
                    className="text-center text-2xl tracking-[0.4em]"
                  />
                  {getFieldHelper("otp") && (
                    <p className="text-xs font-medium text-red-600">
                      {getFieldHelper("otp")}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6 || !!fieldErrors.otp}
                  className="w-full rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    "Verify & continue"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleOtpStepReset}
                  className="w-full text-center text-sm font-medium text-amber-600 hover:text-amber-500"
                >
                  Change email
                </button>
              </div>
            )}

            <div className="pt-2 text-center text-sm text-slate-500">
              <a
                href="/login"
                className="font-semibold text-amber-600 hover:text-amber-500"
              >
                Back to Innovun login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

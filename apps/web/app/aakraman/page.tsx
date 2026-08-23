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
import { ArrowRight } from "@repo/ui/icons";
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
    <div className="relative min-h-screen overflow-hidden bg-foreground">
      <div className="absolute inset-0 opacity-60 mix-blend-screen bg-[radial-gradient(circle_at_top,rgba(248,250,252,0.12),transparent_45%)]" />
      <div className="absolute right-10 top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute left-16 bottom-10 h-32 w-32 rounded-full bg-warning/20 blur-3xl" />

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
              <CardTitle className="text-2xl font-semibold text-foreground">
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
              <div className="rounded-2xl border border-error-border bg-error-surface px-4 py-3 text-sm text-error-foreground">
                {error}
              </div>
            )}

            {step === "input" ? (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-text-secondary"
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
                    className="rounded-2xl border-border"
                  />
                  {getFieldHelper("email") && (
                    <p className="text-xs font-medium text-destructive">
                      {getFieldHelper("email")}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleSendOtp}
                  disabled={isLoading || !email || !!fieldErrors.email}
                  className="w-full rounded-2xl bg-warning text-base font-semibold text-foreground shadow-lg shadow-warning/30 transition hover:bg-warning disabled:opacity-60"
                >
                  {isLoading ? (
                    <>Sending OTP</>
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
                    className="text-sm font-medium text-text-secondary"
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
                    <p className="text-xs font-medium text-destructive">
                      {getFieldHelper("otp")}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.length !== 6 || !!fieldErrors.otp}
                  className="w-full rounded-2xl bg-foreground text-base font-semibold text-background shadow-lg shadow-slate-900/30 transition hover:bg-foreground disabled:opacity-60"
                >
                  {isLoading ? <>Verifying</> : "Verify & continue"}
                </Button>

                <button
                  type="button"
                  onClick={handleOtpStepReset}
                  className="w-full text-center text-sm font-medium text-warning-foreground hover:text-warning"
                >
                  Change email
                </button>
              </div>
            )}

            <div className="pt-2 text-center text-sm text-muted-foreground">
              <a
                href="/login"
                className="font-semibold text-warning-foreground hover:text-warning"
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

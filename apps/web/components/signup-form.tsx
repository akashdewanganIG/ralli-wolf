"use client";

import { Eye, EyeOff } from "@repo/ui/icons";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";
import logo from "../app/assets/images/logos/logo_v1.png";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail, validateName } from "../lib/validation";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signup, error, clearError } = useAuth();
  const router = useRouter();

  const validationErrors = useMemo(() => {
    const errors: { name?: string; email?: string } = {};

    if (name) {
      const nameValidation = validateName(name);
      if (!nameValidation.isValid) {
        errors.name = nameValidation.error;
      }
    }

    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        errors.email = emailValidation.error;
      }
    }

    return errors;
  }, [name, email]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate before submission
    const nameValidation = validateName(name);
    const emailValidation = validateEmail(email);

    if (!nameValidation.isValid || !emailValidation.isValid) {
      return; // Don't submit if validation fails
    }

    setIsSubmitting(true);
    clearError();

    try {
      await signup({ name, email, password });
      router.push("/");
    } catch {
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex items-center justify-center rounded-md">
                <Image
                  src={logo}
                  alt="Company Logo"
                  width={400}
                  height={400}
                  className="h-auto w-full max-w-[13.75rem] object-contain"
                />
              </div>
              <span className="sr-only">
                {process.env.NEXT_PUBLIC_COMPANY_NAME || "Innovun Global"}
              </span>
            </a>
            <h1 className="text-xl font-bold">
              Welcome to{" "}
              {process.env.NEXT_PUBLIC_COMPANY_NAME || "Innovun Global"} CRM.
            </h1>
            <FieldDescription>
              Already have an account? <a href="/login">Sign in</a>
            </FieldDescription>
          </div>
          {error && (
            <div className="bg-error-surface border border-error-border text-destructive px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                aria-invalid={!!validationErrors.name}
                aria-describedby={
                  validationErrors.name ? "name-error" : undefined
                }
              />
              {validationErrors.name && (
                <p id="name-error" className="text-xs text-destructive mt-1">
                  {validationErrors.name}
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                aria-invalid={!!validationErrors.email}
                aria-describedby={
                  validationErrors.email ? "email-error" : undefined
                }
              />
              {validationErrors.email && (
                <p id="email-error" className="text-xs text-destructive mt-1">
                  {validationErrors.email}
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 inset-y-0 my-auto h-fit text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {!showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>
          </div>
          <Field>
            <Button
              type="submit"
              disabled={isSubmitting || hasValidationErrors}
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field className="grid gap-4 sm:grid-cols-1">
            <Button variant="outline" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
              </svg>
              Continue with Microsoft
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}

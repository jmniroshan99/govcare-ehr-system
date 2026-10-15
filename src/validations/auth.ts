import { z } from "zod";
import type { TFunction } from "i18next";

export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;

export function strongPasswordMessage(t: TFunction) {
  return t("validation.strongPassword", "Use at least 12 characters with uppercase, lowercase, number, and special character.");
}

export function createStrongPasswordSchema(t: TFunction) {
  return z.string().regex(strongPasswordRegex, strongPasswordMessage(t));
}

export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.email(t("validation.email")),
    password: z.string().min(8, t("validation.password")),
    mfaCode: z.string().regex(/^\d{6}$/, t("validation.mfaCode")).optional().or(z.literal("")),
  });
}

export function createPasswordResetRequestSchema(t: TFunction) {
  return z.object({
    email: z.email(t("validation.email")),
  });
}

export function createPasswordResetConfirmSchema(t: TFunction) {
  return z.object({
    password: createStrongPasswordSchema(t),
    confirmPassword: z.string(),
  }).refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: t("validation.passwordMismatch", "Passwords do not match."),
  });
}

export function createChangePasswordSchema(t: TFunction) {
  return z.object({
    currentPassword: z.string().min(1, t("validation.required")),
    password: createStrongPasswordSchema(t),
    confirmPassword: z.string(),
  }).refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: t("validation.passwordMismatch", "Passwords do not match."),
  });
}

export const loginSchema = createLoginSchema(((key: string) => {
  const messages: Record<string, string> = {
    "validation.email": "Enter a valid email address.",
    "validation.password": "Password must be at least 8 characters.",
    "validation.mfaCode": "Enter a 6 digit code.",
    "validation.strongPassword": "Use at least 12 characters with uppercase, lowercase, number, and special character.",
    "validation.passwordMismatch": "Passwords do not match.",
  };
  return messages[key] ?? key;
}) as TFunction);

export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<ReturnType<typeof createPasswordResetRequestSchema>>;
export type PasswordResetConfirmInput = z.infer<ReturnType<typeof createPasswordResetConfirmSchema>>;
export type ChangePasswordInput = z.infer<ReturnType<typeof createChangePasswordSchema>>;

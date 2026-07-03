import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";

initializeApp();

const db = getFirestore();
const auth = getAuth();

const roles = ["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "mortuary_officer", "ict_admin", "records_officer", "patient"] as const;
const otpPurposes = ["account_activation", "login_verification", "forgot_password", "sensitive_action"] as const;
const defaultHospitalId = "hosp-colombo-national";
const otpExpiryMs = 7 * 60 * 1000;
const otpResendCooldownMs = 60 * 1000;
const otpBlockMs = 10 * 60 * 1000;
const maxOtpAttempts = 5;
const maxResends = 5;

function defaultPermissionsForRole(role: string) {
  const map: Record<string, string[]> = {
    super_admin: ["*"],
    hospital_admin: ["admin:*", "users:*", "roles:*", "departments:*", "reports:*", "settings:*", "audit:read"],
    doctor: ["patients:read", "visits:*", "opd:*", "lab:request", "radiology:request", "prescriptions:*"],
    nurse: ["patients:read", "wards:read", "vitals:update", "nursing:*", "mar:update", "tasks:update"],
    pharmacist: ["pharmacy:*", "prescriptions:read", "prescriptions:issue", "medicines:stock-update"],
    lab_technician: ["lab:*", "patients:read"],
    radiologist: ["radiology:*", "patients:read"],
    receptionist: ["patients:create", "appointments:*", "opd:queue"],
    records_officer: ["patients:*", "reports:export", "audit:read"],
    patient: ["portal:read", "profile:self", "reports:self", "appointments:self"],
    ict_admin: ["system:*", "backups:*", "security:read", "functions:read", "hosting:read", "audit:read"],
  };
  return map[role] ?? ["patients:read"];
}

function requireAuth(request: { auth?: { uid: string; token: Record<string, unknown> } }) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  return request.auth;
}

function requireRole(request: { auth?: { uid: string; token: Record<string, unknown> } }, allowed: readonly string[]) {
  const context = requireAuth(request);
  const role = context.token.role as string | undefined;
  if (!role || !allowed.includes(role)) throw new HttpsError("permission-denied", "Insufficient permissions.");
  return context;
}

async function audit(actorUid: string, actorRole: string, hospitalId: string, action: string, collectionName: string, documentId: string) {
  await db.collection("auditLogs").add({
    actorUid,
    actorRole,
    hospitalId,
    action,
    collectionName,
    documentId,
    timestamp: FieldValue.serverTimestamp(),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actorUid,
    updatedBy: actorUid,
  });
}

const loginActivitySchema = z.object({
  sessionId: z.string().min(8).max(160),
  email: z.string().trim().max(254),
  loginStatus: z.enum(["success", "failed"]),
  authenticationMethod: z.enum(["email_password", "google", "demo", "unknown"]),
  failureReason: z.string().max(500).optional(),
  deviceBrowser: z.string().max(300).optional(),
  operatingSystem: z.string().max(120).optional(),
});

export const recordLoginActivity = onCall({ enforceAppCheck: true }, async (request) => {
  const input = loginActivitySchema.parse(request.data);
  const now = FieldValue.serverTimestamp();
  let user: Record<string, unknown> = {};
  let userId = request.auth?.uid;

  if (userId) {
    const snapshot = await db.collection("users").doc(userId).get();
    user = snapshot.data() ?? {};
  } else if (input.email && input.email.includes("@")) {
    try {
      const authUser = await auth.getUserByEmail(input.email.toLowerCase());
      userId = authUser.uid;
      const snapshot = await db.collection("users").doc(authUser.uid).get();
      user = snapshot.data() ?? {};
    } catch {
      // Keep failed attempts for unknown addresses without revealing account existence.
    }
  }

  if (input.loginStatus === "success" && !request.auth) throw new HttpsError("unauthenticated", "Successful login events require authentication.");
  const role = String(user.role ?? request.auth?.token.role ?? "unknown");
  const hospitalId = String(user.hospitalId ?? request.auth?.token.hospitalId ?? "unknown");
  const activity = {
    sessionId: input.sessionId,
    userId: userId ?? null,
    fullName: String(user.displayName ?? "Unknown user"),
    role,
    hospitalId,
    hospitalName: String(user.hospitalName ?? ""),
    departmentId: String(user.departmentId ?? ""),
    departmentName: String(user.departmentName ?? ""),
    email: input.email.toLowerCase(),
    loginStatus: input.loginStatus,
    logoutStatus: input.loginStatus === "success" ? "active" : "unknown",
    loginTime: now,
    logoutTime: null,
    sessionDurationSeconds: null,
    ipAddress: request.rawRequest.ip || request.rawRequest.headers["x-forwarded-for"] || "unavailable",
    deviceBrowser: input.deviceBrowser ?? request.rawRequest.headers["user-agent"] ?? "Unknown device",
    operatingSystem: input.operatingSystem ?? "Unknown OS",
    location: request.rawRequest.headers["x-appengine-country"] ?? "unavailable",
    authenticationMethod: input.authenticationMethod,
    failureReason: input.loginStatus === "failed" ? input.failureReason ?? "Authentication rejected" : null,
    lastActivityTime: now,
    timestamp: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? "anonymous",
    updatedBy: userId ?? "anonymous",
  };
  const reference = await db.collection("loginActivities").add(activity);
  await audit(userId ?? "anonymous", role, hospitalId, input.loginStatus === "success" ? "login" : "login_failed", "loginActivities", reference.id);
  return { ok: true, activityId: reference.id };
});

const closeSessionSchema = z.object({
  sessionId: z.string().min(8).max(160),
  logoutStatus: z.enum(["logged_out", "timed_out"]),
  deviceBrowser: z.string().max(300).optional(),
  operatingSystem: z.string().max(120).optional(),
});

export const closeLoginSession = onCall({ enforceAppCheck: true }, async (request) => {
  const context = requireAuth(request);
  const input = closeSessionSchema.parse(request.data);
  const snapshot = await db.collection("loginActivities").where("sessionId", "==", input.sessionId).where("userId", "==", context.uid).limit(1).get();
  if (snapshot.empty) throw new HttpsError("not-found", "Active login session was not found.");
  const activity = snapshot.docs[0];
  const loginTime = activity.get("loginTime")?.toMillis?.() ?? Date.now();
  await activity.ref.update({
    logoutStatus: input.logoutStatus,
    logoutTime: FieldValue.serverTimestamp(),
    lastActivityTime: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
    sessionDurationSeconds: Math.max(0, Math.round((Date.now() - loginTime) / 1000)),
  });
  await audit(context.uid, String(context.token.role ?? "unknown"), String(context.token.hospitalId ?? "unknown"), input.logoutStatus === "timed_out" ? "session_timeout" : "logout", "loginActivities", activity.id);
  return { ok: true };
});

function otpDocId(userId: string, purpose: string) {
  return `${userId}_${purpose}`;
}

function hashOtp(otp: string, userId: string, purpose: string) {
  const pepper = process.env.OTP_PEPPER || process.env.GCLOUD_PROJECT || "govcare-local-otp-pepper";
  return crypto.createHmac("sha256", pepper).update(`${userId}:${purpose}:${otp}`).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function maskedEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

function transporterConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.GMAIL_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!host && !user) return null;
  return {
    host: host || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function sendOtpEmail(email: string, otp: string, purpose: string) {
  const from = process.env.SMTP_FROM || process.env.GMAIL_EMAIL || "GovCare EHR <no-reply@govcare.local>";
  const subjectByPurpose: Record<string, string> = {
    account_activation: "GovCare account activation OTP",
    login_verification: "GovCare login verification OTP",
    forgot_password: "GovCare password reset OTP",
    sensitive_action: "GovCare sensitive action OTP",
  };
  const subject = subjectByPurpose[purpose] ?? "GovCare verification OTP";
  const text = `GovCare EHR verification code: ${otp}. This code expires in 7 minutes. Do not share this code with anyone. Support: ict@govcare.gov.lk`;
  const html = govCareEmailTemplate({
    title: "GovCare EHR Verification",
    subtitle: subject,
    body: [
      "Use this one-time password to continue your GovCare EHR action.",
      "මෙම එක්වර මුරකේතය GovCare EHR ක්‍රියාව සඳහා භාවිත කරන්න.",
      "GovCare EHR செயலுக்குத் தொடர இந்த ஒருமுறை கடவுச்சொல்லைப் பயன்படுத்தவும்.",
    ],
    code: otp,
    footer: "This code expires in 7 minutes. Do not share it with anyone. If you did not request this, contact hospital ICT immediately.",
  });
  const config = transporterConfig();
  if (!config) {
    console.info(`OTP email transport is not configured. Development OTP for ${maskedEmail(email)} (${purpose}): ${otp}`);
    return;
  }
  await nodemailer.createTransport(config).sendMail({ from, to: email, subject, text, html });
}

function govCareEmailTemplate(input: { title: string; subtitle: string; body: string[]; code?: string; footer: string }) {
  const logoUrl = process.env.EMAIL_LOGO_URL || "https://health.gov.lk/wp-content/uploads/2021/06/cropped-logo.png";
  const codeBlock = input.code ? `<div style="margin:24px 0;padding:18px;border-radius:12px;background:#ecfdf5;border:1px solid #99f6e4;text-align:center"><div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0f766e">${input.code}</div><div style="font-size:12px;color:#334155;margin-top:8px">Expires in 7 minutes</div></div>` : "";
  return `
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ea">
              <tr>
                <td style="background:#0f766e;padding:22px;color:#ffffff">
                  <table role="presentation" width="100%">
                    <tr>
                      <td style="width:64px"><img src="${logoUrl}" alt="Ministry of Health" width="54" height="54" style="border-radius:10px;background:#ffffff;padding:4px;object-fit:contain" /></td>
                      <td>
                        <div style="font-size:20px;font-weight:800">GovCare EHR System</div>
                        <div style="font-size:13px;color:#ccfbf1">Government Hospital Electronic Health Record</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:28px">
                  <h1 style="font-size:22px;margin:0 0 6px">${input.title}</h1>
                  <p style="font-size:14px;color:#475569;margin:0 0 18px">${input.subtitle}</p>
                  ${input.body.map((line) => `<p style="font-size:15px;line-height:1.6;margin:8px 0">${line}</p>`).join("")}
                  ${codeBlock}
                  <div style="margin-top:20px;padding:14px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;font-size:13px;line-height:1.5">${input.footer}</div>
                  <p style="font-size:12px;color:#64748b;margin-top:22px">Support: ict@govcare.gov.lk · Ministry of Health Sri Lanka</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>`;
}

async function sendSecurityEmail(email: string, title: string, message: string) {
  const config = transporterConfig();
  if (!config) {
    console.info(`Security email transport is not configured. Message for ${maskedEmail(email)}: ${title}`);
    return;
  }
  const from = process.env.SMTP_FROM || process.env.GMAIL_EMAIL || "GovCare EHR <no-reply@govcare.local>";
  const html = govCareEmailTemplate({
    title,
    subtitle: "GovCare EHR security notification",
    body: [message, "If this was not you, contact your hospital ICT unit immediately."],
    footer: "For your safety, old sessions may be invalidated after password changes.",
  });
  await nodemailer.createTransport(config).sendMail({ from, to: email, subject: title, text: `${title}\n\n${message}`, html });
}

async function getUserContextForOtp(request: { auth?: { uid: string; token: Record<string, unknown> }; data: unknown }, purpose: string, email?: string) {
  if (purpose === "forgot_password" && !request.auth) {
    if (!email) throw new HttpsError("invalid-argument", "Email is required.");
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      throw new HttpsError("not-found", "No active account was found for this email address.");
    }
    const userSnap = await db.collection("users").doc(userRecord.uid).get();
    const user = userSnap.data() ?? {};
    if (userSnap.exists && user.status && user.status !== "active") throw new HttpsError("permission-denied", "This account is not active.");
    if (!userSnap.exists) throw new HttpsError("not-found", "No active EHR user profile was found for this email address.");
    return {
      uid: userRecord.uid,
      email: userRecord.email ?? email,
      role: String(user.role ?? "patient"),
      hospitalId: String(user.hospitalId ?? defaultHospitalId),
    };
  }
  const context = requireAuth(request);
  const userRecord = await auth.getUser(context.uid);
  const userSnap = await db.collection("users").doc(context.uid).get();
  const user = userSnap.data() ?? {};
  if (user.status && user.status !== "active") throw new HttpsError("permission-denied", "This account is not active.");
  return {
    uid: context.uid,
    email: String(user.email ?? userRecord.email ?? email ?? ""),
    role: String(user.role ?? context.token.role ?? "user"),
    hospitalId: String(user.hospitalId ?? context.token.hospitalId ?? defaultHospitalId),
  };
}

export const requestEmailOtp = onCall({ enforceAppCheck: true }, async (request) => {
  const input = z.object({
    purpose: z.enum(otpPurposes),
    email: z.email().optional(),
    metadata: z.object({
      userAgent: z.string().max(500).optional(),
      sessionId: z.string().max(120).optional(),
      action: z.string().max(120).optional(),
    }).optional(),
  }).parse(request.data);
  const user = await getUserContextForOtp(request, input.purpose, input.email);
  if (!user.email) throw new HttpsError("failed-precondition", "User email is missing.");
  const docRef = db.collection("emailOtps").doc(otpDocId(user.uid, input.purpose));
  const now = Date.now();
  const existing = await docRef.get();
  const existingData = existing.data();
  if (existingData?.blockedUntilMs && Number(existingData.blockedUntilMs) > now) {
    throw new HttpsError("resource-exhausted", "Too many OTP attempts. Try again later.");
  }
  if (existingData?.lastSentAtMs && Number(existingData.lastSentAtMs) + otpResendCooldownMs > now) {
    throw new HttpsError("resource-exhausted", "Please wait before requesting another OTP.");
  }
  const resendCount = Number(existingData?.resendCount ?? 0);
  if (resendCount >= maxResends && Number(existingData?.createdAtMs ?? 0) + 15 * 60 * 1000 > now) {
    await docRef.set({ status: "blocked", blockedUntilMs: now + otpBlockMs, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
    await audit(user.uid, user.role, user.hospitalId, "otp_blocked_resend", "emailOtps", docRef.id);
    throw new HttpsError("resource-exhausted", "OTP resend limit reached. Try again later.");
  }
  const otp = generateOtp();
  await docRef.set({
    userId: user.uid,
    email: user.email,
    purpose: input.purpose,
    hashedOtp: hashOtp(otp, user.uid, input.purpose),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    updatedAtMs: now,
    expiresAt: new Date(now + otpExpiryMs).toISOString(),
    expiresAtMs: now + otpExpiryMs,
    attempts: 0,
    resendCount: existing.exists ? resendCount + 1 : 0,
    lastSentAtMs: now,
    status: "pending",
    hospitalId: user.hospitalId,
    device: input.metadata ?? {},
    createdBy: user.uid,
    updatedBy: user.uid,
  }, { merge: true });
  await sendOtpEmail(user.email, otp, input.purpose);
  await audit(user.uid, user.role, user.hospitalId, "otp_generated", "emailOtps", docRef.id);
  await audit(user.uid, user.role, user.hospitalId, "otp_email_sent", "emailOtps", docRef.id);
  return { ok: true, maskedEmail: maskedEmail(user.email), expiresInSeconds: Math.floor(otpExpiryMs / 1000), resendAfterSeconds: Math.floor(otpResendCooldownMs / 1000) };
});

export const verifyEmailOtp = onCall({ enforceAppCheck: true }, async (request) => {
  const input = z.object({
    purpose: z.enum(otpPurposes),
    otp: z.string().regex(/^\d{6}$/),
    email: z.email().optional(),
  }).parse(request.data);
  const user = await getUserContextForOtp(request, input.purpose, input.email);
  const docRef = db.collection("emailOtps").doc(otpDocId(user.uid, input.purpose));
  const snap = await docRef.get();
  const data = snap.data();
  const now = Date.now();
  if (!snap.exists || !data || data.status !== "pending") throw new HttpsError("failed-precondition", "No active OTP request was found.");
  if (Number(data.expiresAtMs) < now) {
    await docRef.set({ status: "expired", updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
    await audit(user.uid, user.role, user.hospitalId, "otp_expired", "emailOtps", docRef.id);
    throw new HttpsError("deadline-exceeded", "OTP expired.");
  }
  if (Number(data.attempts ?? 0) >= maxOtpAttempts) {
    await docRef.set({ status: "blocked", blockedUntilMs: now + otpBlockMs, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
    await audit(user.uid, user.role, user.hospitalId, "otp_blocked_attempts", "emailOtps", docRef.id);
    throw new HttpsError("resource-exhausted", "Too many OTP attempts.");
  }
  const valid = data.hashedOtp === hashOtp(input.otp, user.uid, input.purpose);
  if (!valid) {
    await docRef.set({ attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
    await audit(user.uid, user.role, user.hospitalId, "otp_verification_failed", "emailOtps", docRef.id);
    throw new HttpsError("permission-denied", "Invalid OTP.");
  }
  await docRef.set({
    status: "verified",
    verifiedAt: FieldValue.serverTimestamp(),
    usedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: user.uid,
  }, { merge: true });
  await audit(user.uid, user.role, user.hospitalId, "otp_verification_success", "emailOtps", docRef.id);
  if (input.purpose === "account_activation") {
    await db.collection("users").doc(user.uid).set({ emailVerified: true, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
  }
  return { ok: true };
});

export const resetPasswordWithEmailOtp = onCall({ enforceAppCheck: true }, async (request) => {
  const input = z.object({
    email: z.email(),
    otp: z.string().regex(/^\d{6}$/),
    password: z.string().min(12).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/).regex(/[^A-Za-z\d]/),
  }).parse(request.data);
  const user = await getUserContextForOtp(request, "forgot_password", input.email);
  const docRef = db.collection("emailOtps").doc(otpDocId(user.uid, "forgot_password"));
  const snap = await docRef.get();
  const data = snap.data();
  const now = Date.now();
  if (!snap.exists || !data || data.status !== "pending") throw new HttpsError("failed-precondition", "No active OTP request was found.");
  if (Number(data.expiresAtMs) < now) {
    await docRef.set({ status: "expired", updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
    await audit(user.uid, user.role, user.hospitalId, "otp_expired", "emailOtps", docRef.id);
    throw new HttpsError("deadline-exceeded", "OTP expired.");
  }
  if (data.hashedOtp !== hashOtp(input.otp, user.uid, "forgot_password")) {
    await docRef.set({ attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
    await audit(user.uid, user.role, user.hospitalId, "otp_verification_failed", "emailOtps", docRef.id);
    throw new HttpsError("permission-denied", "Invalid OTP.");
  }
  await auth.updateUser(user.uid, { password: input.password });
  await auth.revokeRefreshTokens(user.uid);
  await docRef.set({ status: "used", verifiedAt: FieldValue.serverTimestamp(), usedAtMs: now, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
  await audit(user.uid, user.role, user.hospitalId, "password_reset_with_otp", "users", user.uid);
  await sendSecurityEmail(user.email, "GovCare password changed", "Your GovCare EHR password was reset using email OTP verification.");
  await audit(user.uid, user.role, user.hospitalId, "password_reset_email_sent", "users", user.uid);
  await db.collection("notifications").add({
    userId: user.uid,
    hospitalId: user.hospitalId,
    targetRoles: [user.role],
    roles: [user.role],
    title: "Password reset completed",
    message: "Your GovCare password was reset using email OTP verification.",
    module: "Security",
    priority: "warning",
    channels: ["in-app", "email"],
    group: "Security",
    read: false,
    archived: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: user.uid,
    updatedBy: user.uid,
  });
  return { ok: true };
});

export const createUserWithRole = onCall(async (request) => {
  const adminContext = requireRole(request, ["super_admin", "hospital_admin"]);
  const schema = z.object({
    email: z.email(),
    password: z.string().min(12),
    displayName: z.string().min(2),
    role: z.enum(roles),
    hospitalId: z.string().min(3),
    departmentId: z.string().optional(),
    hospitalName: z.string().optional(),
    departmentName: z.string().optional(),
  });
  const input = schema.parse(request.data);
  if (adminContext.token.role === "hospital_admin" && adminContext.token.hospitalId !== input.hospitalId) {
    throw new HttpsError("permission-denied", "Cannot create users outside your hospital.");
  }
  const user = await auth.createUser({ email: input.email, password: input.password, displayName: input.displayName });
  await auth.setCustomUserClaims(user.uid, { role: input.role, hospitalId: input.hospitalId, departmentId: input.departmentId ?? null });
  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    hospitalId: input.hospitalId,
    departmentId: input.departmentId ?? null,
    hospitalName: input.hospitalName ?? null,
    departmentName: input.departmentName ?? null,
    permissions: defaultPermissionsForRole(input.role),
    mfaEnabled: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: adminContext.uid,
    updatedBy: adminContext.uid,
  });
  await audit(adminContext.uid, String(adminContext.token.role), input.hospitalId, "create", "users", user.uid);
  const activationOtp = generateOtp();
  const activationRef = db.collection("emailOtps").doc(otpDocId(user.uid, "account_activation"));
  const now = Date.now();
  await activationRef.set({
    userId: user.uid,
    email: input.email,
    purpose: "account_activation",
    hashedOtp: hashOtp(activationOtp, user.uid, "account_activation"),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    updatedAtMs: now,
    expiresAt: new Date(now + otpExpiryMs).toISOString(),
    expiresAtMs: now + otpExpiryMs,
    attempts: 0,
    resendCount: 0,
    lastSentAtMs: now,
    status: "pending",
    hospitalId: input.hospitalId,
    device: { action: "admin_create_user" },
    createdBy: adminContext.uid,
    updatedBy: adminContext.uid,
  });
  await sendOtpEmail(input.email, activationOtp, "account_activation");
  await audit(adminContext.uid, String(adminContext.token.role), input.hospitalId, "otp_generated", "emailOtps", activationRef.id);
  return { uid: user.uid };
});

export const updatePatientFieldConfiguration = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "ict_admin"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    genderEnabled: z.boolean(),
    genderOptions: z.array(z.string().min(1).max(80)).min(1),
    fields: z.record(z.string(), z.object({
      fieldId: z.string().min(1),
      state: z.enum(["visible", "hidden", "required", "optional", "read-only"]),
      visibleToRoles: z.array(z.enum(roles)).min(1),
    })),
    customFields: z.array(z.object({
      id: z.string().min(1).max(80),
      label: z.string().min(1).max(120),
      state: z.enum(["visible", "hidden", "required", "optional", "read-only"]),
      section: z.string().min(1).max(60),
    })).default([]),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) {
    throw new HttpsError("permission-denied", "Cannot edit field policies outside your hospital.");
  }
  await db.collection("patientFieldConfigurations").doc(input.hospitalId).set({
    ...input,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
  }, { merge: true });
  await audit(context.uid, String(context.token.role), input.hospitalId, "update", "patientFieldConfigurations", input.hospitalId);
  return { ok: true };
});

export const registerPatientWithGuardian = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "receptionist", "records_officer"]);
  const schema = z.object({
    hospitalId: z.string().min(3),
    patient: z.object({
      firstName: z.string().min(2).max(80),
      lastName: z.string().min(2).max(80),
      dateOfBirth: z.string().min(8),
      nicOrPassport: z.string().max(32).optional(),
      passportNumber: z.string().max(32).optional(),
      birthCertificateNo: z.string().max(40).optional(),
      phone: z.string().min(7).max(20),
      address: z.string().min(5).max(240),
      sex: z.string().optional(),
      bloodGroup: z.string().optional(),
      allergies: z.array(z.string()).default([]),
      chronicDiseases: z.array(z.string()).default([]),
    }),
    guardian: z.object({
      nic: z.string().min(5).max(32),
      fullName: z.string().min(2).max(160),
      phone: z.string().min(7).max(20),
      relationshipToPatient: z.enum(["Father", "Mother", "Grandparent", "Spouse", "Sibling", "Legal Guardian", "Other"]),
      address: z.string().max(240).optional(),
      email: z.email().optional(),
      emergencyContactName: z.string().max(120).optional(),
      emergencyContactPhone: z.string().max(20).optional(),
    }).optional(),
  });
  const input = schema.parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) {
    throw new HttpsError("permission-denied", "Cannot register patients outside your hospital.");
  }
  const dob = new Date(input.patient.dateOfBirth);
  let age = new Date().getUTCFullYear() - dob.getUTCFullYear();
  if (new Date().getUTCMonth() < dob.getUTCMonth()) age -= 1;
  if (age >= 16 && !input.patient.nicOrPassport?.trim()) throw new HttpsError("invalid-argument", "Adult patients require a NIC or passport.");
  if (age < 16 && (!input.patient.birthCertificateNo?.trim() || !input.guardian)) throw new HttpsError("invalid-argument", "Children require birth certificate and guardian details.");

  const duplicateQuery = age >= 16
    ? await db.collection("patients").where("hospitalId", "==", input.hospitalId).where("nicOrPassport", "==", input.patient.nicOrPassport).limit(1).get()
    : await db.collection("patients").where("hospitalId", "==", input.hospitalId).where("birthCertificateNo", "==", input.patient.birthCertificateNo).limit(1).get();
  if (!duplicateQuery.empty) {
    return { ok: false, duplicate: true, patientId: duplicateQuery.docs[0].data().patientId };
  }

  const result = await db.runTransaction(async (tx) => {
    const counterRef = db.collection("hospitals").doc(input.hospitalId).collection("counters").doc("patients");
    const counterSnap = await tx.get(counterRef);
    const next = Number(counterSnap.data()?.value ?? 0) + 1;
    const patientId = `PAT-${new Date().getUTCFullYear()}-${String(next).padStart(6, "0")}`;
    const patientRef = db.collection("patients").doc(patientId);
    let guardianId: string | undefined;
    if (input.guardian) {
      const guardianRef = db.collection("guardians").doc(`${input.hospitalId}_${input.guardian.nic.toUpperCase()}`);
      const guardianSnap = await tx.get(guardianRef);
      guardianId = guardianSnap.exists ? String(guardianSnap.data()?.guardianId) : `GRD-${new Date().getUTCFullYear()}-${String(next).padStart(6, "0")}`;
      tx.set(guardianRef, {
        ...input.guardian,
        guardianId,
        hospitalId: input.hospitalId,
        dependentPatientIds: FieldValue.arrayUnion(patientId),
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: context.uid,
        createdAt: guardianSnap.exists ? guardianSnap.data()?.createdAt : FieldValue.serverTimestamp(),
        createdBy: guardianSnap.exists ? guardianSnap.data()?.createdBy : context.uid,
      }, { merge: true });
      tx.set(db.collection("guardianDependents").doc(`${guardianId}_${patientId}`), {
        guardianId,
        guardianNic: input.guardian.nic.toUpperCase(),
        guardianUid: null,
        patientId,
        hospitalId: input.hospitalId,
        relationshipToPatient: input.guardian.relationshipToPatient,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: context.uid,
        updatedBy: context.uid,
      });
    }
    tx.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(patientRef, {
      ...input.patient,
      patientId,
      guardianId: guardianId ?? null,
      guardian: input.guardian ? { guardianId, name: input.guardian.fullName, relationship: input.guardian.relationshipToPatient, nic: input.guardian.nic, phone: input.guardian.phone } : null,
      hospitalId: input.hospitalId,
      portalVisible: true,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.uid,
      updatedBy: context.uid,
    });
    return { patientId, guardianId };
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "patients", result.patientId);
  if (result.guardianId) await audit(context.uid, String(context.token.role), input.hospitalId, "link", "guardians", result.guardianId);
  return { ok: true, ...result };
});

export const recordPasswordChanged = onCall(async (request) => {
  const context = requireAuth(request);
  const userSnap = await db.collection("users").doc(context.uid).get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
  const user = userSnap.data() ?? {};
  if (user.status !== "active") throw new HttpsError("permission-denied", "This account is not active.");
  const role = String(user.role ?? context.token.role ?? "user");
  const hospitalId = String(user.hospitalId ?? context.token.hospitalId ?? defaultHospitalId);
  await audit(context.uid, role, hospitalId, "password_change", "users", context.uid);
  await db.collection("notifications").add({
    userId: context.uid,
    hospitalId,
    targetRoles: [role],
    roles: [role],
    title: "Password changed",
    message: "Your GovCare password was changed. Contact ICT immediately if this was not you.",
    module: "Security",
    priority: "warning",
    channels: ["in-app", "email"],
    group: "Security",
    read: false,
    archived: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await auth.revokeRefreshTokens(context.uid);
  return { ok: true };
});

export const ensurePatientPortalProfile = onCall(async (request) => {
  try {
    const context = requireAuth(request);
    const input = z.object({
      uid: z.string(),
      email: z.email().or(z.literal("")),
      displayName: z.string().min(1),
      photoURL: z.string().nullable().optional(),
    }).parse(request.data);
    if (context.uid !== input.uid) throw new HttpsError("permission-denied", "Cannot create another patient's profile.");

    const userRecord = await auth.getUser(context.uid);
    const usedGoogle = userRecord.providerData.some((provider) => provider.providerId === "google.com");
    if (!usedGoogle) throw new HttpsError("permission-denied", "Patient portal login must use Google.");

    const userRef = db.collection("users").doc(context.uid);
    const existing = await userRef.get();
    if (existing.exists) {
      const data = existing.data();
      if (data?.role !== "patient") throw new HttpsError("permission-denied", "This account is not a patient account.");
      return { id: existing.id, ...data };
    }

    const patientId = await db.runTransaction(async (tx) => {
      const counterRef = db.collection("hospitals").doc(defaultHospitalId).collection("counters").doc("patients");
      const snap = await tx.get(counterRef);
      const next = (snap.data()?.value ?? 0) + 1;
      tx.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return `SELF-${new Date().getUTCFullYear()}-${String(next).padStart(6, "0")}`;
    });

    await auth.setCustomUserClaims(context.uid, { role: "patient", hospitalId: defaultHospitalId, patientId });
    const profile = {
      uid: context.uid,
      email: input.email || userRecord.email || "",
      displayName: input.displayName,
      role: "patient",
      hospitalId: defaultHospitalId,
      patientId,
      photoURL: input.photoURL ?? userRecord.photoURL ?? null,
      mfaEnabled: false,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.uid,
      updatedBy: context.uid,
    };
    await userRef.set(profile);
    await db.collection("patients").doc(context.uid).set({
      ownerUid: context.uid,
      patientId,
      firstName: input.displayName.split(" ")[0] ?? "Patient",
      lastName: input.displayName.split(" ").slice(1).join(" ") || "User",
      nicOrPassport: "",
      phone: "",
      address: "",
      allergies: [],
      chronicDiseases: [],
      emergencyContact: { name: "", relationship: "", phone: "" },
      hospitalId: defaultHospitalId,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.uid,
      updatedBy: context.uid,
    }, { merge: true });
    await audit(context.uid, "patient", defaultHospitalId, "create", "users", context.uid);
    return { id: context.uid, ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const message = error instanceof Error ? error.message : "Unknown profile setup error.";
    console.error("ensurePatientPortalProfile failed", error);
    throw new HttpsError("failed-precondition", `Patient profile setup failed: ${message}`);
  }
});

export const updateProfile = onCall(async (request) => {
  const context = requireRole(request, ["doctor", "nurse", "patient"]);
  const input = z.object({
    displayName: z.string().min(2).max(120),
    phone: z.string().max(24).optional(),
    address: z.string().max(240).optional(),
  }).parse(request.data);
  await db.collection("users").doc(context.uid).update({
    ...input,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
  });
  if (context.token.role === "patient") {
    await db.collection("patients").doc(context.uid).set({
      phone: input.phone ?? "",
      address: input.address ?? "",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.uid,
    }, { merge: true });
  }
  await audit(context.uid, String(context.token.role), String(context.token.hospitalId ?? defaultHospitalId), "update", "users", context.uid);
  return { ok: true };
});

export const generatePatientId = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "receptionist", "records_officer"]);
  const input = z.object({ hospitalId: z.string().min(3) }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  const counterRef = db.collection("hospitals").doc(input.hospitalId).collection("counters").doc("patients");
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.data()?.value ?? 0) + 1;
    tx.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `PAT-${new Date().getUTCFullYear()}-${String(next).padStart(6, "0")}`;
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "patients", result);
  return { patientId: result };
});

const prescriptionLineSchema = z.object({
  medicineId: z.string().min(2),
  name: z.string().min(2),
  generic: z.string().min(2),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  quantity: z.number().int().positive(),
  instructions: z.string().max(1000),
  stock: z.number().int().min(0).default(0),
  expiry: z.string().default("not-recorded"),
  alternative: z.string().optional(),
  status: z.enum(["pending", "issued", "unavailable", "substituted"]).default("pending"),
});

const pharmacyPrescriptionSchema = z.object({
  prescriptionNo: z.string().min(2).optional(),
  consultationId: z.string().optional(),
  visitId: z.string().optional(),
  patientId: z.string().min(3),
  nic: z.string().optional(),
  patientName: z.string().min(2),
  age: z.number().int().min(0).optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  allergies: z.array(z.string()).default([]),
  diagnosis: z.string().min(2),
  clinicalNotes: z.string().max(4000).optional(),
  doctorId: z.string().min(2),
  doctorName: z.string().min(2),
  department: z.string().min(2),
  hospitalId: z.string().min(3),
  opdToken: z.string().optional(),
  admissionNo: z.string().optional(),
  priority: z.enum(["routine", "urgent", "stat"]).default("routine"),
  validation: z.enum(["clear", "warning", "blocked"]).default("clear"),
  lines: z.array(prescriptionLineSchema).min(1),
});

function prescriptionNo() {
  return `RX-${new Date().getUTCFullYear()}-${crypto.randomInt(100000, 1000000)}`;
}

function evaluatePrescriptionSafety(input: { allergies: string[]; lines: Array<z.infer<typeof prescriptionLineSchema>> }) {
  const warnings: string[] = [];
  const counts = new Map<string, number>();
  for (const line of input.lines) {
    const generic = line.generic.toLowerCase();
    counts.set(generic, (counts.get(generic) ?? 0) + 1);
    const allergyMatch = input.allergies.some((allergy) => {
      const token = allergy.toLowerCase().split(/\s|-/)[0];
      return token.length > 2 && `${line.name} ${line.generic}`.toLowerCase().includes(token);
    });
    if (allergyMatch) warnings.push(`Allergy warning for ${line.generic}.`);
    if (line.stock <= 0) warnings.push(`${line.generic} is out of stock.`);
    if (line.stock > 0 && line.stock < line.quantity) warnings.push(`${line.generic} has partial stock.`);
  }
  for (const [generic, count] of counts.entries()) {
    if (count > 1) warnings.push(`Duplicate medicine detected: ${generic}.`);
  }
  return { validation: warnings.length ? "warning" : "clear", warnings };
}

export const createPrescriptionFromConsultation = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = pharmacyPrescriptionSchema.parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  const safety = evaluatePrescriptionSafety({ allergies: input.allergies, lines: input.lines });
  const id = input.prescriptionNo ?? prescriptionNo();
  const payload = {
    ...input,
    prescriptionNo: id,
    status: "pending",
    pharmacyStatus: "queued",
    validation: safety.validation,
    safetyWarnings: safety.warnings,
    releaseStatus: "internal",
    signedBy: context.uid,
    signedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  };
  await db.collection("prescriptions").doc(id).set(payload, { merge: true });
  await db.collection("pharmacyQueue").doc(id).set({
    ...payload,
    prescriptionId: id,
    queuedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection("notifications").add({
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    title: "New prescription queued",
    message: `${id} for ${input.patientName} is ready for pharmacy verification.`,
    module: "Pharmacy",
    priority: input.priority === "stat" ? "urgent" : "information",
    roles: ["pharmacist"],
    targetRoles: ["pharmacist"],
    channels: ["in-app", "push"],
    actionHref: "/pharmacy",
    read: false,
    archived: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "createPrescriptionFromConsultation", "prescriptions", id);
  await audit(context.uid, String(context.token.role), input.hospitalId, "pushPrescriptionToPharmacyQueue", "pharmacyQueue", id);
  return { ok: true, prescriptionNo: id, id, validation: safety.validation, safetyWarnings: safety.warnings };
});

export const pushPrescriptionToPharmacyQueue = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = pharmacyPrescriptionSchema.extend({
    id: z.string().optional(),
    status: z.enum(["pending", "verified", "issued", "partially issued", "rejected"]).default("pending"),
    submittedAt: z.string().optional(),
    releaseStatus: z.string().optional(),
    updatedAt: z.string().optional(),
    auditTrail: z.array(z.record(z.string(), z.unknown())).optional(),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  const id = input.prescriptionNo ?? input.id ?? prescriptionNo();
  await db.collection("pharmacyQueue").doc(id).set({
    ...input,
    prescriptionId: id,
    prescriptionNo: id,
    status: input.status,
    queuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
  }, { merge: true });
  await audit(context.uid, String(context.token.role), input.hospitalId, "pushPrescriptionToPharmacyQueue", "pharmacyQueue", id);
  return { ok: true, prescriptionNo: id };
});

export const verifyPrescriptionSafety = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor", "pharmacist"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    prescriptionId: z.string().optional(),
    allergies: z.array(z.string()).default([]),
    lines: z.array(prescriptionLineSchema).default([]),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  let lines = input.lines;
  let allergies = input.allergies;
  if (input.prescriptionId) {
    const snap = await db.collection("prescriptions").doc(input.prescriptionId).get();
    const data = snap.data();
    if (!snap.exists || data?.hospitalId !== input.hospitalId) throw new HttpsError("not-found", "Prescription not found.");
    lines = z.array(prescriptionLineSchema).parse(data.lines ?? []);
    allergies = z.array(z.string()).parse(data.allergies ?? []);
  }
  const safety = evaluatePrescriptionSafety({ allergies, lines });
  if (input.prescriptionId) {
    await db.collection("pharmacyQueue").doc(input.prescriptionId).set({
      validation: safety.validation,
      safetyWarnings: safety.warnings,
      status: "verified",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.uid,
    }, { merge: true });
  }
  await audit(context.uid, String(context.token.role), input.hospitalId, "verifyPrescriptionSafety", "prescriptions", input.prescriptionId ?? "draft");
  return { ok: true, ...safety };
});

export const issueMedicineAndUpdateStock = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "pharmacist"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    prescriptionId: z.string().min(2),
    items: z.array(z.object({ medicineId: z.string().min(2), quantity: z.number().int().positive() })).min(1),
    issuedBy: z.string().optional(),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  await db.runTransaction(async (tx) => {
    for (const item of input.items) {
      const stockRef = db.collection("medicineStock").doc(item.medicineId);
      const medicineRef = db.collection("medicines").doc(item.medicineId);
      const stockSnap = await tx.get(stockRef);
      const medicineSnap = stockSnap.exists ? stockSnap : await tx.get(medicineRef);
      const stock = Number(medicineSnap.data()?.stock ?? medicineSnap.data()?.quantity ?? 0);
      if (!medicineSnap.exists || stock < item.quantity) throw new HttpsError("failed-precondition", `Insufficient stock for ${item.medicineId}.`);
      tx.set(stockSnap.exists ? stockRef : medicineRef, {
        stock: stock - item.quantity,
        quantity: stock - item.quantity,
        hospitalId: input.hospitalId,
        status: stock - item.quantity <= 0 ? "out_of_stock" : "active",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: context.uid,
      }, { merge: true });
    }
    tx.set(db.collection("pharmacyQueue").doc(input.prescriptionId), {
      status: "partially issued",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.uid,
    }, { merge: true });
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "issueMedicineAndUpdateStock", "pharmacyQueue", input.prescriptionId);
  return { ok: true };
});

export const completePharmacyTransaction = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "pharmacist"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    prescriptionId: z.string().min(2),
    patientId: z.string().min(3),
    issuedBy: z.string().min(2),
    receiptId: z.string().optional(),
    items: z.array(z.object({ medicineId: z.string().min(2), quantity: z.number().int().positive() })).min(1),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  const prescriptionSnap = await db.collection("prescriptions").doc(input.prescriptionId).get();
  const prescription = prescriptionSnap.data() ?? {};
  const receiptRef = input.receiptId ? db.collection("pharmacyReceipts").doc(input.receiptId) : db.collection("pharmacyReceipts").doc();
  await receiptRef.set({
    hospitalId: input.hospitalId,
    prescriptionId: input.prescriptionId,
    patientId: input.patientId,
    patientName: prescription.patientName ?? "",
    doctorName: prescription.doctorName ?? "",
    issuedItems: input.items,
    issuedBy: context.uid,
    issuedByName: input.issuedBy,
    receiptNo: receiptRef.id,
    qrPayload: `govcare://pharmacyReceipts/${receiptRef.id}`,
    releaseStatus: "released",
    status: "issued",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  }, { merge: true });
  await db.collection("prescriptions").doc(input.prescriptionId).set({
    pharmacyStatus: "issued",
    status: "issued",
    releaseStatus: "released",
    lastReceiptId: receiptRef.id,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
  }, { merge: true });
  await db.collection("pharmacyQueue").doc(input.prescriptionId).set({
    hospitalId: input.hospitalId,
    prescriptionId: input.prescriptionId,
    patientId: input.patientId,
    status: "issued",
    receiptId: receiptRef.id,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
  }, { merge: true });
  await db.collection("notifications").add({
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    title: "Prescription issued",
    message: `Prescription ${input.prescriptionId} has been issued. Your medication receipt is ready.`,
    module: "Pharmacy",
    priority: "information",
    roles: ["doctor", "patient", "pharmacist"],
    targetRoles: ["doctor", "patient", "pharmacist"],
    channels: ["in-app", "push"],
    actionHref: "/pharmacy",
    read: false,
    archived: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "completePharmacyTransaction", "pharmacyReceipts", receiptRef.id);
  return { ok: true, receiptId: receiptRef.id };
});

export const processPrescription = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "pharmacist"]);
  const input = z.object({
    hospitalId: z.string(),
    prescriptionId: z.string(),
    items: z.array(z.object({ medicineId: z.string(), quantity: z.number().int().positive() })),
  }).parse(request.data);
  await db.runTransaction(async (tx) => {
    for (const item of input.items) {
      const medRef = db.collection("medicines").doc(item.medicineId);
      const snap = await tx.get(medRef);
      const stock = Number(snap.data()?.stock ?? 0);
      if (!snap.exists || stock < item.quantity) {
        throw new HttpsError("failed-precondition", `Insufficient stock for ${item.medicineId}.`);
      }
      tx.update(medRef, { stock: stock - item.quantity, updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid });
    }
    tx.update(db.collection("prescriptions").doc(input.prescriptionId), { status: "completed", updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid });
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "update", "prescriptions", input.prescriptionId);
  return { ok: true };
});

export const issuePharmacyReceipt = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "pharmacist"]);
  const input = z.object({
    hospitalId: z.string(),
    prescriptionId: z.string(),
    patientId: z.string(),
    issuedBy: z.string().min(2).max(120),
    items: z.array(z.object({ medicineId: z.string(), quantity: z.number().int().positive() })).min(1),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");

  const receiptRef = db.collection("pharmacyReceipts").doc();
  const issueRefs = input.items.map(() => db.collection("medicineIssues").doc());

  await db.runTransaction(async (tx) => {
    const prescriptionRef = db.collection("prescriptions").doc(input.prescriptionId);
    const prescriptionSnap = await tx.get(prescriptionRef);
    const prescription = prescriptionSnap.data() ?? {};
    const issuedItems: Array<Record<string, unknown>> = [];

    for (const [index, item] of input.items.entries()) {
      const stockRef = db.collection("medicineStock").doc(item.medicineId);
      const medicineRef = db.collection("medicines").doc(item.medicineId);
      const stockSnap = await tx.get(stockRef);
      const medicineSnap = stockSnap.exists ? stockSnap : await tx.get(medicineRef);
      const stock = Number(medicineSnap.data()?.stock ?? medicineSnap.data()?.quantity ?? 0);
      if (!medicineSnap.exists || stock < item.quantity) {
        throw new HttpsError("failed-precondition", `Insufficient stock for ${item.medicineId}.`);
      }
      const targetRef = stockSnap.exists ? stockRef : medicineRef;
      const medicineName = String(medicineSnap.data()?.name ?? medicineSnap.data()?.generic ?? item.medicineId);
      tx.set(targetRef, {
        stock: stock - item.quantity,
        quantity: stock - item.quantity,
        hospitalId: input.hospitalId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: context.uid,
        status: stock - item.quantity <= 0 ? "out_of_stock" : "active",
      }, { merge: true });
      const issueRef = issueRefs[index];
      tx.set(issueRef, {
        hospitalId: input.hospitalId,
        prescriptionId: input.prescriptionId,
        patientId: input.patientId,
        medicineId: item.medicineId,
        medicineName,
        quantity: item.quantity,
        issueStatus: "issued",
        issuedBy: context.uid,
        issuedByName: input.issuedBy,
        receiptId: receiptRef.id,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: context.uid,
        updatedBy: context.uid,
      });
      issuedItems.push({ medicineId: item.medicineId, medicineName, quantity: item.quantity });
    }

    tx.set(receiptRef, {
      hospitalId: input.hospitalId,
      prescriptionId: input.prescriptionId,
      patientId: input.patientId,
      patientName: prescription.patientName ?? "",
      doctorName: prescription.doctorName ?? prescription.doctor ?? "",
      issuedItems,
      issuedBy: context.uid,
      issuedByName: input.issuedBy,
      receiptNo: `PHR-${Date.now()}`,
      qrPayload: `govcare://pharmacyReceipts/${receiptRef.id}`,
      releaseStatus: "released",
      status: "issued",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.uid,
      updatedBy: context.uid,
    });
    tx.set(prescriptionRef, {
      hospitalId: input.hospitalId,
      patientId: input.patientId,
      pharmacyStatus: "issued",
      status: "issued",
      lastReceiptId: receiptRef.id,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.uid,
    }, { merge: true });
    tx.set(db.collection("pharmacyQueue").doc(input.prescriptionId), {
      hospitalId: input.hospitalId,
      prescriptionId: input.prescriptionId,
      patientId: input.patientId,
      status: "issued",
      receiptId: receiptRef.id,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.uid,
    }, { merge: true });
  });

  await db.collection("notifications").add({
    hospitalId: input.hospitalId,
    title: "Prescription issued",
    message: `Prescription ${input.prescriptionId} has been issued by pharmacy.`,
    module: "Pharmacy",
    priority: "information",
    roles: ["doctor", "patient", "pharmacist"],
    targetRoles: ["doctor", "patient", "pharmacist"],
    patientId: input.patientId,
    actionHref: "/pharmacy",
    read: false,
    archived: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "issue", "pharmacyReceipts", receiptRef.id);
  return { ok: true, receiptId: receiptRef.id };
});

export const generateReport = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "records_officer"]);
  const input = z.object({ hospitalId: z.string(), reportType: z.string(), from: z.string(), to: z.string() }).parse(request.data);
  const ref = await db.collection("reports").add({
    ...input,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "reports", ref.id);
  return { reportId: ref.id };
});

export const generateAdminReport = onCall(async (request) => {
  const context = requireRole(request, [
    "super_admin", "hospital_admin", "records_officer", "ict_admin", "receptionist",
    "doctor", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician",
    "radiologist", "radiology_technician",
  ]);
  const categories = [
    "patients", "opd", "appointments", "consultations", "prescriptions", "pharmacy",
    "medicine-stock", "laboratory", "radiology", "admissions", "beds", "emergency",
    "billing", "inventory", "staff", "audit", "system-activity",
  ] as const;
  const filtersSchema = z.object({
    category: z.enum(categories),
    from: z.string().date(),
    to: z.string().date(),
    hospitalId: z.string().min(3),
    department: z.string().max(120),
    staff: z.string().max(120),
    patientId: z.string().max(80),
    nic: z.string().max(80),
    gender: z.string().max(40),
    ageGroup: z.string().max(40),
    diagnosis: z.string().max(160),
    status: z.string().max(80),
    ward: z.string().max(120),
    medicine: z.string().max(160),
    testType: z.string().max(160),
    priority: z.string().max(40),
  });
  const input = z.object({
    filters: filtersSchema,
    format: z.enum(["pdf", "csv", "print", "view"]),
    clientRequestId: z.string().uuid().optional(),
  }).parse(request.data);
  const role = String(context.token.role);
  const claimHospitalId = String(context.token.hospitalId ?? "");
  const claimDepartmentId = String(context.token.departmentId ?? "");

  if (role !== "super_admin" && input.filters.hospitalId !== claimHospitalId) {
    throw new HttpsError("permission-denied", "Reports are restricted to your hospital.");
  }
  if (!["super_admin", "hospital_admin"].includes(role)) {
    if (!claimDepartmentId) throw new HttpsError("permission-denied", "A department assignment is required for report access.");
    if (input.filters.department && input.filters.department !== claimDepartmentId) {
      throw new HttpsError("permission-denied", "Reports are restricted to your department.");
    }
    input.filters.department = claimDepartmentId;
  }
  if (input.filters.from > input.filters.to) throw new HttpsError("invalid-argument", "Invalid report date range.");

  const ref = input.clientRequestId
    ? db.collection("reports").doc(`${context.uid}_${input.clientRequestId}`)
    : db.collection("reports").doc();
  await ref.set({
    reportType: input.filters.category,
    filters: input.filters,
    format: input.format,
    hospitalId: input.filters.hospitalId,
    departmentId: input.filters.department || null,
    requestedByRole: role,
    releaseStatus: "internal",
    status: input.format === "view" ? "completed" : "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  }, { merge: true });
  await audit(context.uid, role, input.filters.hospitalId, `report_${input.format}`, "reports", ref.id);
  return { reportId: ref.id, status: input.format === "view" ? "completed" : "pending" };
});

const medicalReportPurposes = [
  "university-clearance", "workplace-fitness", "service-area", "legal-court",
  "insurance", "government-confirmation", "disability-confirmation",
  "treatment-history", "fitness-work-study",
] as const;

export const submitMedicalDecisionRequest = onCall(async (request) => {
  const context = requireRole(request, ["patient"]);
  const input = z.object({
    patientUid: z.string().min(3),
    patientId: z.string().min(3),
    patientName: z.string().min(2).max(160),
    hospitalId: z.string().min(3),
    purpose: z.enum(medicalReportPurposes),
    institutionName: z.string().min(2).max(160),
    institutionType: z.string().min(2).max(80),
    requestedInformation: z.array(z.string().min(2).max(80)).min(1).max(14),
    additionalDetails: z.string().max(600),
    assignedDoctorId: z.string().min(3),
    assignedDoctorName: z.string().min(2).max(160),
    consent: z.object({
      accepted: z.literal(true),
      recipient: z.string().min(2).max(160),
      purpose: z.string().min(2).max(160),
      dataCategories: z.array(z.string()).min(1).max(14),
      acceptedAt: z.string().datetime(),
    }),
    clientRequestId: z.string().uuid().optional(),
  }).parse(request.data);
  if (input.patientUid !== context.uid) throw new HttpsError("permission-denied", "Patients can request reports only for their own account.");
  if (input.hospitalId !== String(context.token.hospitalId ?? "")) throw new HttpsError("permission-denied", "Hospital access mismatch.");
  if (input.patientId !== String(context.token.patientId ?? "")) throw new HttpsError("permission-denied", "Patient identity mismatch.");

  const requestRef = input.clientRequestId
    ? db.collection("medicalDecisionRequests").doc(`${context.uid}_${input.clientRequestId}`)
    : db.collection("medicalDecisionRequests").doc();
  const consentRef = input.clientRequestId
    ? db.collection("medicalConsentRecords").doc(`${context.uid}_${input.clientRequestId}`)
    : db.collection("medicalConsentRecords").doc();
  const batch = db.batch();
  batch.set(consentRef, {
    requestId: requestRef.id,
    patientUid: context.uid,
    patientId: input.patientId,
    hospitalId: input.hospitalId,
    recipient: input.consent.recipient,
    purpose: input.consent.purpose,
    dataCategories: input.consent.dataCategories,
    acceptedAt: input.consent.acceptedAt,
    consentVersion: "medical-decision-v1",
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  batch.set(requestRef, {
    ...input,
    consentRecordId: consentRef.id,
    status: "doctor-review",
    releaseStatus: "internal",
    timeline: [{ action: "Request submitted with consent", actorUid: context.uid, timestamp: new Date().toISOString() }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await batch.commit();
  await audit(context.uid, "patient", input.hospitalId, "medical_report_request", "medicalDecisionRequests", requestRef.id);
  return { requestId: requestRef.id };
});

export const reviewMedicalDecisionRequest = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor", "records_officer"]);
  const input = z.object({
    requestId: z.string().min(3),
    action: z.enum(["save-draft", "approve", "release", "reject"]),
    updates: z.object({
      clinicalSummary: z.string().max(4000).optional(),
      medicalRemarks: z.string().max(4000).optional(),
      recommendations: z.string().max(3000).optional(),
      restrictions: z.string().max(2000).optional(),
      fitnessStatus: z.enum(["fit", "fit-with-restrictions", "temporarily-unfit", "unfit", "not-applicable"]).optional(),
      followUpRequirements: z.string().max(2000).optional(),
      issueDate: z.string().optional(),
      expiryDate: z.string().optional(),
      digitalSignature: z.string().max(300).optional(),
    }),
  }).parse(request.data);
  const requestRef = db.collection("medicalDecisionRequests").doc(input.requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) throw new HttpsError("not-found", "Medical report request not found.");
  const reportRequest = requestSnap.data() ?? {};
  const hospitalId = String(reportRequest.hospitalId ?? "");
  if (String(context.token.role) !== "super_admin" && hospitalId !== String(context.token.hospitalId ?? "")) {
    throw new HttpsError("permission-denied", "Report request belongs to another hospital.");
  }
  if (String(context.token.role) === "doctor" && reportRequest.assignedDoctorId && reportRequest.assignedDoctorId !== context.uid) {
    throw new HttpsError("permission-denied", "This request is assigned to another doctor.");
  }
  if (input.action !== "reject" && input.action !== "save-draft" && (!input.updates.clinicalSummary || !input.updates.medicalRemarks)) {
    throw new HttpsError("failed-precondition", "Clinical summary and medical remarks are required.");
  }

  const reportNumber = String(reportRequest.reportNumber ?? `MDR-${new Date().getUTCFullYear()}-${crypto.randomInt(100000, 1000000)}`);
  const verificationToken = crypto.randomBytes(24).toString("base64url");
  const verificationTokenHash = crypto.createHash("sha256").update(verificationToken).digest("hex");
  const status = input.action === "save-draft" ? "drafted" : input.action === "approve" ? "approved" : input.action === "release" ? "released" : "rejected";
  const update = {
    ...input.updates,
    reportNumber,
    status,
    releaseStatus: input.action === "release" ? "released" : String(reportRequest.releaseStatus ?? "internal"),
    verificationTokenHash: input.action === "release" ? verificationTokenHash : reportRequest.verificationTokenHash ?? null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
    timeline: FieldValue.arrayUnion({
      action: input.action,
      actorUid: context.uid,
      actorRole: String(context.token.role),
      timestamp: new Date().toISOString(),
    }),
  };
  await requestRef.update(update);

  if (input.action === "release") {
    await db.collection("releasedMedicalDecisionReports").doc(reportNumber).set({
      requestId: input.requestId,
      reportNumber,
      patientUid: reportRequest.patientUid,
      patientId: reportRequest.patientId,
      patientName: reportRequest.patientName,
      hospitalId,
      hospitalName: reportRequest.hospitalName ?? "National Hospital of Sri Lanka",
      purpose: reportRequest.purpose,
      doctorId: context.uid,
      doctorName: reportRequest.assignedDoctorName,
      issueDate: input.updates.issueDate ?? new Date().toISOString().slice(0, 10),
      expiryDate: input.updates.expiryDate ?? null,
      digitalSignature: input.updates.digitalSignature ?? String(context.token.name ?? context.uid),
      verificationTokenHash,
      releaseStatus: "released",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.uid,
      updatedBy: context.uid,
    });
  }
  await audit(context.uid, String(context.token.role), hospitalId, `medical_report_${input.action}`, "medicalDecisionRequests", input.requestId);
  return { ok: true, reportNumber, verificationToken: input.action === "release" ? verificationToken : undefined };
});

export const verifyMedicalDecisionReport = onCall(async (request) => {
  const input = z.object({
    reportNumber: z.string().min(6).max(80),
    token: z.string().max(200).optional(),
  }).parse(request.data);
  const reportSnap = await db.collection("releasedMedicalDecisionReports").doc(input.reportNumber).get();
  if (!reportSnap.exists) return { valid: false, message: "No valid released report was found." };
  const report = reportSnap.data() ?? {};
  if (report.status !== "active" || report.releaseStatus !== "released") return { valid: false, message: "This report is not currently valid." };
  if (report.expiryDate && String(report.expiryDate) < new Date().toISOString().slice(0, 10)) return { valid: false, message: "This report has expired." };
  if (input.token) {
    const providedHash = crypto.createHash("sha256").update(input.token).digest("hex");
    if (providedHash !== report.verificationTokenHash) return { valid: false, message: "The verification token is invalid." };
  }
  await db.collection("auditLogs").add({
    actorUid: "external-verifier",
    actorRole: "institution",
    hospitalId: report.hospitalId,
    action: "medical_report_verify",
    collectionName: "releasedMedicalDecisionReports",
    documentId: input.reportNumber,
    timestamp: FieldValue.serverTimestamp(),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "external-verifier",
    updatedBy: "external-verifier",
  });
  return {
    valid: true,
    reportNumber: report.reportNumber,
    patientName: report.patientName,
    issueDate: report.issueDate,
    expiryDate: report.expiryDate ?? null,
    purpose: report.purpose,
    hospital: report.hospitalName,
    doctorName: report.doctorName,
    message: "This report is genuine and currently valid.",
  };
});

export const getPatientReportDownloadUrl = onCall(async (request) => {
  const context = requireRole(request, ["patient"]);
  const input = z.object({ reportId: z.string().min(3) }).parse(request.data);
  const reportSnap = await db.collection("reports").doc(input.reportId).get();
  if (!reportSnap.exists) throw new HttpsError("not-found", "Report not found.");
  const report = reportSnap.data();
  if (report?.patientUid !== context.uid) throw new HttpsError("permission-denied", "Report does not belong to this patient.");
  const released = report?.releaseStatus === "released" || report?.releaseStatus === "approved";
  const ownUpload = report?.createdBy === context.uid || report?.uploadedByRole === "patient";
  if (!released && !ownUpload) throw new HttpsError("permission-denied", "This report has not been released to the patient.");
  if (!report?.storagePath) throw new HttpsError("failed-precondition", "Report file is not ready.");
  const [url] = await getStorage().bucket().file(report.storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000,
  });
  await audit(context.uid, "patient", String(report.hospitalId ?? defaultHospitalId), "export", "reports", input.reportId);
  return { url };
});

export const registerPatientUploadedReport = onCall(async (request) => {
  const context = requireRole(request, ["patient", "doctor", "nurse", "super_admin", "hospital_admin", "lab_technician", "radiologist"]);
  const input = z.object({
    title: z.string().min(2).max(160),
    category: z.enum(["laboratory", "radiology", "discharge", "external", "other"]),
    reportDate: z.string().min(8),
    hospitalId: z.string().min(3),
    patientUid: z.string().min(3),
    patientId: z.string().min(3),
    storagePath: z.string().min(10),
  }).parse(request.data);
  if (context.token.role === "patient" && context.uid !== input.patientUid) {
    throw new HttpsError("permission-denied", "Patients can upload reports only to their own record.");
  }
  const ref = await db.collection("reports").add({
    ...input,
    uploadedByRole: context.token.role,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "reports", ref.id);
  return { reportId: ref.id, storagePath: input.storagePath };
});

export const updateCareSummary = onCall(async (request) => {
  const context = requireRole(request, ["patient", "doctor", "nurse", "super_admin", "hospital_admin"]);
  const input = z.object({
    patientUid: z.string().min(3),
    currentSituation: z.string().max(3000),
    futureTreatments: z.string().max(3000),
  }).parse(request.data);
  if (context.token.role === "patient" && context.uid !== input.patientUid) {
    throw new HttpsError("permission-denied", "Patients can update only their own care summary.");
  }
  const patientRef = db.collection("patients").doc(input.patientUid);
  const payload = context.token.role === "patient"
    ? {
        selfReportedSituation: input.currentSituation,
        futureTreatmentRequests: input.futureTreatments,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: context.uid,
      }
    : {
        currentSituation: input.currentSituation,
        futureTreatments: input.futureTreatments,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: context.uid,
      };
  await patientRef.set(payload, { merge: true });
  await audit(context.uid, String(context.token.role), String(context.token.hospitalId ?? defaultHospitalId), "update", "patients", input.patientUid);
  return { ok: true };
});

export const saveConsultationDraft = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    patientId: z.string().min(3),
    symptoms: z.string().max(3000),
    history: z.string().max(3000),
    exam: z.string().max(3000),
    diagnosis: z.string().max(800),
    soap: z.string().max(6000),
    plan: z.string().max(4000),
  }).parse(request.data);
  const draftId = `${context.uid}_${input.patientId}`;
  await db.collection("consultationDrafts").doc(draftId).set({
    ...input,
    doctorUid: context.uid,
    status: "draft",
    encryptedFields: ["history", "soap", "plan"],
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
  }, { merge: true });
  await audit(context.uid, String(context.token.role), input.hospitalId, "update", "consultationDrafts", draftId);
  return { ok: true };
});

export const submitDoctorApproval = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    patientId: z.string().min(3),
    type: z.string().min(2).max(120),
  }).parse(request.data);
  const ref = await db.collection("doctorApprovals").add({
    ...input,
    doctorUid: context.uid,
    status: "approved",
    approvedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "doctorApprovals", ref.id);
  return { ok: true, approvalId: ref.id };
});

export const startDoctorConsultation = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    patientId: z.string().min(3),
    tokenNo: z.string().min(2),
    reason: z.string().max(500),
  }).parse(request.data);
  const ref = await db.collection("consultations").add({
    ...input,
    doctorUid: context.uid,
    status: "active",
    startedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "consultations", ref.id);
  return { ok: true, consultationId: ref.id };
});

export const createTelemedicineSession = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    patientId: z.string().min(3),
    appointmentId: z.string().min(3),
    channel: z.string().min(2).max(80),
  }).parse(request.data);
  const ref = await db.collection("telemedicineSessions").add({
    ...input,
    doctorUid: context.uid,
    joinUrl: `https://meet.govcare.local/${input.appointmentId}-${Date.now()}`,
    status: "scheduled",
    consentStatus: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "telemedicineSessions", ref.id);
  const snap = await ref.get();
  return { ok: true, sessionId: ref.id, joinUrl: snap.data()?.joinUrl };
});

export const sendSecureChatMessage = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor", "nurse", "patient"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    patientId: z.string().min(3),
    message: z.string().min(1).max(2000),
    threadId: z.string().optional(),
    clientMessageId: z.string().uuid().optional(),
  }).parse(request.data);
  if (context.token.role === "patient" && context.token.patientId !== input.patientId) {
    throw new HttpsError("permission-denied", "Patients can only send messages in their own care thread.");
  }
  if (context.token.hospitalId && context.token.hospitalId !== input.hospitalId) {
    throw new HttpsError("permission-denied", "Cannot send messages outside your hospital.");
  }
  const threadRef = input.threadId ? db.collection("secureChats").doc(input.threadId) : db.collection("secureChats").doc();
  await threadRef.set({
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    ...(context.token.role === "patient" ? {} : { doctorUid: context.uid }),
    patientVisible: true,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: context.uid,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
  }, { merge: true });
  const messageRef = input.clientMessageId
    ? threadRef.collection("messages").doc(input.clientMessageId)
    : threadRef.collection("messages").doc();
  await messageRef.set({
    senderUid: context.uid,
    senderRole: context.token.role,
    body: input.message,
    encrypted: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    status: "active",
  }, { merge: false });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "secureChatMessages", messageRef.id);
  return { ok: true, threadId: threadRef.id };
});

export const sendNotification = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin"]);
  const input = z.object({ token: z.string(), title: z.string(), body: z.string(), hospitalId: z.string() }).parse(request.data);
  await getMessaging().send({ token: input.token, notification: { title: input.title, body: input.body } });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "notifications", "fcm");
  return { ok: true };
});

export const createAdmissionRequest = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor", "receptionist"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    patientId: z.string().min(3),
    patientName: z.string().min(2),
    referralSource: z.enum(["OPD", "Emergency", "Clinic", "Doctor Center"]),
    reason: z.string().min(2).max(800),
    provisionalDiagnosis: z.string().min(2).max(800),
    priority: z.enum(["routine", "urgent", "emergency", "critical"]),
    department: z.string().min(2),
    wardType: z.string().min(2),
    consultant: z.string().min(2),
    bedType: z.string().min(2),
    allergies: z.array(z.string()).default([]),
    chronicDiseases: z.array(z.string()).default([]),
    notes: z.string().max(2000).optional(),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  const ref = await db.collection("admissionRequests").add({
    ...input,
    emergencyStatus: input.priority === "emergency" || input.priority === "critical" || input.referralSource === "Emergency",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "admissionRequests", ref.id);
  return { ok: true, admissionRequestId: ref.id };
});

export const approveAdmissionAndAssignBed = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    admissionRequestId: z.string().min(3),
    wardId: z.string().min(2),
    bedId: z.string().min(2),
  }).parse(request.data);
  if (context.token.role !== "super_admin" && context.token.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Wrong hospital.");
  const result = await db.runTransaction(async (tx) => {
    const requestRef = db.collection("admissionRequests").doc(input.admissionRequestId);
    const bedRef = db.collection("beds").doc(input.bedId);
    const requestSnap = await tx.get(requestRef);
    const bedSnap = await tx.get(bedRef);
    if (!requestSnap.exists) throw new HttpsError("not-found", "Admission request not found.");
    if (!bedSnap.exists) throw new HttpsError("not-found", "Bed not found.");
    const admissionRequest = requestSnap.data() ?? {};
    const bed = bedSnap.data() ?? {};
    if (admissionRequest.hospitalId !== input.hospitalId || bed.hospitalId !== input.hospitalId) throw new HttpsError("permission-denied", "Hospital mismatch.");
    if (bed.status !== "available") throw new HttpsError("failed-precondition", "Selected bed is not available.");
    const counterRef = db.collection("hospitals").doc(input.hospitalId).collection("counters").doc("admissions");
    const counterSnap = await tx.get(counterRef);
    const next = Number(counterSnap.data()?.value ?? 0) + 1;
    const admissionNo = `ADM-${new Date().getUTCFullYear()}-${String(next).padStart(6, "0")}`;
    const admissionRef = db.collection("admissions").doc();
    tx.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(admissionRef, {
      ...admissionRequest,
      admissionRequestId: input.admissionRequestId,
      admissionNo,
      wardId: input.wardId,
      bedId: input.bedId,
      status: "admitted",
      admittedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: context.uid,
      updatedBy: context.uid,
    });
    tx.update(requestRef, { admissionNo, wardId: input.wardId, bedId: input.bedId, status: "admitted", updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid });
    tx.update(bedRef, { status: "occupied", patientId: admissionRequest.patientId, patientName: admissionRequest.patientName, admissionId: admissionRef.id, updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid });
    return { admissionId: admissionRef.id, admissionNo, patientName: String(admissionRequest.patientName ?? "Patient") };
  });
  await db.collection("notifications").add({
    hospitalId: input.hospitalId,
    targetRoles: ["doctor", "nurse"],
    roles: ["doctor", "nurse"],
    title: "Patient admitted",
    message: `${result.patientName} admitted as ${result.admissionNo}.`,
    module: "Admissions",
    priority: "urgent",
    channels: ["in-app", "push"],
    group: "Admissions",
    read: false,
    archived: false,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await audit(context.uid, String(context.token.role), input.hospitalId, "approve", "admissions", result.admissionId);
  return { ok: true, ...result };
});

export const requestWardTransfer = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor", "nurse"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    admissionId: z.string().min(3),
    fromWardId: z.string().min(2),
    toWardId: z.string().min(2),
    reason: z.string().min(2).max(800),
  }).parse(request.data);
  const ref = await db.collection("wardTransfers").add({
    ...input,
    requestedBy: context.uid,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await db.collection("admissions").doc(input.admissionId).set({ status: "transfer-requested", updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid }, { merge: true });
  await audit(context.uid, String(context.token.role), input.hospitalId, "create", "wardTransfers", ref.id);
  return { ok: true, transferId: ref.id };
});

export const completeDischarge = onCall(async (request) => {
  const context = requireRole(request, ["super_admin", "hospital_admin", "doctor"]);
  const input = z.object({
    hospitalId: z.string().min(3),
    admissionId: z.string().min(3),
    bedId: z.string().min(2),
    diagnosis: z.string().min(2).max(800),
    treatmentSummary: z.string().min(2).max(3000),
    followUpPlan: z.string().min(2).max(1200),
    releaseToPatient: z.boolean().default(true),
  }).parse(request.data);
  const ref = await db.collection("dischargeSummaries").add({
    ...input,
    status: "completed",
    releaseStatus: input.releaseToPatient ? "released" : "restricted",
    dischargedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: context.uid,
    updatedBy: context.uid,
  });
  await db.collection("admissions").doc(input.admissionId).set({ status: "discharged", dischargedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid }, { merge: true });
  await db.collection("beds").doc(input.bedId).set({ status: "cleaning", admissionId: null, patientId: null, patientName: null, updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid }, { merge: true });
  await audit(context.uid, String(context.token.role), input.hospitalId, "discharge", "admissions", input.admissionId);
  return { ok: true, dischargeSummaryId: ref.id };
});

export const auditDocumentWrites = onDocumentWritten("{collectionName}/{documentId}", async (event) => {
  if (event.params.collectionName === "auditLogs") return;
  const after = event.data?.after.data();
  const before = event.data?.before.data();
  const data = after ?? before;
  if (!data?.hospitalId) return;
  await db.collection("auditLogs").add({
    actorUid: after?.updatedBy ?? before?.updatedBy ?? "system",
    actorRole: "system",
    hospitalId: data.hospitalId,
    action: after && before ? "update" : after ? "create" : "delete",
    collectionName: event.params.collectionName,
    documentId: event.params.documentId,
    timestamp: FieldValue.serverTimestamp(),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "system",
    updatedBy: "system",
  });
});

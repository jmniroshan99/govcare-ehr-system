import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs");
const outFile = path.join(outDir, "GovCare-EHR-Complete-System-Guide.pdf");
const logoPath = path.join(root, "public", "ministry-health-logo.png");

fs.mkdirSync(outDir, { recursive: true });

const doc = new jsPDF({ unit: "pt", format: "a4" });
const page = {
  width: doc.internal.pageSize.getWidth(),
  height: doc.internal.pageSize.getHeight(),
  margin: 48,
};

const colors = {
  teal: [15, 118, 110],
  tealDark: [17, 94, 89],
  cyan: [21, 94, 117],
  slate: [15, 23, 42],
  muted: [71, 85, 105],
  light: [241, 245, 249],
  line: [203, 213, 225],
  amber: [180, 83, 9],
  rose: [190, 18, 60],
  emerald: [4, 120, 87],
};

let y = page.margin;
let currentSection = "Overview";

function addFooter() {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...colors.line);
    doc.line(page.margin, page.height - 38, page.width - page.margin, page.height - 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text("GovCare EHR System - Complete Learning and Implementation Guide", page.margin, page.height - 22);
    doc.text(`Page ${i} of ${pageCount}`, page.width - page.margin, page.height - 22, { align: "right" });
  }
}

function newPage(section = currentSection) {
  doc.addPage();
  currentSection = section;
  y = page.margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.teal);
  doc.text(section.toUpperCase(), page.margin, 28);
}

function ensureSpace(required, section = currentSection) {
  if (y + required > page.height - 70) newPage(section);
}

function title(text, subtitle) {
  doc.setFillColor(...colors.teal);
  doc.rect(0, 0, page.width, 170, "F");
  if (fs.existsSync(logoPath)) {
    const logo = fs.readFileSync(logoPath).toString("base64");
    doc.addImage(`data:image/png;base64,${logo}`, "PNG", page.margin, 38, 64, 64);
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(text, page.margin + 82, 66);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, page.margin + 82, 88);
  doc.setFontSize(10);
  doc.text("Government Hospital Electronic Health Record platform for Sri Lankan public healthcare workflows.", page.margin + 82, 111);
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(page.margin, 130, page.width - page.margin * 2, 52, 8, 8, "F");
  doc.setTextColor(...colors.tealDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Generated: 2026-06-16 | Stack: React + TypeScript + Firebase + Tailwind + ShadCN-style UI", page.margin + 16, 153);
  doc.setFont("helvetica", "normal");
  doc.text("Purpose: training, implementation reference, security review, and deployment planning.", page.margin + 16, 170);
  y = 220;
}

function h1(text) {
  ensureSpace(54, text);
  currentSection = text;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.slate);
  doc.text(text, page.margin, y);
  y += 10;
  doc.setDrawColor(...colors.teal);
  doc.setLineWidth(2);
  doc.line(page.margin, y, page.margin + 120, y);
  y += 24;
}

function h2(text) {
  ensureSpace(34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...colors.tealDark);
  doc.text(text, page.margin, y);
  y += 18;
}

function paragraph(text, options = {}) {
  const size = options.size ?? 10;
  const leading = options.leading ?? 14;
  const maxWidth = options.width ?? page.width - page.margin * 2;
  const lines = doc.splitTextToSize(text, maxWidth);
  ensureSpace(lines.length * leading + 8);
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...(options.color ?? colors.slate));
  doc.text(lines, page.margin, y);
  y += lines.length * leading + 8;
}

function bullet(items) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colors.slate);
  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, page.width - page.margin * 2 - 18);
    ensureSpace(lines.length * 14 + 5);
    doc.circle(page.margin + 4, y - 3, 2, "F");
    doc.text(lines, page.margin + 16, y);
    y += lines.length * 14 + 5;
  });
  y += 4;
}

function table(head, body, options = {}) {
  ensureSpace(80);
  autoTable(doc, {
    head: [head],
    body,
    startY: y,
    margin: { left: page.margin, right: page.margin },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: options.fontSize ?? 8.5,
      cellPadding: 5,
      lineColor: colors.line,
      lineWidth: 0.4,
      valign: "top",
    },
    headStyles: {
      fillColor: colors.teal,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: options.columnStyles ?? {},
  });
  y = doc.lastAutoTable.finalY + 20;
}

function callout(titleText, bodyText, tone = "info") {
  const color = tone === "danger" ? colors.rose : tone === "warning" ? colors.amber : tone === "success" ? colors.emerald : colors.teal;
  const lines = doc.splitTextToSize(bodyText, page.width - page.margin * 2 - 26);
  ensureSpace(38 + lines.length * 13);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...color);
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, 32 + lines.length * 13, 7, 7, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.text(titleText, page.margin + 13, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.slate);
  doc.text(lines, page.margin + 13, y + 34);
  y += 42 + lines.length * 13;
}

const modules = [
  ["Authentication", "Email/password, optional Google login for patients, OTP verification, role identification, session timeout, Firebase custom claims."],
  ["Patient Management", "Dynamic registration, patient profile, unique Patient ID, adult NIC uniqueness, pediatric guardian support, QR/barcode, duplicate prevention, field policy engine."],
  ["Guardian Management", "Guardian profile, NIC, contact details, relationship type, one-to-many dependent linking, child switching in patient portal, released-record access model."],
  ["OPD Queue", "Reception registration, QR scan lookup, token generation, doctor assignment, queue states, priority sorting, display-board-ready workflow."],
  ["Doctor Center", "Dashboard, queue, consultation workspace, SOAP notes, diagnosis, prescriptions, lab/radiology requests, telemedicine, secure chat, patient checked workflow."],
  ["Nurse Module", "Assigned ward patients, vitals, nursing notes, MAR, IV fluids, assessments, handover, critical alerts, barcode verification."],
  ["Admissions and Wards", "Admission requests, approval, bed allocation, 10-ward/25-bed model, transfer, inpatient notes, discharge summaries, bed status indicators."],
  ["Pharmacy", "Prescription queue, verification, allergy and stock warnings, issue workflow, stock deduction, receipts, PDF/print-ready prescription and pharmacy documents."],
  ["Laboratory LIMS", "Lab request lifecycle, sample tracking, result entry, reference ranges, abnormal/critical alerts, approval workflow, PDF reports, trend comparison."],
  ["Radiology", "X-ray, CT, MRI, ultrasound, ECG/Echo, scheduling, image/report uploads, DICOM-ready viewer concepts, critical reporting, report approval."],
  ["Emergency Department", "Triage levels, live ED dashboard, ambulance arrival, code blue/trauma/stroke/sepsis workflows, one-click urgent lab/radiology/bed/pharmacy requests."],
  ["Appointments", "Patient booking by hospital, department, doctor, type, date, time slot; guardian child booking; QR ticket; digital check-in; reminders."],
  ["Reports and Analytics", "OPD counts, admissions/discharges, medicine stock, lab/radiology statistics, disease analytics, PDF/CSV export."],
  ["Super Admin", "Hospital/user/role/permission management, field configuration, audit logs, Firebase overview, security settings, backup controls."],
  ["Notifications", "In-app and FCM-ready notifications, Facebook-style popup cards, notification center, roles, priority levels, sound/critical modal behavior."],
  ["Multilingual and Theme", "English, Sinhala, Tamil language switching, localStorage preference, light/dark mode, readable contrast and responsive layouts."],
];

const roles = [
  ["Super Admin", "Full platform control across hospitals, roles, users, audit logs, settings, backups, Firebase configuration, and security."],
  ["Hospital Admin", "Hospital-level users, departments, wards, reports, settings, role management, operational dashboards."],
  ["Doctor", "Doctor Center, assigned patients, consultations, prescriptions, lab/radiology requests, released patient information."],
  ["Nurse", "Ward patients, vitals, nursing notes, medication administration, care plans, alerts, shift handover."],
  ["Pharmacist", "Prescription verification, stock management, medicine issuing, substitutes, receipts, stock reports."],
  ["Lab Technician / Pathologist", "Lab requests, sample workflow, result entry, critical result escalation, approval and signatures."],
  ["Radiologist / Technician", "Imaging requests, scheduling, scan status, report upload/approval, image storage and viewing."],
  ["Receptionist", "Patient registration, identification, OPD token creation, appointments, QR/barcode support."],
  ["Records Officer", "Patient records, released documents, reports, audit-oriented record handling."],
  ["Patient / Guardian", "Own released records only; dependents through guardian relationship; appointments, reports, prescriptions, care messages."],
];

const firebaseCollections = [
  "hospitals", "departments", "users", "patients", "guardians", "guardianDependents", "patientFieldConfigurations", "appointments",
  "visits", "opdQueues", "consultations", "prescriptions", "pharmacyQueue", "medicineStock", "medicineIssues", "pharmacyReceipts",
  "labRequests", "labResults", "radiologyRequests", "radiologyReports", "admissionRequests", "admissions", "wards", "beds",
  "inpatientNotes", "wardTransfers", "dischargeSummaries", "emergencyCases", "secureChats", "secureChatThreads", "notifications",
  "emailOtps", "reports", "auditLogs", "futureCarePlans", "operationTheatreCases", "mortuaryCases",
];

const functionsList = [
  ["createUserWithRole", "Admin-created users with Firebase Auth, custom claims, Firestore profile, activation OTP."],
  ["requestEmailOtp / verifyEmailOtp", "Generates hashed OTP records, sends Gmail SMTP/Nodemailer email, validates attempts and expiry."],
  ["resetPasswordWithEmailOtp", "Verifies OTP, updates Firebase Auth password, revokes refresh tokens, sends security notification."],
  ["updatePatientFieldConfiguration", "Admin-only production write path for patient field policies and gender options."],
  ["registerPatientWithGuardian", "Secure patient registration with adult NIC duplicate checks and child guardian linking."],
  ["ensurePatientPortalProfile", "Creates/loads patient portal profile for patient login flows."],
  ["markPatientChecked", "Doctor workflow to complete consultation and move patient from active queue to checked list."],
  ["issuePharmacyReceipt", "Pharmacy issue workflow, receipt generation, stock update hooks, notifications."],
  ["createAdmissionRequest / approveAdmissionAndAssignBed", "Admission workflow and bed assignment transactions."],
  ["sendSecureChatMessage / createTelemedicineSession", "Patient-provider communication and telemedicine session scaffolding."],
  ["generateReport / getPatientReportDownloadUrl", "Report generation metadata and secure signed download URL."],
];

const standards = [
  ["FHIR R4", "Use patient, encounter, observation, medication request, diagnostic report, imaging study, and appointment mapping for future interoperability."],
  ["HL7 v2", "Prepare laboratory/radiology analyzer integration through order/result message structures."],
  ["ICD-10", "Doctor diagnosis coding and reporting analytics should store structured ICD code plus clinician text."],
  ["SNOMED CT-ready", "Clinical terminology fields can later map symptoms, findings, and care plans to controlled terminology."],
  ["LOINC-ready", "Laboratory tests and observations should support standardized test codes and reference ranges."],
  ["DICOM-ready", "Radiology images should store metadata and storage references for DICOM viewer integration."],
  ["WCAG 2.1 AA", "Readable contrast, keyboard navigation, labels, focus states, and screen-reader-friendly controls."],
  ["OWASP ASVS / Top 10", "Prevent XSS, IDOR, privilege escalation, weak auth flows, and insecure direct Firestore access."],
  ["Data minimization", "Patients and guardians see released information only; internal notes and audit/security settings remain staff-only."],
  ["Sri Lanka public hospital context", "OPD, ETU, clinic, ward, laboratory, radiology, pharmacy, records, mortuary, and Ministry of Health workflows."],
];

title("GovCare EHR System", "Complete System Details, Learning Guide, and Implementation Reference");

h1("Executive Summary");
paragraph("GovCare EHR System is a modern government hospital Electronic Health Record web application built with React, TypeScript, Tailwind CSS, ShadCN-style components, Framer Motion, React Router, TanStack Query, Zustand, React Hook Form, Zod, and Firebase services. It is designed for public hospital workflows covering patient registration, OPD, doctor consultations, wards, pharmacy, laboratory, radiology, emergency care, appointments, reports, notifications, administration, and patient portal access.");
callout("Current Development Credentials", "Super Admin demo: admin@govcare.gov.lk / GovCare@123. Doctor demo: doctor@govcare.gov.lk / GovCare@123. Patient demo: patient@govcare.gov.lk / GovCare@123 or Google patient login if Firebase provider is enabled.", "success");
callout("Security Note", "The demo credentials are for development only. Production users must be created by secure Cloud Functions and protected by Firebase Auth, custom claims, App Check, role checks, and audit logs.", "warning");

h1("Technology Stack");
table(["Layer", "Technology", "Purpose"], [
  ["Frontend", "React 19 + Vite + TypeScript", "Fast modular SPA with type safety and modern development workflow."],
  ["UI", "Tailwind CSS, ShadCN-style local components, lucide-react", "Professional responsive hospital interface, accessible controls, icons, cards, tables, forms, dialogs."],
  ["Motion", "Framer Motion", "Smooth transitions, dashboard reveal animations, sidebar expansion, popup notifications."],
  ["Routing", "React Router", "Protected role-based routes for staff, patient, admin, clinical modules."],
  ["State", "Zustand", "Auth/session/profile/theme-local state with lightweight store pattern."],
  ["Forms", "React Hook Form + Zod", "Validated login, password reset, patient registration, profile and clinical forms."],
  ["Caching", "TanStack Query-ready architecture", "Client cache invalidation, pagination, offline-safe read planning, safe optimistic updates."],
  ["Firebase", "Auth, Firestore, Functions, Hosting, FCM, App Check, Storage-ready", "Backend identity, data, secure operations, deployment, notifications, anti-abuse, documents/images."],
  ["PDF/Export", "jsPDF, jspdf-autotable, CSV helpers", "Reports, prescriptions, receipts, learning guides, and analytics exports."],
]);

h1("Core Modules");
table(["Module", "Implemented / Designed Capabilities"], modules, { columnStyles: { 0: { cellWidth: 118 }, 1: { cellWidth: 365 } } });

h1("Role-Based Access Model");
paragraph("Users authenticate through Firebase Authentication. The app identifies the user's Firestore profile and custom claims, verifies account status, and redirects to the correct dashboard. Protected routes prevent users from opening modules outside their role.");
table(["Role", "Access Summary"], roles, { columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 353 } } });

h1("Patient Registration and Profile Management");
h2("Configurable Field Policy Engine");
paragraph("The patient field policy engine allows hospital admins to configure whether each field is visible, hidden, required, optional, or read-only. Policies are stored locally for development and are production-ready through the Firestore collection patientFieldConfigurations/{hospitalId} and the updatePatientFieldConfiguration Cloud Function.");
table(["Field Category", "Examples", "Policy Behavior"], [
  ["Identity", "Patient ID, NIC, passport, birth certificate, title, name, DOB, age, gender", "Patient ID and age are read-only; adult NIC is required by clinical age rule; pediatric birth certificate is required under 16."],
  ["Contact", "Address, district, province, postal code, phone, email, emergency contacts", "Admins can make fields mandatory, hidden, or visible by role."],
  ["Guardian", "Guardian name, relationship, NIC, phone", "Required for children under 16 and linked to guardian/dependent records."],
  ["Medical", "Allergies, chronic diseases, disabilities, immunization, family history, pregnancy status", "Sensitive medical fields can be hidden from patient portal or non-clinical roles."],
  ["Social", "Occupation, employer, smoking, alcohol use, organ donor, insurance, communication preference", "Optional or hidden by hospital policy."],
  ["Gender", "Male, Female, Other, Prefer Not to Say, custom values", "Admins can enable/disable gender and manage custom option lists."],
]);
h2("Adult and Pediatric Rules");
bullet([
  "Adult patients aged 16 or older must provide a valid NIC or passport identifier.",
  "Each NIC must be unique to prevent duplicate patient accounts and unsafe duplicate medical histories.",
  "Children under 16 can be registered without NIC using birth certificate number and guardian details.",
  "Guardian profiles support Father, Mother, Grandparent, Spouse, Sibling, Legal Guardian, or Other relationship types.",
  "One guardian can manage multiple children or dependents from the Patient Portal.",
]);

h1("Guardian Management");
paragraph("Guardian Management links a single guardian profile to many child or dependent patient records. It supports guardian ID, NIC, full name, address, phones, email, emergency contact, relationship, and dependent patient IDs. The patient portal lets guardians switch child context and view released records only.");
table(["Collection", "Purpose", "Access Pattern"], [
  ["guardians", "Guardian identity and contact profile.", "Staff read within hospital; patient/guardian owner read; writes through Cloud Functions."],
  ["guardianDependents", "Relationship document linking guardian to child/dependent.", "Staff and owning guardian can read; writes through Cloud Functions."],
  ["patients", "Child/dependent medical profile with guardianId references.", "Released portal records only for guardian/patient; full access only for authorized staff."],
]);

h1("Firebase Architecture");
h2("Recommended Collections");
paragraph(firebaseCollections.join(", "));
h2("Cloud Functions");
table(["Function", "Purpose"], functionsList, { columnStyles: { 0: { cellWidth: 170 }, 1: { cellWidth: 313 } } });
h2("Emulator and Hosting");
table(["Service", "Local Port / Config", "Notes"], [
  ["Auth Emulator", "127.0.0.1:9099", "Development identity testing."],
  ["Firestore Emulator", "127.0.0.1:8081", "Configured to avoid port 8080 conflict."],
  ["Functions Emulator", "127.0.0.1:5001", "Callable function testing."],
  ["Hosting Emulator", "127.0.0.1:5000", "SPA hosting preview."],
  ["Emulator UI", "127.0.0.1:4000", "View Firestore/Auth/Functions local state."],
  ["Firebase Hosting", "dist", "SPA rewrite to index.html and long-cache static asset headers."],
]);

h1("Security Strategy");
bullet([
  "Firebase Authentication handles passwords; frontend never stores or handles password hashes.",
  "Custom claims store role, hospitalId, departmentId, and patientId where needed.",
  "Firestore rules enforce hospital-level isolation and least privilege.",
  "Cloud Functions are used for sensitive writes such as role creation, OTP, patient registration with guardian, admission approval, pharmacy stock updates, and report approvals.",
  "emailOtps collection is blocked from all direct client access.",
  "Audit logs are append-only for normal users and record create, read, update, delete, export, login, OTP, password reset, and workflow events.",
  "Sensitive medical fields are prepared for AES-256-GCM encryption and role-gated display.",
  "Patient and guardian portal access is limited to released/approved information only.",
  "App Check and rate limiting protect OTP and other callable functions from abuse.",
  "No Firebase Admin SDK credentials are exposed in the frontend.",
]);
table(["Threat", "Mitigation"], [
  ["XSS", "Sanitize user input, avoid unsafe HTML, use React escaping, set hosting security headers."],
  ["CSRF", "Firebase Auth token-based callable functions and same-origin app architecture reduce classic CSRF risk."],
  ["IDOR", "Rules check hospitalId, ownerUid, patientId, guardianUid, releaseStatus, and roles."],
  ["Privilege escalation", "Route guards, custom claims verification, admin-only functions, immutable audit fields."],
  ["Insecure direct Firestore writes", "Sensitive collections deny client writes; Cloud Functions validate and transact."],
  ["OTP abuse", "Hashed OTP, expiry, resend cooldown, failed-attempt limit, blocked status, App Check."],
]);

h1("Password Reset and Email OTP");
paragraph("The system supports Gmail SMTP / Nodemailer OTP emails for account activation, login verification, forgot password, and sensitive action confirmation. If the Gmail OTP function is unavailable during development, the login page falls back to Firebase's native secure password reset link to prevent users from being blocked by raw internal errors.");
table(["Step", "Behavior"], [
  ["Forgot Password", "User enters registered email; callable function checks Auth and active Firestore user profile."],
  ["OTP Generation", "Secure random 6-digit OTP is generated; only HMAC SHA-256 hash is stored."],
  ["Email", "Nodemailer sends branded GovCare HTML email with Ministry logo, multilingual warning, expiry and support contact."],
  ["Verification", "OTP must be pending, unexpired, under attempt limit, and one-time use."],
  ["Reset", "Function updates Firebase Auth password, revokes refresh tokens, marks OTP used, audits event."],
  ["Notification", "Security email and in-app notification warn the user after password reset."],
]);

h1("Data Model Rules");
table(["Document Required Fields", "Description"], [
  ["createdAt / updatedAt", "Server timestamps for lifecycle tracking."],
  ["createdBy / updatedBy", "Actor UID or system actor for auditability."],
  ["hospitalId", "Tenant isolation for all hospital data."],
  ["status", "Active, pending, completed, cancelled, archived, critical, suspended, blocked, etc."],
  ["releaseStatus", "Controls what patients/guardians can see: released/approved only."],
]);

h1("Clinical Workflows");
h2("Doctor Patient Check Workflow");
bullet([
  "Doctor starts consultation from Waiting Patients or OPD queue.",
  "System prevents duplicate consultations and marks the patient Currently Checking.",
  "Doctor records complaint, examination, diagnosis, ICD code, SOAP notes, treatment plan, prescription, lab/radiology requests, referral, and follow-up date.",
  "On save, Firestore transaction creates consultation, audit log, notifications, and updates OPD queue status to Checked, Consulted, or Completed.",
  "Patient moves from active queue to Checked Patients / Completed Consultations list in real time.",
]);
h2("Pharmacy Prescription Verification");
bullet([
  "Doctor-issued e-prescription enters pharmacy queue with patient and prescription details.",
  "Pharmacist verifies patient by patient ID, NIC, QR, phone, OPD token, or admission number.",
  "System displays allergy, duplicate medicine, stock, expiry, dosage, pregnancy/pediatric/renal/liver warnings.",
  "Pharmacist issues available medicines, records unavailable items/substitutes, updates stock, generates receipt and patient portal notification.",
]);
h2("Laboratory and Radiology");
bullet([
  "Doctors create requests from consultation; priority can be Routine, Urgent, STAT, or emergency.",
  "Lab/radiology staff track request, sample/scan status, result entry/upload, approval, critical result escalation, and release to doctor/patient.",
  "Reports are stored with releaseStatus and audit logs for every view, upload, edit, approval, and download.",
]);
h2("Admissions, Wards, Emergency, Surgery, Mortuary");
bullet([
  "Admission requests can originate from OPD, Emergency, Clinic, or Doctor Center.",
  "Admins/admission officers approve and allocate ward/bed using transaction-safe workflow.",
  "Emergency module coordinates triage, ED dashboard, urgent lab/radiology/pharmacy/blood/ICU/OT notifications.",
  "Operation theatre manages scheduling, checklists, anesthesia, intra-op notes, safety checklist, recovery and transfer.",
  "Mortuary handles death registration, JMO/police workflow, storage, release approval and handover records.",
]);

h1("Performance and Caching");
bullet([
  "Use TanStack Query for server state, cache invalidation after writes, and paginated Firestore queries.",
  "Use real-time listeners only for active queues, emergency alerts, bed availability, and secure chat.",
  "Use lazy routes and code splitting for heavy modules such as audit logs and future analytics.",
  "Use indexed queries for hospitalId + status/date/role/priority workflows.",
  "Use localStorage for development-only field configuration, profile overrides, theme/language preferences, and seeded demo data.",
  "Use Firebase Hosting cache headers for immutable static assets and no-cache service workers.",
  "Use PWA/offline read-only design for patient portal and staff reference data where appropriate.",
]);

h1("User Interface and Accessibility");
table(["UI Area", "Design Requirements"], [
  ["Theme", "Readable light/dark mode with strong contrast across cards, dialogs, forms, tables, sidebar, notifications."],
  ["Navigation", "Fixed left sidebar with hover expansion, icon mode, search, groups, badges, keyboard access."],
  ["Notifications", "Top/right popup cards, critical modal alerts, notification center, read/unread/archive filters."],
  ["Forms", "Policy-driven required/optional/read-only/hidden fields with validation and clear errors."],
  ["Mobile", "Responsive cards/tables/forms, patient portal and appointment booking optimized for phones."],
  ["Languages", "English, Sinhala, Tamil switcher in top navigation; selected language saved in localStorage."],
  ["Clinical Speed", "Quick actions, search, filters, status badges, skeleton loaders, and clear empty states."],
]);

h1("Deployment Guide");
table(["Command", "Purpose"], [
  ["npm install", "Install frontend dependencies."],
  ["npm --prefix firebase/functions install", "Install Cloud Functions dependencies."],
  ["npm run dev -- --host 127.0.0.1 --port 5174", "Start local Vite frontend."],
  ["npm run build", "Type-check and build React app into dist."],
  ["npm --prefix firebase/functions run build", "Compile TypeScript Cloud Functions."],
  ["firebase emulators:start --only auth,firestore,functions,hosting,storage", "Run local Firebase Emulator Suite."],
  ["firebase deploy --only firestore:rules,firestore:indexes", "Deploy rules and indexes."],
  ["firebase deploy --only functions", "Deploy Cloud Functions."],
  ["firebase deploy --only hosting", "Deploy React app to Firebase Hosting."],
  ["firebase deploy", "Deploy all configured Firebase resources."],
]);
callout("Required Production Setup", "Enable Email/Password and Google providers in Firebase Auth. Add localhost/127.0.0.1 for development authorized domains. Configure App Check reCAPTCHA v3. Set Gmail SMTP secrets through Firebase Functions secrets or environment configuration. Never commit Admin SDK credentials.", "warning");

h1("Environment Variables");
table(["Variable", "Used By", "Notes"], [
  ["VITE_FIREBASE_API_KEY", "Frontend", "Firebase web config; public but should be environment-managed."],
  ["VITE_FIREBASE_AUTH_DOMAIN", "Frontend", "Firebase Auth domain."],
  ["VITE_FIREBASE_PROJECT_ID", "Frontend/Functions", "Project ID healthapp-462e7 in current setup."],
  ["VITE_FIREBASE_STORAGE_BUCKET", "Frontend", "Storage bucket for reports/images when enabled."],
  ["VITE_FIREBASE_MESSAGING_SENDER_ID", "Frontend/FCM", "Cloud Messaging sender."],
  ["VITE_FIREBASE_APP_ID", "Frontend", "Firebase app ID."],
  ["VITE_FIREBASE_VAPID_KEY", "Frontend/FCM", "Web push certificate key."],
  ["VITE_FIREBASE_APPCHECK_SITE_KEY", "Frontend", "reCAPTCHA v3 App Check site key."],
  ["OTP_PEPPER", "Functions", "HMAC pepper for OTP hashing."],
  ["GMAIL_EMAIL / GMAIL_APP_PASSWORD", "Functions", "Gmail SMTP sender account and app password."],
  ["SMTP_HOST / SMTP_PORT / SMTP_FROM", "Functions", "Email transport configuration."],
]);

h1("Firestore Rules Summary");
bullet([
  "hospitals and departments are hospital-isolated, admin-managed.",
  "users can read own profile; admin can manage via Cloud Functions; selected self profile fields can be updated by permitted roles.",
  "patients can be read by authorized hospital staff, or by owning patient/guardian when portalVisible is true.",
  "guardians and guardianDependents are readable by authorized staff or owning guardian; writes are blocked directly and must use Cloud Functions.",
  "patientFieldConfigurations are readable by signed-in hospital users but writable only through Cloud Functions.",
  "emailOtps cannot be read or written directly by any client.",
  "auditLogs are read by selected admin/records roles and cannot be edited/deleted by normal users.",
]);

h1("Learning Path for Developers");
table(["Step", "What to Learn", "Where to Look"], [
  ["1", "Routing and role guards", "src/routes/AppRouter.tsx, src/lib/rbac.ts, src/lib/accessControl.ts"],
  ["2", "Auth/session flow", "src/services/authService.ts, src/stores/authStore.ts, src/pages/Login.tsx"],
  ["3", "Patient registration and guardian logic", "src/pages/PatientRegistration.tsx, src/utils/patientRegistry.ts"],
  ["4", "Field configuration", "src/utils/patientFieldPolicy.ts, src/pages/PatientFieldConfiguration.tsx"],
  ["5", "Firebase rules", "firebase/firestore.rules"],
  ["6", "Cloud Functions", "firebase/functions/src/index.ts"],
  ["7", "UI shell and sidebar", "src/components/layout/AppShell.tsx, navItems.ts"],
  ["8", "Notifications", "src/utils/notifications.ts, src/components/ui/toast.tsx, src/pages/NotificationCenter.tsx"],
  ["9", "PDF/report patterns", "src/pages/Reports.tsx, src/pages/EPrescription.tsx, scripts/generate-govcare-complete-pdf.mjs"],
]);

h1("Implementation Checklist");
bullet([
  "Create real Firebase users for production and assign custom claims with createUserWithRole.",
  "Deploy updated Firestore rules and indexes before allowing live clinical data.",
  "Configure Gmail SMTP secrets and verify OTP email delivery in Functions logs.",
  "Enable App Check and confirm callable functions are reachable from deployed frontend.",
  "Set up Storage rules and Blaze-plan-compatible storage if storing large reports/images.",
  "Review all role policies with hospital administrators and clinical governance team.",
  "Replace demo seeded data and demo credentials before production deployment.",
  "Run usability tests with reception, doctors, nurses, pharmacy, lab, radiology, and records staff.",
  "Conduct security review for IDOR, data release rules, patient portal visibility, and audit completeness.",
]);

addFooter();
doc.save(outFile);
console.log(`Generated ${outFile}`);

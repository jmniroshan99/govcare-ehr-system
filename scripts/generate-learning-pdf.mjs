import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const outputDir = path.resolve("docs");
const outputFile = path.join(outputDir, "GovCare-EHR-Learning-Guide.pdf");

fs.mkdirSync(outputDir, { recursive: true });

const doc = new jsPDF({ unit: "pt", format: "a4" });
const page = {
  width: doc.internal.pageSize.getWidth(),
  height: doc.internal.pageSize.getHeight(),
  marginX: 54,
  marginTop: 58,
  marginBottom: 54,
};

let y = page.marginTop;
let pageNumber = 1;

const colors = {
  primary: [15, 118, 110],
  secondary: [21, 94, 117],
  text: [31, 41, 55],
  muted: [100, 116, 139],
  light: [240, 253, 250],
  border: [203, 213, 225],
  danger: [190, 18, 60],
};

function footer() {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.muted);
  doc.text("GovCare EHR System Learning Guide", page.marginX, page.height - 28);
  doc.text(`Page ${pageNumber}`, page.width - page.marginX, page.height - 28, { align: "right" });
}

function addPage() {
  footer();
  doc.addPage();
  pageNumber += 1;
  y = page.marginTop;
}

function ensureSpace(height) {
  if (y + height > page.height - page.marginBottom) addPage();
}

function title(text, subtitle) {
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, page.width, 180, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text(text, page.marginX, 78);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, page.marginX, 106, { maxWidth: page.width - page.marginX * 2 });
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(page.marginX, 130, page.width - page.marginX * 2, 74, 8, 8, "F");
  doc.setTextColor(...colors.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Modern React + TypeScript + Firebase EHR blueprint for public hospitals", page.marginX + 18, 158);
  doc.setTextColor(...colors.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated from the local project on ${new Date().toLocaleString("en-LK")}`, page.marginX + 18, 180);
  y = 246;
}

function h1(text) {
  ensureSpace(48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.primary);
  doc.text(text, page.marginX, y);
  y += 22;
  doc.setDrawColor(...colors.border);
  doc.line(page.marginX, y, page.width - page.marginX, y);
  y += 18;
}

function h2(text) {
  ensureSpace(34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...colors.secondary);
  doc.text(text, page.marginX, y);
  y += 18;
}

function p(text, options = {}) {
  const fontSize = options.fontSize ?? 10;
  const lineHeight = options.lineHeight ?? 14;
  const maxWidth = options.maxWidth ?? page.width - page.marginX * 2;
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...(options.color ?? colors.text));
  const lines = doc.splitTextToSize(text, maxWidth);
  ensureSpace(lines.length * lineHeight + 6);
  doc.text(lines, options.x ?? page.marginX, y);
  y += lines.length * lineHeight + 8;
}

function bullets(items) {
  for (const item of items) {
    const lines = doc.splitTextToSize(item, page.width - page.marginX * 2 - 16);
    ensureSpace(lines.length * 13 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.text);
    doc.circle(page.marginX + 3, y - 3, 2, "F");
    doc.text(lines, page.marginX + 14, y);
    y += lines.length * 13 + 5;
  }
  y += 3;
}

function callout(label, text, tone = "primary") {
  const fill = tone === "danger" ? [255, 241, 242] : [240, 253, 250];
  const stroke = tone === "danger" ? [254, 205, 211] : [153, 246, 228];
  const heading = tone === "danger" ? colors.danger : colors.primary;
  const width = page.width - page.marginX * 2;
  const lines = doc.splitTextToSize(text, width - 28);
  const height = 36 + lines.length * 13;
  ensureSpace(height + 10);
  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.roundedRect(page.marginX, y, width, height, 7, 7, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...heading);
  doc.text(label, page.marginX + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.text);
  doc.text(lines, page.marginX + 14, y + 34);
  y += height + 12;
}

function table(head, body, options = {}) {
  ensureSpace(90);
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: options.fontSize ?? 8.5, cellPadding: 5, textColor: colors.text },
    headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: page.marginX, right: page.marginX },
  });
  y = doc.lastAutoTable.finalY + 18;
}

title("GovCare EHR System", "Production-learning PDF covering the Government Hospital EHR project architecture, modules, Firebase backend, role-based workflows, security controls, standards alignment, performance strategy, and deployment path.");

h1("1. Executive Overview");
p("GovCare EHR System is a modern government hospital Electronic Health Record web application built with React, TypeScript, Tailwind CSS, ShadCN-style UI primitives, Framer Motion, React Router, TanStack Query, Zustand, React Hook Form, Zod validation, and Firebase services. It is designed as a learning and implementation blueprint for secure patient records, OPD, wards, pharmacy, diagnostics, emergency care, reporting, and hospital administration.");
callout("Learning Purpose", "This PDF explains how the project is structured and how each module should be understood, extended, secured, and deployed. It is not a legal certification document. Production launch still requires local Ministry of Health approval, privacy impact assessment, clinical safety review, penetration testing, data protection review, and operational governance.");

h2("Core Goals");
bullets([
  "Create a role-based EHR experience for public hospitals with distinct staff and patient portals.",
  "Keep patients limited to their own released health information, appointments, care messages, reports, and profile updates.",
  "Use Firebase Authentication, Firestore, Cloud Functions, Storage, Hosting, Cloud Messaging, App Check, Firestore rules, and Storage rules.",
  "Support multilingual user experience for English, Sinhala, and Tamil through i18next and a visible translate control.",
  "Teach a production-minded architecture: validation, sanitization, audit logs, encryption-ready utilities, hospital-level isolation, secure writes, and least privilege.",
]);

h1("2. Technology Stack");
table(["Layer", "Technology", "Usage in GovCare"], [
  ["Frontend framework", "React.js + Vite", "Fast component development, routing shell, pages, dashboards, and module workspaces."],
  ["Language", "TypeScript", "Typed roles, patient models, component props, services, validations, and safer refactoring."],
  ["Styling", "Tailwind CSS + ShadCN-style primitives", "Professional health dashboard surfaces, cards, tables, inputs, badges, and responsive layouts."],
  ["Motion", "Framer Motion", "Page transitions, reveal animations, and modern but serious clinical UI movement."],
  ["Routing", "React Router", "Protected staff/patient routes and role-based redirects."],
  ["Data fetching/cache", "TanStack Query", "Centralized client caching model for production Firestore calls."],
  ["State", "Zustand", "Authentication profile, role, hospital ID, session timeout state, and local profile overrides."],
  ["Forms", "React Hook Form + Zod", "Validated login and patient registration with typed schemas."],
  ["Charts", "Recharts", "Vitals trends, analytics, workload graphs, reports, and dashboards."],
  ["Firebase client", "Firebase Web SDK", "Auth, Firestore, Functions, Storage, Messaging, App Check, emulator connection."],
  ["Firebase backend", "Cloud Functions + Admin SDK", "Sensitive writes, custom claims, patient profile creation, chat messages, reports, approvals, and audit logs."],
  ["PDF/exports", "jsPDF, jsPDF AutoTable, FileSaver, PapaParse", "Prescription/report downloads, CSV exports, and this generated learning PDF."],
]);

h1("3. Project Structure");
p("The codebase is organized around a scalable EHR frontend with Firebase backend configuration. The important folders are:");
table(["Path", "Responsibility"], [
  ["src/app", "Application providers and global setup."],
  ["src/components", "Reusable layout, motion, patient scanner, and UI primitives."],
  ["src/pages", "Feature pages such as Dashboard, Patient Registration, Doctor Center, Laboratory, Radiology, ED, Wards, Reports, Settings, and Patient Portal."],
  ["src/routes", "Protected routing and role-based access entry points."],
  ["src/services", "Firebase auth, profile, Firestore, and doctor service calls."],
  ["src/stores", "Zustand auth/session store."],
  ["src/types", "EHR domain types including Role, Patient, PatientReport, QueueItem, Medicine, AuditLog."],
  ["src/utils", "Sanitization, encryption, downloads, local demo registries, navigation helpers, and care messages."],
  ["src/validations", "Zod schemas for login and patient data."],
  ["firebase/functions", "Cloud Functions source for secure backend operations."],
  ["firebase/firestore.rules", "Firestore authorization policy."],
  ["firebase/storage.rules", "Storage authorization policy."],
  ["firebase/indexes.json", "Composite indexes for query performance."],
  ["firebase/seed", "Sample hospital, department, patient, and medicine records."],
]);

h1("4. Authentication and Role-Based Access");
p("Authentication is handled by Firebase Auth. The frontend protects routes using the authenticated profile and role, while production authorization must be enforced by Firestore rules and Cloud Functions custom claims.");
table(["Role", "Main Access"], [
  ["Super Admin", "Full platform control, users, roles, settings, reports, audit logs, hospital administration."],
  ["Hospital Admin", "Hospital-scoped administration, departments, users, wards, reports, settings."],
  ["Doctor", "Doctor Center, patient search/profile, consultations, prescriptions, lab/radiology review, care messages."],
  ["Nurse", "Assigned patients, wards, vitals, MAR, nursing notes, care plans, handover, critical alerts."],
  ["Pharmacist", "Prescriptions, medicine issuing, stock updates, substitutions, labels, pharmacy reports."],
  ["Lab Roles", "Lab requests, sample tracking, result entry, approval workflow, LIMS dashboards."],
  ["Radiology Roles", "Imaging requests, scan queue, DICOM-ready image workflow, report upload, signing, release."],
  ["Receptionist", "Patient registration, OPD queue, appointments, check-in, token generation."],
  ["Records Officer", "Patient records, reports, document workflows, selected audit/report access."],
  ["Patient", "Own released profile, appointments, prescriptions, reports, care summary, care messages, documents."],
]);
callout("Important Access Rule", "Patients should only see their own released information. They must not see other patients, doctor private notes, staff schedules, medicine stock, audit logs, security settings, or unreleased diagnostics.");

h1("5. Main EHR Modules");
table(["Module", "Key Functions", "Files to Study"], [
  ["Dashboard", "Hospital KPI cards, patient flow analytics, operational overview.", "src/pages/Dashboard.tsx"],
  ["Patient Registration", "Unique patient ID, duplicate checks, QR/barcode card, demographics, medical background.", "src/pages/PatientRegistration.tsx"],
  ["Patient Profile", "Health summary, QR/barcode identity, timeline, vitals, documents, alerts, downloads.", "src/pages/PatientProfile.tsx"],
  ["Patient Portal", "Own health area, reports, appointments, care messages, profile defaults.", "src/pages/PatientPortal.tsx"],
  ["Doctor Center", "OPD queue, assigned/new patients, telemedicine, secure chat, consultation launch.", "src/pages/DoctorDashboard.tsx"],
  ["Doctor Workspace", "SOAP consultation, diagnosis, clinical summary, approvals.", "src/pages/DoctorWorkspace.tsx"],
  ["Nurse Module", "Vitals, nursing notes, MAR, ward tasks, handover, bedside workflow.", "src/pages/NurseModule.tsx"],
  ["Ward Management", "10 wards, 25 beds each, bed updates, patient assignment, inpatient status.", "src/pages/WardManagement.tsx"],
  ["OPD Queue", "Tokens, queue states, priority sorting, digital ticket, real-time queue model.", "src/pages/OPDQueueManagement.tsx"],
  ["E-Prescription", "Medicine search, warnings, signature, QR, pharmacy flow, PDF output.", "src/pages/EPrescription.tsx"],
  ["Laboratory LIMS", "Departments, specimens, results, critical alerts, approvals, trends, reports.", "src/pages/LaboratoryManagement.tsx"],
  ["Radiology", "X-ray/CT/MRI/US/ECG/Echo requests, viewer tools, reports, critical release.", "src/pages/RadiologyManagement.tsx"],
  ["Emergency Department", "Triage, alerts, ambulance, code pathways, escalation, urgent orders.", "src/pages/EmergencyManagement.tsx"],
  ["Appointments", "Patient booking by hospital, department, doctor, type, date, slot, QR ticket.", "src/pages/PatientAppointments.tsx"],
  ["Care Messages", "Two-way doctor-patient conversation, priority messages, context-linked care.", "src/pages/PatientCommunication.tsx"],
  ["Reports", "Analytics, export-ready tables, hospital reports.", "src/pages/Reports.tsx"],
  ["Admin/User Management", "Roles, permissions matrix, admin privilege learning.", "src/pages/UserManagement.tsx"],
  ["Operation Theatre", "Surgery scheduling, checklist, theatre availability, transfers.", "src/pages/OperationTheatre.tsx"],
  ["Future Care", "Follow-ups, rehab, chronic monitoring, reminders, referrals.", "src/pages/FutureCareWorkflow.tsx"],
  ["Mortuary", "Death registration, confirmation, storage, release, certificates.", "src/pages/MortuaryManagement.tsx"],
]);

h1("6. Patient Management Learning Flow");
bullets([
  "Registration starts with validated demographic and clinical background fields using React Hook Form and Zod.",
  "A unique patient ID and QR/barcode card are generated for identity workflows.",
  "Duplicate detection searches existing demo records and can accept scanner input.",
  "Newly saved demo patients are stored in a local patient registry and immediately shown to doctors.",
  "Production should replace demo local storage with a Cloud Function that creates patients, generates IDs transactionally, validates role, writes audit logs, and returns the patient document ID.",
  "Patient profile gives a longitudinal view: medical summary, alerts, timeline, vitals trends, documents, consent, and download actions.",
]);
callout("Recommended Production Pattern", "Use Cloud Functions for patient creation and patient ID generation. Do not trust a client-generated ID for the canonical record. Keep the client ID as a draft or display-only value until the backend confirms it.");

h1("7. Firebase Backend Design");
table(["Firebase Service", "Project Usage"], [
  ["Authentication", "Email/password staff login, Google patient login, profile creation, custom claims for role/hospital/patient ID."],
  ["Firestore", "Hospital records, patient data, queues, appointments, reports, diagnostics, chats, audit logs."],
  ["Cloud Functions", "Sensitive writes: user creation, claims, patient profile creation, consultation drafts, approvals, chat messages, reports, notifications."],
  ["Storage", "Patient reports, radiology images, lab PDFs, consent forms, uploaded health documents."],
  ["Hosting", "Static Vite build deployment, cache headers, SPA fallback."],
  ["Cloud Messaging", "Notification-ready structure for results, appointments, critical alerts, queue updates."],
  ["App Check", "Protects Firebase resources from unauthorized clients when enforced."],
  ["Security Rules", "Hospital isolation, role checks, patient-only-own-data checks, deny unauthorized writes."],
  ["Emulators", "Local Firestore/UI emulator support for rule testing and development."],
]);

h2("Recommended Firestore Collections");
bullets([
  "hospitals, departments, users, patients, appointments, consultations, prescriptions, medicines, labRequests, labResults, radiologyRequests, radiologyReports",
  "admissions, wards, beds, emergencyCases, notifications, secureChats, auditLogs, visits, opdQueues, patientDocuments, reports",
  "operationTheatreCases, surgeryReports, futureCarePlans, mortuaryCases, mortuaryCertificates, vaccinationRecords, billingRecords",
]);
p("Every operational document should include createdAt, updatedAt, createdBy, updatedBy, hospitalId, and status. These metadata fields support auditability, hospital isolation, query filtering, and lifecycle management.");

h1("8. Security Architecture");
p("Healthcare systems must treat all patient data as sensitive. GovCare demonstrates a zero-trust direction: do not rely on hidden UI alone, require backend authorization, validate inputs, sanitize content, and log sensitive actions.");
table(["Control Area", "Implementation Guidance"], [
  ["Identity", "Firebase Auth, MFA for privileged roles, separate patient/staff account handling, Google sign-in for patient portal where required."],
  ["Authorization", "Custom claims for role, hospitalId, patientId; protected routes; Firestore rules; Cloud Function checks."],
  ["Least privilege", "Nurses cannot prescribe; pharmacists cannot edit diagnoses; patients see only own released records; audit logs are restricted."],
  ["Sensitive writes", "User creation, role assignment, approvals, patient IDs, stock issuing, report release, chat messages via Cloud Functions."],
  ["Data protection", "AES-256-GCM encryption utility for highly sensitive fields; Firebase passwords handled only by Auth."],
  ["Input safety", "Zod validation, DOMPurify-based sanitization utility, controlled form inputs."],
  ["Auditability", "Create/read/update/delete/export/login actions should record actor UID, role, hospital, timestamp, resource, IP/device metadata where possible."],
  ["Session safety", "Zustand session expiry model, auto logout direction, no Admin SDK credentials in frontend."],
  ["App Check", "Initialize App Check with site key and enforce in Firebase console for production."],
  ["Storage", "Rules must restrict reports/images to hospital-scoped roles and patient-owned released documents."],
]);
callout("Do Not Ship With Open Rules", "Rules such as allow read, write: if request.auth != null are not enough for healthcare. Use hospital isolation, role checks, patient ownership checks, release flags, and Cloud Functions for sensitive writes.", "danger");

h1("9. Healthcare Standards and Compliance Mapping");
p("The project should be aligned with recognized healthcare and software security standards. These standards guide design and interoperability, but formal compliance requires policy, governance, documentation, operational evidence, and external assessment.");
table(["Standard / Framework", "Purpose", "How GovCare Should Use It"], [
  ["HL7 FHIR R5", "Healthcare data exchange resources and APIs.", "Map Patient, Encounter, Observation, MedicationRequest, DiagnosticReport, ImagingStudy, Appointment, Communication, CarePlan."],
  ["HL7 CDA / C-CDA", "Structured clinical documents.", "Discharge summaries, referrals, clinical notes, and portable medical summary documents."],
  ["DICOM / DICOMweb", "Medical images and imaging metadata.", "Radiology module image storage, preview, comparison, reports, and future PACS integration."],
  ["ICD-10 / ICD-11", "Disease classification and diagnosis coding.", "Doctor diagnosis fields, reports, disease statistics, analytics, and public health reporting."],
  ["LOINC", "Laboratory and clinical observation codes.", "Lab test catalog, lab result interoperability, trend comparison, diagnostic reports."],
  ["SNOMED CT", "Clinical terminology.", "Structured clinical findings, problem lists, procedures, allergies, and care summaries where licensed."],
  ["ISO 27799 / ISO 27001", "Health information security management.", "Security controls, risk management, access control, incident response, asset management, logging."],
  ["HIPAA Security Rule principles", "Administrative, physical, and technical safeguards for ePHI.", "Use as a security checklist even outside the US: confidentiality, integrity, availability, safeguards, workforce compliance."],
  ["OWASP ASVS 5.0", "Application security verification.", "Authentication, session, access control, validation, API, crypto, logging, file upload, and configuration checks."],
  ["WCAG 2.2", "Accessibility.", "Keyboard navigation, contrast, labels, readable layouts, responsive mobile workflows."],
  ["WHO digital health guidance", "Evidence-based implementation of digital health interventions.", "Equity, acceptability, feasibility, safety, workflow fit, and monitoring of digital health outcomes."],
]);

h1("10. Module-by-Module Implementation Notes");
h2("Doctor Center");
bullets([
  "Shows workload metrics, OPD/emergency queue, assigned patients, newly saved registrations, diagnostics, alerts, schedule, and analytics.",
  "Includes actions for consultation, telemedicine, and secure chat.",
  "Production should source active queue, assigned patients, diagnostics, and messages from hospital-scoped Firestore queries with pagination and limited real-time listeners.",
]);
h2("Nurse Module");
bullets([
  "Focused on ward and bedside workflows: vitals, nursing notes, MAR, IV fluids, wound care, intake/output, risk assessments, handover, and alerts.",
  "Nurse restrictions must be enforced in rules and Cloud Functions: no prescribing, no diagnosis edits, no lab/radiology edits, no admin settings.",
]);
h2("Laboratory LIMS");
bullets([
  "Covers hematology, clinical chemistry, microbiology, serology, histopathology, molecular biology, blood bank, urinalysis, parasitology, virology, toxicology, and endocrinology.",
  "Key workflows include test request, sample collection, barcode/QR labels, result entry, abnormal values, panic alerts, pathologist approval, PDF report generation, and release to doctor/patient.",
]);
h2("Radiology");
bullets([
  "Supports X-ray, CT, MRI, ultrasound, ECG, Echo, portable imaging, scan rooms, equipment availability, queue status, upload/report workflows, and critical alerts.",
  "DICOM support should be integrated with a proper DICOMweb/PACS-compatible service for production rather than storing raw clinical imaging casually in public client paths.",
]);
h2("Emergency Department");
bullets([
  "Triage levels, ambulance arrival, critical dashboard, one-click emergency lab/imaging/pharmacy/blood/ICU/OT actions, and escalation protocols.",
  "Use real-time listeners only for active ED cases, code alerts, bed availability, and urgent status changes.",
]);
h2("Patient Portal and Care Messages");
bullets([
  "Patients can see own profile, released reports, appointments, prescriptions, care summary, documents, and care messages.",
  "Care Messages now supports two-way doctor/patient messaging in local demo storage and calls secure Cloud Functions when available.",
  "Production messages should be encrypted, threaded by patient/visit, audited, and filtered so patients cannot see staff-only communication.",
]);

h1("11. Validation, Sanitization, and Forms");
bullets([
  "Login validation lives in src/validations/auth.ts.",
  "Patient registration validation lives in src/validations/patient.ts.",
  "Sanitization utility lives in src/utils/sanitize.ts and helps reduce XSS risk from user-entered text.",
  "React Hook Form keeps form state efficient and reduces unnecessary renders.",
  "Zod schemas should be mirrored or revalidated in Cloud Functions; never rely only on client validation.",
]);

h1("12. Data Flow Examples");
h2("Patient Registration Flow");
bullets([
  "Reception opens Patient Registration.",
  "Form validates demographics, identity, emergency contact, risk, and clinical background.",
  "QR/barcode scanning can populate search or duplicate-check fields.",
  "Demo app stores patient in local registry and shows the patient to doctors.",
  "Production Cloud Function should generate canonical patientId, create patient document, write audit log, and return the stored record.",
]);
h2("Doctor Consultation Flow");
bullets([
  "Doctor starts from OPD queue, assigned patient, or newly saved patient.",
  "Doctor opens profile and consultation workspace.",
  "SOAP note, diagnosis, treatment plan, prescription, lab/radiology requests, and follow-up are recorded.",
  "Sensitive actions go through Cloud Functions with audit logging.",
]);
h2("Diagnostic Report Flow");
bullets([
  "Doctor requests lab/radiology test.",
  "Technician receives work queue and updates sample/scan status.",
  "Result/report is entered, reviewed, signed, and released.",
  "Doctor receives notification; patient sees only approved/released reports.",
]);

h1("13. Performance and Caching Strategy");
table(["Area", "Recommended Practice"], [
  ["Routes", "Lazy-load large modules and keep initial bundle small."],
  ["Firestore queries", "Use hospitalId + status + date/role filters; add composite indexes for common queries."],
  ["Real-time updates", "Use listeners only for active queues, emergency alerts, bed availability, and chat."],
  ["Search", "Debounce patient, medicine, appointment, and diagnostic searches."],
  ["Tables", "Paginate or virtualize large patient, report, lab, radiology, and audit lists."],
  ["Documents/images", "Compress before upload and use signed or rules-protected Storage paths."],
  ["PWA/offline", "Cache shell and allow read-only offline views for safe patient/staff screens."],
  ["Optimistic updates", "Use only for low-risk actions; avoid for clinical approvals, stock issuing, report signing, and role changes."],
]);

h1("14. Deployment Guide");
bullets([
  "Install dependencies with npm install.",
  "Copy .env.example to .env and set Firebase web configuration values.",
  "Enable Firebase Authentication providers: email/password and Google if patient Google login is required.",
  "Add localhost and 127.0.0.1 to Firebase authorized domains for local testing.",
  "Install function dependencies with npm run functions:install.",
  "Test locally with npm run dev and Firebase emulators where possible.",
  "Build frontend with npm run build.",
  "Build functions with npm run functions:build.",
  "Deploy Firestore rules, indexes, Storage rules, Functions, and Hosting using npm run firebase:deploy or targeted firebase deploy commands.",
  "After deploying Functions that set custom claims, users may need to sign out and sign in again to refresh tokens.",
]);

h1("15. Firebase Emulator Learning Setup");
p("For local Firestore emulator usage, configure firebase.json with a Firestore host and port such as 127.0.0.1:8081 and UI port 4000, then run firebase emulators:start --only firestore. In the frontend, connectFirestoreEmulator(db, '127.0.0.1', 8081) during import.meta.env.DEV.");
callout("Common Emulator Issue", "If port 8080 is taken, use port 8081 in firebase.json and make sure the frontend emulator connection uses the same port.");

h1("16. Security Testing Checklist");
bullets([
  "Verify patients cannot access staff routes by typing staff URLs directly.",
  "Verify patients cannot read another patient's Firestore documents.",
  "Verify doctors cannot access another hospital's records.",
  "Verify nurses cannot edit diagnosis, doctor notes, prescriptions, lab results, radiology reports, users, settings, or audit logs.",
  "Verify pharmacists can issue medicines but cannot change clinical diagnosis.",
  "Verify lab/radiology staff can access only diagnostic workflows and cannot edit unrelated patient data.",
  "Verify audit logs are append-only and not editable by normal users.",
  "Run Firebase emulator rule tests for every role and collection.",
  "Run OWASP ASVS-based checks for authentication, access control, validation, file uploads, error handling, logging, secrets, and configuration.",
  "Review Firebase App Check enforcement, Cloud Function IAM, Storage rules, and Hosting headers.",
]);

h1("17. Current Demo vs Production");
table(["Feature", "Current Demo Behavior", "Production Target"], [
  ["New saved patients", "Stored in browser localStorage and shown to doctors.", "Cloud Function creates Firestore patients with audit logs."],
  ["Care messages", "Shared localStorage thread plus callable attempt.", "Encrypted Firestore secureChats with per-thread patient visibility and message audit logs."],
  ["Patient downloads", "Generated text/PDF-like demo downloads.", "Signed Firebase Storage URLs or backend-generated PDFs with immutable metadata."],
  ["QR/barcode scanning", "Browser BarcodeDetector plus manual fallback.", "Device-tested scanner workflow with camera permissions, fallback, and audit logging."],
  ["Authentication", "Firebase plus demo fallback paths.", "Mandatory Firebase Auth, MFA, custom claims, enforced App Check."],
  ["Clinical data", "Rich UI mock data and local demo persistence.", "Firestore source of truth, clinical terminology tables, indexes, and backend workflows."],
]);

h1("18. Recommended Next Build Steps");
bullets([
  "Replace local demo patient registry with a createPatient Cloud Function.",
  "Create Firestore emulator tests for every role and module.",
  "Add secure message encryption and Firestore listener-based chat threads.",
  "Generate real PDFs for prescriptions, lab reports, radiology reports, discharge summaries, and certificates.",
  "Add FHIR export endpoints for Patient, Encounter, Observation, MedicationRequest, DiagnosticReport, Appointment, Communication, and CarePlan.",
  "Add DICOMweb/PACS integration for radiology image workflows.",
  "Add LOINC/SNOMED/ICD catalog tables and controlled terminology selection.",
  "Add production monitoring, structured logs, error boundaries, and incident response documentation.",
  "Conduct accessibility review, clinical safety review, privacy impact assessment, and penetration test before launch.",
]);

h1("19. Source References Used For Standards Mapping");
bullets([
  "HL7 FHIR R5 official specification: https://hl7.org/fhir/R5/",
  "WHO guideline on digital interventions for health system strengthening: https://www.who.int/publications/i/item/9789241550505",
  "HHS HIPAA Security Rule summary: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html",
  "OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/",
  "ISO 27799 health informatics information security management: https://www.iso.org/standard/62777.html",
  "DICOM standard overview: https://www.dicomstandard.org/",
  "WHO International Classification of Diseases: https://www.who.int/standards/classifications/classification-of-diseases",
]);

footer();
doc.save(outputFile);
console.log(outputFile);

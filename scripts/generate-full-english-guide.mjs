import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const docsDir = path.join(projectRoot, "docs");
const outputFile = path.join(docsDir, "GovCare_EHR_Full_English_Technical_Guide.pdf");
const logoFile = path.join(projectRoot, "public", "ministry-health-logo.png");

fs.mkdirSync(docsDir, { recursive: true });

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const M = 14;

const C = {
  ink: [20, 35, 35],
  muted: [83, 99, 99],
  teal: [0, 128, 112],
  tealDark: [0, 82, 75],
  tealSoft: [226, 247, 243],
  blue: [35, 91, 167],
  amber: [181, 118, 18],
  green: [25, 135, 85],
  red: [180, 50, 58],
  line: [205, 219, 217],
  card: [248, 252, 251],
  white: [255, 255, 255],
};

let pageNo = 1;
let y = 0;

function font(size = 10, style = "normal", color = C.ink) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function footer() {
  doc.setDrawColor(...C.line);
  doc.line(M, H - 13, W - M, H - 13);
  font(7.5, "normal", C.muted);
  doc.text("GovCare EHR System - Full English Technical Guide", M, H - 8);
  doc.text(`Page ${pageNo}`, W - M, H - 8, { align: "right" });
}

function checkSpace(need = 20) {
  if (y + need > H - 18) {
    footer();
    doc.addPage();
    pageNo += 1;
    y = 18;
  }
}

function page(title, subtitle = "") {
  if (pageNo > 1) doc.addPage();
  doc.setFillColor(...C.white);
  doc.rect(0, 0, W, H, "F");
  font(15.2, "bold", C.tealDark);
  doc.text(title, M, 17);
  if (subtitle) {
    font(8.3, "normal", C.muted);
    doc.text(subtitle, M, 23);
  }
  doc.setDrawColor(...C.line);
  doc.line(M, 27, W - M, 27);
  footer();
  y = 36;
  pageNo += 1;
}

function addLogo(x, top, size) {
  if (!fs.existsSync(logoFile)) return;
  const image = fs.readFileSync(logoFile).toString("base64");
  doc.addImage(`data:image/png;base64,${image}`, "PNG", x, top, size, size);
}

function p(text, opts = {}) {
  const width = opts.width ?? W - M * 2;
  const x = opts.x ?? M;
  const size = opts.size ?? 8.8;
  const lineHeight = opts.lineHeight ?? 4.9;
  font(size, opts.style ?? "normal", opts.color ?? C.ink);
  const lines = doc.splitTextToSize(text, width);
  for (const line of lines) {
    checkSpace(lineHeight + 2);
    doc.text(line, x, y);
    y += lineHeight;
  }
  y += opts.after ?? 2;
}

function h(text) {
  checkSpace(11);
  font(11.2, "bold", C.tealDark);
  doc.text(text, M, y);
  y += 7;
}

function bullet(items) {
  font(8.25, "normal", C.ink);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, W - M * 2 - 8);
    checkSpace(lines.length * 4.7 + 3);
    doc.setFillColor(...C.teal);
    doc.circle(M + 2, y - 1.5, 0.9, "F");
    doc.text(lines, M + 7, y);
    y += lines.length * 4.7 + 1.2;
  }
  y += 2;
}

function box(title, text, color = C.teal) {
  const lines = doc.splitTextToSize(text, W - M * 2 - 10);
  const height = Math.max(19, 12 + lines.length * 4.6);
  checkSpace(height + 7);
  doc.setFillColor(...C.tealSoft);
  doc.setDrawColor(...color);
  doc.roundedRect(M, y, W - M * 2, height, 2, 2, "FD");
  font(8.8, "bold", color);
  doc.text(title, M + 5, y + 7);
  font(7.8, "normal", C.ink);
  doc.text(lines, M + 5, y + 13);
  y += height + 6;
}

function table(headers, rows, widths) {
  const rowH = 9.5;
  checkSpace((rows.length + 2) * rowH);
  let x = M;
  doc.setFillColor(...C.tealDark);
  doc.rect(M, y, W - M * 2, rowH, "F");
  font(7.1, "bold", C.white);
  headers.forEach((head, i) => {
    doc.text(head, x + 2, y + 6);
    x += widths[i];
  });
  y += rowH;
  rows.forEach((row, index) => {
    x = M;
    doc.setFillColor(index % 2 === 0 ? 250 : 244, 252, 251);
    doc.setDrawColor(...C.line);
    doc.rect(M, y, W - M * 2, rowH, "FD");
    font(6.75, "normal", C.ink);
    row.forEach((cell, i) => {
      doc.text(doc.splitTextToSize(String(cell), widths[i] - 4).slice(0, 2), x + 2, y + 4.7);
      x += widths[i];
    });
    y += rowH;
  });
  y += 5;
}

function workflow(labels) {
  checkSpace(34);
  const boxW = 31;
  const gap = 5;
  const top = y + 8;
  labels.forEach((label, i) => {
    const x = M + i * (boxW + gap);
    const color = i % 2 === 0 ? C.teal : C.blue;
    doc.setFillColor(i % 2 === 0 ? 226 : 239, i % 2 === 0 ? 247 : 248, i % 2 === 0 ? 243 : 255);
    doc.setDrawColor(...color);
    doc.roundedRect(x, top, boxW, 17, 2, 2, "FD");
    font(6.4, "bold", i % 2 === 0 ? C.tealDark : C.blue);
    doc.text(doc.splitTextToSize(label, boxW - 5), x + boxW / 2, top + 6, { align: "center" });
    if (i < labels.length - 1) {
      doc.setDrawColor(...C.teal);
      doc.line(x + boxW + 1, top + 8.5, x + boxW + gap - 1, top + 8.5);
    }
  });
  y += 35;
}

function cover() {
  doc.setFillColor(4, 93, 83);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(17, 131, 115);
  doc.circle(W - 24, 36, 45, "F");
  doc.setFillColor(0, 71, 66);
  doc.circle(10, H - 24, 55, "F");
  addLogo(M, 23, 32);
  font(23.5, "bold", C.white);
  doc.text("GovCare EHR System", M, 74);
  font(13, "bold", [232, 255, 249]);
  doc.text("Full English Technical Guide", M, 87);
  font(9.8, "normal", [232, 255, 249]);
  doc.text("Electronic Health Record Web Application for Sri Lankan Government Hospitals", M, 99);
  doc.setFillColor(232, 247, 243);
  doc.roundedRect(M, 118, W - M * 2, 60, 4, 4, "F");
  font(10.5, "bold", C.tealDark);
  doc.text("Complete project description for learners and developers", M + 7, 132);
  font(8.3, "normal", C.ink);
  doc.text(
    doc.splitTextToSize(
      "This guide explains the full system vision, technology stack, clinical modules, PostgreSQL database design, Spring Boot document management, security model, role-based access, deployment flow, and development roadmap.",
      W - M * 2 - 14,
    ),
    M + 7,
    144,
  );
  font(8.5, "bold", [235, 255, 249]);
  doc.text("React + TypeScript + Tailwind CSS + Spring Boot + PostgreSQL + PWA", M, H - 20);
  font(7.5, "normal", [220, 245, 239]);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, M, H - 13);
  pageNo += 1;
}

cover();

page("1. Executive Overview", "What GovCare EHR is and why it matters");
p("GovCare EHR System is a modern Electronic Health Record web application designed for Sri Lankan government hospitals. The system digitizes patient registration, OPD queues, consultations, prescriptions, pharmacy dispensing, laboratory requests/results, radiology reports, admissions, ward care, emergency workflows, notifications, reports, documents, and audit logs.");
p("The current project is a frontend-rich React application with a migration path toward a Spring Boot + PostgreSQL backend. The recommended production architecture is React for the user interface, Spring Boot for secure backend APIs, PostgreSQL for structured hospital data, and controlled file storage for documents and images.");
box("Core principle", "The patient record is the central source of truth. All hospital services connect through patientId, hospitalId, visitId, orderId, prescriptionId, and admissionId.");
workflow(["Patient", "Visit", "Doctor", "Orders", "Reports"]);

page("2. Full Technology Stack", "Frontend, backend, database, files, reports, and deployment");
table(
  ["Layer", "Technology", "Purpose"],
  [
    ["Frontend", "React 19 + Vite", "Fast SPA interface for hospital staff and patients"],
    ["Language", "TypeScript", "Typed models, safer services, fewer runtime mistakes"],
    ["UI", "Tailwind CSS + ShadCN-style components", "Responsive professional hospital interface"],
    ["Animation", "Framer Motion", "Smooth transitions, dialogs, dashboards, sidebars"],
    ["Routing", "React Router", "Role-based pages and protected navigation"],
    ["Caching", "TanStack Query", "Client cache, loading states, query invalidation"],
    ["Forms", "React Hook Form + Zod", "Validated clinical/admin forms"],
    ["State", "Zustand", "Local auth/session/theme state"],
    ["Backend", "Spring Boot", "Secure REST APIs, file handling, business rules"],
    ["Database", "PostgreSQL", "Relational clinical data, reports, analytics"],
    ["Files", "Spring-managed storage", "Images, PDFs, scans, reports, receipts"],
    ["PDF", "jsPDF", "Reports, guides, prescriptions, receipts"],
  ],
  [31, 60, 91],
);

page("3. Production Architecture", "Recommended final architecture");
workflow(["React UI", "Spring Boot API", "PostgreSQL", "File Storage", "Audit Logs"]);
p("The frontend should not connect directly to PostgreSQL. The React app sends requests to Spring Boot APIs. Spring Boot validates authentication, roles, hospital isolation, file permissions, and business rules before reading or writing PostgreSQL.");
bullet([
  "React handles dashboards, forms, tables, search, charts, modals, language switching, and dark/light mode.",
  "Spring Boot handles APIs, transactions, document uploads, permission checks, validation, audit logs, and report generation.",
  "PostgreSQL stores structured records such as users, patients, visits, prescriptions, lab results, radiology reports, admissions, notifications, and audit logs.",
  "File storage stores the actual binary files while PostgreSQL stores file metadata, checksum, ownership, visibility, and release status.",
]);

page("4. Authentication and Role-Based Access", "Identity, roles, permissions, and sessions");
p("The system supports staff and patient login. During migration, Firebase Authentication can remain as an optional identity provider, but the production direction can move to Spring Security with JWT tokens. Every API request must include authenticated identity and role context.");
table(
  ["Role", "Main access"],
  [
    ["Super Admin", "All hospitals, system settings, users, roles, reports, audit, backups"],
    ["Hospital Admin", "Hospital users, departments, settings, reports, wards, activity"],
    ["Doctor", "Assigned patients, consultations, prescriptions, lab/radiology orders"],
    ["Nurse", "Ward patients, vitals, MAR, nursing notes, care tasks"],
    ["Pharmacist", "Prescriptions, stock, dispensing, receipts"],
    ["Lab Technician", "Lab requests, samples, result entry"],
    ["Radiologist", "Imaging requests, reports, findings, approvals"],
    ["Receptionist", "Registration, OPD queue, appointments"],
    ["Patient/Guardian", "Own released records, appointments, messages, reports"],
  ],
  [43, 139],
);
box("Access rule", "Patients must only see their own released records. Staff must only see records allowed by role, hospital, department, and clinical assignment.");

page("5. Patient Management", "Registration, identity, guardian management, and profiles");
bullet([
  "Adult registration supports NIC/passport validation and duplicate prevention.",
  "Pediatric registration supports birth certificate number and guardian/parent details.",
  "Children under 16 should require guardian details for appointments and portal access.",
  "Patient profiles contain demographics, gender, blood group, allergies, chronic diseases, disabilities, family history, emergency contacts, language preference, and profile photo.",
  "QR/barcode patient identification supports fast retrieval during OPD, emergency, pharmacy, lab, radiology, admissions, and ward workflows.",
  "Field policy configuration allows admins to mark fields visible, hidden, required, optional, or read-only based on hospital policy.",
]);
workflow(["Register", "Validate", "Create ID", "QR Card", "Profile"]);

page("6. OPD Queue Management", "Reception workflow and token handling");
p("The OPD module connects reception, patient management, appointments, doctor center, billing/service records, and reports. Reception staff search or scan a patient, create a visit, assign a department/doctor, generate a token, and place the patient into the queue.");
bullet([
  "Queue statuses include waiting, called, in-consultation, completed, skipped, transferred, cancelled, and emergency priority.",
  "Smart sorting can consider arrival time, appointment time, priority, age, disability, pregnancy, emergency severity, and doctor availability.",
  "After the doctor completes consultation, the patient is removed from active queue and moved to checked/completed consultations.",
  "Queue data should use low-latency updates only for active queues, not every historical record.",
]);

page("7. Doctor Center and Consultation", "Clinical workspace");
p("Doctor Center is the main clinical workspace. It provides OPD queue, assigned patients, admitted patients, emergency alerts, pending lab and radiology results, telemedicine, secure chat, prescriptions, care summary, follow-up reminders, and analytics.");
bullet([
  "Consultation supports chief complaint, history, examination findings, diagnosis, ICD-10 code, SOAP notes, treatment plan, prescription, lab request, radiology request, referral, follow-up date, and notes.",
  "Smart clinical tools can include allergy alerts, abnormal findings, duplicate medication warnings, pregnancy/renal alerts, drug interactions, clinical templates, and AI-ready summaries.",
  "Doctor actions must create audit logs and update linked records such as visits, prescriptions, lab orders, radiology orders, admissions, and notifications.",
]);

page("8. Nurse Module and Ward Management", "Bedside care, tasks, and patient safety");
bullet([
  "Nurses can view assigned ward patients, record vital signs, create nursing notes, maintain care plans, manage MAR, document IV fluids, wound care, intake/output, glucose checks, fall risk, pressure ulcer risk, and shift handover.",
  "Nurses cannot edit doctor diagnosis, prescribe medicines, modify lab/radiology reports, manage users, or access admin security settings.",
  "Ward allocation follows patient classification: male wards, female wards, and children wards. Children under 10 should be routed to children wards unless authorized staff override.",
  "Assigned beds should be highlighted clearly with occupancy, patient, ward, bed type, and status.",
]);
table(
  ["Enhancement", "Description", "Value"],
  [
    ["BCMA", "Scan patient QR wristband and medicine barcode", "Prevents medication errors"],
    ["Predictive alerts", "Analyze vitals and notes for deterioration/fall/sepsis risk", "Proactive nursing care"],
    ["Task board", "Assign tasks by shift and workload", "Reduces missed tasks and burnout"],
  ],
  [36, 86, 60],
);

page("9. E-Prescription and Pharmacy", "Medication lifecycle");
workflow(["Doctor signs Rx", "Pharmacy Queue", "Verify", "Issue Stock", "Receipt"]);
bullet([
  "Doctors create structured prescriptions with medicine, generic name, dosage, route, frequency, duration, quantity, instructions, warnings, and digital signature.",
  "Pharmacists verify patient identity, allergy warnings, duplicate medicines, dosage safety, prescription validity, stock availability, and expiry alerts.",
  "Dispensing supports full issue, partial issue, unavailable medicine marking, approved substitution, stock deduction, receipt generation, and patient portal release.",
  "Pharmacy transactions should be transaction-safe in PostgreSQL to avoid stock mismatch.",
]);

page("10. Laboratory Information System", "Requests, samples, results, and approvals");
bullet([
  "Laboratory supports hematology, clinical chemistry, microbiology, serology, immunology, histopathology, molecular biology, blood bank, urinalysis, parasitology, virology, toxicology, and endocrinology.",
  "Workflow includes request creation, barcode/QR sample labeling, collection, transport, receipt, processing, result entry, reference range validation, abnormal/critical classification, pathologist approval, report release, and notifications.",
  "Doctors can view current and historical lab results with trend charts. Patients can only view approved and released reports.",
  "Critical results should trigger urgent alerts to the responsible doctor and care team.",
]);

page("11. Radiology Module", "Imaging requests and reports");
bullet([
  "Radiology supports X-ray, CT, MRI, ultrasound, ECG, echo, and portable imaging requests.",
  "Staff can prioritize urgent cases, schedule scan appointments, update scan status, upload images/PDF reports, add findings, mark normal/abnormal/critical, and notify doctors.",
  "Future support can include DICOM viewing, zoom, rotate, brightness/contrast, comparison with previous scans, radiation exposure tracking, digital signature, and QR verification.",
  "Approved reports can be linked to patient profile and released to patient portal with limited access controls.",
]);

page("12. Emergency Department", "Fast critical care coordination");
p("The Emergency Department module manages triage, ambulance arrivals, emergency alerts, urgent orders, critical patient tracking, available beds, and escalation to doctors, nurses, lab, radiology, pharmacy, blood bank, ICU, and operating theatre.");
bullet([
  "Triage levels classify patients by severity and guide queue priority.",
  "One-click emergency lab, radiology, pharmacy, blood request, admission, and ICU transfer actions reduce delay.",
  "Emergency workflows must support real-time status tracking and low-latency updates for critical cases.",
  "Every emergency view, order, transfer, or release should be audited.",
]);

page("13. Admissions, Wards, Theatre, Future Care, Mortuary", "Extended hospital workflows");
bullet([
  "Admissions cover requests from OPD, emergency, and clinics, approval, ward assignment, bed allocation, admission number, inpatient profile, transfers, discharge, and follow-up.",
  "Operation Theatre supports surgery scheduling, theatre availability, surgeon/anesthetist/nurse assignment, consent, anesthesia notes, safety checklist, intra-operative notes, implants/instruments, blood integration, recovery, and surgery reports.",
  "Future Care supports follow-up schedules, rehabilitation plans, repeat investigations, referral plans, chronic monitoring, vaccination reminders, long-term medication reviews, and patient reminders.",
  "Mortuary management supports death registration, doctor confirmation, body identification, next-of-kin, police/JMO workflow, post-mortem request, body storage, release approval, certificates, and audit logs.",
]);

page("14. Patient Portal and Communication", "Patient-centered digital access");
bullet([
  "Patients can view personal profile, appointments, released prescriptions, approved lab results, approved radiology reports, discharge summaries, vaccination records, bills/service records, health documents, and secure messages.",
  "Patients must not access other patient data, doctor private notes, internal staff communication, audit logs, stock details, admin dashboards, unreleased reports, or internal emergency notes unless released.",
  "Care messaging can support text, voice notes, images, documents, telemedicine, medication reminders, symptom reporting, pain/mood tracking, questionnaires, suggested replies, summaries, and tasks.",
]);
box("Release model", "Patients can view released information only. Doctors/admins control what becomes visible to the patient.");

page("15. Documents, Images, and Media Management", "Spring Boot + PostgreSQL direction");
p("All documents, images, lab PDFs, radiology files, profile photos, emergency images, prescriptions, discharge cards, certificates, and receipts should be managed through Spring Boot APIs. PostgreSQL stores metadata while the actual files are saved in controlled storage.");
table(
  ["Metadata field", "Purpose"],
  [
    ["hospitalId", "Tenant isolation and ownership"],
    ["patientId", "Links file to patient profile"],
    ["uploadedBy / uploaderRole", "Tracks who uploaded the file"],
    ["module", "Identifies source module such as lab, radiology, ward, profile"],
    ["filePath / fileUrl", "Download path controlled by backend"],
    ["mimeType / fileSize", "Validation and display"],
    ["sha256Checksum", "File integrity verification"],
    ["visibilityLevel / releaseStatus", "Private, care team, admin-only, or patient released"],
  ],
  [55, 127],
);
box("Best practice", "Do not store large binary files directly inside PostgreSQL rows. Store files in managed storage and store searchable metadata in PostgreSQL.");

page("16. PostgreSQL Database Design", "Core relational structure");
bullet([
  "hospitals and departments define multi-hospital tenancy.",
  "app_users stores staff and patient account profiles, roles, permissions, and status.",
  "patients and guardians store identity, demographics, clinical summary fields, and family/dependent relationships.",
  "visits and opd_queue connect registration, reception, queue, doctors, and reports.",
  "consultations, prescriptions, lab_requests, lab_results, radiology_requests, radiology_reports, admissions, wards, beds, appointments, notifications, global_media, login_activities, audit_logs, and system_settings cover the major workflows.",
  "Indexes are needed for hospitalId, patientId, status, createdAt, queue status, report filters, and login/audit reports.",
]);

page("17. Security Architecture", "Hospital-grade protection model");
bullet([
  "Authenticate every user and validate the account status before dashboard access.",
  "Enforce least privilege through role-based access checks in Spring Boot middleware/services.",
  "Use hospitalId isolation in every query so users cannot cross hospital boundaries.",
  "Use patient-only released record access for patient portal endpoints.",
  "Audit create, update, delete, approve, export, upload, download, login, logout, failed login, and sensitive reads.",
  "Validate and sanitize all inputs using backend validation rules.",
  "Use HTTPS, secure headers, secure cookies/JWTs, password policy, MFA/OTP for sensitive actions, and strong backup procedures.",
]);
box("Security tests", "Test IDOR, privilege escalation, direct API calls, unauthorized file downloads, patient-to-patient access, role bypassing, and unsafe report export.");

page("18. Reports and Analytics", "Administrative intelligence");
bullet([
  "Admin reports include patient registration, OPD queue, appointments, consultations, prescriptions, pharmacy dispensing, medicine stock, lab tests, radiology reports, ward admissions, bed occupancy, emergency triage, billing, inventory, staff activity, audit logs, login activity, notifications, and system usage.",
  "Filters include date range, hospital, department, doctor, nurse, pharmacist, lab technician, patient ID, NIC, gender, age group, diagnosis, visit type, status, ward, bed, medicine, test type, radiology type, emergency priority, payment status, user role, and report status.",
  "Reports should support PDF, CSV, Excel, print, charts, trends, monthly comparisons, summary cards, pagination, and background generation for heavy datasets.",
]);

page("19. Offline, Performance, and User Experience", "Fast and readable hospital workflows");
bullet([
  "Use lazy loading and code splitting for route-level pages.",
  "Use TanStack Query caching and invalidation for repeat reads.",
  "Use pagination, debounced search, indexed database queries, and server-side filters for large datasets.",
  "Use real-time updates only for critical workflows such as queues, emergency alerts, bed availability, chat, and urgent notifications.",
  "Use dark/light mode with strong contrast, readable tables, accessible forms, clear errors, loading skeletons, toast notifications, and responsive patient portal screens.",
  "Offline mode should support cached read-only access and safe queued actions where clinically acceptable.",
]);

page("20. Deployment and Testing Plan", "How to move toward production");
bullet([
  "Install PostgreSQL, create govcare_ehr database, apply schema.sql and seed.sql.",
  "Install Maven and run Spring Boot API from spring-api.",
  "Run React frontend with npm run dev -- --host 127.0.0.1.",
  "Set VITE_API_BASE_URL and VITE_MEDIA_API_BASE_URL in .env.",
  "Run npm run build to verify frontend production build.",
  "Run Spring Boot tests and build with mvn test and mvn package.",
  "Test all roles, patient-only access, document upload/download, report release, queue flow, prescription-to-pharmacy, lab/radiology release, admission/bed allocation, and audit logs.",
  "Before real deployment, enable HTTPS, production database backups, storage backups, monitoring, logging, role reviews, and security testing.",
]);

page("21. Development Roadmap", "Recommended build order");
table(
  ["Phase", "Focus", "Deliverables"],
  [
    ["MVP", "Core hospital workflows", "Login, patients, OPD, consultation, prescription, pharmacy, lab basics, reports, audit"],
    ["Phase 2", "Inpatient and diagnostics", "Admissions, wards, radiology, advanced lab, patient portal, media service"],
    ["Phase 3", "Enterprise intelligence", "AI-ready summaries, advanced analytics, HL7/FHIR, analyzer integration, predictive alerts"],
  ],
  [28, 55, 99],
);
box("Final conclusion", "GovCare EHR combines clinical workflow design, modern frontend engineering, Spring Boot backend APIs, PostgreSQL relational data, secure document management, and hospital-grade access control into a scalable learning and development project.", C.green);

doc.save(outputFile);
console.log(outputFile);

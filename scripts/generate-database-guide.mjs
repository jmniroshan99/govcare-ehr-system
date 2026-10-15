import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const docsDir = path.join(projectRoot, "docs");
const outputFile = path.join(docsDir, "GovCare_EHR_Database_Understanding_Guide.pdf");
const logoFile = path.join(projectRoot, "public", "ministry-health-logo.png");

fs.mkdirSync(docsDir, { recursive: true });

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const M = 14;
let pageNo = 1;
let y = 0;

const C = {
  ink: [21, 34, 34],
  muted: [84, 100, 100],
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

function font(size = 10, style = "normal", color = C.ink) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function addLogo(x, top, size) {
  if (!fs.existsSync(logoFile)) return;
  const image = fs.readFileSync(logoFile).toString("base64");
  doc.addImage(`data:image/png;base64,${image}`, "PNG", x, top, size, size);
}

function footer() {
  doc.setDrawColor(...C.line);
  doc.line(M, H - 13, W - M, H - 13);
  font(7.5, "normal", C.muted);
  doc.text("GovCare EHR - Database Understanding Guide", M, H - 8);
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

function bullets(items) {
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
  const rowH = 9.7;
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
    font(6.7, "normal", C.ink);
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
    font(6.4, "bold", color);
    doc.text(doc.splitTextToSize(label, boxW - 5), x + boxW / 2, top + 6, { align: "center" });
    if (i < labels.length - 1) {
      doc.setDrawColor(...C.teal);
      doc.line(x + boxW + 1, top + 8.5, x + boxW + gap - 1, top + 8.5);
    }
  });
  y += 35;
}

function relationshipDiagram() {
  checkSpace(72);
  const cx = W / 2;
  const cy = y + 32;
  doc.setFillColor(255, 249, 235);
  doc.setDrawColor(...C.amber);
  doc.roundedRect(cx - 24, cy - 10, 48, 20, 2, 2, "FD");
  font(8.2, "bold", C.amber);
  doc.text("patients", cx, cy - 1, { align: "center" });
  font(6.3, "normal", C.ink);
  doc.text("central table", cx, cy + 5, { align: "center" });

  const nodes = [
    ["visits", 28, cy - 24],
    ["consultations", 72, cy - 39],
    ["prescriptions", 116, cy - 39],
    ["lab_results", 160, cy - 24],
    ["radiology", 160, cy + 22],
    ["admissions", 116, cy + 39],
    ["global_media", 72, cy + 39],
    ["appointments", 28, cy + 22],
  ];
  nodes.forEach(([label, x, ny]) => {
    doc.setDrawColor(...C.line);
    doc.line(cx, cy, x, ny);
    doc.setFillColor(...C.card);
    doc.roundedRect(x - 19, ny - 7, 38, 14, 2, 2, "FD");
    font(6.6, "bold", C.tealDark);
    doc.text(label, x, ny + 2, { align: "center" });
  });
  y += 72;
}

function cover() {
  doc.setFillColor(4, 93, 83);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(17, 131, 115);
  doc.circle(W - 24, 36, 45, "F");
  addLogo(M, 23, 32);
  font(23, "bold", C.white);
  doc.text("GovCare EHR System", M, 74);
  font(13, "bold", [232, 255, 249]);
  doc.text("Database Understanding Guide", M, 87);
  font(9.8, "normal", [232, 255, 249]);
  doc.text("PostgreSQL architecture for learners and developers", M, 99);
  doc.setFillColor(232, 247, 243);
  doc.roundedRect(M, 118, W - M * 2, 57, 4, 4, "F");
  font(10.5, "bold", C.tealDark);
  doc.text("Easy explanation of how the EHR database is built", M + 7, 132);
  font(8.2, "normal", C.ink);
  doc.text(doc.splitTextToSize("This PDF explains the GovCare EHR PostgreSQL database in a simple way: main tables, relationships, patient-centered design, file metadata, role access, audit logs, indexes, and how hospital modules connect.", W - M * 2 - 14), M + 7, 144);
  font(8.5, "bold", [235, 255, 249]);
  doc.text("Spring Boot API + PostgreSQL Database + Controlled File Storage", M, H - 20);
  font(7.5, "normal", [220, 245, 239]);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, M, H - 13);
  pageNo += 1;
}

cover();

page("1. Database Big Picture", "What the database does");
p("The GovCare EHR database stores structured hospital information. It is designed for a multi-hospital environment, so almost every operational table contains hospital_id. This keeps one hospital's data separated from another hospital's data.");
p("The central clinical table is patients. Most hospital workflows start from a patient record and connect to visits, consultations, prescriptions, laboratory, radiology, admissions, appointments, media files, and audit logs.");
box("Simple rule", "Think of patients as the center of the database. Every clinical module connects back to patients.id.");
workflow(["Hospital", "Patient", "Visit", "Orders", "Reports"]);

page("2. Main Database Layers", "How tables are grouped");
table(
  ["Layer", "Tables", "Purpose"],
  [
    ["Hospital setup", "hospitals, departments, system_settings", "Defines hospitals, departments, and configuration"],
    ["Identity", "app_users, guardians, patients", "Stores staff, patients, guardians, roles, and profiles"],
    ["Clinical flow", "visits, opd_queue, consultations", "Handles OPD, doctor work, and visit status"],
    ["Treatment", "prescriptions, prescription_items, medicines, pharmacy_stock, pharmacy_receipts", "Controls medication lifecycle"],
    ["Diagnostics", "lab_requests, lab_results, radiology_requests, radiology_reports", "Stores lab and imaging workflow"],
    ["Inpatient", "wards, beds, admissions", "Handles ward admission and bed allocation"],
    ["Governance", "notifications, login_activities, audit_logs", "Tracks alerts, login history, and system actions"],
    ["Files", "global_media", "Stores metadata for images, reports, scans, and documents"],
  ],
  [34, 74, 74],
);

page("3. Patient-Centered Architecture", "The most important relationship");
relationshipDiagram();
p("The patient table is connected to the major hospital functions. This means a doctor, nurse, pharmacist, laboratory technician, radiologist, receptionist, and patient portal can all refer to the same patient identity.");
bullets([
  "visits.patient_id connects OPD/clinic/emergency visits to a patient.",
  "consultations.patient_id connects doctor notes to a patient.",
  "prescriptions.patient_id connects medicines to a patient.",
  "lab_results.patient_id and radiology_reports.patient_id connect approved reports.",
  "admissions.patient_id connects ward and bed information.",
  "global_media.patient_id connects documents, photos, scans, and PDFs.",
]);

page("4. Hospital and User Tables", "Multi-hospital and role structure");
table(
  ["Table", "Important columns", "Meaning"],
  [
    ["hospitals", "id, code, name, city, district, province, settings, status", "Main tenant/branch table"],
    ["departments", "hospital_id, code, name, type, floor, head_user_id, status", "Hospital sections such as OPD, Lab, Radiology"],
    ["app_users", "auth_uid, hospital_id, department_id, role, email, permissions, status", "Staff/patient login profile"],
    ["system_settings", "hospital_id, key, category, value, is_public, status", "Hospital-specific settings"],
  ],
  [35, 86, 61],
);
box("Why hospital_id matters", "hospital_id is the tenant boundary. Every user and record should be filtered by hospital_id to prevent cross-hospital data leaks.", C.green);

page("5. Patient and Guardian Tables", "Identity and family/dependent model");
table(
  ["Table", "Columns", "Purpose"],
  [
    ["patients", "patient_no, guardian_id, nic, passport_no, birth_certificate_no, full_name, date_of_birth, gender, allergies", "Main patient record"],
    ["guardians", "guardian_no, nic, full_name, relationship, address, phone, email, dependent links through patients.guardian_id", "Parent/guardian account model"],
  ],
  [35, 91, 56],
);
bullets([
  "Adult patients should have NIC or passport validation.",
  "Children can use birth certificate number and guardian_id.",
  "A guardian can be linked to multiple patients.",
  "Duplicate prevention uses hospital_id + NIC/passport/birth certificate uniqueness.",
]);

page("6. OPD and Consultation Flow", "From reception to doctor");
workflow(["patients", "visits", "opd_queue", "consultations", "audit_logs"]);
table(
  ["Table", "Stores", "Example status"],
  [
    ["visits", "visit_no, visit_type, reason, doctor_id, department_id, priority", "pending, completed"],
    ["opd_queue", "token_no, queue_status, estimated_wait_minutes, called_at", "waiting, called, completed"],
    ["consultations", "chief_complaint, diagnosis, soap_notes, treatment_plan", "completed, released/internal"],
  ],
  [35, 95, 52],
);
p("When a patient comes to OPD, the system creates a visit, adds a queue row, and later stores consultation details from the doctor.");

page("7. Prescription and Pharmacy Tables", "Medication workflow");
workflow(["consultation", "prescription", "items", "stock", "receipt"]);
table(
  ["Table", "Main columns", "Purpose"],
  [
    ["prescriptions", "prescription_no, diagnosis, doctor_id, pharmacy_status, release_status", "Prescription header"],
    ["prescription_items", "medicine_name, dosage, route, frequency, duration, quantity", "Medicine line items"],
    ["medicines", "name, generic_name, category, dosage_form, strength, reorder_level", "Medicine catalogue"],
    ["pharmacy_stock", "medicine_id, batch_no, quantity, expiry_date, location, supplier", "Stock batches"],
    ["pharmacy_receipts", "prescription_id, pharmacist_id, receipt_no, issued_items", "Dispensing receipt"],
  ],
  [37, 88, 57],
);
box("Transaction rule", "Medicine issuing and stock deduction should happen inside a database transaction, so stock cannot become incorrect.", C.amber);

page("8. Laboratory and Radiology Tables", "Diagnostic workflow");
table(
  ["Workflow", "Request table", "Result/report table"],
  [
    ["Laboratory", "lab_requests: test_type, priority, clinical_reason, sample_status, test_status", "lab_results: result_data, classification, report_url, release_status"],
    ["Radiology", "radiology_requests: imaging_type, priority, clinical_reason, scan_status, scheduled_at", "radiology_reports: findings, impression, image_urls, report_url, release_status"],
  ],
  [36, 73, 73],
);
bullets([
  "Requests are created by doctors or emergency staff.",
  "Results/reports are entered by lab/radiology staff.",
  "Doctors review approved results.",
  "Patients only see reports with release_status = released.",
]);

page("9. Admissions, Wards, and Beds", "Inpatient architecture");
workflow(["admission", "ward", "bed", "care", "discharge"]);
table(
  ["Table", "Columns", "Purpose"],
  [
    ["wards", "ward_no, name, category, floor, capacity, nurse_station, status", "Ward structure"],
    ["beds", "ward_id, bed_no, bed_type, room_no, status, current_patient_id", "Bed availability and allocation"],
    ["admissions", "admission_no, patient_id, ward_id, bed_id, consultant_id, admitted_at, discharged_at", "Inpatient stay"],
  ],
  [36, 92, 54],
);
box("Ward policy", "Children, male patients, and female patients can be routed to appropriate ward categories using age and gender data from patients.", C.green);

page("10. Documents and Images", "global_media table");
p("The global_media table stores metadata for all uploaded files. The actual file is saved by Spring Boot in controlled storage. PostgreSQL stores who uploaded it, what module it belongs to, which patient it is linked to, and whether the patient can see it.");
table(
  ["Column", "Meaning"],
  [
    ["hospital_id", "Which hospital owns the file"],
    ["patient_id", "Which patient the file belongs to"],
    ["uploaded_by / uploader_role", "Who uploaded it and their role"],
    ["module", "Source area such as laboratory, radiology, emergency, profile"],
    ["file_url / file_path", "Backend-controlled download path and storage path"],
    ["mime_type / file_size_bytes", "File type and size"],
    ["sha256_checksum", "File integrity check"],
    ["visibility_level", "private, care-team, admin-only, or patient-released"],
    ["release_status", "internal, pending_review, released, rejected"],
  ],
  [58, 124],
);

page("11. Audit, Login, and Notifications", "Accountability tables");
table(
  ["Table", "Purpose", "Why important"],
  [
    ["audit_logs", "Stores actor, role, module, action, before_state, after_state", "Legal and clinical traceability"],
    ["login_activities", "Tracks success/failed login, logout, device, IP, session duration", "Security monitoring"],
    ["notifications", "Stores target user/role, title, message, module, priority, read state", "Real-time workflow alerts"],
  ],
  [38, 82, 62],
);
box("Audit rule", "Every sensitive create, update, delete, approve, release, upload, download, export, login, and logout should create an audit log.", C.red);

page("12. Keys and Relationships", "Primary keys and foreign keys");
bullets([
  "Primary key: each table has id uuid primary key.",
  "Foreign key: a column that points to another table, such as patients.hospital_id -> hospitals.id.",
  "hospital_id: connects records to one hospital and supports tenant isolation.",
  "patient_id: connects clinical records to one patient.",
  "visit_id: connects consultation/orders to one hospital visit.",
  "doctor_id, nurse_id, pharmacist_id, uploaded_by: connect actions to app_users.",
]);
table(
  ["Relationship", "Meaning"],
  [
    ["patients.hospital_id -> hospitals.id", "Patient belongs to hospital"],
    ["visits.patient_id -> patients.id", "Visit belongs to patient"],
    ["consultations.visit_id -> visits.id", "Consultation belongs to visit"],
    ["prescriptions.consultation_id -> consultations.id", "Prescription comes from consultation"],
    ["beds.ward_id -> wards.id", "Bed belongs to ward"],
    ["global_media.patient_id -> patients.id", "File belongs to patient"],
  ],
  [70, 112],
);

page("13. Indexes and Performance", "How the database stays fast");
bullets([
  "Indexes help PostgreSQL find rows quickly.",
  "Common filters should be indexed: hospital_id, patient_id, status, created_at, role, queue_status, release_status.",
  "Reports should use date range filters and pagination instead of loading all rows.",
  "OPD queue, emergency, and bed availability queries should be optimized because users need them quickly.",
]);
box("Performance rule", "Never load a full hospital table into the browser. Use API pagination, search filters, and PostgreSQL indexes.", C.amber);

page("14. Security Model", "How data should be protected");
bullets([
  "Spring Boot API must check authentication before every request.",
  "API must check role permissions before reading or writing data.",
  "Every query must include hospital_id filtering unless the user is Super Admin.",
  "Patient portal endpoints must only return own released records.",
  "File downloads must check global_media visibility_level and release_status.",
  "Audit logs should be append-only for normal users.",
  "Backups must include PostgreSQL database and controlled file storage.",
]);

page("15. Developer Learning Path", "How to study the database");
bullets([
  "Start with hospitals, departments, app_users.",
  "Then study patients and guardians.",
  "Follow one OPD patient journey: patients -> visits -> opd_queue -> consultations.",
  "Then follow treatment: consultations -> prescriptions -> prescription_items -> pharmacy_receipts.",
  "Then follow diagnostics: lab_requests -> lab_results and radiology_requests -> radiology_reports.",
  "Study global_media for document/image storage.",
  "Finally study audit_logs and login_activities for security accountability.",
]);
box("Final summary", "GovCare EHR database is patient-centered, hospital-isolated, role-aware, audit-friendly, and designed for Spring Boot APIs with PostgreSQL as the main source of truth.", C.green);

doc.save(outputFile);
console.log(outputFile);

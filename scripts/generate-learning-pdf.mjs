import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const docsDir = path.join(projectRoot, "docs");
const outputFile = path.join(docsDir, "GovCare_EHR_Easy_Mode_Learner_Guide.pdf");
const logoFile = path.join(projectRoot, "public", "ministry-health-logo.png");
const fontRegular = "C:\\Windows\\Fonts\\Nirmala.ttf";
const fontBold = "C:\\Windows\\Fonts\\NirmalaB.ttf";

fs.mkdirSync(docsDir, { recursive: true });

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
const M = 14;

const C = {
  ink: [23, 35, 35],
  muted: [88, 105, 105],
  teal: [0, 128, 112],
  tealDark: [0, 82, 75],
  tealSoft: [225, 247, 243],
  blue: [35, 91, 167],
  amber: [181, 118, 18],
  red: [180, 50, 58],
  green: [25, 135, 85],
  line: [205, 219, 217],
  card: [248, 252, 251],
  white: [255, 255, 255],
};

if (fs.existsSync(fontRegular)) {
  doc.addFileToVFS("Nirmala.ttf", fs.readFileSync(fontRegular).toString("base64"));
  doc.addFont("Nirmala.ttf", "Nirmala", "normal");
}
if (fs.existsSync(fontBold)) {
  doc.addFileToVFS("NirmalaB.ttf", fs.readFileSync(fontBold).toString("base64"));
  doc.addFont("NirmalaB.ttf", "Nirmala", "bold");
}

let pageNo = 1;
let y = 0;

function font(size = 10, style = "normal", color = C.ink) {
  doc.setFont("Nirmala", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function footer() {
  doc.setDrawColor(...C.line);
  doc.line(M, H - 13, W - M, H - 13);
  font(7.4, "normal", C.muted);
  doc.text("GovCare EHR - Easy Mode Learner Guide", M, H - 8);
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
  font(15.5, "bold", C.tealDark);
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
  const size = opts.size ?? 9.2;
  const lineHeight = opts.lineHeight ?? 5.2;
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
  checkSpace(12);
  font(11.3, "bold", C.tealDark);
  doc.text(text, M, y);
  y += 7;
}

function bullet(items) {
  font(8.6, "normal", C.ink);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, W - M * 2 - 8);
    checkSpace(lines.length * 5 + 3);
    doc.setFillColor(...C.teal);
    doc.circle(M + 2, y - 1.5, 1, "F");
    doc.text(lines, M + 7, y);
    y += lines.length * 5 + 1.2;
  }
  y += 2;
}

function box(title, text, color = C.teal) {
  const lines = doc.splitTextToSize(text, W - M * 2 - 10);
  const height = Math.max(20, 12 + lines.length * 5);
  checkSpace(height + 7);
  doc.setFillColor(...C.tealSoft);
  doc.setDrawColor(...color);
  doc.roundedRect(M, y, W - M * 2, height, 2, 2, "FD");
  font(9, "bold", color);
  doc.text(title, M + 5, y + 7);
  font(8.2, "normal", C.ink);
  doc.text(lines, M + 5, y + 13);
  y += height + 6;
}

function table(headers, rows, widths) {
  const rowH = 9;
  checkSpace((rows.length + 2) * rowH);
  let x = M;
  doc.setFillColor(...C.tealDark);
  doc.rect(M, y, W - M * 2, rowH, "F");
  font(7.2, "bold", C.white);
  headers.forEach((head, i) => {
    doc.text(head, x + 2, y + 5.8);
    x += widths[i];
  });
  y += rowH;
  rows.forEach((row, index) => {
    x = M;
    doc.setFillColor(index % 2 === 0 ? 250 : 244, 252, 251);
    doc.setDrawColor(...C.line);
    doc.rect(M, y, W - M * 2, rowH, "FD");
    font(6.9, "normal", C.ink);
    row.forEach((cell, i) => {
      doc.text(doc.splitTextToSize(String(cell), widths[i] - 4).slice(0, 2), x + 2, y + 4.8);
      x += widths[i];
    });
    y += rowH;
  });
  y += 5;
}

function workflow(labels) {
  checkSpace(35);
  const boxW = 31;
  const gap = 5;
  const top = y + 8;
  labels.forEach((label, i) => {
    const x = M + i * (boxW + gap);
    doc.setFillColor(i % 2 === 0 ? C.tealSoft[0] : 240, i % 2 === 0 ? C.tealSoft[1] : 248, i % 2 === 0 ? C.tealSoft[2] : 255);
    doc.setDrawColor(...(i % 2 === 0 ? C.teal : C.blue));
    doc.roundedRect(x, top, boxW, 17, 2, 2, "FD");
    font(6.7, "bold", i % 2 === 0 ? C.tealDark : C.blue);
    doc.text(doc.splitTextToSize(label, boxW - 5), x + boxW / 2, top + 6, { align: "center" });
    if (i < labels.length - 1) {
      doc.setDrawColor(...C.teal);
      doc.line(x + boxW + 1, top + 8.5, x + boxW + gap - 1, top + 8.5);
    }
  });
  y += 35;
}

function mock(title, subtitle, items) {
  const height = 54;
  checkSpace(height + 8);
  doc.setFillColor(246, 250, 250);
  doc.setDrawColor(...C.line);
  doc.roundedRect(M, y, W - M * 2, height, 3, 3, "FD");
  doc.setFillColor(...C.teal);
  doc.roundedRect(M + 4, y + 4, W - M * 2 - 8, 10, 2, 2, "F");
  font(7.8, "bold", C.white);
  doc.text(title, M + 8, y + 11);
  font(6.4, "normal", [230, 255, 250]);
  doc.text(subtitle, W - M - 8, y + 11, { align: "right" });
  const colW = (W - M * 2 - 16) / items.length;
  const top = y + 20;
  items.forEach((item, i) => {
    const x = M + 6 + i * colW;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.line);
    doc.roundedRect(x, top, colW - 4, 27, 2, 2, "FD");
    doc.setFillColor(...(item.color ?? C.teal));
    doc.circle(x + 8, top + 8, 5.2, "F");
    font(6.3, "bold", C.white);
    doc.text(item.icon, x + 8, top + 10, { align: "center" });
    font(7.1, "bold", C.ink);
    doc.text(item.title, x + 16, top + 8);
    font(6.1, "normal", C.muted);
    doc.text(doc.splitTextToSize(item.text, colW - 20), x + 16, top + 14);
  });
  y += height + 8;
}

function databaseDiagram() {
  checkSpace(70);
  const centerX = W / 2;
  const centerY = y + 31;
  doc.setFillColor(255, 249, 235);
  doc.setDrawColor(...C.amber);
  doc.roundedRect(centerX - 24, centerY - 10, 48, 20, 2, 2, "FD");
  font(8.2, "bold", C.amber);
  doc.text("patients", centerX, centerY - 1, { align: "center" });
  font(6.2, "normal", C.ink);
  doc.text("central record", centerX, centerY + 5, { align: "center" });
  const nodes = [
    ["users", 28, centerY - 22],
    ["visits", 28, centerY + 22],
    ["prescriptions", 72, centerY - 37],
    ["lab_results", 114, centerY - 37],
    ["radiology", 156, centerY - 22],
    ["appointments", 156, centerY + 22],
    ["media_files", 114, centerY + 38],
    ["audit_logs", 72, centerY + 38],
  ];
  nodes.forEach(([label, x, ny]) => {
    doc.setDrawColor(...C.line);
    doc.line(centerX, centerY, x, ny);
    doc.setFillColor(...C.card);
    doc.roundedRect(x - 18, ny - 7, 36, 14, 2, 2, "FD");
    font(6.7, "bold", C.tealDark);
    doc.text(label, x, ny + 2, { align: "center" });
  });
  y += 70;
}

function cover() {
  doc.setFillColor(4, 93, 83);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(17, 131, 115);
  doc.circle(W - 24, 36, 45, "F");
  doc.setFillColor(0, 71, 66);
  doc.circle(10, H - 24, 55, "F");
  addLogo(M, 23, 32);
  font(24, "bold", C.white);
  doc.text("GovCare EHR System", M, 74);
  font(13, "bold", [232, 255, 249]);
  doc.text("Easy Mode Learner Guide", M, 87);
  font(10, "normal", [232, 255, 249]);
  doc.text("Electronic Health Record Web Application for Sri Lankan Government Hospitals", M, 99);
  doc.setFillColor(232, 247, 243);
  doc.roundedRect(M, 118, W - M * 2, 58, 4, 4, "F");
  font(11, "bold", C.tealDark);
  doc.text("ආරම්භක සිසුන් සඳහා පහසු ඉගෙනුම් PDF", M + 7, 132);
  font(8.8, "normal", C.ink);
  doc.text(doc.splitTextToSize("මෙම මාර්ගෝපදේශය GovCare EHR project එක සරලව ඉගෙනගැනීමට සකස් කර ඇත. Technical words English වලින් තබා Sinhala explanation එක සරල කර ඇත.", W - M * 2 - 14), M + 7, 144);
  font(8.5, "bold", [235, 255, 249]);
  doc.text("React + Spring Boot + PostgreSQL + Tailwind CSS + PWA", M, H - 20);
  font(7.5, "normal", [220, 245, 239]);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, M, H - 13);
  pageNo += 1;
}

cover();

page("1. EHR කියන්නේ මොකක්ද?", "Beginner explanation");
p("EHR means Electronic Health Record. සරලව කිව්වොත්, patient කෙනෙකුගේ medical file එක computer system එකක secure ලෙස තබන ක්‍රමයයි.");
p("Paper file එකක් නැතිව patient details, visits, doctor notes, prescriptions, lab reports, radiology reports, admissions, appointments සහ documents එකම system එකකින් access කරන්න පුළුවන්.");
box("Easy idea", "Patient record එක system එකේ මධ්‍යස්ථානය. අනෙක් modules සියල්ල patientId එකට connect වෙනවා.");
workflow(["Register Patient", "Create Visit", "Doctor Check", "Orders", "Reports"]);

page("2. GovCare EHR එකේ අරමුණ", "Why this system is useful");
bullet([
  "Government hospitals වල queues, reports, wards, pharmacy සහ lab workflows digital කරයි.",
  "Doctorsට patient history ඉක්මනින් බලන්න පුළුවන්.",
  "Nursesට vitals, medication, ward tasks සහ alerts manage කරන්න පුළුවන්.",
  "Pharmacistsට prescriptions verify කර medicine issue කරන්න පුළුවන්.",
  "Patientsට තමන්ට release කරපු reports සහ appointments බලන්න පුළුවන්.",
]);
box("Important", "System එකේ goal එක hospital work එක faster, safer, and more organized කිරීමයි.", C.green);

page("3. Easy Architecture", "How the project parts connect");
workflow(["React UI", "Spring Boot API", "PostgreSQL", "File Storage", "Reports"]);
p("React frontend එක user interface එකයි. Spring Boot API එක backend brain එකයි. PostgreSQL database එක data store කරන place එකයි. Documents/images storage folder එක files save කරන place එකයි.");
table(
  ["Part", "Simple meaning", "Project use"],
  [
    ["React", "Screen/UI", "Login, dashboard, forms, tables"],
    ["Spring Boot", "Backend API", "Upload, download, business rules"],
    ["PostgreSQL", "Database", "Patients, visits, reports, audit logs"],
    ["File Storage", "Files folder", "Images, PDFs, scans, documents"],
    ["PWA", "Offline shell", "Basic offline-friendly app access"],
  ],
  [32, 58, 92],
);

page("4. Technologies Used", "Simple technical stack");
table(
  ["Technology", "What it does", "Why useful"],
  [
    ["React + Vite", "Frontend app", "Fast development and fast UI"],
    ["TypeScript", "Typed code", "Reduces mistakes"],
    ["Tailwind CSS", "UI design", "Clean responsive hospital theme"],
    ["Spring Boot", "Backend server", "Secure APIs and file handling"],
    ["PostgreSQL", "Relational DB", "Strong data structure and reports"],
    ["Firebase Auth", "Optional login", "Can keep during migration"],
    ["jsPDF", "PDF exports", "Reports and learning documents"],
  ],
  [34, 64, 84],
);

page("5. Main Modules Overview", "Big picture before details");
mock("GovCare Dashboard", "Role-based hospital workspace", [
  { icon: "A", title: "Admin", text: "Users, roles, reports, settings.", color: C.amber },
  { icon: "D", title: "Doctor", text: "Consultation and orders.", color: C.teal },
  { icon: "P", title: "Patient", text: "Own released records.", color: C.blue },
]);
bullet([
  "Authentication and Admin",
  "Patient Management and OPD",
  "Doctor Center and Consultation",
  "Nurse and Ward Management",
  "Pharmacy, Laboratory, Radiology",
  "Emergency, Reports, Notifications",
  "Documents and Images using Spring Boot + PostgreSQL",
]);

page("6. Authentication & Admin", "Login and control center");
mock("Login Page", "Staff and patient access", [
  { icon: "L", title: "Login", text: "Email/password or provider.", color: C.teal },
  { icon: "R", title: "Role", text: "Admin, doctor, nurse, patient.", color: C.blue },
  { icon: "S", title: "Session", text: "Timeout and logout tracking.", color: C.green },
]);
p("Login පසු system එක user role එක හඳුනාගනී. Role එක අනුව dashboard එක වෙනස් වේ. Adminට reports, users, settings සහ audit logs බලන්න පුළුවන්.");
box("Learner note", "RBAC means Role-Based Access Control. User role එක අනුව permission ලැබෙන ක්‍රමයයි.");

page("7. Patient Management", "Patient profile is the center");
mock("Patient Registration", "NIC / guardian / QR", [
  { icon: "ID", title: "Patient ID", text: "Unique patient number.", color: C.teal },
  { icon: "NIC", title: "NIC Check", text: "Duplicate prevention.", color: C.amber },
  { icon: "QR", title: "QR Code", text: "Fast lookup.", color: C.blue },
]);
bullet([
  "Adult patient: NIC or passport validation.",
  "Child patient: birth certificate and guardian details.",
  "Under 16: guardian details are needed for appointments.",
  "Patient profile includes demographics, allergies, diseases, emergency contact, photo, and documents.",
]);

page("8. OPD Queue", "Reception workflow");
mock("OPD Queue Board", "Token and status", [
  { icon: "1", title: "Waiting", text: "Patient added to queue.", color: C.amber },
  { icon: "2", title: "Called", text: "Doctor calls patient.", color: C.teal },
  { icon: "3", title: "Done", text: "Consultation completed.", color: C.green },
]);
workflow(["Search Patient", "Create Visit", "Assign Doctor", "Token", "Consultation"]);
p("Receptionist patient QR/NIC/name search කර OPD visit create කරයි. Token number එක patient සහ doctor dashboard දෙකටම පෙන්විය හැක.");

page("9. Doctor Center", "Consultation workflow");
mock("Doctor Consultation", "Clinical workspace", [
  { icon: "S", title: "SOAP", text: "Symptoms and plan.", color: C.teal },
  { icon: "Rx", title: "Prescription", text: "Send to pharmacy.", color: C.blue },
  { icon: "Lab", title: "Orders", text: "Lab/radiology requests.", color: C.amber },
]);
bullet([
  "Doctor sees patient profile, allergies, vitals, history, reports, and previous visits.",
  "Doctor writes diagnosis, notes, treatment plan, prescription, lab request, radiology request, and follow-up date.",
  "After save, patient moves from active OPD queue to checked/completed list.",
]);

page("10. Nurse and Ward Module", "Bedside care");
mock("Ward Dashboard", "Beds and nursing work", [
  { icon: "V", title: "Vitals", text: "BP, pulse, temp, SpO2.", color: C.teal },
  { icon: "MAR", title: "Medicine", text: "Medication administration.", color: C.blue },
  { icon: "Bed", title: "Beds", text: "Assigned bed highlighted.", color: C.green },
]);
bullet([
  "Nurse can record vitals, nursing notes, care plans, IV fluids, wound care, intake/output, and handover.",
  "Nurse cannot change doctor diagnosis or prescribe medicines.",
  "Ward allocation uses gender and age rules: male ward, female ward, children ward.",
]);

page("11. Nurse Advanced Features", "Safety improvements");
table(
  ["Feature", "Easy explanation", "Value"],
  [
    ["BCMA", "Scan patient QR and medicine barcode", "Prevents wrong medicine"],
    ["Risk Alerts", "Analyze vitals and notes", "Finds falls, sepsis, deterioration risk"],
    ["Task Board", "Assign nursing tasks by shift", "Reduces missed work and overload"],
  ],
  [35, 75, 72],
);
box("Five Rights", "BCMA helps check Right Patient, Right Drug, Right Dose, Right Route, and Right Time.", C.green);

page("12. Pharmacy Module", "Prescription to medicine issue");
workflow(["Doctor Rx", "Pharmacy Queue", "Verify", "Issue", "Receipt"]);
bullet([
  "Doctor sends e-prescription directly to pharmacy queue.",
  "Pharmacist verifies patient, allergy warnings, duplicate medicine, dosage, and stock.",
  "After issue, stock is reduced and receipt is generated.",
  "Patient can see released prescription and medication history.",
]);

page("13. Laboratory Module", "Requests and results");
mock("Lab Report Page", "Sample to approved result", [
  { icon: "S", title: "Sample", text: "Collected and received.", color: C.amber },
  { icon: "R", title: "Result", text: "Normal/abnormal/critical.", color: C.teal },
  { icon: "A", title: "Approve", text: "Release after approval.", color: C.green },
]);
bullet([
  "Supports blood tests, urine tests, cultures, serology, histopathology, molecular tests, and blood bank workflows.",
  "Critical results should notify doctors quickly.",
  "Only approved/released results should appear in patient portal.",
]);

page("14. Radiology Module", "Images and scan reports");
mock("Radiology Workspace", "Request and report", [
  { icon: "XR", title: "Request", text: "X-ray, CT, MRI, US.", color: C.blue },
  { icon: "IMG", title: "Upload", text: "Images and PDFs.", color: C.teal },
  { icon: "QR", title: "Verify", text: "QR report check.", color: C.green },
]);
p("Radiology staff can schedule scans, upload reports/images, add findings, mark normal/abnormal/critical, and release approved reports.");

page("15. Documents and Images", "Spring Boot + PostgreSQL management");
workflow(["React Upload", "Spring API", "Store File", "PostgreSQL Metadata", "Download"]);
p("All documents, images, scans, reports, profile photos, emergency evidence, and receipts should go through Spring Boot API. PostgreSQL stores metadata. The actual file is saved in controlled storage folder.");
table(
  ["Stored in PostgreSQL", "Example"],
  [
    ["hospitalId", "Which hospital owns the file"],
    ["patientId", "Which patient file belongs to"],
    ["uploadedBy / role", "Who uploaded it"],
    ["module", "lab, radiology, ward, profile"],
    ["filePath / fileUrl", "Where file can be loaded from"],
    ["visibility / releaseStatus", "Private or released to patient"],
    ["sha256Checksum", "File integrity check"],
  ],
  [68, 114],
);
box("Important", "Do not save big images/PDFs directly inside database rows. Save files in storage, save metadata in PostgreSQL.", C.amber);

page("16. PostgreSQL Database Structure", "Main tables");
databaseDiagram();
table(
  ["Table", "Purpose"],
  [
    ["app_users", "Staff and user profiles"],
    ["patients", "Main patient records"],
    ["visits / opd_queue", "Hospital visits and queue"],
    ["consultations", "Doctor notes and diagnosis"],
    ["prescriptions", "E-prescriptions"],
    ["lab_requests / lab_results", "Lab workflow"],
    ["radiology_requests / reports", "Imaging workflow"],
    ["global_media", "Documents/images metadata"],
    ["audit_logs", "System action history"],
  ],
  [58, 124],
);

page("17. Role-Based Access", "Who can do what?");
table(
  ["Role", "Can do"],
  [
    ["Admin", "Users, roles, settings, reports, audit"],
    ["Doctor", "Consultations, prescriptions, lab/radiology orders"],
    ["Nurse", "Vitals, ward notes, MAR, care tasks"],
    ["Pharmacist", "Verify and issue medicines"],
    ["Lab Tech", "Enter and process lab results"],
    ["Radiologist", "Upload imaging reports and findings"],
    ["Receptionist", "Registration, OPD, appointments"],
    ["Patient", "Own released records only"],
  ],
  [45, 137],
);
box("Best rule", "Patient can only see own released information. Staff can only see data allowed by role and hospital.", C.green);

page("18. Security Easy Mode", "How to protect hospital data");
bullet([
  "Use authentication for every user.",
  "Use roles and permissions for every module.",
  "Use hospitalId to isolate hospital data.",
  "Use audit logs for every important action.",
  "Patients must not access other patient records.",
  "Sensitive uploads must go through backend validation.",
  "Use HTTPS in production.",
  "Back up PostgreSQL database and file storage regularly.",
]);
box("Security meaning", "Security is not only login. It is also permissions, audit logs, validation, backups, and privacy rules.", C.red);

page("19. How To Run Locally", "Student setup steps");
table(
  ["Step", "Command / action"],
  [
    ["Frontend", "npm run dev -- --host 127.0.0.1"],
    ["PostgreSQL DB", "createdb govcare_ehr"],
    ["Apply schema", "psql ... -f database/postgresql/schema.sql"],
    ["Spring API", "cd spring-api && mvn spring-boot:run"],
    ["Media URL", "VITE_MEDIA_API_BASE_URL=http://127.0.0.1:4002"],
    ["Build test", "npm run build"],
  ],
  [42, 140],
);
p("Note: Maven must be installed to run Spring Boot. PostgreSQL must be installed to use the database.");

page("20. Learning Roadmap", "What to study first");
bullet([
  "1. Understand patient registration and patientId.",
  "2. Learn OPD queue flow.",
  "3. Learn doctor consultation and prescription flow.",
  "4. Learn pharmacy, lab, and radiology integrations.",
  "5. Learn Spring Boot media upload API.",
  "6. Learn PostgreSQL tables and relationships.",
  "7. Learn role-based access and audit logs.",
  "8. Learn deployment and backups.",
]);
box("Final conclusion", "GovCare EHR is a good learning project because it connects real hospital workflows with modern web development, backend APIs, PostgreSQL database, document management, and security.", C.green);

doc.save(outputFile);
console.log(outputFile);

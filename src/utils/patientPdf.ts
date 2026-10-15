import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PatientPdfDetails = {
  patientId: string;
  fullName: string;
  dateOfBirth?: string;
  age?: number | string;
  gender?: string;
  nic?: string;
  passportNumber?: string;
  birthCertificateNo?: string;
  bloodGroup?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  province?: string;
  guardianName?: string;
  guardianRelationship?: string;
  allergies?: string;
  chronicDiseases?: string;
  riskCategory?: string;
  hospitalName?: string;
  preparedBy?: string;
};

export type PatientFieldChange = {
  label: string;
  before: string;
  after: string;
};

function fmt(value: unknown, fallback = "Not recorded") {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function drawLetterhead(doc: jsPDF, title: string, hospitalName: string) {
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("GovCare EHR", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(hospitalName, 14, 19);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 196, 15, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 196, 34, { align: "right" });
}

function drawFooter(doc: jsPDF, note: string) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 282, 196, 282);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(note, 14, 288);
    doc.text(`Page ${page} of ${pageCount}`, 196, 288, { align: "right" });
  }
}

function patientSummaryRows(details: PatientPdfDetails) {
  return [
    ["Patient ID", fmt(details.patientId)],
    ["Full name", fmt(details.fullName)],
    ["Date of birth", fmt(details.dateOfBirth)],
    ["Age", fmt(details.age)],
    ["Gender", fmt(details.gender)],
    ["NIC", fmt(details.nic)],
    ["Passport number", fmt(details.passportNumber)],
    ["Birth certificate no.", fmt(details.birthCertificateNo)],
    ["Blood group", fmt(details.bloodGroup)],
    ["Nationality", fmt(details.nationality)],
    ["Phone", fmt(details.phone)],
    ["Email", fmt(details.email)],
    ["Address", fmt(details.address)],
    ["District / Province", `${fmt(details.district, "")} ${details.province ? `/ ${details.province}` : ""}`.trim() || "Not recorded"],
    ["Guardian", details.guardianName ? `${details.guardianName} (${fmt(details.guardianRelationship, "Guardian")})` : "Not applicable"],
    ["Allergies", fmt(details.allergies, "No known allergies")],
    ["Chronic diseases", fmt(details.chronicDiseases, "None recorded")],
    ["Risk category", fmt(details.riskCategory, "Routine")],
  ];
}

/**
 * Generates and downloads a PDF confirming a new patient's registration details.
 * Call this right after a successful patient create (e.g. in PatientRegistration.tsx).
 */
export function generateNewPatientPdf(details: PatientPdfDetails) {
  const doc = new jsPDF();
  const hospitalName = details.hospitalName ?? "Government Hospital";
  drawLetterhead(doc, "New Patient Registration", hospitalName);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${details.fullName}`, 14, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Patient ID: ${details.patientId}`, 14, 50);

  autoTable(doc, {
    startY: 56,
    head: [["Field", "Value"]],
    body: patientSummaryRows(details),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Prepared by", 14, finalY + 14);
  doc.setFont("helvetica", "normal");
  doc.text(fmt(details.preparedBy, "Records officer"), 14, finalY + 20);

  drawFooter(doc, "This document confirms the patient details captured at registration. Verify all fields with the patient/guardian before filing.");
  doc.save(`${details.patientId}-registration.pdf`);
}

/**
 * Generates and downloads a PDF listing exactly what changed on a patient's record after an
 * edit/update. Pass only the fields that actually changed - each entry shows the old and new value.
 */
export function generatePatientUpdatePdf(details: PatientPdfDetails, changes: PatientFieldChange[]) {
  const doc = new jsPDF();
  const hospitalName = details.hospitalName ?? "Government Hospital";
  drawLetterhead(doc, "Patient Details Updated", hospitalName);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${details.fullName}`, 14, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Patient ID: ${details.patientId}`, 14, 50);

  if (changes.length === 0) {
    doc.setFontSize(10);
    doc.text("No field changes were recorded for this update.", 14, 62);
  } else {
    autoTable(doc, {
      startY: 56,
      head: [["Field", "Previous value", "New value"]],
      body: changes.map((change) => [change.label, fmt(change.before), fmt(change.after)]),
      styles: { fontSize: 9, cellPadding: 3, valign: "top" },
      headStyles: { fillColor: [180, 83, 9], textColor: 255 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    });
  }

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 62;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Updated by", 14, finalY + 14);
  doc.setFont("helvetica", "normal");
  doc.text(fmt(details.preparedBy, "Records officer"), 14, finalY + 20);

  drawFooter(doc, "This document lists field-level changes made to the patient record. It is stored for audit purposes.");
  doc.save(`${details.patientId}-update-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Compares a "before" and "after" patient object and returns only the fields that actually
 * changed, in a friendly label + before/after form ready for generatePatientUpdatePdf().
 */
export function diffPatientFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fieldLabels: Record<string, string>,
): PatientFieldChange[] {
  const changes: PatientFieldChange[] = [];
  for (const [key, label] of Object.entries(fieldLabels)) {
    const beforeValue = before[key];
    const afterValue = after[key];
    const beforeText = Array.isArray(beforeValue) ? beforeValue.join(", ") : String(beforeValue ?? "");
    const afterText = Array.isArray(afterValue) ? afterValue.join(", ") : String(afterValue ?? "");
    if (beforeText.trim() !== afterText.trim()) {
      changes.push({ label, before: beforeText, after: afterText });
    }
  }
  return changes;
}

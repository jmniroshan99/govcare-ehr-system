export interface SmartSearchSuggestion {
  id: string;
  label: string;
  description: string;
  category: "Patient" | "Doctor" | "Appointment" | "Prescription" | "Laboratory" | "Radiology" | "Admission" | "Ward" | "User" | "Notification" | "Report" | string;
  href: string;
}

export type StaffRole =
  | "hospital_admin"
  | "records_officer"
  | "receptionist"
  | "doctor"
  | "nurse"
  | "lab_technician"
  | "pathologist"
  | "radiology_technician"
  | "radiologist"
  | "pharmacist";

export type EmploymentType = "permanent" | "contract" | "temporary" | "visiting";
export type WorkStatus = "active" | "on_leave" | "suspended" | "inactive";

export type StaffMember = {
  id: string;
  employeeNo: string;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  nationalId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  hospitalId: string;
  hospitalName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  role: StaffRole;
  professionalRegistrationNo?: string | null;
  jobTitle?: string | null;
  employmentType?: EmploymentType | null;
  joiningDate?: string | null;
  workStatus: WorkStatus;
  active: boolean;
  status: string;
  mustChangePassword: boolean;
  photoURL?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  permissions?: string[];
  temporaryPassword?: string;
  passwordShownOnce?: boolean;
};

export type HospitalOption = {
  id: string;
  code: string;
  name: string;
  city?: string;
  district?: string;
};

export type DepartmentOption = {
  id: string;
  code: string;
  name: string;
  type?: string;
  status: string;
};

export type StaffRoleOption = {
  code: StaffRole;
  name: string;
  description?: string;
  default_route?: string;
};

export type StaffSummary = {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  doctors: number;
  nurses: number;
  laboratoryStaff: number;
  pharmacyStaff: number;
  radiologyStaff: number;
};

export type StaffListResponse = {
  items: StaffMember[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  summary: StaffSummary;
};

export type StaffOptionsResponse = {
  hospitals: HospitalOption[];
  roles: StaffRoleOption[];
};

export type CreateStaffInput = {
  title?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  nationalId?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email: string;
  address?: string;
  hospitalId: string;
  departmentId?: string | null;
  roleCode: StaffRole;
  professionalRegistrationNo?: string;
  jobTitle?: string;
  employmentType: EmploymentType;
  joiningDate?: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  active: boolean;
};

export type StaffAuditRecord = {
  id: string;
  action: string;
  before_state?: string;
  after_state?: string;
  ip_address?: string;
  created_at: string;
  actor_name?: string;
};

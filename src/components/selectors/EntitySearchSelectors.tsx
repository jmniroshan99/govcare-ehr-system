import type { SelectOption } from "../../data/referenceOptions";
import { searchAdmissions, searchDiagnoses, searchLaboratoryTests, searchMedicines, searchPatients, searchRadiologyStudies, searchStaff } from "../../services/referenceDataService";
import { AsyncSearchableSelect } from "../forms/AsyncSearchableSelect";

export type EntitySelectorProps = { value?: string; selectedOption?: SelectOption | null; onChange: (value: string, option?: SelectOption) => void; disabled?: boolean; required?: boolean };

export function PatientSearchSelector(props: EntitySelectorProps) { return <AsyncSearchableSelect {...props} loadOptions={searchPatients} placeholder="Search patient ID, NIC, passport, phone or name" />; }
export function AdmissionSearchSelector(props: EntitySelectorProps) { return <AsyncSearchableSelect {...props} loadOptions={searchAdmissions} placeholder="Search active admission, patient, ward or bed" />; }
export function MedicineSearchSelector(props: EntitySelectorProps) { return <AsyncSearchableSelect {...props} loadOptions={searchMedicines} placeholder="Search generic, brand, strength or dosage form" />; }
export function DiagnosisSearchSelector(props: EntitySelectorProps) { return <AsyncSearchableSelect {...props} loadOptions={searchDiagnoses} placeholder="Search ICD-10 code or diagnosis" />; }
export function LaboratoryTestSelector(props: EntitySelectorProps) { return <AsyncSearchableSelect {...props} loadOptions={searchLaboratoryTests} placeholder="Search laboratory test name or code" />; }
export function RadiologyStudySelector(props: EntitySelectorProps) { return <AsyncSearchableSelect {...props} loadOptions={searchRadiologyStudies} placeholder="Search imaging study or code" />; }
export function StaffSearchSelector({ hospitalId, departmentId, role, permission, ...props }: EntitySelectorProps & { hospitalId?: string; departmentId?: string; role?: string; permission?: string }) { return <AsyncSearchableSelect {...props} loadOptions={(query) => searchStaff(query, { hospitalId, departmentId, role, permission })} placeholder="Search staff name, ID, role or department" />; }

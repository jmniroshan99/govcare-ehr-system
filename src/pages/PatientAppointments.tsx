import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileUp,
  HeartPulse,
  Languages,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageTransition, SectionReveal } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { useAuthStore } from "../stores/authStore";

type AppointmentType = "Physical visit" | "Telemedicine" | "Video consultation" | "Follow-up";

const hospitals = ["National Hospital", "Base Hospital", "Teaching Hospital"];
const hospitalCities = ["Colombo", "Kandy", "Galle", "Jaffna", "Kurunegala", "Matara"];
const departments = ["Medical OPD", "Diabetes Clinic", "Cardiology Clinic", "Chest Clinic", "Primary Care"];
const doctors = [
  { name: "Dr. Anjali Perera", department: "Diabetes Clinic", hospital: "National Hospital", specialty: "Endocrinology", language: "Sinhala, English", location: "Clinic Room 12", mode: "Physical + Video", wait: "18 min", queue: 6, availability: "Today 14:30, 16:00", experience: "12 yrs" },
  { name: "Dr. M. Nazeer", department: "Cardiology Clinic", hospital: "National Hospital", specialty: "Cardiology", language: "Tamil, English", location: "Cardiology Unit", mode: "Physical", wait: "22 min", queue: 9, availability: "Tomorrow 09:00, 10:30", experience: "15 yrs" },
  { name: "Dr. Fathima Rizna", department: "Primary Care", hospital: "Base Hospital", specialty: "Family Medicine", language: "Sinhala, Tamil, English", location: "Virtual Clinic", mode: "Telemedicine + Video", wait: "10 min", queue: 3, availability: "Today 10:30, 14:30", experience: "9 yrs" },
  { name: "Dr. K. Thevan", department: "Chest Clinic", hospital: "Teaching Hospital", specialty: "Respiratory Medicine", language: "Tamil, English", location: "Chest Clinic 02", mode: "Physical + Video", wait: "35 min", queue: 14, availability: "Friday 09:00, Monday 16:00", experience: "11 yrs" },
];
const dates = ["Today", "Tomorrow", "Friday", "Monday"];
const slots = ["09:00", "10:30", "14:30", "16:00"];
const upcoming = [
  ["CLN-220", "Diabetes Clinic", "2026-06-28 09:30", "Queue 12", "Confirmed"],
  ["TEL-118", "Video Review", "2026-06-20 16:00", "Virtual room", "Check-in pending"],
];

export function PatientAppointments() {
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const [symptoms, setSymptoms] = useState("fever and high sugar");
  const [patientCity, setPatientCity] = useState(profile?.city ?? "");
  const [hospitalCity, setHospitalCity] = useState(profile?.hospitalCity ?? "Colombo");
  const [hospital, setHospital] = useState(profile?.preferredHospital || hospitals[0]);
  const [department, setDepartment] = useState("Diabetes Clinic");
  const [doctorName, setDoctorName] = useState(doctors[0].name);
  const [type, setType] = useState<AppointmentType>("Physical visit");
  const [date, setDate] = useState("Today");
  const [slot, setSlot] = useState("14:30");
  const [familyMember, setFamilyMember] = useState("Self");
  const [childName, setChildName] = useState("");
  const [childBirthCertificate, setChildBirthCertificate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianNic, setGuardianNic] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferredLanguage ?? "English");

  const suggestedDepartment = symptoms.toLowerCase().includes("sugar") ? "Diabetes Clinic" : symptoms.toLowerCase().includes("chest") ? "Cardiology Clinic" : "Medical OPD";
  const availableDoctors = useMemo(() => doctors.filter((doctor) => doctor.hospital === hospital && doctor.department === department && (!preferredLanguage || doctor.language.includes(preferredLanguage))), [hospital, department, preferredLanguage]);
  const searchableDoctors = useMemo(() => {
    const query = doctorSearch.toLowerCase();
    return doctors.filter((doctor) => [doctor.name, doctor.department, doctor.hospital, doctor.specialty, doctor.language, doctor.mode].some((value) => value.toLowerCase().includes(query)));
  }, [doctorSearch]);
  const selectedDoctor = doctors.find((doctor) => doctor.name === doctorName) ?? availableDoctors[0] ?? doctors[0];
  const queueNumber = selectedDoctor.queue + slots.indexOf(slot) + 1;

  function notify(message: string, tone: "success" | "warning" | "danger" | "info" = "success") {
    showToast(message, tone);
  }

  function bookAppointment() {
    if (familyMember === "Child") {
      if (!childName.trim() || childBirthCertificate.trim().length < 4 || !guardianName.trim() || guardianNic.trim().length < 5 || guardianPhone.trim().length < 7) {
        notify("For child appointments, enter child name, birth certificate number, guardian name, guardian NIC, and guardian phone.", "warning");
        return;
      }
    }
    notify(`Appointment booked with ${selectedDoctor.name}. Queue number ${queueNumber}.`, "success");
  }

  function selectDoctor(doctor: typeof doctors[number]) {
    setDoctorName(doctor.name);
    setHospital(doctor.hospital);
    setDepartment(doctor.department);
    if (doctor.mode.includes("Telemedicine")) setType("Telemedicine");
    notify(`${doctor.name} selected for appointment booking.`, "info");
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Book appointment</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Book a doctor in a few easy steps</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Choose hospital, department, doctor, visit type, date, and time. The appointment ticket includes queue number, waiting time, location, QR code, and reminders.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => notify("Digital check-in ready.", "info")}><QrCode className="h-4 w-4" />Check in</Button>
            <Button onClick={bookAppointment}><CalendarDays className="h-4 w-4" />Book now</Button>
          </div>
        </div>

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          {["Simple booking", "Live queue", "Reminders", "Sinhala / Tamil / English"].map((item) => (
            <div key={item} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />{item}</div>
          ))}
        </div>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Appointment details</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="selection-panel p-4">
                <label className="text-sm font-medium">
                  Smart search or symptoms
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Example: fever, chest pain, high sugar" />
                  </div>
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="info"><Sparkles className="h-3 w-3" />Suggested: {suggestedDepartment}</Badge>
                  <Button variant="outline" onClick={() => setDepartment(suggestedDepartment)}>Use suggestion</Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Your city
                  <Input value={patientCity} onChange={(event) => setPatientCity(event.target.value)} placeholder="Example: Colombo" />
                </label>
                <label className="block text-sm font-medium">
                  Hospital city
                  <Select value={hospitalCity} onChange={(event) => setHospitalCity(event.target.value)}>
                    {hospitalCities.map((city) => <option key={city}>{city}</option>)}
                  </Select>
                </label>
                <StepSelect step="1" label="Hospital" value={hospital} onChange={setHospital} options={hospitals} />
                <StepSelect step="2" label="Department" value={department} onChange={setDepartment} options={departments} />
                <StepSelect step="3" label="Doctor" value={doctorName} onChange={setDoctorName} options={(availableDoctors.length ? availableDoctors : doctors).map((doctor) => doctor.name)} />
                <StepSelect step="4" label="Appointment type" value={type} onChange={(value) => setType(value as AppointmentType)} options={["Physical visit", "Telemedicine", "Video consultation", "Follow-up"]} />
                <StepSelect step="5" label="Date" value={date} onChange={setDate} options={dates} />
                <StepSelect step="6" label="Available time slot" value={slot} onChange={setSlot} options={slots} />
                <StepSelect step="7" label="Preferred language" value={preferredLanguage} onChange={setPreferredLanguage} options={["English", "Sinhala", "Tamil"]} />
              </div>

              <div className="rounded-md border border-border bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">Choose your doctor</p>
                    <p className="text-sm text-muted-foreground">Search by name, specialty, department, hospital, language, or visit type.</p>
                  </div>
                  <Badge tone="success">{selectedDoctor.name} selected</Badge>
                </div>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={doctorSearch} onChange={(event) => setDoctorSearch(event.target.value)} placeholder="Search doctor, specialty, language..." />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {searchableDoctors.map((doctor) => (
                    <button
                      key={doctor.name}
                      className={`interactive-control rounded-md border p-3 text-left text-sm ${doctor.name === selectedDoctor.name ? "border-teal-300 bg-teal-50 shadow-sm" : "border-border bg-white hover:bg-muted"}`}
                      onClick={() => selectDoctor(doctor)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-950">{doctor.name}</p>
                          <p className="text-muted-foreground">{doctor.specialty} | {doctor.experience}</p>
                        </div>
                        <Badge tone={doctor.mode.includes("Video") || doctor.mode.includes("Telemedicine") ? "info" : "success"}>{doctor.mode}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <span>{doctor.hospital} - {doctor.department}</span>
                        <span>{doctor.language}</span>
                        <span>Available: {doctor.availability}</span>
                        <span>Wait: {doctor.wait} | Queue: {doctor.queue}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Book for
                  <Select value={familyMember} onChange={(event) => setFamilyMember(event.target.value)}>
                    <option>Self</option>
                    <option>Child</option>
                    <option>Parent</option>
                    <option>Spouse</option>
                  </Select>
                </label>
                <div className="rounded-md border border-border bg-white p-3 text-sm">
                  <p className="font-bold text-slate-950">Follow-up booking</p>
                  <p className="text-muted-foreground">Auto-link to previous diabetes clinic visit.</p>
                </div>
              </div>

              {familyMember === "Child" && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
                  <div className="mb-3">
                    <p className="font-bold text-amber-950">Child appointment guardian verification</p>
                    <p className="text-sm text-amber-950">Patients under 16 do not need a NIC. Use the child birth certificate and guardian details for booking.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="text-sm font-medium">Child name *<Input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="Child full name" /></label>
                    <label className="text-sm font-medium">Birth certificate no *<Input value={childBirthCertificate} onChange={(event) => setChildBirthCertificate(event.target.value)} placeholder="BC number" /></label>
                    <label className="text-sm font-medium">Guardian / parent name *<Input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
                    <label className="text-sm font-medium">Guardian NIC *<Input value={guardianNic} onChange={(event) => setGuardianNic(event.target.value)} /></label>
                    <label className="text-sm font-medium">Guardian phone *<Input value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></label>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={bookAppointment}><CalendarDays className="h-4 w-4" />Book appointment</Button>
                <Button variant="outline" onClick={() => notify("Appointment reschedule started.", "info")}>Reschedule</Button>
                <Button variant="outline" onClick={() => notify("Appointment cancellation requested.", "warning")}>Cancel</Button>
                <Button variant="outline" onClick={() => notify("Attendance confirmed.", "success")}>Confirm attendance</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />Appointment ticket</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid place-items-center rounded-lg border border-border bg-white p-6">
                <QrCode className="h-24 w-24 text-primary" />
                <p className="mt-2 text-sm font-bold text-slate-950">QR Ticket</p>
              </div>
              <TicketRow label="Patient" value={familyMember} />
              {familyMember === "Child" && <TicketRow label="Child / guardian" value={`${childName || "Child name required"} | ${guardianName || "Guardian required"}`} />}
              {familyMember === "Child" && <TicketRow label="Birth certificate" value={childBirthCertificate || "Required"} />}
              <TicketRow label="Patient city" value={patientCity || "Not set"} />
              <TicketRow label="Hospital city" value={hospitalCity} />
              <TicketRow label="Hospital" value={hospital} />
              <TicketRow label="Department" value={department} />
              <TicketRow label="Doctor" value={selectedDoctor.name} />
              <TicketRow label="Type" value={type} />
              <TicketRow label="Date and time" value={`${date} ${slot}`} />
              <TicketRow label="Queue number" value={`#${queueNumber}`} />
              <TicketRow label="Estimated wait" value={selectedDoctor.wait} />
              <TicketRow label="Location" value={selectedDoctor.location} />
              <div className="flex flex-wrap gap-2">
                <Badge tone="success"><Clock className="h-3 w-3" />{selectedDoctor.mode}</Badge>
                <Badge tone="info"><MapPin className="h-3 w-3" />Clinic location</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <ActionCard title="Before visit" icon={<FileUp className="h-5 w-5 text-primary" />} actions={["Upload documents", "Complete questionnaire", "Pre-visit instructions"]} onAction={notify} />
          <ActionCard title="Reminders" icon={<Bell className="h-5 w-5 text-primary" />} actions={["Push notification", "SMS reminder", "Email reminder"]} onAction={notify} />
          <ActionCard title="Online visit" icon={<Video className="h-5 w-5 text-primary" />} actions={["Join video consultation", "Open virtual waiting room", "Secure chat"]} onAction={notify} />
        </section>

        <SectionReveal>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-primary" />Upcoming appointments</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {upcoming.map(([id, title, dateText, queue, status]) => (
                <div key={id} className="rounded-md border border-border bg-white p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{title}</p>
                    <Badge tone={status.includes("Confirmed") ? "success" : "warning"}>{status}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{id} | {dateText} | {queue}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => notify("Digital check-in completed.", "success")}><QrCode className="h-4 w-4" />Check in</Button>
                    <Button variant="outline" onClick={() => notify("Reminder updated.", "info")}>Reminder</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </SectionReveal>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Safe and easy booking</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <p className="help-strip p-3">Patients can book for themselves or approved family members only.</p>
            <p className="help-strip p-3">Booking, rescheduling, cancellation, and confirmation create audit logs.</p>
            <p className="help-strip p-3"><Languages className="mr-1 inline h-4 w-4" />English, Sinhala, and Tamil interface ready.</p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

function StepSelect({ step, label, value, options, onChange }: { step: string; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-white">{step}</span>
        {label}
      </span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </Select>
    </label>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function ActionCard({ title, icon, actions, onAction }: { title: string; icon: React.ReactNode; actions: string[]; onAction: (message: string, tone?: "success" | "warning" | "danger" | "info") => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {actions.map((item) => <Button key={item} variant="outline" className="justify-start" onClick={() => onAction(`${item} ready.`, "info")}>{item}</Button>)}
      </CardContent>
    </Card>
  );
}

import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCheck,
  ClipboardList,
  FileText,
  Languages,
  MessageSquareText,
  Mic,
  Paperclip,
  PhoneCall,
  Pill,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Stethoscope,
  Upload,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTransition, SectionReveal } from "../components/motion/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { sendSecureChatMessage } from "../services/doctorService";
import { useAuthStore } from "../stores/authStore";
import { appendCareMessage, CARE_MESSAGES_UPDATED_EVENT, getCareMessages, saveCareMessages } from "../utils/careMessages";
import type { CareMessage, CareMessagePriority } from "../utils/careMessages";

const initialMessages: CareMessage[] = [
  { id: "msg-1", sender: "Dr. Anjali Perera", role: "doctor", time: "09:12", text: "Your chest X-ray is released and does not show an acute lesion. Please continue the current plan and upload home blood sugar readings today.", linkedTo: "RAD-2026-3002 | Diabetes follow-up", receipt: "read", priority: "normal", createdAt: "2026-06-14T09:12:00+05:30" },
  { id: "msg-2", sender: "Nimal Silva", role: "patient", time: "09:20", text: "I still have mild fever and my fasting sugar was 168 this morning.", linkedTo: "OPD-126 | Viral URTI", receipt: "delivered", priority: "normal", createdAt: "2026-06-14T09:20:00+05:30" },
  { id: "msg-3", sender: "Care Assistant", role: "system", time: "09:21", text: "AI summary drafted: patient reports persistent mild fever and elevated fasting sugar. Suggested follow-up: review hydration, fever pattern, and medication adherence.", linkedTo: "AI-ready visit summary", receipt: "system", priority: "normal", createdAt: "2026-06-14T09:21:00+05:30" },
];

const trackers = [
  { day: "Mon", pain: 3, mood: 7, sugar: 142 },
  { day: "Tue", pain: 4, mood: 6, sugar: 168 },
  { day: "Wed", pain: 5, mood: 6, sugar: 176 },
  { day: "Thu", pain: 4, mood: 7, sugar: 158 },
  { day: "Fri", pain: 3, mood: 8, sugar: 151 },
];

const contextLinks = [
  ["Visit", "OPD-126", "Viral URTI and diabetes review"],
  ["Diagnosis", "E11.9", "Type 2 diabetes mellitus"],
  ["Prescription", "RX-443", "Metformin, paracetamol"],
  ["Laboratory", "LAB-2026-9001", "FBC and HbA1c highlights"],
  ["Follow-up", "CLN-220", "Diabetes clinic in 2 weeks"],
];

const reminders = [
  ["Medication", "Metformin 500mg", "Today 20:00"],
  ["Appointment", "Diabetes clinic", "2026-06-28 09:30"],
  ["Questionnaire", "Fever and glucose check", "Due today"],
  ["Lab", "Repeat FBC", "48 hours"],
];

const education = [
  "How to monitor fever safely",
  "Diabetes sick-day rules",
  "When to seek emergency care",
  "Medication adherence guide",
];

export function PatientCommunication() {
  const { showToast } = useToast();
  const profile = useAuthStore((state) => state.profile);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState(() => getCareMessages(initialMessages));
  const [draft, setDraft] = useState("I uploaded my sugar readings. Should I continue the same dose?");
  const [language, setLanguage] = useState("English");
  const [priority, setPriority] = useState<CareMessagePriority>("normal");
  const [pain, setPain] = useState(4);
  const [mood, setMood] = useState(7);
  const [videoConsultOpen, setVideoConsultOpen] = useState(false);
  const [voiceNoteReady, setVoiceNoteReady] = useState(false);
  const [careTasks, setCareTasks] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [careActionLog, setCareActionLog] = useState<string[]>([]);
  const isDoctor = profile?.role === "doctor" || profile?.role === "nurse";
  const senderRole = isDoctor ? "doctor" : "patient";
  const senderName = profile?.displayName ?? (isDoctor ? "Dr. Anjali Perera" : "Nimal Silva");
  const unreadCount = messages.filter((message) => message.role !== "system" && message.role !== senderRole && message.receipt !== "read").length;

  useEffect(() => {
    if (!getCareMessages().length) saveCareMessages(initialMessages);

    function refreshMessages() {
      setMessages(getCareMessages(initialMessages));
    }

    window.addEventListener(CARE_MESSAGES_UPDATED_EVENT, refreshMessages);
    window.addEventListener("storage", refreshMessages);
    return () => {
      window.removeEventListener(CARE_MESSAGES_UPDATED_EVENT, refreshMessages);
      window.removeEventListener("storage", refreshMessages);
    };
  }, []);

  const aiSummary = useMemo(() => {
    return "Patient conversation linked to OPD-126, diabetes diagnosis, released radiology report, active prescription, and follow-up plan. Latest patient-reported fasting sugar is elevated; fever persists mildly.";
  }, []);

  async function sendComposedMessage(text: string, priorityOverride: CareMessagePriority = priority, linkedTo?: string) {
    if (!text.trim()) {
      showToast("Type a message before sending.", "warning");
      return;
    }
    const message: CareMessage = {
      id: `msg-${messages.length + 1}-${senderRole}`,
      sender: senderName,
      role: senderRole,
      time: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      text: text.trim(),
      linkedTo: linkedTo ?? (isDoctor ? "Doctor advice | Follow-up plan" : "Patient reply | Follow-up plan"),
      receipt: "sent",
      priority: priorityOverride,
      createdAt: new Date().toISOString(),
    };
    setMessages(appendCareMessage(message));
    try {
      await sendSecureChatMessage({
        patientId: profile?.patientId ?? "PAT-2026-000001",
        message: message.text,
        threadId: "care-thread-demo",
      });
    } catch (error) {
      console.warn("Secure chat Cloud Function unavailable; message kept in local care thread.", error);
    }
    showToast(priorityOverride === "emergency" ? "Emergency message sent to the care team and patient thread." : "Secure message sent to the conversation.", priorityOverride === "emergency" ? "danger" : "success");
  }

  async function sendMessage() {
    await sendComposedMessage(draft);
    setDraft("");
  }

  function quickAction(label: string) {
    showToast(`${label} prepared for secure sharing.`, "info");
  }

  function recordCareAction(summary: string) {
    setCareActionLog((current) => [summary, ...current].slice(0, 6));
  }

  function openVideoConsult() {
    setVideoConsultOpen(true);
    showToast("Video consultation room opened.", "success");
  }

  function sendTelemedicineLink() {
    void sendComposedMessage("Telemedicine link is ready: https://meet.govcare.local/care-thread-demo. Please join at your appointment time.", "normal", "Telemedicine | Secure video consult");
    recordCareAction("Telemedicine link shared with the patient thread.");
    setVideoConsultOpen(false);
  }

  function prepareVoiceNote() {
    setVoiceNoteReady(true);
    setDraft((current) => current || "[Voice note] Patient reports symptoms verbally. Please review and respond.");
    showToast("Voice note mode enabled. Browser recording can be connected to Firebase Storage in production.", "info");
  }

  function sendEmergencyMessage() {
    setPriority("emergency");
    void sendComposedMessage("Emergency message: patient needs urgent clinical review. Please escalate to the care team immediately.", "emergency", "Emergency escalation | Care team alert");
  }

  function handleFiles(files: FileList | null, kind: "file" | "image") {
    const names = Array.from(files ?? []).map((file) => file.name);
    if (!names.length) return;
    setAttachedFiles((current) => [...names, ...current].slice(0, 8));
    void sendComposedMessage(`${kind === "image" ? "Image" : "Document"} attached for review: ${names.join(", ")}`, "normal", kind === "image" ? "Patient image upload" : "Patient document upload");
  }

  function startSpeechToText() {
    const recognitionConstructor = (window as Window & {
      SpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null };
      webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null };
    }).SpeechRecognition ?? (window as Window & {
      webkitSpeechRecognition?: new () => { lang: string; start: () => void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null };
    }).webkitSpeechRecognition;

    if (!recognitionConstructor) {
      setDraft("Speech note: patient reports mild fever, elevated fasting sugar, and requests doctor advice.");
      showToast("Speech recognition is not available in this browser, so a sample speech note was added.", "warning");
      return;
    }

    const recognition = new recognitionConstructor();
    recognition.lang = language === "Sinhala" ? "si-LK" : language === "Tamil" ? "ta-LK" : "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setDraft(transcript);
      showToast("Speech converted to message draft.", "success");
    };
    recognition.onerror = () => showToast("Speech recognition could not capture audio.", "warning");
    recognition.start();
  }

  function applySuggestedReply() {
    setDraft(isDoctor ? "Please continue current medicines, monitor fever, drink fluids, and upload fasting sugar tomorrow morning. Seek emergency care if breathing difficulty, chest pain, confusion, or persistent high fever occurs." : "I have followed the care plan and uploaded my latest readings. Please review and advise if I should change anything.");
    showToast("Suggested reply added to the message box.", "success");
  }

  function sendSummary() {
    void sendComposedMessage(`Care summary shared: ${aiSummary}`, "normal", "AI-generated visit summary");
  }

  function createTask() {
    const task = isDoctor ? "Doctor task: Review uploaded readings and confirm medication plan." : "Patient task: Upload fasting blood sugar reading tomorrow morning.";
    setCareTasks((current) => [task, ...current].slice(0, 6));
    void sendComposedMessage(task, "normal", "Care task");
    recordCareAction(task);
    showToast("Care task created and shared in the conversation.", "success");
  }

  function handleCareAction(label: string) {
    const actions: Record<string, { text: string; linkedTo: string; task?: string; openVideo?: boolean }> = {
      "Send care plan": {
        text: "Care plan shared: continue prescribed medicines, monitor fever and blood sugar, maintain hydration, and return urgently if symptoms worsen.",
        linkedTo: "Care plan | Doctor instructions",
        task: "Patient task: Follow care plan and report warning symptoms.",
      },
      "Digital prescription": {
        text: "Digital prescription shared: Metformin 500mg after meals, Paracetamol as needed for fever, and pharmacy QR verification ready.",
        linkedTo: "Digital prescription | RX-443",
      },
      "Lab request": {
        text: "Laboratory request created: repeat FBC and fasting blood sugar. Please complete sample collection within 48 hours.",
        linkedTo: "Lab request | Repeat FBC and FBS",
        task: "Patient task: Complete repeat lab tests within 48 hours.",
      },
      "Discharge instructions": {
        text: "Discharge instructions shared: rest, hydration, medication adherence, fever monitoring, and follow-up clinic attendance.",
        linkedTo: "Discharge instructions | Released to patient",
      },
      "Educational material": {
        text: "Educational material shared: Diabetes sick-day rules, safe fever monitoring, medication adherence guide, and emergency warning signs.",
        linkedTo: "Patient education | Diabetes and fever",
      },
      "Telemedicine link": {
        text: "Telemedicine link is ready: https://meet.govcare.local/care-thread-demo. Please join at your appointment time.",
        linkedTo: "Telemedicine | Secure video consult",
        openVideo: true,
      },
      "Phone follow-up": {
        text: "Phone follow-up scheduled: care team will call to review fever pattern, blood sugar readings, and medication response.",
        linkedTo: "Phone follow-up | Care team call",
        task: "Care team task: Call patient for follow-up review.",
      },
    };

    const action = actions[label];
    if (!action) {
      quickAction(label);
      return;
    }

    if (action.openVideo) setVideoConsultOpen(true);
    if (action.task) setCareTasks((current) => [action.task as string, ...current].slice(0, 6));
    recordCareAction(`${label} completed.`);
    void sendComposedMessage(action.text, "normal", action.linkedTo);
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="page-hero flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Patient communication</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Secure doctor-patient conversation workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Messages between doctor and patient stay linked to visits, prescriptions, lab results, and care plans. Both sides can send and view the same conversation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openVideoConsult}><Video className="h-4 w-4" />Video consult</Button>
            <Button variant="outline" onClick={prepareVoiceNote}><Mic className="h-4 w-4" />Voice note</Button>
            <Button onClick={sendEmergencyMessage}><AlertTriangle className="h-4 w-4" />Emergency message</Button>
          </div>
        </div>

        {videoConsultOpen && (
          <Card className="border-cyan-200 bg-cyan-50">
            <CardContent className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div>
                <p className="font-bold text-cyan-950">Secure video consultation room</p>
                <p className="text-sm text-cyan-900">Waiting room: care-thread-demo | Timer ready | Consent checked | Patient and doctor join buttons enabled.</p>
              </div>
              <Button variant="outline" onClick={() => showToast("Doctor joined the video room.", "success")}><Video className="h-4 w-4" />Doctor join</Button>
              <Button onClick={sendTelemedicineLink}><Send className="h-4 w-4" />Send link</Button>
            </CardContent>
          </Card>
        )}

        <div className="help-strip grid gap-3 p-4 text-sm md:grid-cols-4">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />End-to-end encryption ready</div>
          <div className="flex items-center gap-2 font-semibold"><Languages className="h-4 w-4" />English, Sinhala, Tamil</div>
          <div className="flex items-center gap-2 font-semibold"><CheckCheck className="h-4 w-4" />Read receipts and typing status</div>
          <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" />{unreadCount} unread messages</div>
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.45fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Medical context</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="selection-panel p-3 text-sm">
                <p className="font-bold text-slate-950">Nimal Silva</p>
                <p className="text-muted-foreground">PAT-2026-000001 | Diabetes follow-up | Penicillin allergy</p>
              </div>
              {contextLinks.map(([type, id, detail]) => (
                <div key={`${type}-${id}`} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{type}</p>
                    <Badge tone="info">{id}</Badge>
                  </div>
                  <p className="text-muted-foreground">{detail}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => quickAction("Conversation search")}><Search className="h-4 w-4" />Search conversation</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary" />Secure conversation</span>
                <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />{isDoctor ? "Patient replies enabled" : "Doctor replies enabled"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === senderRole ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-lg border px-4 py-3 text-sm shadow-sm ${message.role === senderRole ? "border-teal-200 bg-teal-50 text-teal-950" : message.role === "system" ? "border-cyan-200 bg-cyan-50 text-cyan-950" : "border-border bg-white text-slate-800"}`}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold">{message.sender}</span>
                        <span className="text-xs opacity-70">{message.time}</span>
                      </div>
                      <p className="leading-6">{message.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={message.priority === "emergency" ? "danger" : message.priority === "urgent" ? "warning" : "neutral"}>{message.priority ?? "normal"}</Badge>
                        <Badge tone="info">{message.linkedTo}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs opacity-75"><CheckCheck className="h-3 w-3" />{message.receipt}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-[150px_150px_1fr]">
                <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option>English</option>
                  <option>Sinhala</option>
                  <option>Tamil</option>
                </Select>
                <Select value={priority} onChange={(event) => setPriority(event.target.value as CareMessagePriority)}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </Select>
                <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }} placeholder={isDoctor ? "Type advice, care plan, or follow-up message..." : "Type your reply to the doctor..."} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={sendMessage}><Send className="h-4 w-4" />Send</Button>
                <Button variant="outline" onClick={() => attachmentInputRef.current?.click()}><Paperclip className="h-4 w-4" />Attach</Button>
                <Button variant="outline" onClick={() => imageInputRef.current?.click()}><Camera className="h-4 w-4" />Image</Button>
                <Button variant="outline" onClick={startSpeechToText}><Mic className="h-4 w-4" />Speech to text</Button>
                <Button variant="outline" onClick={applySuggestedReply}>Suggested reply</Button>
              </div>
              <input ref={attachmentInputRef} className="hidden" type="file" multiple onChange={(event) => handleFiles(event.target.files, "file")} />
              <input ref={imageInputRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => handleFiles(event.target.files, "image")} />
              {(voiceNoteReady || attachedFiles.length > 0) && (
                <div className="grid gap-2 rounded-md border border-border bg-muted p-3 text-sm">
                  {voiceNoteReady && <p className="font-medium text-slate-800">Voice note mode is active. Use Speech to text or send the prepared voice-note draft.</p>}
                  {attachedFiles.length > 0 && <p className="text-muted-foreground">Recent attachments: {attachedFiles.join(", ")}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Care actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Send care plan", FileText],
                ["Digital prescription", Pill],
                ["Lab request", ClipboardList],
                ["Discharge instructions", FileText],
                ["Educational material", Upload],
                ["Telemedicine link", Video],
                ["Phone follow-up", PhoneCall],
              ].map(([label, Icon]) => (
                <Button key={label as string} variant="outline" className="w-full justify-start" onClick={() => handleCareAction(label as string)}>
                  <Icon className="h-4 w-4" />{label as string}
                </Button>
              ))}
              {careActionLog.length > 0 && (
                <div className="rounded-md border border-border bg-muted p-3 text-sm">
                  <p className="mb-2 font-bold text-slate-950">Completed actions</p>
                  <div className="space-y-2">
                    {careActionLog.map((item) => (
                      <p key={item} className="rounded-md border border-border bg-white px-3 py-2 text-slate-700">{item}</p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ActivityIcon />Patient-reported outcomes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium">Pain score<Input type="number" min={0} max={10} value={pain} onChange={(event) => setPain(Number(event.target.value))} /></label>
                <label className="text-sm font-medium">Mood score<Input type="number" min={0} max={10} value={mood} onChange={(event) => setMood(Number(event.target.value))} /></label>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trackers}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="pain" stroke="#be123c" strokeWidth={2} />
                    <Line type="monotone" dataKey="mood" stroke="#0f766e" strokeWidth={2} />
                    <Line type="monotone" dataKey="sugar" stroke="#155e75" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Button className="w-full" onClick={() => quickAction("Symptom report")}><Smile className="h-4 w-4" />Submit symptom report</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Reminders</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {reminders.map(([type, title, due]) => (
                <div key={`${type}-${title}`} className="rounded-md border border-border bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-950">{title}</p>
                    <Badge tone={type === "Medication" ? "success" : type === "Lab" ? "warning" : "info"}>{type}</Badge>
                  </div>
                  <p className="text-muted-foreground">{due}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Consent and safety</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="selection-panel p-3">
                <p className="font-bold text-slate-950">Messaging consent active</p>
                <p className="text-muted-foreground">Patient allows care-team messaging, file sharing, reminders, and telemedicine links.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">E2E encryption ready</Badge>
                <Badge tone="info">Audit logs</Badge>
                <Badge tone="warning">Emergency escalation</Badge>
                <Badge tone="neutral">Offline read cache</Badge>
              </div>
              <p className="text-muted-foreground">Production storage should use Firestore rules, role custom claims, App Check, encrypted message payloads, and immutable audit logs for every view, send, edit, upload, and download.</p>
            </CardContent>
          </Card>
        </section>

        <SectionReveal>
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />AI-generated visit summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="selection-panel p-4 text-sm leading-6">{aiSummary}</p>
              <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={sendSummary}><FileText className="h-4 w-4" />Send summary</Button>
                  <Button variant="outline" onClick={createTask}><ClipboardList className="h-4 w-4" />Create task</Button>
                </div>
                {careTasks.length > 0 && (
                  <div className="grid gap-2">
                    {careTasks.map((task) => (
                      <p key={task} className="rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-800">{task}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5 text-primary" />Translation and education</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="help-strip p-3 text-sm">Messages can be translated between English, Sinhala, and Tamil before sending. Clinical meaning should be confirmed before urgent decisions.</p>
                <div className="grid gap-2">
                  {education.map((item) => (
                    <button key={item} className="interactive-control rounded-md border border-border bg-white px-3 py-3 text-left text-sm font-medium text-slate-800" onClick={() => quickAction(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </SectionReveal>
      </div>
    </PageTransition>
  );
}

function ActivityIcon() {
  return <ClipboardList className="h-5 w-5 text-primary" />;
}

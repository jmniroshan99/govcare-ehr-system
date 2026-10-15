import { clinicalAssessmentHref } from "../../utils/patientNavigation";
import {
  Ambulance,
  BarChart3,
  BedDouble,
  Building2,
  BrainCircuit,
  Bell,
  BellRing,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Droplets,
  FileCheck2,
  FileClock,
  FileImage,
  FlaskConical,
  HeartPulse,
  HelpCircle,
  Languages,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Pill,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  UserCircle,
  UserPlus,
  UserRoundCog,
  UsersRound,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { SmartSearch } from "../search/SmartSearch";
import { useAuthStore } from "../../stores/authStore";
import { logout } from "../../services/authService";
import { roleLabels } from "../../lib/rbac";
import { defaultHomeForProfile, roleModuleSummary } from "../../lib/accessControl";
import { canAccessPath } from "../../lib/roleAccess";
import { cn } from "../../lib/utils";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../ui/toast-context";
import type { Role } from "../../types/ehr";
import { languageOptions } from "../../i18n";
import { ensureNotificationsSeeded, NOTIFICATIONS_UPDATED_EVENT, unreadCountForRole } from "../../utils/notifications";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { preloadRoute } from "../../routes/routePreload";

interface SidebarEntry {
  href: string;
  label: string;
  translationKey?: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  shortcut?: string;
}

interface SidebarGroup {
  title: string;
  translationKey?: string;
  icon: typeof LayoutDashboard;
  entries: SidebarEntry[];
}


const sidebarGroups: SidebarGroup[] = [
  {
    title: "Command",
    translationKey: "layout.groups.command",
    icon: LayoutDashboard,
    entries: [
      { href: "/", label: "Dashboard", translationKey: "nav.dashboard", icon: LayoutDashboard, badge: "Live", shortcut: "D" },
      { href: "/efficiency", label: "Efficiency Center", translationKey: "nav.efficiencyCenter", icon: Sparkles, badge: "New", shortcut: "E" },
      { href: "/profile", label: "Profile", translationKey: "nav.profile", icon: UserCircle },
      { href: "/portal", label: "My Health", translationKey: "nav.myHealth", icon: UserCircle },
      { href: "/portal/medical-reports", label: "Official Medical Reports", translationKey: "nav.officialMedicalReports", icon: FileCheck2 },
      { href: "/portal/care-summary", label: "Care Summary", translationKey: "nav.careSummary", icon: HeartPulse },
      { href: "/portal/messages", label: "Secure Chat", translationKey: "nav.careMessages", icon: MessageSquareText, shortcut: "C" },
      { href: "/media", label: "Media Center", translationKey: "nav.mediaCenter", icon: FileImage, badge: "Upload" },
      { href: "/doctor", label: "Telemedicine", translationKey: "nav.telemedicine", icon: Video },
    ],
  },
  {
    title: "Patient Management",
    translationKey: "layout.groups.patientManagement",
    icon: UsersRound,
    entries: [
      { href: "/patients/register", label: "Patient Registration", translationKey: "nav.patientRegistration", icon: UserPlus },
      { href: "/admin/patient-fields", label: "Patient Field Policy", translationKey: "nav.patientFieldPolicy", icon: Settings },
      { href: "/patients/search", label: "Patient Identification", translationKey: "nav.patientSearch", icon: UsersRound, badge: "QR" },
      { href: "/guardians", label: "Guardian Management", translationKey: "nav.guardianManagement", icon: UsersRound },
      { href: "/opd", label: "OPD Queue", translationKey: "nav.opdQueue", icon: ClipboardList, shortcut: "O" },
      { href: "/appointments", label: "Appointments", translationKey: "nav.appointments", icon: BellRing },
    ],
  },
  {
    title: "Clinical Care",
    translationKey: "layout.groups.clinicalCare",
    icon: Stethoscope,
    entries: [
      { href: "/doctor", label: "Doctor Center", translationKey: "nav.doctorCenter", icon: Stethoscope },
      { href: "/doctor/workspace", label: "Consult Workspace", translationKey: "nav.consultWorkspace", icon: ClipboardList },
      { href: "/wards", label: "Ward Management", translationKey: "nav.wardManagement", icon: BedDouble },
      { href: "/admissions", label: "Admissions", translationKey: "nav.admissions", icon: BedDouble },
      { href: "/nurse-notes", label: "Nurse Module", translationKey: "nav.nurseModule", icon: ClipboardList },
      { href: "/emergency", label: "Emergency Department", translationKey: "nav.emergency", icon: Ambulance, badge: "ETU" },
    ],
  },
  {
    title: "Diagnostics and Treatment",
    translationKey: "layout.groups.diagnosticsTreatment",
    icon: FlaskConical,
    entries: [
      { href: "/pharmacy", label: "Pharmacy", translationKey: "nav.pharmacy", icon: Pill },
      { href: "/laboratory", label: "Laboratory", translationKey: "nav.laboratory", icon: FlaskConical },
      { href: "/laboratory/blood-reports", label: "Blood Reports", icon: FileCheck2 },
      { href: "/radiology", label: "Radiology", translationKey: "nav.radiology", icon: Radio },
      { href: "/media", label: "Media Center", translationKey: "nav.mediaCenter", icon: FileImage },
      { href: "/laboratory", label: "Blood Bank", translationKey: "nav.bloodBank", icon: Droplets },
      { href: "/operation-theatre", label: "Surgery", translationKey: "nav.surgery", icon: Stethoscope },
    ],
  },
  {
    title: "Clinical Intelligence",
    translationKey: "layout.groups.clinicalIntelligence",
    icon: BrainCircuit,
    entries: [
      { href: "/ai-dashboard", label: "AI Intelligence Center", icon: BrainCircuit },
      { href: "/ai-cdss", label: "Patient Deterioration AI-CDSS", icon: HeartPulse },
      { href: "/ai-cdss/ckd", label: "CKD & Clinical Intelligence", icon: BrainCircuit },
    ],
  },
  {
    title: "Governance",
    translationKey: "layout.groups.governance",
    icon: ShieldCheck,
    entries: [
      { href: "/super-admin", label: "Super Admin", translationKey: "nav.superAdmin", icon: ShieldCheck },
      { href: "/admin/facilities", label: "Hospital Setup", icon: Building2, badge: "Admin" },
      { href: "/efficiency", label: "Efficiency Center", translationKey: "nav.efficiencyCenter", icon: Sparkles },
      { href: "/reports", label: "Reports and Analytics", translationKey: "nav.reports", icon: BarChart3 },
      { href: "/medical-report-review", label: "Medical Report Review", translationKey: "nav.medicalReportReview", icon: FileCheck2 },
      { href: "/notifications", label: "Notifications", translationKey: "nav.notifications", icon: Bell },
      { href: "/admin/staff", label: "Staff Management", translationKey: "nav.staffManagement", icon: UserRoundCog },
      { href: "/audit-logs", label: "Audit Logs", translationKey: "nav.auditLogs", icon: FileClock },
      { href: "/admin/login-activity", label: "Login Activity", translationKey: "nav.loginActivity", icon: LogIn },
      { href: "/settings", label: "Settings", translationKey: "nav.settings", icon: Settings },
      { href: "/settings", label: "Help Center", translationKey: "nav.helpCenter", icon: CircleHelp },
    ],
  },
];


export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Command: true,
    "Patient Management": true,
    "Clinical Care": true,
  });
  const [navSearch, setNavSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const role = profile?.role;
  const clearAuth = useAuthStore((state) => state.clear);
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { online, queued, syncing, syncNow } = useOfflineStatus();
  const [unreadNotifications, setUnreadNotifications] = useState(() => unreadCountForRole(role));

  useEffect(() => {
    if (location.pathname === "/ai-cdss" || location.pathname.startsWith("/ai-cdss/")) {
      setOpenGroups((current) => ({ ...current, "Clinical Intelligence": true }));
    }
  }, [location.pathname]);

  const expanded = desktopExpanded || mobileOpen;

  useEffect(() => {
    ensureNotificationsSeeded();
    function refreshUnread() {
      setUnreadNotifications(unreadCountForRole(role));
    }
    refreshUnread();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshUnread);
    window.addEventListener("storage", refreshUnread);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshUnread);
      window.removeEventListener("storage", refreshUnread);
    };
  }, [role]);

  const visibleGroups = useMemo(() => {
    const query = navSearch.toLowerCase();
    return sidebarGroups
      .map((group) => ({
        ...group,
        entries: group.entries
          .map((entry) => entry.href === "/" && profile ? { ...entry, href: defaultHomeForProfile(profile) } : entry)
          .filter((entry) => {
            const allowed = canAccessPath(profile, entry.href);
            const translatedEntry = entry.translationKey ? t(entry.translationKey) : entry.label;
            const translatedGroup = group.translationKey ? t(group.translationKey) : group.title;
            const matches = !query || translatedEntry.toLowerCase().includes(query) || translatedGroup.toLowerCase().includes(query);
            return allowed && matches;
          })
          .map((entry) => entry.href === "/notifications" ? { ...entry, badge: unreadNotifications > 0 ? String(unreadNotifications) : undefined } : entry),
      }))
      .filter((group) => group.entries.length > 0);
  }, [navSearch, profile, role, t, unreadNotifications]);

  async function handleLogout() {
    await logout("logged_out");
    window.sessionStorage.removeItem("govcare-auth-mode");
    window.sessionStorage.removeItem("govcare-login-intent");
    clearAuth();
    navigate("/login", { replace: true });
  }

  function handleThemeToggle() {
    toggleTheme();
    showToast(isDark ? t("lightMode") : t("darkMode"), "info");
  }

  function handleLanguageChange(language: string) {
    void i18n.changeLanguage(language);
    showToast(t("languageChanged"), "info");
  }

  function toggleGroup(title: string) {
    setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
  }

  return (
    <div className="gov-shell min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-control-border focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-foreground">Skip to main content</a>
      <div className="fixed inset-y-0 left-0 z-30 hidden w-4 lg:block" onMouseEnter={() => setDesktopExpanded(true)} aria-hidden="true" />
      <motion.aside
        initial={false}
        animate={{ width: expanded ? 300 : 76, x: mobileOpen || desktopExpanded ? 0 : 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={() => setDesktopExpanded(true)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) setDesktopExpanded(false);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDesktopExpanded(false);
        }}
        className={cn(
          "gov-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-accent-border bg-surface shadow-2xl shadow-shadow-tone backdrop-blur-xl lg:block",
          "dark:border-accent-border dark:bg-surface",
        )}
      >
        <SidebarContent
          expanded={expanded}
          groups={visibleGroups}
          openGroups={openGroups}
          navSearch={navSearch}
          role={role}
          setNavSearch={setNavSearch}
          toggleGroup={toggleGroup}
          onNavigate={() => setMobileOpen(false)}
          onExpand={() => setDesktopExpanded(true)}
          profile={profile}
        />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-backdrop backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="gov-sidebar fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] border-r border-border bg-surface shadow-2xl backdrop-blur-xl dark:border-accent-border dark:bg-surface lg:hidden"
              initial={{ x: -340 }}
              animate={{ x: 0 }}
              exit={{ x: -340 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute right-3 top-3">
                <Button variant="outline" className="min-h-9 px-3 py-1.5" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></Button>
              </div>
              <SidebarContent
                expanded
                groups={visibleGroups}
                openGroups={openGroups}
                navSearch={navSearch}
                role={role}
                setNavSearch={setNavSearch}
                toggleGroup={toggleGroup}
                onNavigate={() => setMobileOpen(false)}
                onExpand={() => setMobileOpen(true)}
                profile={profile}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0 transition-[padding] duration-300 lg:pl-[82px]">
        <motion.header
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="gov-topbar sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 backdrop-blur dark:bg-surface"
        >
          <Button variant="ghost" className="w-10 px-0 lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <SmartSearch className="order-last w-full flex-none sm:order-none sm:min-w-0 sm:flex-1 sm:basis-40 lg:max-w-xl" placeholder={t("search")} />
          {location.pathname.startsWith("/patients/") && role && ["super_admin", "hospital_admin", "doctor", "pathologist"].includes(role) && <Button variant="outline" className="hidden border-accent-border px-3 text-accent md:inline-flex" onClick={() => navigate(clinicalAssessmentHref(location.pathname))}><BrainCircuit className="h-4 w-4" />Open AI Clinical Assessment</Button>}
          <Button variant="outline" className="hidden px-3 2xl:inline-flex" aria-label={t("help")} onClick={() => navigate("/settings")}>
            <HelpCircle className="h-4 w-4" />{t("help")}
          </Button>
          <label className="inline-flex h-10 w-[84px] shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-2 text-sm font-semibold text-foreground sm:w-auto dark:bg-surface dark:text-foreground" title={t("translate")}>
            <Languages className="hidden h-4 w-4 text-accent md:block" />
            <span className="hidden 2xl:inline">{t("translate")}</span>
            <select className="min-w-0 w-full bg-transparent text-xs outline-none sm:w-auto sm:max-w-28 sm:text-sm 2xl:max-w-none" value={i18n.language} onChange={(event) => handleLanguageChange(event.target.value)} aria-label={t("translate")}>
              {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.nativeLabel}</option>)}
            </select>
          </label>
          <Button variant="outline" className="relative w-10 shrink-0 px-0" aria-label={t("notifications")} onClick={() => navigate("/notifications")}>
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger-solid px-1 text-[10px] font-bold text-on-solid">{unreadNotifications}</span>}
          </Button>
          <Button
            variant="outline"
            className={cn("w-10 shrink-0 px-0 sm:w-auto sm:px-3", online ? "border-success-border text-success dark:text-success" : "border-warning-border text-warning dark:text-warning")}
            aria-label={online ? `${queued} offline actions queued` : "Offline mode"}
            title={online ? `${queued} queued actions` : "Working from cached data"}
            disabled={syncing}
            onClick={() => {
              if (!online) {
                showToast("Offline mode: safe changes will be queued and synchronized after reconnection.", "warning");
                return;
              }
              void syncNow().then(() => showToast(queued ? "Offline actions synchronized." : "All data is synchronized.", "success"));
            }}
          >
            {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="hidden xl:inline">{online ? (queued ? `${queued} queued` : "Online") : "Offline"}</span>
            {queued > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warning-solid px-1 text-[10px] font-bold text-on-solid">{queued}</span>}
          </Button>
          <Button variant="outline" className="w-10 shrink-0 px-0" onClick={handleThemeToggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isDark ? "Light mode" : "Dark mode"}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="hidden min-w-0 max-w-56 items-center justify-end gap-3 text-right xl:flex">
            {profile?.photoURL ? <img className="h-10 w-10 rounded-full object-cover ring-2 ring-accent-border" src={profile.photoURL} alt={profile.displayName} /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-surface text-sm font-bold text-accent ring-2 ring-accent-border">{profile?.displayName?.slice(0, 2).toUpperCase() ?? "GC"}</div>}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground dark:text-foreground">{profile?.displayName ?? t("signedInUser")}</p>
              <div className="mt-0.5 flex flex-wrap justify-end gap-1 text-xs">
                <span className="rounded-full bg-accent-surface px-2 py-0.5 font-bold text-accent dark:bg-accent-solid dark:text-accent">{role ? roleLabels[role] : t("noRole")}</span>
                {profile?.departmentName || profile?.departmentId ? <span className="rounded-full bg-muted px-2 py-0.5 text-foreground dark:bg-surface dark:text-foreground">{profile.departmentName ?? profile.departmentId}</span> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{profile?.hospitalName ?? profile?.hospitalId ?? t("governmentNetwork")}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-10 shrink-0 px-0" onClick={handleLogout} aria-label={t("logout")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </motion.header>
        {!online && <div className="border-b border-warning-border bg-warning-surface px-4 py-2 text-center text-sm font-semibold text-warning dark:border-warning-border dark:bg-warning-solid dark:text-warning">Offline mode: cached records remain available. Safe drafts and messages will synchronize automatically; approvals, dispensing, and stock changes require a connection.</div>}
        <main id="main-content" className="gov-main mx-auto flex min-h-screen w-full max-w-[1680px] min-w-0 flex-1 flex-col p-4 sm:p-6" tabIndex={-1}>
          {(location.pathname === "/ai-cdss" || location.pathname === "/ai-cdss/ckd") && <AiCdssContextBar path={location.pathname} />}
          {children}
        </main>
      </div>
    </div>
  );
}

function AiCdssContextBar({ path }: { path: string }) {
  const navigate = useNavigate();
  const ckd = path === "/ai-cdss/ckd";
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-border bg-accent-surface px-4 py-3 text-sm dark:border-accent-border dark:bg-accent-surface"><p className="font-semibold text-accent dark:text-accent">AI Clinical Decision Support <span className="mx-2 text-accent">/</span><span className="font-normal">{ckd ? "CKD Risk Assessment" : "Patient Deterioration"}</span></p><label className="flex min-w-0 max-w-full flex-wrap items-center gap-2 font-semibold text-accent dark:text-accent">Switch AI assessment<select className="min-w-0 max-w-full rounded-md border border-accent-border bg-surface px-2 py-1 dark:bg-surface" value={ckd ? "/ai-cdss/ckd" : "/ai-cdss"} onChange={e => navigate(e.target.value)} aria-label="Switch AI assessment"><option value="/ai-cdss">Patient Deterioration Assessment</option><option value="/ai-cdss/ckd">CKD Risk Assessment</option></select></label></div>;
}

function SidebarContent({
  expanded,
  groups,
  openGroups,
  navSearch,
  role,
  setNavSearch,
  toggleGroup,
  onNavigate,
  onExpand,
  profile,
}: {
  expanded: boolean;
  groups: SidebarGroup[];
  openGroups: Record<string, boolean>;
  navSearch: string;
  role?: Role;
  setNavSearch: (value: string) => void;
  toggleGroup: (title: string) => void;
  onNavigate: () => void;
  onExpand: () => void;
  profile?: { displayName: string; role: Role; hospitalId: string; hospitalName?: string; departmentId?: string; departmentName?: string; photoURL?: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-border px-4">
        {profile?.photoURL ? <img className="h-12 w-12 shrink-0 rounded-md object-cover shadow-sm ring-1 ring-border" src={profile.photoURL} alt={profile.displayName} /> : <img className="h-12 w-12 shrink-0 rounded-md bg-surface object-contain p-1 shadow-sm ring-1 ring-border" src="/ministry-health-logo.png" alt="Ministry of Health logo" />}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground dark:text-foreground">{profile?.displayName ?? "GovCare EHR"}</p>
              <p className="truncate text-xs text-muted-foreground">{role ? roleLabels[role] : "Government network"} | {profile?.hospitalName ?? profile?.hospitalId ?? "Government network"}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {expanded && role && (
        <div className="px-3 pb-2">
          <div className="rounded-md border border-accent-border bg-accent-surface p-3 text-xs text-accent dark:border-accent-border dark:bg-accent-solid dark:text-accent">
            <p className="font-bold">Allowed modules</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {roleModuleSummary[role].slice(0, 5).map((module) => <span key={module} className="rounded-full bg-surface px-2 py-0.5 font-semibold text-accent dark:bg-surface dark:text-accent">{module}</span>)}
            </div>
          </div>
        </div>
      )}

      <div className="p-3">
        {expanded ? (
          <SmartSearch
            inputClassName="h-10"
            navigateOnSelect
            onChange={setNavSearch}
            placeholder={t("layout.searchModules")}
            value={navSearch}
          />
        ) : (
          <button type="button" onClick={onExpand} className="interactive-control grid h-10 w-full place-items-center rounded-md border border-accent-border bg-accent-surface text-accent" title={t("layout.searchModules")} aria-label={t("layout.searchModules")}>
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const isOpen = openGroups[group.title] ?? true;
          const groupLabel = group.translationKey ? t(group.translationKey) : group.title;
          return (
            <div key={group.title} className="mb-2">
              {expanded ? <button
                className={cn("interactive-control flex min-h-10 w-full items-center rounded-md px-3 text-left text-xs font-bold uppercase text-muted-foreground hover:bg-muted", expanded ? "justify-between" : "justify-center")}
                onClick={() => toggleGroup(group.title)}
                type="button"
                title={groupLabel}
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <group.icon className="h-4 w-4" />
                  {expanded && groupLabel}
                </span>
                {expanded && <ChevronDown className={cn("h-4 w-4 transition", isOpen && "rotate-180")} />}
              </button> : <div className="flex min-h-10 items-center justify-center text-muted-foreground" role="separator" aria-label={groupLabel} title={groupLabel}><group.icon className="h-4 w-4" /></div>}
              <AnimatePresence initial={false}>
                {(expanded ? isOpen : true) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {group.entries.map((entry) => (
                      <NavLink
                        key={`${group.title}-${entry.label}-${entry.href}`}
                        to={entry.href}
                        end={entry.href.startsWith("/ai-cdss")}
                        onClick={onNavigate}
                        onFocus={() => preloadRoute(entry.href)}
                        onMouseEnter={() => preloadRoute(entry.href)}
                        onTouchStart={() => preloadRoute(entry.href)}
                        title={entry.translationKey ? t(entry.translationKey) : entry.label}
                        aria-label={!expanded ? `${entry.translationKey ? t(entry.translationKey) : entry.label}${entry.badge ? `: ${entry.badge}` : ""}` : undefined}
                        accessKey={entry.shortcut?.toLowerCase()}
                        className={({ isActive }) =>
                          cn(
                            "interactive-control relative my-1 flex min-h-11 items-center rounded-md text-sm font-semibold text-foreground hover:bg-accent-surface hover:text-accent dark:text-foreground dark:hover:bg-accent-solid dark:hover:text-accent",
                            expanded ? "gap-3 px-3" : "justify-center px-2",
                            isActive && "bg-accent-surface text-accent shadow-sm ring-1 ring-accent-border dark:bg-accent-surface dark:text-on-solid dark:ring-accent-border",
                          )
                        }
                      >
                        <entry.icon className="h-4 w-4 shrink-0" />
                        {expanded && <span className="min-w-0 flex-1 truncate">{entry.translationKey ? t(entry.translationKey) : entry.label}</span>}
                        {expanded && entry.shortcut && <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Alt+{entry.shortcut}</span>}
                        {entry.badge && (expanded
                          ? <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{entry.badge}</span>
                          : <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-solid ring-2 ring-border" />)}
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className={cn("rounded-md border border-accent-border bg-accent-surface p-3 text-xs text-accent", !expanded && "grid place-items-center p-2")}>
          {expanded ? (
            <>
              <p className="font-bold">{t("layout.autoHideTitle")}</p>
              <p className="mt-1">{t("layout.autoHideDescription")}</p>
            </>
          ) : (
            <LayoutDashboard className="h-4 w-4" />
          )}
        </div>
      </div>
    </div>
  );
}

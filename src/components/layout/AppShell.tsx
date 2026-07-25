import {
  Ambulance,
  BarChart3,
  BedDouble,
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
  UsersRound,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { SmartSearch } from "../search/SmartSearch";
import { navItems } from "./navItems";
import { useAuthStore } from "../../stores/authStore";
import { logout } from "../../services/authService";
import { closeLoginSession } from "../../services/loginActivityService";
import { roleLabels } from "../../lib/rbac";
import { roleModuleSummary } from "../../lib/accessControl";
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
  roles?: Role[];
}

interface SidebarGroup {
  title: string;
  translationKey?: string;
  icon: typeof LayoutDashboard;
  entries: SidebarEntry[];
}

const fallbackRoles: Role[] = ["super_admin", "hospital_admin", "doctor", "surgeon", "anesthetist", "nurse", "pharmacist", "pathologist", "lab_manager", "lab_technician", "radiologist", "radiology_technician", "receptionist", "mortuary_officer", "ict_admin", "records_officer"];

const sidebarGroups: SidebarGroup[] = [
  {
    title: "Command",
    translationKey: "layout.groups.command",
    icon: LayoutDashboard,
    entries: [
      { href: "/", label: "Dashboard", translationKey: "nav.dashboard", icon: LayoutDashboard, badge: "Live", shortcut: "D" },
      { href: "/efficiency", label: "Efficiency Center", translationKey: "nav.efficiencyCenter", icon: Sparkles, badge: "New", shortcut: "E" },
      { href: "/portal", label: "My Health", translationKey: "nav.myHealth", icon: UserCircle, roles: ["patient"] },
      { href: "/portal/medical-reports", label: "Official Medical Reports", translationKey: "nav.officialMedicalReports", icon: FileCheck2, roles: ["patient"] },
      { href: "/portal/care-summary", label: "Care Summary", translationKey: "nav.careSummary", icon: HeartPulse, roles: ["doctor", "nurse", "patient"] },
      { href: "/portal/messages", label: "Secure Chat", translationKey: "nav.careMessages", icon: MessageSquareText, badge: "3", shortcut: "C", roles: ["doctor", "nurse", "patient"] },
      { href: "/media", label: "Media Center", translationKey: "nav.mediaCenter", icon: FileImage, badge: "Upload" },
      { href: "/doctor", label: "Telemedicine", translationKey: "nav.telemedicine", icon: Video, roles: ["super_admin", "hospital_admin", "doctor"] },
    ],
  },
  {
    title: "Patient Management",
    translationKey: "layout.groups.patientManagement",
    icon: UsersRound,
    entries: [
      { href: "/patients/register", label: "Patient Registration", translationKey: "nav.patientRegistration", icon: UserPlus },
      { href: "/admin/patient-fields", label: "Patient Field Policy", translationKey: "nav.patientFieldPolicy", icon: Settings, roles: ["super_admin", "hospital_admin", "ict_admin"] },
      { href: "/patients/search", label: "Patient Identification", translationKey: "nav.patientSearch", icon: UsersRound, badge: "QR" },
      { href: "/guardians", label: "Guardian Management", translationKey: "nav.guardianManagement", icon: UsersRound },
      { href: "/patients/PAT-2026-0001", label: "Patient Profile", translationKey: "nav.patientProfile", icon: UserCircle },
      { href: "/opd", label: "OPD Queue", translationKey: "nav.opdQueue", icon: ClipboardList, badge: "42", shortcut: "O" },
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
      { href: "/radiology", label: "Radiology", translationKey: "nav.radiology", icon: Radio },
      { href: "/media", label: "Media Center", translationKey: "nav.mediaCenter", icon: FileImage },
      { href: "/laboratory", label: "Blood Bank", translationKey: "nav.bloodBank", icon: Droplets },
      { href: "/operation-theatre", label: "Surgery", translationKey: "nav.surgery", icon: Stethoscope },
    ],
  },
  {
    title: "Governance",
    translationKey: "layout.groups.governance",
    icon: ShieldCheck,
    entries: [
      { href: "/super-admin", label: "Super Admin", translationKey: "nav.superAdmin", icon: ShieldCheck, roles: ["super_admin"] },
      { href: "/efficiency", label: "Efficiency Center", translationKey: "nav.efficiencyCenter", icon: Sparkles },
      { href: "/reports", label: "Reports and Analytics", translationKey: "nav.reports", icon: BarChart3 },
      { href: "/medical-report-review", label: "Medical Report Review", translationKey: "nav.medicalReportReview", icon: FileCheck2 },
      { href: "/notifications", label: "Notifications", translationKey: "nav.notifications", icon: Bell, badge: "8" },
      { href: "/admin/users", label: "User Management", translationKey: "nav.userManagement", icon: ShieldCheck },
      { href: "/audit-logs", label: "Audit Logs", translationKey: "nav.auditLogs", icon: FileClock },
      { href: "/admin/login-activity", label: "Login Activity", translationKey: "nav.loginActivity", icon: LogIn },
      { href: "/settings", label: "Settings", translationKey: "nav.settings", icon: Settings },
      { href: "/settings", label: "Help Center", translationKey: "nav.helpCenter", icon: CircleHelp },
    ],
  },
];

function rolesForHref(href: string) {
  return navItems.find((item) => item.href === href)?.roles ?? fallbackRoles;
}

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
  const { t, i18n } = useTranslation();
  const profile = useAuthStore((state) => state.profile);
  const role = profile?.role;
  const clearAuth = useAuthStore((state) => state.clear);
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { online, queued, syncing, syncNow } = useOfflineStatus();
  const [unreadNotifications, setUnreadNotifications] = useState(() => unreadCountForRole(role));

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
          .filter((entry) => {
            const allowedRoles = entry.roles ?? rolesForHref(entry.href);
            const allowed = role ? allowedRoles.includes(role) : false;
            const translatedEntry = entry.translationKey ? t(entry.translationKey) : entry.label;
            const translatedGroup = group.translationKey ? t(group.translationKey) : group.title;
            const matches = !query || translatedEntry.toLowerCase().includes(query) || translatedGroup.toLowerCase().includes(query);
            return allowed && matches;
          })
          .map((entry) => entry.href === "/notifications" ? { ...entry, badge: unreadNotifications > 0 ? String(unreadNotifications) : undefined } : entry),
      }))
      .filter((group) => group.entries.length > 0);
  }, [navSearch, role, t, unreadNotifications]);

  async function handleLogout() {
    await closeLoginSession("logged_out");
    await logout();
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
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-4 lg:block" onMouseEnter={() => setDesktopExpanded(true)} aria-hidden="true" />
      <motion.aside
        initial={false}
        animate={{ width: expanded ? 304 : 82, x: mobileOpen || desktopExpanded ? 0 : 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={() => setDesktopExpanded(true)}
        onMouseLeave={() => setDesktopExpanded(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-white/30 bg-white/78 shadow-2xl shadow-slate-900/10 backdrop-blur-xl lg:block",
          "dark:border-teal-200/10 dark:bg-slate-950/72",
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
          profile={profile}
        />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] border-r border-white/30 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-teal-200/10 dark:bg-slate-950/92 lg:hidden"
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
          className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-white/90 px-4 py-2 backdrop-blur dark:bg-slate-950/90"
        >
          <Button variant="ghost" className="w-10 px-0 lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <SmartSearch className="max-w-xl flex-1" placeholder={t("search")} />
          <Button variant="outline" className="hidden px-3 md:inline-flex" aria-label={t("help")} onClick={() => navigate("/settings")}>
            <HelpCircle className="h-4 w-4" />{t("help")}
          </Button>
          <label className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-2 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-50" title={t("translate")}>
            <Languages className="h-4 w-4 text-primary" />
            <span className="hidden md:inline">{t("translate")}</span>
            <select className="max-w-28 bg-transparent text-sm outline-none sm:max-w-none" value={i18n.language} onChange={(event) => handleLanguageChange(event.target.value)} aria-label={t("translate")}>
              {languageOptions.map((language) => <option key={language.code} value={language.code}>{language.nativeLabel}</option>)}
            </select>
          </label>
          <Button variant="outline" className="relative w-10 px-0" aria-label={t("notifications")} onClick={() => navigate("/notifications")}>
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unreadNotifications}</span>}
          </Button>
          <Button
            variant="outline"
            className={cn("px-2 sm:px-3", online ? "border-emerald-300 text-emerald-800 dark:text-emerald-200" : "border-amber-400 text-amber-900 dark:text-amber-100")}
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
            {queued > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">{queued}</span>}
          </Button>
          <Button variant="outline" className="w-10 px-0" onClick={handleThemeToggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isDark ? "Light mode" : "Dark mode"}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="hidden min-w-52 items-center justify-end gap-3 text-right sm:flex">
            {profile?.photoURL ? <img className="h-10 w-10 rounded-full object-cover ring-2 ring-teal-100" src={profile.photoURL} alt={profile.displayName} /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-50 text-sm font-bold text-primary ring-2 ring-teal-100">{profile?.displayName?.slice(0, 2).toUpperCase() ?? "GC"}</div>}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{profile?.displayName ?? t("signedInUser")}</p>
              <div className="mt-0.5 flex flex-wrap justify-end gap-1 text-xs">
                <span className="rounded-full bg-teal-50 px-2 py-0.5 font-bold text-primary dark:bg-teal-950 dark:text-teal-100">{role ? roleLabels[role] : t("noRole")}</span>
                {profile?.departmentName || profile?.departmentId ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-100">{profile.departmentName ?? profile.departmentId}</span> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{profile?.hospitalName ?? profile?.hospitalId ?? t("governmentNetwork")}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-10 px-0" onClick={handleLogout} aria-label={t("logout")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </motion.header>
        {!online && <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">Offline mode: cached records remain available. Safe drafts and messages will synchronize automatically; approvals, dispensing, and stock changes require a connection.</div>}
        <main className="mx-auto w-full max-w-[1480px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
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
  profile?: { displayName: string; role: Role; hospitalId: string; hospitalName?: string; departmentId?: string; departmentName?: string; photoURL?: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-white/30 px-4">
        {profile?.photoURL ? <img className="h-12 w-12 shrink-0 rounded-md object-cover shadow-sm ring-1 ring-border" src={profile.photoURL} alt={profile.displayName} /> : <img className="h-12 w-12 shrink-0 rounded-md bg-white object-contain p-1 shadow-sm ring-1 ring-border" src="/ministry-health-logo.png" alt="Ministry of Health logo" />}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">{profile?.displayName ?? "GovCare EHR"}</p>
              <p className="truncate text-xs text-muted-foreground">{role ? roleLabels[role] : "Government network"} | {profile?.hospitalName ?? profile?.hospitalId ?? "Government network"}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {expanded && role && (
        <div className="px-3 pb-2">
          <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-50">
            <p className="font-bold">Allowed modules</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {roleModuleSummary[role].slice(0, 5).map((module) => <span key={module} className="rounded-full bg-white px-2 py-0.5 font-semibold text-primary dark:bg-slate-900 dark:text-teal-100">{module}</span>)}
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
          <div className="grid h-10 place-items-center rounded-md border border-teal-200 bg-teal-50 text-primary" title="Search modules">
            <Search className="h-4 w-4" />
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const isOpen = openGroups[group.title] ?? true;
          const groupLabel = group.translationKey ? t(group.translationKey) : group.title;
          return (
            <div key={group.title} className="mb-2">
              <button
                className={cn("interactive-control flex min-h-10 w-full items-center rounded-md px-3 text-left text-xs font-bold uppercase text-muted-foreground hover:bg-muted", expanded ? "justify-between" : "justify-center")}
                onClick={() => toggleGroup(group.title)}
                type="button"
                title={groupLabel}
              >
                <span className="flex items-center gap-3">
                  <group.icon className="h-4 w-4" />
                  {expanded && groupLabel}
                </span>
                {expanded && <ChevronDown className={cn("h-4 w-4 transition", isOpen && "rotate-180")} />}
              </button>
              <AnimatePresence initial={false}>
                {(expanded ? isOpen : true) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {group.entries.map((entry) => (
                      <NavLink
                        key={`${group.title}-${entry.label}-${entry.href}`}
                        to={entry.href}
                        onClick={onNavigate}
                        onFocus={() => preloadRoute(entry.href)}
                        onMouseEnter={() => preloadRoute(entry.href)}
                        onTouchStart={() => preloadRoute(entry.href)}
                        title={entry.translationKey ? t(entry.translationKey) : entry.label}
                        accessKey={entry.shortcut?.toLowerCase()}
                        className={({ isActive }) =>
                          cn(
                            "interactive-control relative my-1 flex min-h-11 items-center rounded-md text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-primary dark:text-slate-100 dark:hover:bg-teal-950/70 dark:hover:text-teal-100",
                            expanded ? "gap-3 px-3" : "justify-center px-2",
                            isActive && "bg-teal-100 text-teal-950 shadow-sm ring-1 ring-teal-300 dark:bg-teal-700/35 dark:text-white dark:ring-teal-400/50",
                          )
                        }
                      >
                        <entry.icon className="h-4 w-4 shrink-0" />
                        {expanded && <span className="min-w-0 flex-1 truncate">{entry.translationKey ? t(entry.translationKey) : entry.label}</span>}
                        {expanded && entry.shortcut && <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Alt+{entry.shortcut}</span>}
                        {entry.badge && (
                          <span className={cn("rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white", expanded ? "" : "absolute right-1 top-1")}>{entry.badge}</span>
                        )}
                      </NavLink>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/30 p-3">
        <div className={cn("rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950", !expanded && "grid place-items-center p-2")}>
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

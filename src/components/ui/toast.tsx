import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ClipboardList, FlaskConical, Info, MessageSquareText, Pill, Radio, ShieldAlert, Stethoscope, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ToastContext } from "./toast-context";
import type { ToastContextValue, ToastMessage } from "./toast-context";
import { NOTIFICATION_POPUP_EVENT, playNotificationSound, updateNotification } from "../../utils/notifications";
import type { GovCareNotification, NotificationPriority } from "../../utils/notifications";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [popups, setPopups] = useState<GovCareNotification[]>([]);
  const [criticalAlert, setCriticalAlert] = useState<GovCareNotification | null>(null);

  const value = useMemo<ToastContextValue>(() => ({
    showToast(message, tone = "success") {
      const id = crypto.randomUUID();
      setToasts((current) => {
        if (current.some((toast) => toast.message === message && toast.tone === tone)) return current;
        return [...current, { id, message, tone }].slice(-4);
      });
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3600);
    },
  }), []);

  useEffect(() => {
    function onPopup(event: Event) {
      const notification = event instanceof CustomEvent ? event.detail as GovCareNotification | undefined : undefined;
      if (!notification?.id) return;
      if (notification.priority === "critical") {
        setCriticalAlert(notification);
        playNotificationSound("critical");
        if ("vibrate" in navigator) navigator.vibrate([180, 90, 180]);
        return;
      }
      setPopups((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 4));
      if (notification.priority === "urgent" && "vibrate" in navigator) navigator.vibrate(120);
      window.setTimeout(() => {
        setPopups((current) => current.filter((item) => item.id !== notification.id));
      }, notification.priority === "urgent" ? 9000 : 6200);
    }
    window.addEventListener(NOTIFICATION_POPUP_EVENT, onPopup);
    return () => window.removeEventListener(NOTIFICATION_POPUP_EVENT, onPopup);
  }, []);

  function dismiss(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function dismissPopup(id: string) {
    setPopups((current) => current.filter((popup) => popup.id !== id));
  }

  function markPopupRead(notification: GovCareNotification) {
    updateNotification(notification.id, { read: true });
    dismissPopup(notification.id);
  }

  function openPopup(notification: GovCareNotification) {
    updateNotification(notification.id, { read: true });
    if (notification.actionHref) window.location.assign(notification.actionHref);
    dismissPopup(notification.id);
  }

  function closeCritical(markRead = false) {
    if (criticalAlert && markRead) updateNotification(criticalAlert.id, { read: true });
    setCriticalAlert(null);
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] grid w-[min(420px,calc(100vw-2rem))] gap-2 max-sm:left-4 max-sm:right-4 max-sm:w-auto">
        <AnimatePresence>
          {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />)}
        </AnimatePresence>
      </div>
      <div className="fixed right-4 top-20 z-[80] grid w-[min(430px,calc(100vw-2rem))] gap-3 sm:right-5">
        <AnimatePresence>
          {popups.map((popup) => (
            <NotificationPopup
              key={popup.id}
              notification={popup}
              onClose={() => dismissPopup(popup.id)}
              onMarkRead={() => markPopupRead(popup)}
              onOpen={() => openPopup(popup)}
            />
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {criticalAlert && (
          <CriticalNotificationDialog
            notification={criticalAlert}
            onClose={() => closeCritical(false)}
            onAcknowledge={() => closeCritical(true)}
            onOpen={() => {
              if (criticalAlert.actionHref) window.location.assign(criticalAlert.actionHref);
              closeCritical(true);
            }}
          />
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const Icon = toast.tone === "danger" || toast.tone === "warning" ? AlertTriangle : toast.tone === "info" ? Info : CheckCircle2;
  const toneClass = {
    success: "border-success-border bg-success-surface text-success",
    info: "border-info-border bg-info-surface text-info",
    warning: "border-warning-border bg-warning-surface text-warning",
    danger: "border-danger-border bg-danger-surface text-danger",
  }[toast.tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm font-semibold shadow-xl ${toneClass}`}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button className="interactive-control rounded p-0.5 opacity-inactive hover:opacity-100" onClick={onDismiss} type="button" aria-label="Dismiss notification">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function renderModuleIcon(moduleName: string, priority: NotificationPriority, className: string) {
  const module = moduleName.toLowerCase();
  if (priority === "critical") return <ShieldAlert className={className} />;
  if (module.includes("pharmacy") || module.includes("prescription")) return <Pill className={className} />;
  if (module.includes("lab")) return <FlaskConical className={className} />;
  if (module.includes("radiology")) return <Radio className={className} />;
  if (module.includes("appointment")) return <CalendarDays className={className} />;
  if (module.includes("chat") || module.includes("message")) return <MessageSquareText className={className} />;
  if (module.includes("telemedicine")) return <Video className={className} />;
  if (module.includes("opd") || module.includes("queue")) return <ClipboardList className={className} />;
  if (module.includes("doctor") || module.includes("consult")) return <Stethoscope className={className} />;
  return <Bell className={className} />;
}

function priorityClasses(priority: NotificationPriority) {
  if (priority === "critical") return {
    shell: "border-danger-border bg-surface text-foreground shadow-2xl shadow-shadow-tone dark:border-danger-border dark:bg-surface dark:text-danger",
    icon: "bg-danger-solid text-on-solid dark:bg-danger-solid dark:text-on-solid",
    badge: "bg-danger-surface text-danger ring-1 ring-danger-border dark:bg-danger-surface dark:text-danger dark:ring-danger-border",
    button: "bg-danger-solid text-on-solid hover:bg-danger-solid dark:bg-danger-solid dark:text-on-solid dark:hover:bg-danger-solid",
  };
  if (priority === "urgent") return {
    shell: "border-warning-border bg-surface text-foreground shadow-2xl shadow-shadow-tone dark:border-warning-border dark:bg-surface dark:text-warning",
    icon: "bg-warning-solid text-on-solid dark:bg-warning-solid dark:text-foreground",
    badge: "bg-warning-surface text-warning ring-1 ring-warning-border dark:bg-warning-surface dark:text-warning dark:ring-warning-border",
    button: "bg-warning-solid text-on-solid hover:bg-warning-solid dark:bg-warning-solid dark:text-on-solid dark:hover:bg-warning-solid",
  };
  if (priority === "warning") return {
    shell: "border-warning-border bg-surface text-foreground shadow-xl shadow-shadow-tone dark:border-warning-border dark:bg-surface dark:text-warning",
    icon: "bg-warning-surface text-warning dark:bg-warning-surface dark:text-warning",
    badge: "bg-warning-surface text-warning ring-1 ring-warning-border dark:bg-warning-surface dark:text-warning dark:ring-warning-border",
    button: "bg-inverse text-on-solid hover:bg-inverse dark:bg-accent-solid dark:text-on-solid dark:hover:bg-accent-surface",
  };
  return {
    shell: "border-info-border bg-surface text-foreground shadow-xl shadow-shadow-tone dark:border-info-border dark:bg-surface dark:text-info",
    icon: "bg-info-surface text-info dark:bg-info-surface dark:text-info",
    badge: "bg-info-surface text-info ring-1 ring-info-border dark:bg-info-surface dark:text-info dark:ring-info-border",
    button: "bg-primary text-primary-foreground hover:bg-primary-hover ",
  };
}

function actionLabel(notification: GovCareNotification) {
  const text = `${notification.module} ${notification.title}`.toLowerCase();
  if (text.includes("patient")) return "View Patient";
  if (text.includes("prescription") || text.includes("pharmacy")) return "Open Prescription";
  if (text.includes("lab")) return "View Lab Result";
  if (text.includes("radiology")) return "View Report";
  if (text.includes("telemedicine") || text.includes("video")) return "Join Telemedicine";
  if (text.includes("message") || text.includes("chat")) return "Open Chat";
  return "Open";
}

function NotificationPopup({ notification, onClose, onOpen, onMarkRead }: { notification: GovCareNotification; onClose: () => void; onOpen: () => void; onMarkRead: () => void }) {
  const classes = priorityClasses(notification.priority);
  return (
    <motion.article
      initial={{ opacity: 0, x: 36, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 36, scale: 0.98 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-lg border p-4 ${classes.shell}`}
      role="status"
      aria-label={`${notification.priority} notification: ${notification.title}`}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${classes.icon}`}>
          {renderModuleIcon(notification.module, notification.priority, "h-5 w-5")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold leading-snug text-foreground dark:text-on-solid">{notification.title}</p>
              <p className="mt-1 text-sm leading-5 text-foreground dark:text-foreground">{notification.message}</p>
            </div>
            <button className="interactive-control rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:text-foreground dark:hover:bg-surface dark:hover:text-on-solid" type="button" onClick={onClose} aria-label="Close notification popup">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-bold capitalize ${classes.badge}`}>{notification.priority}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-foreground dark:bg-surface dark:text-foreground">{notification.module}</span>
            <time className="font-medium text-muted-foreground dark:text-foreground">{new Date(notification.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {notification.actionHref && <button className={`interactive-control min-h-10 rounded-md px-3 text-sm font-bold ${classes.button}`} type="button" onClick={onOpen}>{actionLabel(notification)}</button>}
            <button className="interactive-control min-h-10 rounded-md border border-border bg-surface px-3 text-sm font-bold text-foreground hover:bg-surface dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-surface" type="button" onClick={onMarkRead}>Mark as Read</button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CriticalNotificationDialog({ notification, onClose, onOpen, onAcknowledge }: { notification: GovCareNotification; onClose: () => void; onOpen: () => void; onAcknowledge: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[95] grid place-items-center bg-surface p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="critical-notification-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="emergency-alert-modal w-[min(560px,calc(100vw-2rem))] rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-danger-solid text-on-solid">
            {renderModuleIcon(notification.module, notification.priority, "h-7 w-7")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-danger dark:text-danger">Critical hospital alert</p>
                <h2 id="critical-notification-title" className="mt-1 text-xl font-bold leading-tight text-foreground dark:text-on-solid">{notification.title}</h2>
              </div>
              <button className="interactive-control rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground dark:text-foreground dark:hover:bg-surface dark:hover:text-on-solid" type="button" onClick={onClose} aria-label="Close critical notification">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-base leading-6 text-foreground dark:text-foreground">{notification.message}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-danger-surface px-2.5 py-1 font-bold text-danger ring-1 ring-danger-border dark:bg-danger-surface dark:text-danger dark:ring-danger-border">critical</span>
              <span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-foreground dark:bg-surface dark:text-foreground">{notification.module}</span>
              <time className="font-medium text-muted-foreground dark:text-foreground">{new Date(notification.timestamp).toLocaleString()}</time>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {notification.actionHref && <button className="interactive-control min-h-11 rounded-md bg-danger-solid px-4 text-sm font-bold text-on-solid hover:bg-danger-solid dark:bg-danger-solid dark:hover:bg-danger-solid" type="button" onClick={onOpen}>{actionLabel(notification)}</button>}
              <button className="interactive-control min-h-11 rounded-md border border-danger-border bg-surface px-4 text-sm font-bold text-danger hover:bg-danger-surface dark:border-danger-border dark:bg-surface dark:text-danger dark:hover:bg-danger-surface" type="button" onClick={onAcknowledge}>Acknowledge and Mark as Read</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

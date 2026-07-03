import { AlertTriangle, Archive, Bell, BellRing, CheckCheck, Clock3, ExternalLink, Mail, MessageSquareText, MonitorUp, Radio, Search, Send, ShieldAlert, Smartphone, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ui/toast-context";
import { addNotification, ensureNotificationsSeeded, getNotifications, NOTIFICATIONS_UPDATED_EVENT, playNotificationSound, saveNotifications, updateNotification } from "../utils/notifications";
import type { GovCareNotification, NotificationPriority } from "../utils/notifications";
import { useAuthStore } from "../stores/authStore";
import { notificationPermissionStatus, registerPushNotifications, watchForegroundPushMessages } from "../services/pushService";

type PriorityFilter = "all" | NotificationPriority;

function priorityTone(priority: NotificationPriority) {
  if (priority === "critical") return "danger" as const;
  if (priority === "urgent" || priority === "warning") return "warning" as const;
  return "info" as const;
}

function priorityIcon(priority: NotificationPriority) {
  if (priority === "critical") return ShieldAlert;
  if (priority === "urgent" || priority === "warning") return AlertTriangle;
  return Bell;
}

function channelIcon(channel: string) {
  if (channel === "push") return Smartphone;
  if (channel === "email") return Mail;
  if (channel === "sms") return Send;
  if (channel === "sound") return Volume2;
  return MessageSquareText;
}

export function NotificationCenter() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const role = useAuthStore((state) => state.profile?.role);
  const [notifications, setNotifications] = useState<GovCareNotification[]>(() => getNotifications());
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [status, setStatus] = useState<"active" | "unread" | "archived">("active");
  const [desktopStatus, setDesktopStatus] = useState(() => notificationPermissionStatus());

  useEffect(() => {
    ensureNotificationsSeeded();
    function refresh() {
      setNotifications(getNotifications());
    }
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void watchForegroundPushMessages((title) => {
      showToast(`Desktop popup received: ${title}`, "success");
      setDesktopStatus(notificationPermissionStatus());
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });
    return () => unsubscribe?.();
  }, [showToast]);

  const visibleNotifications = useMemo(() => {
    const q = query.toLowerCase();
    return notifications
      .filter((item) => !role || item.roles.includes(role))
      .filter((item) => status === "archived" ? item.archived : status === "unread" ? !item.archived && !item.read : !item.archived)
      .filter((item) => priority === "all" || item.priority === priority)
      .filter((item) => !q || [item.title, item.message, item.module, item.group, item.priority].some((value) => value.toLowerCase().includes(q)))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [notifications, priority, query, role, status]);

  const grouped = useMemo(() => {
    return visibleNotifications.reduce<Record<string, GovCareNotification[]>>((groups, item) => {
      groups[item.group] = [...(groups[item.group] ?? []), item];
      return groups;
    }, {});
  }, [visibleNotifications]);

  const stats = useMemo(() => ({
    unread: visibleNotifications.filter((item) => !item.read).length,
    critical: visibleNotifications.filter((item) => item.priority === "critical").length,
    urgent: visibleNotifications.filter((item) => item.priority === "urgent").length,
    archived: notifications.filter((item) => item.archived && (!role || item.roles.includes(role))).length,
  }), [notifications, role, visibleNotifications]);

  const statCards = [
    { label: t("notificationsPage.unread"), value: stats.unread, Icon: BellRing, tone: "info" as const },
    { label: t("notificationsPage.critical"), value: stats.critical, Icon: ShieldAlert, tone: "danger" as const },
    { label: t("notificationsPage.urgent"), value: stats.urgent, Icon: AlertTriangle, tone: "warning" as const },
    { label: t("notificationsPage.archived"), value: stats.archived, Icon: Archive, tone: "neutral" as const },
  ];

  function markAllRead() {
    const next = notifications.map((item) => role && item.roles.includes(role) ? { ...item, read: true } : item);
    saveNotifications(next);
    showToast(t("notificationsPage.allReadToast"), "success");
  }

  function archiveRead() {
    const next = notifications.map((item) => role && item.roles.includes(role) && item.read ? { ...item, archived: true } : item);
    saveNotifications(next);
    showToast(t("notificationsPage.archiveReadToast"), "success");
  }

  function testCriticalAlert() {
    playNotificationSound("critical");
    addNotification({
      title: "Critical patient safety alert",
      message: "Critical alert popup test: urgent clinical review is required now.",
      module: "Emergency Department",
      priority: "critical",
      roles: role ? [role] : ["super_admin", "hospital_admin", "doctor", "nurse"],
      channels: ["in-app", "push", "sound"],
      group: "Critical",
      actionHref: "/emergency",
    });
    showToast(t("notificationsPage.soundToast"), "danger");
  }

  async function enablePush() {
    try {
      const token = await registerPushNotifications();
      setDesktopStatus(notificationPermissionStatus());
      showToast(`Push notifications enabled. Token saved: ${token.slice(0, 12)}...`, "success");
    } catch (error) {
      setDesktopStatus(notificationPermissionStatus());
      showToast(error instanceof Error ? error.message : "Push notification setup failed.", "danger");
    }
  }

  async function testDesktopPopup() {
    if (notificationPermissionStatus() !== "granted") {
      await enablePush();
    }
    addNotification({
      title: "GovCare desktop notification",
      message: "This is a Firebase-style desktop popup for urgent EHR alerts.",
      module: "Notification Center",
      priority: "urgent",
      roles: role ? [role] : ["super_admin", "hospital_admin", "doctor", "nurse", "pharmacist"],
      channels: ["in-app", "push", "sound"],
      group: "Desktop",
      actionHref: "/notifications",
    });
    const shown = notificationPermissionStatus() === "granted";
    setDesktopStatus(notificationPermissionStatus());
    showToast(shown ? "Desktop popup displayed." : "Desktop permission is not granted yet.", shown ? "success" : "warning");
  }

  return (
    <div className="space-y-5">
      <div className="page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{t("notificationsPage.eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">{t("notificationsPage.title")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("notificationsPage.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={enablePush}><Smartphone className="h-4 w-4" />Enable push</Button>
          <Button variant="outline" onClick={testDesktopPopup}><MonitorUp className="h-4 w-4" />Test desktop popup</Button>
          <Button variant="outline" onClick={testCriticalAlert}><Volume2 className="h-4 w-4" />{t("notificationsPage.testSound")}</Button>
          <Button variant="outline" onClick={archiveRead}><Archive className="h-4 w-4" />{t("notificationsPage.archiveRead")}</Button>
          <Button onClick={markAllRead}><CheckCheck className="h-4 w-4" />{t("notificationsPage.markAllRead")}</Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, Icon, tone }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
              </div>
              <Badge tone={tone}><Icon className="h-5 w-5" /></Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />{t("notificationsPage.filterSearch")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("notificationsPage.searchPlaceholder")} />
          <Select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}>
            <option value="all">{t("notificationsPage.allPriorities")}</option>
            <option value="information">{t("notificationsPage.information")}</option>
            <option value="warning">{t("notificationsPage.warning")}</option>
            <option value="urgent">{t("notificationsPage.urgent")}</option>
            <option value="critical">{t("notificationsPage.critical")}</option>
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value as "active" | "unread" | "archived")}>
            <option value="active">{t("notificationsPage.active")}</option>
            <option value="unread">{t("notificationsPage.unread")}</option>
            <option value="archived">{t("notificationsPage.archived")}</option>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-cyan-200 bg-cyan-50/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-950">Firebase desktop popup status</p>
            <p className="text-sm text-muted-foreground">Browser permission: {desktopStatus}. Critical and urgent push alerts use persistent desktop popup dialogs and open the related EHR page when clicked.</p>
          </div>
          <Badge tone={desktopStatus === "granted" ? "success" : desktopStatus === "denied" ? "danger" : "warning"}>{desktopStatus}</Badge>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, items]) => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{group}</span>
                  <Badge tone="neutral">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => {
                  const Icon = priorityIcon(item.priority);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-md border p-4 ${item.read ? "border-border bg-white" : "border-teal-200 bg-teal-50 shadow-sm"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <Badge tone={priorityTone(item.priority)}><Icon className="h-4 w-4" /></Badge>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-950">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge tone="info">{item.module}</Badge>
                              <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.channels.map((channel) => {
                            const ChannelIcon = channelIcon(channel);
                            return <Badge key={channel} tone="neutral"><ChannelIcon className="h-3.5 w-3.5" />{channel}</Badge>;
                          })}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => updateNotification(item.id, { read: !item.read })}>{item.read ? t("markUnread") : t("markRead")}</Button>
                        <Button className="min-h-9 px-3 py-1.5" variant="outline" onClick={() => updateNotification(item.id, { archived: true })}><Archive className="h-4 w-4" />{t("archive")}</Button>
                        {item.actionHref && <Link className="interactive-control inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-muted" to={item.actionHref}><ExternalLink className="h-4 w-4" />{t("openModule")}</Link>}
                      </div>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
          {!visibleNotifications.length && <Card><CardContent className="text-sm text-muted-foreground">{t("notificationsPage.noResults")}</CardContent></Card>}
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5 text-primary" />{t("notificationsPage.deliveryArchitecture")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(t("notificationsPage.deliveryPoints", { returnObjects: true }) as string[]).map((item) => <p key={item} className="help-strip p-3">{item}</p>)}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

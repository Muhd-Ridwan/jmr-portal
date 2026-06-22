import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  AlertTriangle,
  BookOpen,
  CreditCard,
  LayoutGrid,
  ChevronRightCircle,
  FileText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import PrayerTimes from "../components/PrayerTimes";
import { getParents, getMyProfile } from "../api/parents";
import { getOverduePayments, getMyOverduePayments } from "../api/payments";
import type { Parent, OverdueEntry, ParentDetail } from "../types";

function StatCard({
  label,
  value,
  icon,
  sub,
  highlight = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-raised p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          {label}
        </p>
        <div
          className={`p-2 rounded-lg ${
            highlight
              ? "bg-red-900/40 text-red-400"
              : "bg-surface-raised text-white/70"
          }`}
        >
          {icon}
        </div>
      </div>
      <p
        className={`text-3xl font-bold tracking-tight ${
          highlight ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-xs mt-1 ${highlight ? "text-red-400/70" : "text-white/40"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function AdminDashboard({
  greeting,
  dateLabel,
  timeLabel,
}: {
  greeting: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [parents, setParents] = useState<Parent[]>([]);
  const [overdue, setOverdue] = useState<OverdueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const adminModules = [
    {
      icon: <Users className="w-5 h-5" />,
      title: t("dashboard.modules.parentsAndChildren"),
      description: t("dashboard.modules.parentsAndChildrenDesc"),
      action: t("dashboard.modules.manageParents"),
      to: "/parents",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: t("dashboard.modules.payments"),
      description: t("dashboard.modules.paymentsDesc"),
      action: t("dashboard.modules.viewOverdue"),
      to: "/payments",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: t("dashboard.modules.reports"),
      description: t("dashboard.modules.reportsDesc"),
      action: t("dashboard.modules.openReports"),
      to: "/reports",
    },
  ];

  useEffect(() => {
    async function load() {
      try {
        const [p, o] = await Promise.all([
          getParents() as Promise<Parent[]>,
          getOverduePayments() as Promise<OverdueEntry[]>,
        ]);
        setParents(p);
        setOverdue(o);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalOverdueMonths = overdue.reduce(
    (sum, e) => sum + e.overdue_count,
    0,
  );

  return (
    <>
      <div className="mb-8">
        <p className="text-xs text-white/40 font-semibold tracking-widest uppercase mb-2">
          {dateLabel}
        </p>
        <h1 className="text-3xl font-bold text-white">
          {t("dashboard.welcomeBack")}{" "}
          <span className="text-[#86efac]">{greeting}</span>
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {t("dashboard.overview")} · {timeLabel}
        </p>
        <PrayerTimes />
      </div>

      {!loading && overdue.length > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-900/30 border border-red-800/50 text-red-300 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">
              {t("dashboard.childHasPending", { count: overdue.length })}
            </span>{" "}
            {t("dashboard.pendingPaymentsText")}
            {totalOverdueMonths > 0 &&
              ` — ${t("dashboard.monthsUnpaid", { count: totalOverdueMonths })}`}
            {overdue.some((e) => e.registration_pending) &&
              ` · ${t("dashboard.registrationFeePending")}`}
            .
          </p>
          <button
            onClick={() => navigate("/payments")}
            className="ml-auto text-xs font-medium underline hover:no-underline shrink-0"
          >
            {t("dashboard.viewAll")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label={t("dashboard.totalParents")}
          value={loading ? "—" : parents.length}
          icon={<Users className="w-4 h-4" />}
          sub={loading ? "" : `${parents.length} ${t("dashboard.registered")}`}
        />
        <StatCard
          label={t("dashboard.pendingPayments")}
          value={loading ? "—" : overdue.length}
          icon={<CreditCard className="w-4 h-4" />}
          sub={
            overdue.length > 0
              ? t("dashboard.childrenWithPendingFees")
              : t("dashboard.allUpToDate")
          }
          highlight={overdue.length > 0}
        />
        <StatCard
          label={t("dashboard.pendingMonths")}
          value={loading ? "—" : totalOverdueMonths}
          icon={<AlertTriangle className="w-4 h-4" />}
          sub={
            totalOverdueMonths > 0
              ? t("dashboard.monthlyFeesUnpaid")
              : t("dashboard.noPendingMonths")
          }
          highlight={totalOverdueMonths > 0}
        />
      </div>

      <div className="bg-surface rounded-xl border border-surface-raised overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-raised flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white/70">
            {t("dashboard.quickAccess")}
          </h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {adminModules.map((mod) => (
            <button
              key={mod.to}
              onClick={() => navigate(mod.to)}
              className="text-left bg-surface-raised hover:bg-[#4a7a57] rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-surface text-white/70 rounded-lg group-hover:text-white transition-colors">
                  {mod.icon}
                </div>
                <h3 className="font-semibold text-white">{mod.title}</h3>
              </div>
              <p className="text-sm text-white/50">{mod.description}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-[#86efac] mt-4">
                {mod.action} <ChevronRightCircle size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ParentDashboard({
  greeting,
  dateLabel,
  timeLabel,
}: {
  greeting: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ParentDetail | null>(null);
  const [overdue, setOverdue] = useState<OverdueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const parentModules = [
    {
      icon: <Users className="w-5 h-5" />,
      title: t("dashboard.modules.myChildren"),
      description: t("dashboard.modules.myChildrenDesc"),
      action: t("dashboard.modules.viewChildren"),
      to: "/my-children",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: t("dashboard.modules.paymentStatus"),
      description: t("dashboard.modules.paymentStatusDesc"),
      action: t("dashboard.modules.viewPayments"),
      to: "/my-payments",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: t("dashboard.modules.myReports"),
      description: t("dashboard.modules.myReportsDesc"),
      action: t("dashboard.modules.viewReport"),
      to: "/my-reports",
    },
  ];

  useEffect(() => {
    async function load() {
      try {
        const [p, o] = await Promise.all([
          getMyProfile(),
          getMyOverduePayments(),
        ]);
        setProfile(p);
        setOverdue(o);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalOverdueMonths = overdue.reduce(
    (sum, e) => sum + e.overdue_count,
    0,
  );
  const childrenCount = profile?.children.length ?? 0;

  return (
    <>
      <div className="mb-8">
        <p className="text-xs text-white/40 font-semibold tracking-widest uppercase mb-2">
          {dateLabel}
        </p>
        <h1 className="text-3xl font-bold text-white">
          {t("dashboard.welcomeBack")}{" "}
          <span className="text-[#86efac]">{greeting}</span>
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {t("dashboard.portal")} · {timeLabel}
        </p>
        <PrayerTimes />
      </div>

      {!loading && overdue.length > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-900/30 border border-red-800/50 text-red-300 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">
              {t("dashboard.childHasPending", { count: overdue.length })}
            </span>{" "}
            {t("dashboard.pendingPaymentsText")}
            {totalOverdueMonths > 0 &&
              ` — ${t("dashboard.monthsUnpaid", { count: totalOverdueMonths })}`}
            {overdue.some((e) => e.registration_pending) &&
              ` · ${t("dashboard.registrationFeePending")}`}
            .
          </p>
          <button
            onClick={() => navigate("/my-payments")}
            className="ml-auto text-xs font-medium underline hover:no-underline shrink-0"
          >
            {t("dashboard.viewAll")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label={t("dashboard.myChildren")}
          value={loading ? "—" : childrenCount}
          icon={<Users className="w-4 h-4" />}
          sub={loading ? "" : `${childrenCount} ${t("dashboard.enrolled")}`}
        />
        <StatCard
          label={t("dashboard.pendingPayments")}
          value={loading ? "—" : overdue.length}
          icon={<CreditCard className="w-4 h-4" />}
          sub={
            overdue.length > 0
              ? t("dashboard.childrenWithPendingFees")
              : t("dashboard.allUpToDate")
          }
          highlight={overdue.length > 0}
        />
        <StatCard
          label={t("dashboard.pendingMonths")}
          value={loading ? "—" : totalOverdueMonths}
          icon={<AlertTriangle className="w-4 h-4" />}
          sub={
            totalOverdueMonths > 0
              ? t("dashboard.monthlyFeesUnpaid")
              : t("dashboard.noPendingMonths")
          }
          highlight={totalOverdueMonths > 0}
        />
      </div>

      <div className="bg-surface rounded-xl border border-surface-raised overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-raised flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white/70">
            {t("dashboard.quickAccess")}
          </h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {parentModules.map((mod) => (
            <button
              key={mod.to}
              onClick={() => navigate(mod.to)}
              className="text-left bg-surface-raised hover:bg-[#4a7a57] rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-surface text-white/70 rounded-lg group-hover:text-white transition-colors">
                  {mod.icon}
                </div>
                <h3 className="font-semibold text-white">{mod.title}</h3>
              </div>
              <p className="text-sm text-white/50">{mod.description}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-[#86efac] mt-4">
                {mod.action} <ChevronRightCircle size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const locale = i18n.language === "ms" ? "ms-MY" : "en-MY";
  const greeting = user?.name ?? "there";
  const dateLabel = now
    .toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
  const timeLabel = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isParentUser = user?.role === "user";

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
      {isParentUser ? (
        <ParentDashboard
          greeting={greeting}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
        />
      ) : (
        <AdminDashboard
          greeting={greeting}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
        />
      )}
    </div>
  );
}

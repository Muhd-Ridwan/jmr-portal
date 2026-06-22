import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  AlertTriangle,
  BookOpen,
  CreditCard,
  FileText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import PrayerTimes from "../components/PrayerTimes";
import { getParents, getMyProfile } from "../api/parents";
import { getOverduePayments, getMyOverduePayments } from "../api/payments";
import type { Parent, OverdueEntry, ParentDetail } from "../types";

function StatRow({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface border border-surface-raised rounded-xl px-4 py-3.5 flex items-center gap-4">
      <div
        className={`p-2 rounded-lg shrink-0 ${
          highlight
            ? "bg-red-900/40 text-red-400"
            : "bg-surface-raised text-white/60"
        }`}
      >
        {icon}
      </div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-widest flex-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          highlight ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ModuleGrid({
  modules,
}: {
  modules: {
    icon: React.ReactNode;
    title: string;
    description: string;
    to: string;
  }[];
}) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 gap-3">
      {modules.map((mod) => (
        <button
          key={mod.to}
          onClick={() => navigate(mod.to)}
          className="text-left bg-surface rounded-xl p-4 border border-surface-raised hover:bg-surface-raised transition-colors active:scale-[0.98]"
        >
          <div className="p-2 bg-primary/20 text-[#86efac] rounded-lg w-fit mb-3">
            {mod.icon}
          </div>
          <p className="font-semibold text-white text-sm leading-snug">
            {mod.title}
          </p>
          <p className="text-xs text-white/40 mt-1 leading-snug">
            {mod.description}
          </p>
        </button>
      ))}
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
      to: "/parents",
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: t("dashboard.modules.payments"),
      description: t("dashboard.modules.paymentsDesc"),
      to: "/payments",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: t("dashboard.modules.reports"),
      description: t("dashboard.modules.reportsDesc"),
      to: "/reports",
    },
    {
      icon: <BookOpen className="w-5 h-5" />,
      title: t("dashboard.modules.services"),
      description: t("dashboard.modules.servicesDesc"),
      to: "/services",
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
          <p className="text-sm flex-1">
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
            className="text-xs font-medium underline hover:no-underline shrink-0"
          >
            {t("dashboard.viewAll")}
          </button>
        </div>
      )}

      <div className="space-y-2 mb-8">
        <StatRow
          label={t("dashboard.totalParents")}
          value={loading ? "—" : parents.length}
          icon={<Users className="w-4 h-4" />}
        />
        <StatRow
          label={t("dashboard.pendingPayments")}
          value={loading ? "—" : overdue.length}
          icon={<CreditCard className="w-4 h-4" />}
          highlight={overdue.length > 0}
        />
        <StatRow
          label={t("dashboard.pendingMonths")}
          value={loading ? "—" : totalOverdueMonths}
          icon={<AlertTriangle className="w-4 h-4" />}
          highlight={totalOverdueMonths > 0}
        />
      </div>

      <ModuleGrid modules={adminModules} />
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
      to: "/my-children",
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: t("dashboard.modules.paymentStatus"),
      description: t("dashboard.modules.paymentStatusDesc"),
      to: "/my-payments",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: t("dashboard.modules.myReports"),
      description: t("dashboard.modules.myReportsDesc"),
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
          <p className="text-sm flex-1">
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
            className="text-xs font-medium underline hover:no-underline shrink-0"
          >
            {t("dashboard.viewAll")}
          </button>
        </div>
      )}

      <div className="space-y-2 mb-8">
        <StatRow
          label={t("dashboard.myChildren")}
          value={loading ? "—" : childrenCount}
          icon={<Users className="w-4 h-4" />}
        />
        <StatRow
          label={t("dashboard.pendingPayments")}
          value={loading ? "—" : overdue.length}
          icon={<CreditCard className="w-4 h-4" />}
          highlight={overdue.length > 0}
        />
        <StatRow
          label={t("dashboard.pendingMonths")}
          value={loading ? "—" : totalOverdueMonths}
          icon={<AlertTriangle className="w-4 h-4" />}
          highlight={totalOverdueMonths > 0}
        />
      </div>

      <ModuleGrid modules={parentModules} />
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

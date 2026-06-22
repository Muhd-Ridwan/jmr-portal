import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, UserX } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getMyOverduePayments } from "../api/payments";
import { getMyProfile } from "../api/parents";
import type { OverdueEntry, Child } from "../types";
import PageHeader from "../components/PageHeader";

export default function MyPayments() {
  const { t } = useTranslation();
  const [overdue, setOverdue] = useState<OverdueEntry[]>([]);
  const [unregistered, setUnregistered] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  const months = t("common.months", { returnObjects: true }) as string[];

  useEffect(() => {
    Promise.all([getMyOverduePayments(), getMyProfile()])
      .then(([o, profile]) => {
        setOverdue(o);
        setUnregistered(
          profile.children.filter((c) => c.registration_paid === false),
        );
      })
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const totalMonths = overdue.reduce((sum, e) => sum + e.overdue_count, 0);
  const hasIssues = overdue.length > 0 || unregistered.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title={t("myPayments.title")}
        description={t("myPayments.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
      />

      {loading ? (
        <p className="text-sm text-white/30 text-center py-12">
          {t("common.loading")}
        </p>
      ) : !hasIssues ? (
        <div className="bg-surface border border-surface-raised rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">
              {t("myPayments.allUpToDate")}
            </p>
            <p className="text-xs text-white/30 mt-1">
              {t("myPayments.noOutstanding")}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                {t("myPayments.overdueMonthlyFees")}
              </h2>
              <div className="flex items-center gap-3 bg-red-900/30 border border-red-800/50 text-red-300 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-sm">
                  <span className="font-semibold">
                    {t("myPayments.monthsOutstanding", { count: totalMonths })}
                  </span>{" "}
                  {t("myPayments.outstanding")}{" "}
                  {t("myPayments.child", { count: overdue.length })}.
                </p>
              </div>
              <div className="space-y-3">
                {overdue.map((entry) => (
                  <div
                    key={entry.child_id}
                    className="bg-surface border border-surface-raised rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-900/40 flex items-center justify-center text-sm font-bold text-red-300 shrink-0">
                          {entry.child_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {entry.child_name}
                          </p>
                          <p className="text-xs text-white/40">
                            RM {Number(entry.monthly_fee).toFixed(2)}/month
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-red-400 bg-red-900/30 border border-red-700/40 px-2.5 py-1 rounded-full shrink-0">
                        {t("myPayments.monthsOverdue", {
                          count: entry.overdue_count,
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.overdue_months.map((m) => (
                        <span
                          key={`${m.month}-${m.year}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-surface-raised text-white/60 border border-white/10"
                        >
                          {months[m.month - 1]} {m.year}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {unregistered.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                {t("myPayments.unpaidRegistrationFees")}
              </h2>
              <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-800/40 text-amber-300 rounded-xl px-4 py-3">
                <UserX className="w-4 h-4 shrink-0" />
                <p className="text-sm">
                  <span className="font-semibold">
                    {t("myPayments.childNotPaid", {
                      count: unregistered.length,
                    })}
                  </span>{" "}
                  {t("myPayments.hasHave", { count: unregistered.length })}{" "}
                  {t("myPayments.notPaidReg")}
                </p>
              </div>
              <div className="space-y-3">
                {unregistered.map((child) => (
                  <div
                    key={child.id}
                    className="bg-surface border border-surface-raised rounded-xl p-5 flex items-center gap-4"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-900/30 flex items-center justify-center text-sm font-bold text-amber-300 shrink-0">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {child.name}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {child.service_types
                          ?.map((s) =>
                            s.name === "quran_only"
                              ? t("myChildren.quranOnly")
                              : s.name === "tuition_and_quran"
                                ? t("myChildren.tuitionAndQuran")
                                : s.name,
                          )
                          .join(", ") || "—"}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-400 bg-amber-900/30 border border-amber-700/40 px-2.5 py-1 rounded-full shrink-0">
                      {t("myPayments.regUnpaid")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

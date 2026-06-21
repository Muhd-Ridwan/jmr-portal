import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { getOverduePayments, getUnpaidRegistrations } from "../api/payments";
import type { OverdueEntry, UnregisteredChild } from "../types";
import PageHeader from "../components/PageHeader";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function Payments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overdue, setOverdue] = useState<OverdueEntry[]>([]);
  const [unregistered, setUnregistered] = useState<UnregisteredChild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role === "user") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    Promise.all([getOverduePayments(), getUnpaidRegistrations()])
      .then(([o, u]) => {
        setOverdue(o);
        setUnregistered(u);
      })
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const totalOwed = overdue.reduce(
    (sum, e) => sum + e.overdue_count * e.monthly_fee,
    0,
  );
  const totalRegOwed = unregistered.reduce(
    (sum, u) => sum + Number(u.registration_fee),
    0,
  );

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-8">
      <PageHeader
        title="Payments"
        description="Outstanding monthly fees and unpaid registration fees."
      />

      {/* ── Overdue monthly fees ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
          Overdue Monthly Fees
        </h2>

        {!loading && overdue.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-surface border border-surface-raised rounded-xl px-5 py-4">
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Overdue Children
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {overdue.length}
              </p>
            </div>
            <div className="bg-surface border border-surface-raised rounded-xl px-5 py-4">
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Total Months Owed
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {overdue.reduce((sum, e) => sum + e.overdue_count, 0)}
              </p>
            </div>
            <div className="bg-surface border border-surface-raised rounded-xl px-5 py-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Amount Owed
              </p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                RM {totalOwed.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-surface-raised">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              Child
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              Parent
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
              Monthly Fee
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
              Months Owed
            </span>
            <span />
          </div>

          {loading ? (
            <p className="px-6 py-8 text-sm text-white/30 text-center">
              Loading...
            </p>
          ) : overdue.length === 0 ? (
            <p className="px-6 py-10 text-sm text-white/30 text-center">
              No overdue monthly payments. All children are up to date.
            </p>
          ) : (
            <div className="divide-y divide-surface-raised">
              {overdue.map((entry) => (
                <button
                  key={entry.child_id}
                  type="button"
                  onClick={() => navigate(`/parents/${entry.parent_id}`)}
                  className="w-full text-left px-6 py-4 hover:bg-surface-raised/50 transition-colors group"
                >
                  <div className="sm:hidden space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">
                        {entry.child_name}
                      </p>
                      <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        {entry.overdue_count} month
                        {entry.overdue_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{entry.parent_name}</p>
                    <p className="text-xs text-white/30">
                      {entry.overdue_months
                        .slice(0, 3)
                        .map((m) => `${MONTH_NAMES[m.month - 1]} ${m.year}`)
                        .join(", ")}
                      {entry.overdue_months.length > 3 &&
                        ` +${entry.overdue_months.length - 3} more`}
                    </p>
                  </div>
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {entry.child_name}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {entry.overdue_months
                          .slice(0, 2)
                          .map((m) => `${MONTH_NAMES[m.month - 1]} ${m.year}`)
                          .join(", ")}
                        {entry.overdue_months.length > 2 &&
                          ` +${entry.overdue_months.length - 2} more`}
                      </p>
                    </div>
                    <p className="text-sm text-white/60">{entry.parent_name}</p>
                    <p className="text-sm text-white/60 text-right tabular-nums">
                      RM {Number(entry.monthly_fee).toFixed(2)}
                    </p>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full justify-end">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {entry.overdue_count} month
                      {entry.overdue_count !== 1 ? "s" : ""}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Unpaid registration fees ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
          Unpaid Registration Fees
        </h2>

        {!loading && unregistered.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-surface-raised rounded-xl px-5 py-4">
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Children Pending
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {unregistered.length}
              </p>
            </div>
            <div className="bg-surface border border-surface-raised rounded-xl px-5 py-4">
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Total Owed
              </p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                RM {totalRegOwed.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-6 py-3 border-b border-surface-raised">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              Child
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              Parent
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
              Reg. Fee
            </span>
            <span />
          </div>

          {loading ? (
            <p className="px-6 py-8 text-sm text-white/30 text-center">
              Loading...
            </p>
          ) : unregistered.length === 0 ? (
            <p className="px-6 py-10 text-sm text-white/30 text-center">
              All children have paid their registration fee.
            </p>
          ) : (
            <div className="divide-y divide-surface-raised">
              {unregistered.map((u) => (
                <button
                  key={u.child_id}
                  type="button"
                  onClick={() => navigate(`/parents/${u.parent_id}`)}
                  className="w-full text-left px-6 py-4 hover:bg-surface-raised/50 transition-colors group"
                >
                  <div className="sm:hidden space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">
                        {u.child_name}
                      </p>
                      <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                        RM {Number(u.registration_fee).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{u.parent_name}</p>
                  </div>
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <UserX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <p className="text-sm font-medium text-white">
                        {u.child_name}
                      </p>
                    </div>
                    <p className="text-sm text-white/60">{u.parent_name}</p>
                    <span className="text-sm font-semibold text-amber-400 text-right tabular-nums">
                      RM {Number(u.registration_fee).toFixed(2)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

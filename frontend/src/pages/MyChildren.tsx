import { useState, useEffect } from "react";
import { BookOpen, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getMyProfile } from "../api/parents";
import type { ParentDetail, Child } from "../types";
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

function serviceLabel(child: Child): string {
  if (!child.service_types?.length) return "No service";
  return child.service_types
    .map((s) => {
      if (s.name === "quran_only") return "Quran Reading";
      if (s.name === "tuition_and_quran") return "Tuition + Quran";
      return s.name;
    })
    .join(", ");
}

export default function MyChildren() {
  const [profile, setProfile] = useState<ParentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title="My Children"
        description="View your children's enrolment and service details."
        backTo={{ label: "Dashboard", to: "/dashboard" }}
      />

      {loading ? (
        <p className="text-sm text-white/30 text-center py-12">Loading...</p>
      ) : !profile ? (
        <p className="text-sm text-white/30 text-center py-12">
          No profile found.
        </p>
      ) : profile.children.length === 0 ? (
        <div className="bg-surface border border-surface-raised rounded-xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">No children enrolled yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {profile.children.map((child) => {
            const registered = new Date(child.created_at);
            const registeredLabel = `${MONTH_NAMES[registered.getMonth()]} ${registered.getFullYear()}`;

            return (
              <div
                key={child.id}
                className="bg-surface border border-surface-raised rounded-xl p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-sm font-bold text-white/70 shrink-0">
                    {child.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-white">
                        {child.name}
                      </h3>
                      {child.registration_paid !== undefined && (
                        <span
                          className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                            child.registration_paid
                              ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/40"
                              : "bg-red-900/30 text-red-400 border-red-700/40"
                          }`}
                        >
                          {child.registration_paid ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Registration{" "}
                          {child.registration_paid ? "paid" : "unpaid"}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      <div>
                        <span className="text-white/40 text-xs uppercase tracking-wide">
                          Service
                        </span>
                        <p className="text-white/80 mt-0.5">
                          {serviceLabel(child)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs uppercase tracking-wide">
                          Monthly fee
                        </span>
                        <p className="text-white/80 mt-0.5">
                          RM {Number(child.monthly_fee).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs uppercase tracking-wide">
                          Enrolled
                        </span>
                        <p className="text-white/80 mt-0.5">
                          {registeredLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

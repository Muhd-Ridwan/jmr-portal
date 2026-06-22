import { useState, useEffect } from "react";
import { BookOpen, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getMyProfile } from "../api/parents";
import type { ParentDetail, Child } from "../types";
import PageHeader from "../components/PageHeader";

function serviceLabel(child: Child, t: (key: string) => string): string {
  if (!child.service_types?.length) return t("myChildren.noService");
  return child.service_types
    .map((s) => {
      if (s.name === "quran_only") return t("myChildren.quranOnly");
      if (s.name === "tuition_and_quran")
        return t("myChildren.tuitionAndQuran");
      return s.name;
    })
    .join(", ");
}

export default function MyChildren() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ParentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const monthsShort = t("common.monthsShort", {
    returnObjects: true,
  }) as string[];

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title={t("myChildren.title")}
        description={t("myChildren.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
      />

      {loading ? (
        <p className="text-sm text-white/30 text-center py-12">
          {t("common.loading")}
        </p>
      ) : !profile ? (
        <p className="text-sm text-white/30 text-center py-12">
          {t("myChildren.noProfile")}
        </p>
      ) : profile.children.length === 0 ? (
        <div className="bg-surface border border-surface-raised rounded-xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">{t("myChildren.noChildren")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {profile.children.map((child) => {
            const registered = new Date(child.created_at);
            const registeredLabel = `${monthsShort[registered.getMonth()]} ${registered.getFullYear()}`;

            return (
              <div
                key={child.id}
                className="bg-surface border border-surface-raised rounded-xl p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-sm font-bold text-white/70 shrink-0">
                    {child.name.charAt(0).toUpperCase()}
                  </div>

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
                          {child.registration_paid
                            ? t("myChildren.registrationPaid")
                            : t("myChildren.registrationUnpaid")}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      <div>
                        <span className="text-white/40 text-xs uppercase tracking-wide">
                          {t("myChildren.service")}
                        </span>
                        <p className="text-white/80 mt-0.5">
                          {serviceLabel(child, t)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs uppercase tracking-wide">
                          {t("myChildren.monthlyFee")}
                        </span>
                        <p className="text-white/80 mt-0.5">
                          RM {Number(child.monthly_fee).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs uppercase tracking-wide">
                          {t("myChildren.enrolled")}
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

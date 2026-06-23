import { useState, useEffect, useRef } from "react";
import { Filter, FileText, Eye, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Badge from "../components/Badge";
import { getParents, getParent } from "../api/parents";
import { getPaymentSummary, exportReport } from "../api/reports";
import type { Parent, Child, ReportParent } from "../types";

const currentYear = new Date().getFullYear();
const YEARS = Array.from(
  { length: currentYear - 2019 },
  (_, i) => currentYear - i,
);

const SELECT_CLS =
  "w-full bg-surface-raised border border-surface-raised text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtRM(amount: number): string {
  return `RM ${amount.toFixed(2)}`;
}

export default function Reports() {
  const { t } = useTranslation();
  const months = t("common.months", { returnObjects: true }) as string[];

  const [allParents, setAllParents] = useState<Parent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [parentChildren, setParentChildren] = useState<Child[]>([]);
  const [reportData, setReportData] = useState<ReportParent[] | null>(null);
  const [openParentId, setOpenParentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getParents(true)
      .then(setAllParents)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedParentId) {
      setParentChildren([]);
      setSelectedChildId("");
      return;
    }
    getParent(Number(selectedParentId), true)
      .then((p) => {
        setParentChildren(p.children);
        setSelectedChildId("");
      })
      .catch(() => {});
  }, [selectedParentId]);

  useEffect(() => {
    if (!selectedYear) setSelectedMonth("");
  }, [selectedYear]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const filters: Record<string, number> = {};
      if (selectedParentId) filters.parent_id = Number(selectedParentId);
      if (selectedChildId) filters.child_id = Number(selectedChildId);
      if (selectedYear) filters.year = Number(selectedYear);
      if (selectedMonth) filters.month = Number(selectedMonth);
      const data = await getPaymentSummary(filters);
      setReportData(data);
      setOpenParentId(data.length === 1 ? data[0].parent_id : null);
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch {
      toast.error(t("reports.noDataFound"));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const filters: Record<string, number> = {};
      if (selectedParentId) filters.parent_id = Number(selectedParentId);
      if (selectedChildId) filters.child_id = Number(selectedChildId);
      if (selectedYear) filters.year = Number(selectedYear);
      if (selectedMonth) filters.month = Number(selectedMonth);
      await exportReport(filters);
    } catch {
      toast.error(t("reports.exportFailed"));
    } finally {
      setExportLoading(false);
    }
  }

  function handleClear() {
    setSelectedParentId("");
    setSelectedChildId("");
    setSelectedYear("");
    setSelectedMonth("");
    setReportData(null);
    setOpenParentId(null);
  }

  const totalParents = reportData?.length ?? 0;
  const totalChildren =
    reportData?.reduce((s, p) => s + p.children.length, 0) ?? 0;
  const totalPaid =
    reportData?.reduce(
      (s, p) =>
        s +
        p.children.reduce(
          (cs, c) => cs + c.months.filter((m) => m.paid).length,
          0,
        ),
      0,
    ) ?? 0;
  const totalUnpaid =
    reportData?.reduce(
      (s, p) =>
        s +
        p.children.reduce(
          (cs, c) => cs + c.months.filter((m) => !m.paid).length,
          0,
        ),
      0,
    ) ?? 0;

  const totalCollected =
    reportData?.reduce(
      (s, p) =>
        s +
        p.children.reduce((cs, c) => {
          const fees = c.months
            .filter((m) => m.paid)
            .reduce((ms, m) => ms + m.amount, 0);
          const reg = c.registration.paid ? (c.registration.amount ?? 0) : 0;
          return cs + fees + reg;
        }, 0),
      0,
    ) ?? 0;

  const totalOutstanding =
    reportData?.reduce(
      (s, p) =>
        s +
        p.children.reduce(
          (cs, c) =>
            cs +
            c.months.filter((m) => !m.paid).reduce((ms, m) => ms + m.amount, 0),
          0,
        ),
      0,
    ) ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
      />

      {/* Filters */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white/70">
            {t("reports.filters")}
          </h2>
          <span className="text-xs text-white/30 ml-1">
            {t("reports.noDefaultSelection")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              {t("reports.parentLabel")}
            </label>
            <select
              className={SELECT_CLS}
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
            >
              <option value="">{t("reports.allParents")}</option>
              {allParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.parent_name}
                  {p.is_active ? "" : ` (${t("common.inactive")})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              {t("reports.childLabel")}
            </label>
            <select
              className={SELECT_CLS}
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              disabled={!selectedParentId}
            >
              <option value="">{t("reports.allChildren")}</option>
              {parentChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? "" : ` (${t("common.inactive")})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              {t("reports.yearLabel")}
            </label>
            <select
              className={SELECT_CLS}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">{t("reports.allYears")}</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              {t("reports.monthLabel")}
            </label>
            <select
              className={SELECT_CLS}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={!selectedYear}
            >
              <option value="">{t("reports.allMonths")}</option>
              {months.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleGenerate} loading={loading}>
            <Eye className="w-3.5 h-3.5" />
            {t("reports.show")}
          </Button>
          <Button variant="secondary" onClick={handleClear} disabled={loading}>
            {t("reports.clear")}
          </Button>
        </div>
      </div>

      {/* Results */}
      {reportData && (
        <div ref={resultsRef}>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-surface border border-surface-raised rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                {t("reports.parentsLabel")}
              </p>
              <p className="text-xl font-bold text-white">{totalParents}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {t("reports.children", { count: totalChildren })}
              </p>
            </div>
            <div className="bg-surface border border-surface-raised rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                {t("reports.monthsPaid")}
              </p>
              <p className="text-xl font-bold text-white">{totalPaid}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {t("reports.unpaidCount", { count: totalUnpaid })}
              </p>
            </div>
            <div className="bg-surface border border-green-900/50 rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                {t("reports.totalCollected")}
              </p>
              <p className="text-xl font-bold text-green-400">
                RM {totalCollected.toFixed(2)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {t("reports.feesAndReg")}
              </p>
            </div>
            <div
              className={`bg-surface border rounded-xl px-4 py-3 ${totalOutstanding > 0 ? "border-red-900/50" : "border-surface-raised"}`}
            >
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                {t("reports.outstanding")}
              </p>
              <p
                className={`text-xl font-bold ${totalOutstanding > 0 ? "text-red-400" : "text-white"}`}
              >
                RM {totalOutstanding.toFixed(2)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {t("reports.monthsUnpaid", { count: totalUnpaid })}
              </p>
            </div>
          </div>

          {/* Export button */}
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={handleExport}
              loading={exportLoading}
              disabled={reportData.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              {t("reports.generateReport")}
            </Button>
          </div>

          {reportData.length === 0 ? (
            <div className="bg-surface border border-surface-raised rounded-xl p-10 flex flex-col items-center gap-3 text-white/30">
              <FileText className="w-8 h-8" />
              <p className="text-sm">{t("reports.noDataFound")}</p>
            </div>
          ) : (
            <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
              <div className="overflow-y-auto max-h-[480px] sm:max-h-none divide-y divide-white/10">
                {reportData.map((parent) => {
                  const isOpen = openParentId === parent.parent_id;
                  return (
                    <div key={parent.parent_id}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
                        onClick={() =>
                          setOpenParentId(isOpen ? null : parent.parent_id)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">
                            {parent.parent_name}
                          </h3>
                          <Badge variant={parent.is_active ? "green" : "gray"}>
                            {parent.is_active
                              ? t("reports.active")
                              : t("reports.inactive")}
                          </Badge>
                          <span className="text-xs text-white/30">
                            {t("reports.children", {
                              count: parent.children.length,
                            })}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-white/40 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 space-y-3 border-t border-white/10">
                          {parent.children.length === 0 ? (
                            <p className="text-sm text-white/40 py-2">
                              {t("reports.noChildren")}
                            </p>
                          ) : (
                            parent.children.map((child) => (
                              <div
                                key={child.child_id}
                                className="rounded-lg border border-surface-raised p-4"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-white text-sm">
                                    {child.child_name}
                                  </span>
                                  <Badge
                                    variant={child.is_active ? "green" : "gray"}
                                  >
                                    {child.is_active
                                      ? t("reports.active")
                                      : t("reports.inactive")}
                                  </Badge>
                                </div>
                                {child.service_names.length > 0 && (
                                  <p className="text-xs text-white/40 mb-2">
                                    {child.service_names.join(" · ")}
                                  </p>
                                )}

                                <p className="text-xs mb-3">
                                  {child.registration.paid ? (
                                    <span className="text-green-400">
                                      {t("reports.registrationPaid")}{" "}
                                      {fmtRM(child.registration.amount!)} on{" "}
                                      {fmtDate(child.registration.paid_at!)} (
                                      {(
                                        child.registration.payment_method ?? ""
                                      ).replace("_", " ")}
                                      )
                                    </span>
                                  ) : (
                                    <span className="text-red-400">
                                      {t("reports.registrationUnpaid")}
                                    </span>
                                  )}
                                </p>

                                {child.months.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-white/40 text-left">
                                          <th className="pb-2 pr-4 font-medium">
                                            {t("reports.columnMonth")}
                                          </th>
                                          <th className="pb-2 pr-4 font-medium">
                                            {t("reports.columnYear")}
                                          </th>
                                          <th className="pb-2 pr-4 font-medium">
                                            {t("reports.columnAmount")}
                                          </th>
                                          <th className="pb-2 pr-4 font-medium">
                                            {t("reports.columnStatus")}
                                          </th>
                                          <th className="pb-2 font-medium">
                                            {t("reports.columnDatePaid")}
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {child.months.map((m, i) => (
                                          <tr
                                            key={i}
                                            className="border-t border-surface-raised/50"
                                          >
                                            <td className="py-1.5 pr-4 text-white/70">
                                              {months[m.month - 1]}
                                            </td>
                                            <td className="py-1.5 pr-4 text-white/70">
                                              {m.year}
                                            </td>
                                            <td className="py-1.5 pr-4 text-white/70">
                                              {fmtRM(m.amount)}
                                            </td>
                                            <td className="py-1.5 pr-4">
                                              <Badge
                                                variant={
                                                  m.paid ? "green" : "red"
                                                }
                                              >
                                                {m.paid
                                                  ? t("common.paid")
                                                  : t("common.unpaid")}
                                              </Badge>
                                            </td>
                                            <td className="py-1.5 text-white/50">
                                              {m.paid && m.paid_at
                                                ? fmtDate(m.paid_at)
                                                : "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-xs text-white/40 italic">
                                    {t("reports.noPaymentRecords")}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

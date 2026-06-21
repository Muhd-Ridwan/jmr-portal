import { useState, useEffect, useRef } from "react";
import { Filter, FileText, Eye, ChevronDown, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Badge from "../components/Badge";
import { getMyProfile } from "../api/parents";
import { getMyPaymentSummary } from "../api/reports";
import { getReceiptUrl } from "../api/payments";
import type { Child, ReportChild } from "../types";
import type { MyReportData } from "../api/reports";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

function ReceiptPreviewModal({
  url,
  isPdf,
  onClose,
}: {
  url: string;
  isPdf: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-surface border border-surface-raised rounded-2xl shadow-xl w-full max-w-3xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-raised shrink-0">
          <span className="text-sm font-medium text-white/70">Receipt</span>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {isPdf ? (
          <iframe
            src={url}
            title="Receipt"
            className="w-full"
            style={{ height: "75vh" }}
          />
        ) : (
          <div
            className="flex items-center justify-center p-4 overflow-auto"
            style={{ maxHeight: "75vh" }}
          >
            <img
              src={url}
              alt="Receipt"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ChildAccordion({ child }: { child: ReportChild }) {
  const [open, setOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{
    url: string;
    isPdf: boolean;
  } | null>(null);

  const initial = child.child_name.charAt(0).toUpperCase();
  const paidMonths = child.months.filter((m) => m.paid);
  const unpaidMonths = child.months.filter((m) => !m.paid);
  const amountPaid =
    paidMonths.reduce((s, m) => s + m.amount, 0) +
    (child.registration.paid ? (child.registration.amount ?? 0) : 0);
  const amountDue = unpaidMonths.reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
        {/* Header */}
        <button
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
          onClick={() => setOpen((v) => !v)}
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-surface-raised flex items-center justify-center text-sm font-bold text-white/70 shrink-0">
            {initial}
          </div>

          {/* Name + services */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">
                {child.child_name}
              </span>
              <Badge variant={child.is_active ? "green" : "gray"}>
                {child.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {child.service_names.length > 0 && (
              <p className="text-xs text-white/40 mt-0.5 truncate">
                {child.service_names.join(" · ")}
              </p>
            )}
          </div>

          {/* Amounts summary */}
          <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-right">
            {amountPaid > 0 && (
              <span className="text-xs font-medium text-green-400">
                {fmtRM(amountPaid)} paid
              </span>
            )}
            {amountDue > 0 && (
              <span className="text-xs font-medium text-red-400">
                {fmtRM(amountDue)} due
              </span>
            )}
            {amountPaid === 0 && amountDue === 0 && (
              <span className="text-xs text-white/30">No records</span>
            )}
          </div>

          <ChevronDown
            className={`w-4 h-4 text-white/40 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Body */}
        {open && (
          <div className="border-t border-white/10">
            {/* Registration row */}
            <div
              className={`flex items-center justify-between px-5 py-3 border-b border-white/10 ${
                child.registration.paid ? "bg-green-900/10" : "bg-red-900/10"
              }`}
            >
              <span className="text-xs font-medium text-white/60">
                Registration fee
              </span>
              {child.registration.paid ? (
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs text-white/40">
                    {fmtDate(child.registration.paid_at!)} ·{" "}
                    {(child.registration.payment_method ?? "").replace(
                      "_",
                      " ",
                    )}
                  </span>
                  <span className="text-xs font-semibold text-green-400">
                    {fmtRM(child.registration.amount!)}
                  </span>
                  <Badge variant="green">Paid</Badge>
                </div>
              ) : (
                <Badge variant="red">Unpaid</Badge>
              )}
            </div>

            {/* Monthly fees table */}
            <div className="px-5 py-4">
              {child.months.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-raised">
                        <th className="pb-2 pr-4 font-semibold text-white/30 uppercase tracking-widest text-left">
                          Month
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-white/30 uppercase tracking-widest text-left">
                          Year
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-white/30 uppercase tracking-widest text-left">
                          Amount
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-white/30 uppercase tracking-widest text-left">
                          Status
                        </th>
                        <th className="pb-2 pr-4 font-semibold text-white/30 uppercase tracking-widest text-left">
                          Date Paid
                        </th>
                        <th className="pb-2 font-semibold text-white/30 uppercase tracking-widest text-left">
                          Receipt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {child.months.map((m, i) => (
                        <tr
                          key={i}
                          className="border-t border-surface-raised/40"
                        >
                          <td className="py-2.5 pr-4 text-white/80">
                            {MONTHS[m.month - 1]}
                          </td>
                          <td className="py-2.5 pr-4 text-white/60">
                            {m.year}
                          </td>
                          <td className="py-2.5 pr-4 text-white/80 tabular-nums">
                            {fmtRM(m.amount)}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge variant={m.paid ? "green" : "red"}>
                              {m.paid ? "Paid" : "Unpaid"}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-white/40">
                            {m.paid && m.paid_at ? fmtDate(m.paid_at) : "—"}
                          </td>
                          <td className="py-2.5">
                            {m.paid && m.session_id && m.receipt_key ? (
                              <button
                                onClick={async () => {
                                  try {
                                    const { url } = await getReceiptUrl(
                                      m.session_id!,
                                    );
                                    const ext = m
                                      .receipt_key!.split(".")
                                      .pop()
                                      ?.toLowerCase();
                                    setReceiptPreview({
                                      url,
                                      isPdf: ext === "pdf",
                                    });
                                  } catch {
                                    toast.error("Failed to load receipt.");
                                  }
                                }}
                                className="flex items-center gap-1 text-[#86efac] hover:text-white transition-colors text-xs"
                              >
                                <Paperclip className="w-3 h-3" />
                                View
                              </button>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-white/40 italic py-2">
                  No payment records for this period.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {receiptPreview && (
        <ReceiptPreviewModal
          url={receiptPreview.url}
          isPdf={receiptPreview.isPdf}
          onClose={() => setReceiptPreview(null)}
        />
      )}
    </>
  );
}

export default function MyReports() {
  const [myChildren, setMyChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reportData, setReportData] = useState<MyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMyProfile()
      .then((p) => setMyChildren(p.children))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedYear) setSelectedMonth("");
  }, [selectedYear]);

  async function handleShow() {
    setLoading(true);
    try {
      const filters: Record<string, number> = {};
      if (selectedChildId) filters.child_id = Number(selectedChildId);
      if (selectedYear) filters.year = Number(selectedYear);
      if (selectedMonth) filters.month = Number(selectedMonth);
      const data = await getMyPaymentSummary(filters);
      setReportData(data);
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch {
      toast.error("Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSelectedChildId("");
    setSelectedYear("");
    setSelectedMonth("");
    setReportData(null);
  }

  const children = reportData?.children ?? [];

  const totalPaid = children.reduce(
    (s, c) => s + c.months.filter((m) => m.paid).length,
    0,
  );
  const totalUnpaid = children.reduce(
    (s, c) => s + c.months.filter((m) => !m.paid).length,
    0,
  );
  const totalCollected = children.reduce((s, c) => {
    const fees = c.months
      .filter((m) => m.paid)
      .reduce((ms, m) => ms + m.amount, 0);
    const reg = c.registration.paid ? (c.registration.amount ?? 0) : 0;
    return s + fees + reg;
  }, 0);
  const totalOutstanding = children.reduce(
    (s, c) =>
      s + c.months.filter((m) => !m.paid).reduce((ms, m) => ms + m.amount, 0),
    0,
  );

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
      <PageHeader
        title="My Payment Report"
        description="View your payment history and outstanding fees."
        backTo={{ label: "Dashboard", to: "/dashboard" }}
      />

      {/* Filters */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white/70">Filters</h2>
          <span className="text-xs text-white/30 ml-1">
            — leave blank to see all
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              Child
            </label>
            <select
              className={SELECT_CLS}
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
            >
              <option value="">All Children</option>
              {myChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? "" : " (Inactive)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              Year
            </label>
            <select
              className={SELECT_CLS}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              Month
            </label>
            <select
              className={SELECT_CLS}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={!selectedYear}
            >
              <option value="">All Months</option>
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleShow} loading={loading}>
            <Eye className="w-3.5 h-3.5" />
            Show
          </Button>
          <Button variant="secondary" onClick={handleClear} disabled={loading}>
            Clear
          </Button>
        </div>
      </div>

      {/* Results */}
      {reportData && (
        <div ref={resultsRef}>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-surface border border-surface-raised rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                Months Paid
              </p>
              <p className="text-xl font-bold text-white">{totalPaid}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {totalUnpaid} unpaid
              </p>
            </div>
            <div className="bg-surface border border-green-900/50 rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                Total Paid
              </p>
              <p className="text-xl font-bold text-green-400">
                {fmtRM(totalCollected)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                fees + registration
              </p>
            </div>
            <div
              className={`bg-surface border rounded-xl px-4 py-3 ${totalOutstanding > 0 ? "border-red-900/50" : "border-surface-raised"}`}
            >
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                Outstanding
              </p>
              <p
                className={`text-xl font-bold ${totalOutstanding > 0 ? "text-red-400" : "text-white"}`}
              >
                {fmtRM(totalOutstanding)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {totalUnpaid} month{totalUnpaid !== 1 ? "s" : ""} unpaid
              </p>
            </div>
          </div>

          {children.length === 0 ? (
            <div className="bg-surface border border-surface-raised rounded-xl p-10 flex flex-col items-center gap-3 text-white/30">
              <FileText className="w-8 h-8" />
              <p className="text-sm">No data found for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {children.map((child) => (
                <ChildAccordion key={child.child_id} child={child} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

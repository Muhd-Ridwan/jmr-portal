import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Filter, Download, FileText, Eye, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { getParents, getParent } from "../api/parents";
import { getPaymentSummary } from "../api/reports";
import type { Parent, Child, ReportParent } from "../types";

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

interface ExportFilters {
  parentName?: string;
  childName?: string;
  month?: number;
  year?: number;
}

function generatePDF(data: ReportParent[], filters: ExportFilters): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("JMR Portal — Payment Report", 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(`Generated: ${genDate}`, 14, 25);

  const filterParts: string[] = [];
  if (filters.parentName) filterParts.push(`Parent: ${filters.parentName}`);
  if (filters.childName) filterParts.push(`Child: ${filters.childName}`);
  if (filters.month && filters.year) {
    filterParts.push(`Period: ${MONTHS[filters.month - 1]} ${filters.year}`);
  } else if (filters.year) {
    filterParts.push(`Year: ${filters.year}`);
  }

  let yPos = 25;
  if (filterParts.length > 0) {
    doc.text(`Filters: ${filterParts.join(" | ")}`, 14, 31);
    yPos = 31;
  }
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  for (const parent of data) {
    if (yPos > 265) {
      doc.addPage();
      yPos = 15;
    }

    // Parent header bar
    doc.setFillColor(79, 140, 92);
    doc.rect(14, yPos - 5, pageWidth - 28, 9, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      parent.is_active
        ? parent.parent_name
        : `${parent.parent_name} [INACTIVE]`,
      16,
      yPos + 1,
    );
    doc.setTextColor(0, 0, 0);
    yPos += 11;

    if (parent.children.length === 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(130, 130, 130);
      doc.text("No children found.", 18, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;
      continue;
    }

    for (const child of parent.children) {
      if (yPos > 255) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(
        child.is_active ? child.child_name : `${child.child_name} [INACTIVE]`,
        18,
        yPos,
      );
      doc.setTextColor(0, 0, 0);
      yPos += 5;

      if (child.service_names.length > 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(child.service_names.join(" · "), 18, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
      }

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      if (child.registration.paid) {
        doc.setTextColor(30, 120, 60);
        const method = (child.registration.payment_method ?? "").replace(
          "_",
          " ",
        );
        doc.text(
          `Registration Fee: PAID — ${fmtRM(child.registration.amount!)} | ${fmtDate(child.registration.paid_at!)} | ${method}`,
          18,
          yPos,
        );
      } else {
        doc.setTextColor(180, 40, 40);
        doc.text("Registration Fee: UNPAID", 18, yPos);
      }
      doc.setTextColor(0, 0, 0);
      yPos += 5;

      if (child.months.length > 0) {
        autoTable(doc, {
          startY: yPos,
          margin: { left: 18, right: 14 },
          head: [["Month", "Year", "Amount", "Status", "Date Paid"]],
          body: child.months.map((m) => [
            MONTHS[m.month - 1],
            String(m.year),
            fmtRM(m.amount),
            m.paid ? "PAID" : "UNPAID",
            m.paid && m.paid_at ? fmtDate(m.paid_at) : "—",
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [79, 140, 92] },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didParseCell: (data: any) => {
            if (data.section === "body" && data.column.index === 3) {
              const val = String(data.cell.raw ?? "");
              if (val === "UNPAID") {
                data.cell.styles.textColor = [180, 40, 40];
                data.cell.styles.fontStyle = "bold";
              } else if (val === "PAID") {
                data.cell.styles.textColor = [30, 120, 60];
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable.finalY + 6;
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(130, 130, 130);
        doc.text("No payment records for this period.", 18, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 6;
      }

      yPos += 2;
    }
    yPos += 4;
  }

  doc.save("jmr-payment-report.pdf");
}

export default function Reports() {
  const [allParents, setAllParents] = useState<Parent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [parentChildren, setParentChildren] = useState<Child[]>([]);
  const [reportData, setReportData] = useState<ReportParent[] | null>(null);
  const [openParentId, setOpenParentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmExport, setShowConfirmExport] = useState(false);
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
      toast.error("Failed to generate report.");
    } finally {
      setLoading(false);
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

  function handleExportClick() {
    if (!reportData) return;
    if (!selectedParentId && !selectedYear) {
      setShowConfirmExport(true);
    } else {
      doExport();
    }
  }

  function doExport() {
    if (!reportData) return;
    setShowConfirmExport(false);
    generatePDF(reportData, {
      parentName: selectedParentId
        ? allParents.find((p) => p.id === Number(selectedParentId))?.parent_name
        : undefined,
      childName: selectedChildId
        ? parentChildren.find((c) => c.id === Number(selectedChildId))?.name
        : undefined,
      month: selectedMonth ? Number(selectedMonth) : undefined,
      year: selectedYear ? Number(selectedYear) : undefined,
    });
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
        title="Payment Reports"
        description="Filter and export payment history for parents and children."
        backTo={{ label: "Dashboard", to: "/dashboard" }}
      />

      {/* Filters */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white/70">Filters</h2>
          <span className="text-xs text-white/30 ml-1">
            — no default selection
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              Parent
            </label>
            <select
              className={SELECT_CLS}
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
            >
              <option value="">All Parents</option>
              {allParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.parent_name}
                  {p.is_active ? "" : " (Inactive)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">
              Child
            </label>
            <select
              className={SELECT_CLS}
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              disabled={!selectedParentId}
            >
              <option value="">All Children</option>
              {parentChildren.map((c) => (
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
          <Button onClick={handleGenerate} loading={loading}>
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
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-surface border border-surface-raised rounded-xl px-4 py-3">
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                Parents
              </p>
              <p className="text-xl font-bold text-white">{totalParents}</p>
              <p className="text-xs text-white/30 mt-0.5">
                {totalChildren} child{totalChildren !== 1 ? "ren" : ""}
              </p>
            </div>
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
                Total Collected
              </p>
              <p className="text-xl font-bold text-green-400">
                RM {totalCollected.toFixed(2)}
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
                RM {totalOutstanding.toFixed(2)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {totalUnpaid} month{totalUnpaid !== 1 ? "s" : ""} unpaid
              </p>
            </div>
          </div>

          {/* Export button */}
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={handleExportClick}>
              <Download className="w-3.5 h-3.5" />
              Generate Report
            </Button>
          </div>

          {reportData.length === 0 ? (
            <div className="bg-surface border border-surface-raised rounded-xl p-10 flex flex-col items-center gap-3 text-white/30">
              <FileText className="w-8 h-8" />
              <p className="text-sm">No data found for the selected filters.</p>
            </div>
          ) : (
            <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden divide-y divide-white/10">
              {reportData.map((parent) => {
                const isOpen = openParentId === parent.parent_id;
                return (
                  <div key={parent.parent_id}>
                    {/* Accordion header */}
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
                          {parent.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-white/30">
                          {parent.children.length} child
                          {parent.children.length !== 1 ? "ren" : ""}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-white/40 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Accordion body */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 space-y-3 border-t border-white/10">
                        {parent.children.length === 0 ? (
                          <p className="text-sm text-white/40 py-2">
                            No children found.
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
                                  {child.is_active ? "Active" : "Inactive"}
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
                                    Registration: Paid{" "}
                                    {fmtRM(child.registration.amount!)} on{" "}
                                    {fmtDate(child.registration.paid_at!)} (
                                    {(
                                      child.registration.payment_method ?? ""
                                    ).replace("_", " ")}
                                    )
                                  </span>
                                ) : (
                                  <span className="text-red-400">
                                    Registration: Unpaid
                                  </span>
                                )}
                              </p>

                              {child.months.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-white/40 text-left">
                                        <th className="pb-2 pr-4 font-medium">
                                          Month
                                        </th>
                                        <th className="pb-2 pr-4 font-medium">
                                          Year
                                        </th>
                                        <th className="pb-2 pr-4 font-medium">
                                          Amount
                                        </th>
                                        <th className="pb-2 pr-4 font-medium">
                                          Status
                                        </th>
                                        <th className="pb-2 font-medium">
                                          Date Paid
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
                                            {MONTHS[m.month - 1]}
                                          </td>
                                          <td className="py-1.5 pr-4 text-white/70">
                                            {m.year}
                                          </td>
                                          <td className="py-1.5 pr-4 text-white/70">
                                            {fmtRM(m.amount)}
                                          </td>
                                          <td className="py-1.5 pr-4">
                                            <Badge
                                              variant={m.paid ? "green" : "red"}
                                            >
                                              {m.paid ? "Paid" : "Unpaid"}
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
                                  No payment records for this period.
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
          )}
        </div>
      )}

      {/* Confirm export-all modal */}
      {showConfirmExport && (
        <Modal
          title="Export All Data?"
          onClose={() => setShowConfirmExport(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowConfirmExport(false)}
              >
                Cancel
              </Button>
              <Button onClick={doExport}>
                <Download className="w-4 h-4" />
                Yes, Generate Report
              </Button>
            </>
          }
        >
          <p className="text-white/70 text-sm">
            No filters are selected. This will export the full payment history
            for all parents and children. Continue?
          </p>
        </Modal>
      )}
    </div>
  );
}

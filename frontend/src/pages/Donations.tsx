import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  Trash2,
  Paperclip,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Button from "../components/Button";
import Modal from "../components/Modal";
import FormField from "../components/FormField";
import Input from "../components/Input";
import {
  getDonations,
  getDonationReceiptUrl,
  getReceiptUploadUrl,
  createDonation,
  updateDonation,
  deleteDonation,
  type DonationTransaction,
  type DonationData,
  type DonationPayload,
} from "../api/donations";

function ReceiptPreviewModal({
  donationId,
  receiptKey,
  onClose,
}: {
  donationId: number;
  receiptKey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ext = receiptKey.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg"].includes(ext);

  useEffect(() => {
    getDonationReceiptUrl(donationId)
      .then((r) => setUrl(r.url))
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Failed to load receipt";
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [donationId]);

  return (
    <Modal title={t("common.receipt")} onClose={onClose}>
      {loading ? (
        <p className="text-white/50 text-sm">{t("common.loading")}</p>
      ) : url ? (
        isImage ? (
          <img src={url} alt="Receipt" className="w-full rounded-lg" />
        ) : (
          <iframe
            src={url}
            className="w-full h-96 rounded-lg"
            title="Receipt"
          />
        )
      ) : (
        <p className="text-white/50 text-sm">Unable to load receipt.</p>
      )}
      {url && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={async () => {
              const r = await getDonationReceiptUrl(donationId, true);
              window.open(r.url, "_blank");
            }}
          >
            {t("donations.download")}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function TransactionModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: DonationTransaction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<"credit" | "debit">(
    editing?.type ?? "credit",
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(
    editing?.transaction_date ?? new Date().toISOString().slice(0, 10),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(
    editing?.receipt_key ?? null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      e.amount = t("donations.modal.amountRequired");
    if (!date) e.date = t("donations.modal.dateRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      let key = uploadedKey;
      if (receiptFile && !uploadedKey) {
        setUploading(true);
        const { upload_url, key: newKey } = await getReceiptUploadUrl(
          receiptFile.name,
          receiptFile.type,
        );
        await fetch(upload_url, {
          method: "PUT",
          body: receiptFile,
          headers: { "Content-Type": receiptFile.type },
        });
        setUploadedKey(newKey);
        key = newKey;
        setUploading(false);
      }

      const payload: DonationPayload = {
        type,
        amount: Number(amount),
        description: description || undefined,
        receipt_key: key ?? undefined,
        transaction_date: date,
      };

      if (editing) {
        const result = await updateDonation(editing.id, payload);
        toast.success(result.message || t("donations.modal.successUpdate"));
      } else {
        const result = await createDonation(payload);
        toast.success(result.message || t("donations.modal.successCreate"));
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("donations.modal.uploadFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  return (
    <Modal
      title={
        editing ? t("donations.modal.editTitle") : t("donations.modal.addTitle")
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("donations.modal.cancel")}
          </Button>
          <Button loading={saving || uploading} onClick={handleSubmit}>
            {t("donations.modal.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t("donations.modal.typeLabel")}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("credit")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                type === "credit"
                  ? "bg-green-900/30 border-green-500/50 text-green-400"
                  : "bg-surface-raised border-surface-raised text-white/50 hover:text-white"
              }`}
            >
              {t("donations.modal.credit")}
            </button>
            <button
              type="button"
              onClick={() => setType("debit")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                type === "debit"
                  ? "bg-red-900/30 border-red-500/50 text-red-400"
                  : "bg-surface-raised border-surface-raised text-white/50 hover:text-white"
              }`}
            >
              {t("donations.modal.debit")}
            </button>
          </div>
        </FormField>

        <FormField
          label={t("donations.modal.amountLabel")}
          required
          error={errors.amount}
        >
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
          />
        </FormField>

        <FormField
          label={t("donations.modal.dateLabel")}
          required
          error={errors.date}
        >
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />
        </FormField>

        <FormField label={t("donations.modal.descriptionLabel")}>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              type === "debit"
                ? t("donations.modal.descriptionPlaceholder")
                : ""
            }
          />
        </FormField>

        <FormField label={t("donations.modal.receiptLabel")}>
          {uploadedKey ? (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Paperclip className="w-4 h-4 text-white/40" />
              <span className="flex-1 truncate">
                {uploadedKey.split("/").pop()}
              </span>
              <button
                type="button"
                onClick={() => {
                  setUploadedKey(null);
                  setReceiptFile(null);
                }}
                className="text-white/30 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setReceiptFile(f);
                    setUploadedKey(null);
                  }
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                {receiptFile
                  ? receiptFile.name
                  : t("donations.modal.attachReceipt")}
              </Button>
            </>
          )}
        </FormField>
      </div>
    </Modal>
  );
}

export default function Donations() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [data, setData] = useState<DonationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filterType, setFilterType] = useState<"" | "credit" | "debit">("");
  const [filterYear, setFilterYear] = useState<number | "">("");
  const [filterMonth, setFilterMonth] = useState<number | "">("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DonationTransaction | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const months = t("common.months", { returnObjects: true }) as string[];
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    new Set([
      currentYear,
      ...(data?.transactions.map((tx) =>
        new Date(tx.transaction_date).getFullYear(),
      ) ?? []),
    ]),
  ).sort((a, b) => b - a);

  useEffect(() => {
    setLoading(true);
    getDonations({
      type: filterType || undefined,
      year: filterYear || undefined,
      month: filterMonth || undefined,
    })
      .then(setData)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load";
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [filterType, filterYear, filterMonth, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await deleteDonation(id);
      toast.success(t("donations.modal.successDelete"));
      setConfirmDeleteId(null);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(
      i18n.language === "ms" ? "ms-MY" : "en-MY",
      { day: "numeric", month: "short", year: "numeric" },
    );
  }

  const balanceNegative = (data?.balance ?? 0) < 0;

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
      <PageHeader
        title={t("donations.title")}
        description={t("donations.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
            >
              {t("donations.addTransaction")}
            </Button>
          ) : undefined
        }
      />

      {/* Mobile: compact horizontal rows */}
      <div className="flex sm:hidden flex-col gap-2 mb-6">
        {[
          {
            label: t("donations.totalReceived"),
            value: data?.total_credit ?? 0,
            color: "text-[#86efac]",
            icon: <ArrowDownCircle className="w-4 h-4" />,
            highlight: false,
          },
          {
            label: t("donations.totalSpent"),
            value: data?.total_debit ?? 0,
            color: "text-white",
            icon: <ArrowUpCircle className="w-4 h-4" />,
            highlight: false,
          },
          {
            label: t("donations.balance"),
            value: data?.balance ?? 0,
            color: balanceNegative ? "text-red-400" : "text-white",
            icon: <Wallet className="w-4 h-4" />,
            highlight: balanceNegative,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface rounded-xl border border-surface-raised flex items-center gap-4 px-4 py-3.5"
          >
            <div
              className={`p-2 rounded-lg shrink-0 ${card.highlight ? "bg-red-900/40 text-red-400" : "bg-surface-raised text-white/60"}`}
            >
              {card.icon}
            </div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest flex-1">
              {card.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
              RM {Number(card.value).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Desktop: 3-col grid */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-raised text-white/60 shrink-0">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                {t("donations.totalReceived")}
              </p>
              <p className="text-2xl font-bold text-[#86efac]">
                RM {(data?.total_credit ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-raised text-white/60 shrink-0">
              <ArrowUpCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                {t("donations.totalSpent")}
              </p>
              <p className="text-2xl font-bold text-white">
                RM {(data?.total_debit ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 ${balanceNegative ? "bg-red-900/40 text-red-400" : "bg-surface-raised text-white/60"}`}
            >
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                {t("donations.balance")}
              </p>
              <p
                className={`text-2xl font-bold ${balanceNegative ? "text-red-400" : "text-white"}`}
              >
                RM {(data?.balance ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 mb-4">
        <div className="flex gap-1">
          {(["", "credit", "debit"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === f
                  ? "bg-primary text-white"
                  : "bg-surface-raised text-white/50 hover:text-white"
              }`}
            >
              {f === ""
                ? t("donations.filterAll")
                : f === "credit"
                  ? t("donations.filterCredit")
                  : t("donations.filterDebit")}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            value={filterYear}
            onChange={(e) =>
              setFilterYear(e.target.value ? Number(e.target.value) : "")
            }
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-raised border border-surface-raised text-white/70 outline-none focus:ring-2 focus:ring-primary/60"
          >
            <option value="">— {t("reports.allYears")} —</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) =>
              setFilterMonth(e.target.value ? Number(e.target.value) : "")
            }
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-raised border border-surface-raised text-white/70 outline-none focus:ring-2 focus:ring-primary/60"
          >
            <option value="">— {t("reports.allMonths")} —</option>
            {months.map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile: compact scrollable list */}
      <div className="sm:hidden rounded-xl border border-surface-raised overflow-hidden">
        {loading ? (
          <p className="text-center text-white/30 py-8">
            {t("common.loading")}
          </p>
        ) : !data?.transactions.length ? (
          <p className="text-center text-white/30 py-8">
            {t("donations.noTransactions")}
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
            {data.transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-raised/50 transition-colors"
              >
                {/* Type icon */}
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${tx.type === "credit" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
                >
                  {tx.type === "credit" ? (
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Middle: description + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">
                    {tx.description ||
                      (tx.type === "credit"
                        ? t("donations.typeCredit")
                        : t("donations.typeDebit"))}
                  </p>
                  <p className="text-xs text-white/30">
                    {formatDate(tx.transaction_date)}
                  </p>
                </div>

                {/* Right: amount + actions */}
                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={`text-sm font-bold tabular-nums ${tx.type === "credit" ? "text-[#86efac]" : "text-red-400"}`}
                  >
                    {tx.type === "debit" ? "−" : "+"}RM{" "}
                    {Number(tx.amount).toFixed(2)}
                  </span>
                  {tx.receipt_key && (
                    <button
                      onClick={() => {
                        setPreviewId(tx.id);
                        setPreviewKey(tx.receipt_key);
                      }}
                      className="text-white/30 hover:text-[#86efac] transition-colors"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdmin &&
                    (confirmDeleteId === tx.id ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="danger"
                          loading={deleting}
                          onClick={() => handleDelete(tx.id)}
                        >
                          {t("common.confirm")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setEditing(tx);
                            setShowModal(true);
                          }}
                          className="text-white/30 hover:text-white transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(tx.id)}
                          className="text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-surface-raised bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-surface-raised">
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">
                {t("donations.columnDate")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">
                {t("donations.columnType")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">
                {t("donations.columnAmount")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">
                {t("donations.columnDescription")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">
                {t("donations.columnReceipt")}
              </th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="px-4 py-8 text-center text-white/30"
                >
                  {t("common.loading")}
                </td>
              </tr>
            ) : !data?.transactions.length ? (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="px-4 py-8 text-center text-white/30"
                >
                  {t("donations.noTransactions")}
                </td>
              </tr>
            ) : (
              data.transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`transition-colors ${
                    tx.type === "debit"
                      ? "bg-red-900/10 hover:bg-red-900/20"
                      : "hover:bg-surface-raised/50"
                  }`}
                >
                  <td className="px-4 py-3 text-white/70">
                    {formatDate(tx.transaction_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.type === "credit"
                          ? "bg-green-900/30 text-green-400"
                          : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {tx.type === "credit" ? (
                        <ArrowDownCircle className="w-3 h-3" />
                      ) : (
                        <ArrowUpCircle className="w-3 h-3" />
                      )}
                      {tx.type === "credit"
                        ? t("donations.typeCredit")
                        : t("donations.typeDebit")}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${tx.type === "credit" ? "text-[#86efac]" : "text-red-400"}`}
                  >
                    {tx.type === "debit" ? "−" : "+"}RM{" "}
                    {Number(tx.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    <div>
                      {tx.description || (
                        <span className="text-white/30">—</span>
                      )}
                    </div>
                    <div className="text-xs text-white/30">
                      {t("donations.recordedBy")} {tx.created_by_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {tx.receipt_key ? (
                      <button
                        onClick={() => {
                          setPreviewId(tx.id);
                          setPreviewKey(tx.receipt_key);
                        }}
                        className="flex items-center gap-1 text-xs text-[#86efac] hover:underline"
                      >
                        <Paperclip className="w-3 h-3" />
                        {t("donations.preview")}
                      </button>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {confirmDeleteId === tx.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleting}
                            onClick={() => handleDelete(tx.id)}
                          >
                            {t("common.confirm")}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditing(tx);
                              setShowModal(true);
                            }}
                            className="text-white/30 hover:text-white transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(tx.id)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TransactionModal
          editing={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}

      {previewId !== null && previewKey !== null && (
        <ReceiptPreviewModal
          donationId={previewId}
          receiptKey={previewKey}
          onClose={() => {
            setPreviewId(null);
            setPreviewKey(null);
          }}
        />
      )}
    </div>
  );
}

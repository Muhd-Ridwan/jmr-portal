import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Phone,
  Mail,
  MapPin,
  UserCheck,
  UserX,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { getParent, updateParent } from "../api/parents";
import {
  getServiceTypes,
  createChild,
  toggleChildStatus,
} from "../api/children";
import {
  createPaymentSession,
  createRegistrationPayment,
  getPendingPayments,
  getPaymentHistory,
} from "../api/payments";
import type {
  ParentDetail as ParentDetailType,
  Child,
  ServiceType,
  PaymentHistory,
  PendingPayments,
  RegistrationPaymentRecord,
} from "../types";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Button from "../components/Button";
import FormField from "../components/FormField";
import Input from "../components/Input";

const MONTH_NAMES = [
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

// ── Edit Parent Modal ─────────────────────────────────────────────────────────

function EditParentModal({
  parent,
  onClose,
  onSaved,
}: {
  parent: ParentDetailType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    parent_name: parent.parent_name,
    email: parent.email ?? "",
    address: parent.address ?? "",
  });
  const [phones, setPhones] = useState<string[]>(
    parent.phone_numbers.map((p) => p.phone_num),
  );
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function addPhone() {
    const trimmed = newPhone.trim();
    if (!trimmed) return;
    setPhones((prev) => [...prev, trimmed]);
    setNewPhone("");
  }

  function removePhone(idx: number) {
    setPhones((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!form.parent_name.trim()) {
      toast.error("Name is required");
      return;
    }
    const finalPhones = newPhone.trim() ? [...phones, newPhone.trim()] : phones;
    if (finalPhones.length === 0) {
      toast.error("At least one phone number is required");
      return;
    }
    setSaving(true);
    try {
      await updateParent(parent.id, {
        parent_name: form.parent_name.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        phone_numbers: finalPhones,
      });
      toast.success("Parent updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Parent"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Full Name" required>
          <Input
            type="text"
            value={form.parent_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, parent_name: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            placeholder="Optional"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </FormField>
        <FormField label="Address">
          <Input
            type="text"
            placeholder="Optional"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Phone Numbers" required>
          <div className="space-y-2">
            {phones.map((phone, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={phone}
                  onChange={(e) =>
                    setPhones((prev) =>
                      prev.map((p, i) => (i === idx ? e.target.value : p)),
                    )
                  }
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removePhone(idx)}
                  disabled={phones.length === 1 && !newPhone.trim()}
                  className="p-2 text-white/30 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Add phone number"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPhone()}
                className="flex-1"
              />
              <button
                type="button"
                onClick={addPhone}
                disabled={!newPhone.trim()}
                className="p-2 text-white/30 hover:text-[#86efac] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </FormField>
      </div>
    </Modal>
  );
}

// ── Add Child Modal ───────────────────────────────────────────────────────────

function AddChildModal({
  parentId,
  serviceTypes,
  onClose,
  onSaved,
}: {
  parentId: number;
  serviceTypes: ServiceType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    dob: "",
    service_type_ids:
      serviceTypes.length > 0 ? [serviceTypes[0].id] : ([] as number[]),
  });
  const [saving, setSaving] = useState(false);

  function toggleService(id: number) {
    setForm((f) => ({
      ...f,
      service_type_ids: f.service_type_ids.includes(id)
        ? f.service_type_ids.filter((s) => s !== id)
        : [...f.service_type_ids, id],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.service_type_ids.length === 0) {
      toast.error("Select at least one service");
      return;
    }
    setSaving(true);
    try {
      await createChild({
        parent_id: parentId,
        name: form.name.trim(),
        dob: form.dob || undefined,
        service_type_ids: form.service_type_ids,
      });
      toast.success("Child added");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add Child"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            Add Child
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Name" required>
          <Input
            type="text"
            placeholder="Child's full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>
        <FormField label="Date of Birth">
          <Input
            type="date"
            value={form.dob}
            onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
          />
        </FormField>
        <FormField label="Services" required>
          <div className="space-y-2">
            {serviceTypes.map((st) => {
              const checked = form.service_type_ids.includes(st.id);
              return (
                <label
                  key={st.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? "border-primary/60 bg-primary/10"
                      : "border-surface-raised bg-surface-raised hover:bg-[#4a7a57]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(st.id)}
                    className="w-4 h-4 accent-primary shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {st.name
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-white/40">
                      RM {st.monthly_fee}/month · RM {st.registration_fee}{" "}
                      registration
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </FormField>
      </div>
    </Modal>
  );
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({
  parentId,
  activeChildren,
  onClose,
  onSaved,
}: {
  parentId: number;
  activeChildren: Child[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const [childMonths, setChildMonths] = useState<
    Record<number, { month: number; year: number }[]>
  >({});
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "online">(
    "cash",
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleChild(child: Child) {
    setChildMonths((prev) => {
      if (prev[child.id]) {
        const next = { ...prev };
        delete next[child.id];
        return next;
      }
      return {
        ...prev,
        [child.id]: [{ month: now.getMonth() + 1, year: now.getFullYear() }],
      };
    });
  }

  function addMonth(childId: number) {
    setChildMonths((prev) => ({
      ...prev,
      [childId]: [
        ...(prev[childId] ?? []),
        { month: now.getMonth() + 1, year: now.getFullYear() },
      ],
    }));
  }

  function removeMonth(childId: number, idx: number) {
    setChildMonths((prev) => {
      const updated = (prev[childId] ?? []).filter((_, i) => i !== idx);
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[childId];
        return next;
      }
      return { ...prev, [childId]: updated };
    });
  }

  function updateMonth(
    childId: number,
    idx: number,
    field: "month" | "year",
    val: number,
  ) {
    setChildMonths((prev) => {
      const updated = [...(prev[childId] ?? [])];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, [childId]: updated };
    });
  }

  const fee_payments = Object.entries(childMonths).flatMap(
    ([childId, months]) => {
      const child = activeChildren.find((c) => c.id === +childId);
      return months.map((m) => ({
        child_id: +childId,
        month: m.month,
        year: m.year,
        amount: child?.monthly_fee ?? 0,
      }));
    },
  );

  const total = fee_payments.reduce((sum, p) => sum + p.amount, 0);

  async function handleSubmit() {
    if (fee_payments.length === 0) {
      toast.error("Select at least one child and month");
      return;
    }
    setSaving(true);
    try {
      await createPaymentSession({
        parent_id: parentId,
        total_amount: total,
        payment_method: method,
        notes: notes.trim() || undefined,
        paid_at: new Date().toISOString(),
        fee_payments,
      });
      toast.success("Payment recorded");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record Payment"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Record — RM {total}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {activeChildren.map((child) => {
          const selected = !!childMonths[child.id];
          const months = childMonths[child.id] ?? [];
          return (
            <div
              key={child.id}
              className="rounded-lg border border-surface-raised overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleChild(child)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                  selected
                    ? "bg-primary/20 text-white"
                    : "bg-surface-raised text-white/60 hover:text-white"
                }`}
              >
                <span className="font-medium">{child.name}</span>
                <span className="text-xs text-white/40">
                  RM {child.monthly_fee}/month
                </span>
              </button>

              {selected && (
                <div className="px-4 py-3 space-y-2 bg-surface">
                  {months.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={m.month}
                        onChange={(e) =>
                          updateMonth(child.id, idx, "month", +e.target.value)
                        }
                        className="flex-1 px-2 py-1.5 text-xs rounded bg-surface-raised border border-surface-raised text-white focus:outline-none focus:ring-1 focus:ring-primary/60"
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        value={m.year}
                        onChange={(e) =>
                          updateMonth(child.id, idx, "year", +e.target.value)
                        }
                        className="w-24 text-xs py-1.5"
                      />
                      <span className="text-xs text-white/40 shrink-0">
                        RM {child.monthly_fee}
                      </span>
                      <button
                        onClick={() => removeMonth(child.id, idx)}
                        className="text-white/30 hover:text-red-400 transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addMonth(child.id)}
                    className="text-xs text-[#86efac] hover:text-white transition-colors"
                  >
                    + Add month
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {activeChildren.length === 0 && (
          <p className="text-sm text-white/40 text-center py-4">
            No active children to record payment for.
          </p>
        )}

        <div className="pt-2 border-t border-surface-raised space-y-3">
          <FormField label="Payment Method" required>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-raised bg-surface-raised text-white focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
            </select>
          </FormField>
          <FormField label="Notes">
            <Input
              type="text"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </div>

        {total > 0 && (
          <div className="flex justify-between items-center py-2 border-t border-surface-raised">
            <span className="text-sm text-white/60">Total</span>
            <span className="text-lg font-bold text-white">RM {total}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ParentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const parentId = Number(id);

  const [parent, setParent] = useState<ParentDetailType | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [history, setHistory] = useState<PaymentHistory>({
    sessions: [],
    registration_payments: [],
  });
  const [pendingMap, setPendingMap] = useState<Record<number, PendingPayments>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [includingInactive, setIncludingInactive] = useState(false);

  useEffect(() => {
    if (user && user.role === "user") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    load();
  }, [parentId, includingInactive]);

  async function load() {
    setLoading(true);
    try {
      const [p, st, h] = await Promise.all([
        getParent(parentId, includingInactive),
        getServiceTypes(),
        getPaymentHistory(parentId),
      ]);
      setParent(p);
      setServiceTypes(st);
      setHistory(h as PaymentHistory);

      // Load pending payments for all children to get registration status
      const pending = await Promise.all(
        p.children.map((c) =>
          getPendingPayments(c.id).then((r) => [c.id, r] as const),
        ),
      );
      setPendingMap(Object.fromEntries(pending));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(child: Child) {
    try {
      await toggleChildStatus(child.id, !child.is_active);
      toast.success(
        `${child.name} ${child.is_active ? "deactivated" : "activated"}`,
      );
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handlePayRegistration(child: Child) {
    const totalRegFee = child.service_types.reduce(
      (sum, s) => sum + Number(s.registration_fee),
      0,
    );
    try {
      await createRegistrationPayment(child.id, {
        amount: totalRegFee,
        payment_method: "cash",
        paid_at: new Date().toISOString(),
      });
      toast.success(`Registration paid for ${child.name}`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
        <p className="text-red-400 text-sm">Parent not found.</p>
      </div>
    );
  }

  const activeChildren = parent.children.filter((c) => c.is_active);

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title={parent.parent_name}
        description={`Registered ${new Date(parent.created_at).toLocaleDateString("en-MY")}`}
        backTo={{ label: "Parents", to: "/parents" }}
        action={
          <Button variant="secondary" onClick={() => setShowEdit(true)}>
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
        }
      />

      {/* Parent Info */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">
          Contact Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-white/30 shrink-0" />
              <span className="text-sm text-white/70">
                {parent.email ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-white/30 shrink-0" />
              <span className="text-sm text-white/70">
                {parent.address ?? "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-white/30 shrink-0" />
            <div className="flex flex-col gap-1">
              {parent.phone_numbers.map((p) => (
                <span key={p.id} className="text-sm text-white/70">
                  {p.phone_num}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-raised flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white/70">Children</h2>
            <p className="text-xs text-white/30 mt-0.5">
              {activeChildren.length} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncludingInactive((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-white/50 border border-white/15 rounded-md px-2.5 py-1 hover:text-white/70 hover:border-white/30 transition-colors"
            >
              {includingInactive ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              {includingInactive ? "Hide inactive" : "Show inactive"}
            </button>
            <Button size="sm" onClick={() => setShowAddChild(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add Child
            </Button>
          </div>
        </div>

        {parent.children.length === 0 ? (
          <p className="px-6 py-8 text-sm text-white/30 text-center">
            No children registered yet.
          </p>
        ) : (
          <div className="divide-y divide-surface-raised">
            {parent.children.map((child) => {
              const pending = pendingMap[child.id];
              const regPaid = pending?.registration_paid ?? true;
              return (
                <div
                  key={child.id}
                  className={`px-6 py-4 flex items-center justify-between gap-4 ${
                    !child.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {child.name}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {child.service_types
                        .map((s) =>
                          s.name
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase()),
                        )
                        .join(" + ")}{" "}
                      · RM {child.monthly_fee}/month
                      {child.dob &&
                        ` · ${new Date(child.dob).toLocaleDateString("en-MY")}`}
                    </p>
                    {!regPaid ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-amber-400/80 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Registration unpaid — RM{" "}
                          {child.service_types
                            .reduce(
                              (sum, s) => sum + Number(s.registration_fee),
                              0,
                            )
                            .toFixed(2)}
                        </span>
                        <button
                          onClick={() => handlePayRegistration(child)}
                          className="text-xs px-2 py-0.5 rounded font-medium bg-amber-400/10 text-amber-300 border border-amber-400/30 hover:bg-amber-400/20 hover:border-amber-400/60 hover:text-amber-200 transition-all"
                        >
                          Pay now
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400/70">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Registration paid
                        {pending?.registration_payment && (
                          <span className="text-white/30">
                            ·{" "}
                            {new Date(
                              pending.registration_payment.paid_at,
                            ).toLocaleDateString("en-MY", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            · RM{" "}
                            {Number(
                              pending.registration_payment.amount,
                            ).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(child)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        child.is_active
                          ? "bg-surface-raised text-white/60 hover:text-red-400"
                          : "bg-surface-raised text-white/40 hover:text-[#86efac]"
                      }`}
                    >
                      {child.is_active ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          Inactive
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-raised flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white/70">
              Payment History
            </h2>
            <p className="text-xs text-white/30 mt-0.5">
              {history.sessions.length + history.registration_payments.length}{" "}
              entr
              {history.sessions.length +
                history.registration_payments.length !==
              1
                ? "ies"
                : "y"}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowPayment(true)}
            disabled={activeChildren.length === 0}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </Button>
        </div>

        {history.sessions.length === 0 &&
        history.registration_payments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-white/30 text-center">
            No payments recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-surface-raised">
            {/* Merge sessions and registration payments, sorted newest first */}
            {[
              ...history.sessions.map((s) => ({
                type: "session" as const,
                date: s.paid_at,
                data: s,
              })),
              ...history.registration_payments.map((r) => ({
                type: "registration" as const,
                date: r.paid_at,
                data: r,
              })),
            ]
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              )
              .map((entry) => {
                if (entry.type === "registration") {
                  const rp = entry.data as RegistrationPaymentRecord;
                  return (
                    <div
                      key={`reg-${rp.id}`}
                      className="px-6 py-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-white flex items-center gap-2">
                          <Receipt className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                          Registration — {rp.child_name}
                          <span className="text-white/40 font-normal text-xs capitalize">
                            · {rp.payment_method.replace("_", " ")}
                          </span>
                        </p>
                        <p className="text-xs text-white/40 mt-0.5 ml-5">
                          {new Date(rp.paid_at).toLocaleDateString("en-MY", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          · Recorded by {rp.recorded_by}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-emerald-400/80 tabular-nums">
                        RM {Number(rp.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                }

                const session = entry.data as (typeof history.sessions)[0];
                return (
                  <div key={`session-${session.id}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSession((v) =>
                          v === session.id ? null : session.id,
                        )
                      }
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-raised/50 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">
                          RM {session.total_amount}{" "}
                          <span className="text-white/40 font-normal text-xs capitalize">
                            · {session.payment_method.replace("_", " ")}
                          </span>
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {new Date(session.paid_at).toLocaleDateString(
                            "en-MY",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}{" "}
                          · Recorded by {session.recorded_by}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-white/30">
                        <Calendar className="w-3.5 h-3.5" />
                        {expandedSession === session.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {expandedSession === session.id && (
                      <div className="px-6 pb-4 space-y-1">
                        {session.fee_payments.map((fp) => (
                          <div
                            key={fp.id}
                            className="flex items-center justify-between text-xs py-1.5 border-t border-surface-raised/50 first:border-t-0"
                          >
                            <span className="text-white/60">
                              {fp.child_name}
                            </span>
                            <span className="text-white/40">
                              {MONTH_NAMES[fp.month - 1]} {fp.year}
                            </span>
                            <span className="text-white/60">
                              RM {fp.amount}
                            </span>
                          </div>
                        ))}
                        {session.notes && (
                          <p className="text-xs text-white/30 pt-2 italic">
                            Note: {session.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showEdit && (
        <EditParentModal
          parent={parent}
          onClose={() => setShowEdit(false)}
          onSaved={load}
        />
      )}
      {showAddChild && (
        <AddChildModal
          parentId={parentId}
          serviceTypes={serviceTypes}
          onClose={() => setShowAddChild(false)}
          onSaved={load}
        />
      )}
      {showPayment && (
        <RecordPaymentModal
          parentId={parentId}
          activeChildren={activeChildren}
          onClose={() => setShowPayment(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import {
  getServiceTypes,
  createServiceType,
  updateServiceType,
  toggleServiceTypeStatus,
} from "../api/children";
import type { ServiceType } from "../types";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Button from "../components/Button";
import FormField from "../components/FormField";
import Input from "../components/Input";

function formatName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Service Modal (shared for add + edit) ─────────────────────────────────────

function ServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service?: ServiceType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!service;
  const [form, setForm] = useState({
    name: service?.name ?? "",
    monthly_fee: service?.monthly_fee?.toString() ?? "",
    registration_fee: service?.registration_fee?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  const hasSymbol = /[^a-z0-9_]/.test(form.name);

  function handleNameChange(raw: string) {
    const cleaned = raw.toLowerCase().replace(/ /g, "_");
    setForm((f) => ({ ...f, name: cleaned }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Service name is required");
      return;
    }
    if (hasSymbol) {
      toast.error("Service name contains invalid symbols.");
      return;
    }
    const monthly = parseFloat(form.monthly_fee);
    const registration = parseFloat(form.registration_fee);
    if (isNaN(monthly) || monthly < 0) {
      toast.error("Enter a valid monthly fee");
      return;
    }
    if (isNaN(registration) || registration < 0) {
      toast.error("Enter a valid registration fee");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const result = (await updateServiceType(service!.id, {
          name: form.name.trim(),
          monthly_fee: monthly,
          registration_fee: registration,
        })) as { message: string };
        toast.success(result.message);
      } else {
        const result = (await createServiceType({
          name: form.name.trim(),
          monthly_fee: monthly,
          registration_fee: registration,
        })) as { message: string };
        toast.success(result.message);
      }
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
      title={isEdit ? "Edit Service" : "Add Service"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            {isEdit ? "Save Changes" : "Add Service"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Service Name" required>
          <Input
            type="text"
            placeholder="e.g. quran_only"
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={hasSymbol ? "border-red-500 focus:ring-red-500/40" : ""}
          />
          <p
            className={`text-xs mt-1 ${hasSymbol ? "text-red-400" : "text-white/30"}`}
          >
            {hasSymbol
              ? "Symbols are not permitted. Use letters, numbers, and underscores only."
              : "Spaces are converted to underscores automatically."}
          </p>
        </FormField>
        <FormField label="Monthly Fee (RM)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.monthly_fee}
            onChange={(e) =>
              setForm((f) => ({ ...f, monthly_fee: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Registration Fee (RM)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.registration_fee}
            onChange={(e) =>
              setForm((f) => ({ ...f, registration_fee: e.target.value }))
            }
          />
        </FormField>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Services() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceType | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.role === "user") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setServices(await getServiceTypes(true));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(service: ServiceType) {
    setTogglingId(service.id);
    try {
      const result = await toggleServiceTypeStatus(
        service.id,
        !service.is_active,
      );
      toast.success(result.message);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title="Services"
        description="Manage service types and pricing"
        backTo={{ label: "Dashboard", to: "/dashboard" }}
        action={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Service
          </Button>
        }
      />

      <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
        {/* Desktop column headers */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-surface-raised">
          <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
            Service
          </span>
          <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
            Monthly
          </span>
          <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
            Registration
          </span>
          <span />
          <span />
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-white/30 text-center">
            Loading...
          </p>
        ) : services.length === 0 ? (
          <p className="px-6 py-8 text-sm text-white/30 text-center">
            No services configured yet.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {services.map((s) => (
              <div key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                {/* ── Mobile card ── */}
                <div className="sm:hidden px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">
                          {formatName(s.name)}
                        </p>
                        {!s.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-raised text-white/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/30 mt-0.5 font-mono">
                        {s.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-raised rounded-lg px-3 py-2">
                      <p className="text-xs text-white/30 uppercase tracking-wide mb-0.5">
                        Monthly
                      </p>
                      <p className="text-sm font-semibold text-white tabular-nums">
                        RM {Number(s.monthly_fee).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-surface-raised rounded-lg px-3 py-2">
                      <p className="text-xs text-white/30 uppercase tracking-wide mb-0.5">
                        Registration
                      </p>
                      <p className="text-sm font-semibold text-white tabular-nums">
                        RM {Number(s.registration_fee).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditTarget(s)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white/60 bg-surface-raised hover:text-white transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggle(s)}
                      disabled={togglingId === s.id}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        s.is_active
                          ? "text-white/60 bg-surface-raised hover:text-red-400"
                          : "text-white/60 bg-surface-raised hover:text-[#86efac]"
                      }`}
                    >
                      {s.is_active ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" />
                          Activate
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Desktop row ── */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {formatName(s.name)}
                      </p>
                      {!s.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-raised text-white/30">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 mt-0.5 font-mono">
                      {s.name}
                    </p>
                  </div>
                  <span className="text-sm text-white/70 text-right tabular-nums">
                    RM {Number(s.monthly_fee).toFixed(2)}
                  </span>
                  <span className="text-sm text-white/70 text-right tabular-nums">
                    RM {Number(s.registration_fee).toFixed(2)}
                  </span>
                  <button
                    onClick={() => setEditTarget(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 bg-surface-raised hover:text-white transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(s)}
                    disabled={togglingId === s.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      s.is_active
                        ? "text-white/50 bg-surface-raised hover:text-red-400"
                        : "text-white/50 bg-surface-raised hover:text-[#86efac]"
                    }`}
                  >
                    {s.is_active ? (
                      <>
                        <ToggleRight className="w-3.5 h-3.5" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-3.5 h-3.5" />
                        Activate
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <ServiceModal onClose={() => setShowAdd(false)} onSaved={load} />
      )}
      {editTarget && (
        <ServiceModal
          service={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

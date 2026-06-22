import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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

function ServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service?: ServiceType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!service;
  const [form, setForm] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    monthly_fee: service?.monthly_fee?.toString() ?? "",
    registration_fee: service?.registration_fee?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  const hasSymbol = /[^a-zA-Z0-9\s+\-&().\/,']/.test(form.name);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(t("services.modal.nameRequired"));
      return;
    }
    if (hasSymbol) {
      toast.error(t("services.modal.invalidSymbols"));
      return;
    }
    const monthly = parseFloat(form.monthly_fee);
    const registration = parseFloat(form.registration_fee);
    if (isNaN(monthly) || monthly < 0) {
      toast.error(t("services.modal.invalidMonthlyFee"));
      return;
    }
    if (isNaN(registration) || registration < 0) {
      toast.error(t("services.modal.invalidRegistrationFee"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const result = (await updateServiceType(service!.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          monthly_fee: monthly,
          registration_fee: registration,
        })) as { message: string };
        toast.success(result.message);
      } else {
        const result = (await createServiceType({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
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
      title={
        isEdit ? t("services.modal.editTitle") : t("services.modal.addTitle")
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("services.modal.cancel")}
          </Button>
          <Button loading={saving} onClick={handleSave}>
            {isEdit
              ? t("services.modal.saveChanges")
              : t("services.modal.addBtn")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label={t("services.modal.serviceName")} required>
          <Input
            type="text"
            placeholder={t("services.modal.serviceNamePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={hasSymbol ? "border-red-500 focus:ring-red-500/40" : ""}
          />
          {hasSymbol && (
            <p className="text-xs mt-1 text-red-400">
              {t("services.modal.invalidSymbolsDetail")}
            </p>
          )}
        </FormField>
        <FormField label={t("services.modal.description")}>
          <textarea
            rows={3}
            placeholder={t("services.modal.descriptionPlaceholder")}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="w-full bg-surface-raised border border-surface-raised text-white rounded-lg px-3 py-2 text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </FormField>
        <FormField label={t("services.modal.monthlyFee")} required>
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
        <FormField label={t("services.modal.registrationFee")} required>
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

export default function Services() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        title={t("services.title")}
        description={t("services.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
        action={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />
            {t("services.addService")}
          </Button>
        }
      />

      <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_68px] px-6 py-3 border-b border-surface-raised">
          <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
            {t("services.serviceColumn")}
          </span>
          <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
            {t("services.monthlyColumn")}
          </span>
          <span className="text-xs font-semibold text-white/30 uppercase tracking-widest text-right">
            {t("services.registrationColumn")}
          </span>
          <span />
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-white/30 text-center">
            {t("services.loading")}
          </p>
        ) : services.length === 0 ? (
          <p className="px-6 py-8 text-sm text-white/30 text-center">
            {t("services.noServices")}
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {services.map((s) => (
              <div key={s.id} className={!s.is_active ? "opacity-50" : ""}>
                {/* Mobile card */}
                <div className="sm:hidden px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">
                          {s.name}
                        </p>
                        {!s.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-raised text-white/30">
                            {t("services.inactive")}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-xs text-white/40 mt-0.5">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-raised rounded-lg px-3 py-2">
                      <p className="text-xs text-white/30 uppercase tracking-wide mb-0.5">
                        {t("services.monthly")}
                      </p>
                      <p className="text-sm font-semibold text-white tabular-nums">
                        RM {Number(s.monthly_fee).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-surface-raised rounded-lg px-3 py-2">
                      <p className="text-xs text-white/30 uppercase tracking-wide mb-0.5">
                        {t("services.registration")}
                      </p>
                      <p className="text-sm font-semibold text-white tabular-nums">
                        RM {Number(s.registration_fee).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditTarget(s)}
                      className="flex-1 justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t("services.editBtn")}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggle(s)}
                      disabled={togglingId === s.id}
                      className={`flex-1 justify-center ${
                        s.is_active
                          ? "!text-red-400 hover:!bg-red-900/20"
                          : "!text-[#86efac] hover:!bg-primary/10"
                      }`}
                    >
                      {s.is_active ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5" />
                          {t("services.deactivate")}
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" />
                          {t("services.activate")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_68px] items-center px-6 py-4 hover:bg-white/[0.03] transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      {!s.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-raised text-white/30">
                          {t("services.inactive")}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-white/40 mt-0.5">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <span className="text-sm tabular-nums text-white/70 text-right">
                    RM {Number(s.monthly_fee).toFixed(2)}
                  </span>
                  <span className="text-sm tabular-nums text-white/70 text-right">
                    RM {Number(s.registration_fee).toFixed(2)}
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditTarget(s)}
                      title={t("services.editTitle")}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(s)}
                      disabled={togglingId === s.id}
                      title={
                        s.is_active
                          ? t("services.deactivateTitle")
                          : t("services.activateTitle")
                      }
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                        s.is_active
                          ? "text-red-400 hover:bg-red-900/20"
                          : "text-[#86efac] hover:bg-primary/10"
                      }`}
                    >
                      {s.is_active ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                  </div>
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

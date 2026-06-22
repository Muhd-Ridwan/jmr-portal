import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Eye, Phone, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { getParents, createParent, deleteParent } from "../api/parents";
import type { Parent } from "../types";
import PageHeader from "../components/PageHeader";
import Table from "../components/Table";
import Modal from "../components/Modal";
import Button from "../components/Button";
import FormField from "../components/FormField";
import Input from "../components/Input";

interface ParentForm {
  parent_name: string;
  email: string;
  address: string;
  phone_numbers: string[];
}

const emptyForm: ParentForm = {
  parent_name: "",
  email: "",
  address: "",
  phone_numbers: [""],
};

export default function Parents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ParentForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    if (user && user.role === "user") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    load();
  }, [includeInactive]);

  async function load() {
    setLoading(true);
    try {
      const data = (await getParents(includeInactive)) as Parent[];
      setParents(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.parent_name.trim()) e.parent_name = t("parents.nameRequired");
    const validPhones = form.phone_numbers.filter((p) => p.trim());
    if (validPhones.length === 0) e.phone_numbers = t("parents.phoneRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    setSaving(true);
    try {
      await createParent({
        parent_name: form.parent_name.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        phone_numbers: form.phone_numbers.filter((p) => p.trim()),
      });
      toast.success(t("parents.successRegistered"));
      closeModal();
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteParent(id);
      toast.success(t("parents.successDeleted"));
      setConfirmDelete(null);
      setParents((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm);
    setErrors({});
  }

  function addPhone() {
    setForm((f) => ({ ...f, phone_numbers: [...f.phone_numbers, ""] }));
  }

  function updatePhone(index: number, value: string) {
    setForm((f) => {
      const phones = [...f.phone_numbers];
      phones[index] = value;
      return { ...f, phone_numbers: phones };
    });
  }

  function removePhone(index: number) {
    setForm((f) => ({
      ...f,
      phone_numbers: f.phone_numbers.filter((_, i) => i !== index),
    }));
  }

  const columns = [
    {
      header: t("parents.nameColumn"),
      key: "parent_name",
      render: (row: Parent) => (
        <div className="flex items-center gap-2">
          <span
            className={`font-medium ${row.is_active ? "text-white" : "text-white/40"}`}
          >
            {row.parent_name}
          </span>
          {!row.is_active && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-surface-raised text-white/30">
              {t("common.inactive")}
            </span>
          )}
        </div>
      ),
    },
    {
      header: t("parents.emailColumn"),
      key: "email",
      render: (row: Parent) => (
        <span className="text-white/50">{row.email ?? "—"}</span>
      ),
    },
    {
      header: t("parents.addressColumn"),
      key: "address",
      render: (row: Parent) => (
        <span className="text-white/50">{row.address ?? "—"}</span>
      ),
    },
    {
      header: t("parents.registeredColumn"),
      key: "created_at",
      render: (row: Parent) =>
        new Date(row.created_at).toLocaleDateString("en-MY"),
    },
    {
      header: "",
      key: "actions",
      className: "w-36",
      render: (row: Parent) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/parents/${row.id}`)}
          >
            <Eye className="w-3.5 h-3.5" />
            {t("parents.viewButton")}
          </Button>
          {confirmDelete === row.id ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(row.id)}
            >
              {t("parents.confirmDelete")}
            </Button>
          ) : (
            <button
              onClick={() => setConfirmDelete(row.id)}
              className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
              aria-label="Delete parent"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
      <PageHeader
        title={t("parents.title")}
        description={t("parents.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIncludeInactive((v) => !v)}
            >
              {includeInactive ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {includeInactive
                ? t("parents.hideInactive")
                : t("parents.showInactive")}
            </Button>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />
              {t("parents.addParent")}
            </Button>
          </div>
        }
      />

      <Table
        columns={columns}
        data={parents}
        emptyMessage={loading ? t("common.loading") : t("parents.noParents")}
      />

      {showModal && (
        <Modal
          title={t("parents.registerParent")}
          onClose={closeModal}
          footer={
            <>
              <Button variant="secondary" onClick={closeModal}>
                {t("parents.modal.cancel")}
              </Button>
              <Button loading={saving} onClick={handleCreate}>
                {t("parents.modal.register")}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <FormField
              label={t("parents.modal.fullName")}
              required
              error={errors.parent_name}
            >
              <Input
                type="text"
                placeholder={t("parents.modal.fullNamePlaceholder")}
                value={form.parent_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parent_name: e.target.value }))
                }
                error={errors.parent_name}
              />
            </FormField>

            <FormField label={t("common.email")} error={errors.email}>
              <Input
                type="email"
                placeholder={t("common.optional")}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </FormField>

            <FormField label={t("common.address")} error={errors.address}>
              <Input
                type="text"
                placeholder={t("common.optional")}
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </FormField>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-white/70">
                {t("parents.modal.phoneNumbers")}{" "}
                <span className="text-red-400">*</span>
              </label>
              {form.phone_numbers.map((phone, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder={t("parents.modal.phonePlaceholder", {
                      num: i + 1,
                    })}
                    value={phone}
                    onChange={(e) => updatePhone(i, e.target.value)}
                    error={i === 0 ? errors.phone_numbers : undefined}
                  />
                  {form.phone_numbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="text-white/30 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {errors.phone_numbers && (
                <p className="text-xs text-red-400">{errors.phone_numbers}</p>
              )}
              <button
                type="button"
                onClick={addPhone}
                className="inline-flex items-center gap-1 text-xs text-[#86efac] hover:text-white mt-1 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {t("parents.modal.addAnotherNumber")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

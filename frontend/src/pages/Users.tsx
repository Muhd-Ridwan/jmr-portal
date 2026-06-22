import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Users as UsersIcon,
  Send,
  UserX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getUsers,
  createAdmin,
  createStaffUser,
  deleteUser,
} from "../api/users";
import { sendOnboarding, toggleParentStatus } from "../api/parents";
import type { StaffUser } from "../types";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Button from "../components/Button";
import FormField from "../components/FormField";
import Input from "../components/Input";

function RoleBadge({ role }: { role: string; isParent?: boolean }) {
  const { t } = useTranslation();
  if (role === "superadmin")
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/40 font-medium">
        {t("users.superadmin")}
      </span>
    );
  if (role === "admin")
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/40 font-medium">
        {t("users.admin")}
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-white/50 border border-white/10 font-medium">
      {t("users.userRole")}
    </span>
  );
}

function CreateUserModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: "admin" | "user";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone_num: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(t("users.modal.nameRequired"));
      return;
    }
    if (!form.email.trim()) {
      toast.error(t("users.modal.emailRequired"));
      return;
    }
    if (!form.password) {
      toast.error(t("users.modal.passwordRequired"));
      return;
    }
    setSaving(true);
    try {
      const fn = mode === "admin" ? createAdmin : createStaffUser;
      const result = await fn({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone_num: form.phone_num.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      toast.success(result.message);
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
        mode === "admin"
          ? t("users.modal.addAdminTitle")
          : t("users.modal.addStaffTitle")
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("users.modal.cancel")}
          </Button>
          <Button loading={saving} onClick={handleSave}>
            {mode === "admin"
              ? t("users.modal.createAdmin")
              : t("users.modal.createStaff")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label={t("users.modal.fullName")} required>
          <Input
            type="text"
            placeholder={t("users.modal.fullName")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>
        <FormField label={t("users.modal.email")} required>
          <Input
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </FormField>
        <FormField label={t("users.modal.password")} required>
          <Input
            type="password"
            placeholder={t("users.modal.password")}
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
        </FormField>
        <FormField label={t("users.modal.phone")}>
          <Input
            type="text"
            placeholder={t("common.optional")}
            value={form.phone_num}
            onChange={(e) =>
              setForm((f) => ({ ...f, phone_num: e.target.value }))
            }
          />
        </FormField>
        <FormField label={t("users.modal.address")}>
          <Input
            type="text"
            placeholder={t("common.optional")}
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function Users() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isSuperadmin = user?.role === "superadmin";

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState<"admin" | "user" | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [togglingParentId, setTogglingParentId] = useState<number | null>(null);

  useEffect(() => {
    if (user && user.role === "user") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (isSuperadmin) load();
    else setLoading(false);
  }, [isSuperadmin]);

  async function load() {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleParent(u: StaffUser) {
    if (!u.parent_id) return;
    setTogglingParentId(u.id);
    try {
      const result = await toggleParentStatus(u.parent_id);
      toast.success(result.message);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTogglingParentId(null);
    }
  }

  async function handleSendOnboarding(u: StaffUser) {
    if (!u.parent_id) return;
    setSendingId(u.id);
    try {
      const result = (await sendOnboarding(u.parent_id)) as { message: string };
      toast.success(result.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(u: StaffUser) {
    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      toast.success(`${u.name} ${t("users.remove").toLowerCase()}`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateMode("user")}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("users.addStaff")}
            </Button>
            {isSuperadmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCreateMode("admin")}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("users.addAdmin")}
              </Button>
            )}
          </div>
        }
      />

      {isSuperadmin ? (
        <div className="bg-surface border border-surface-raised rounded-xl overflow-hidden">
          <div className="hidden sm:grid sm:grid-cols-[2fr_2fr_110px_96px] gap-6 px-6 py-3 border-b border-surface-raised">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              {t("users.nameColumn")}
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              {t("users.emailColumn")}
            </span>
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
              {t("users.joinedColumn")}
            </span>
            <span />
          </div>

          {loading ? (
            <p className="px-6 py-8 text-sm text-white/30 text-center">
              {t("users.loading")}
            </p>
          ) : users.length === 0 ? (
            <p className="px-6 py-8 text-sm text-white/30 text-center">
              {t("users.noUsers")}
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {users.map((u) => {
                const canDelete = u.role !== "superadmin" && u.id !== user?.id;
                const avatarColors =
                  u.role === "superadmin"
                    ? "bg-purple-900/50 text-purple-300"
                    : u.role === "admin"
                      ? "bg-amber-900/50 text-amber-300"
                      : u.is_parent
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-surface-raised text-white/60";
                return (
                  <div key={u.id}>
                    {/* Mobile card */}
                    <div className="sm:hidden px-5 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColors}`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {u.name}
                            </p>
                            <p className="text-xs text-white/40 mt-0.5 truncate">
                              {u.email}
                            </p>
                          </div>
                        </div>
                        <RoleBadge role={u.role} isParent={u.is_parent} />
                      </div>
                      <div className="flex items-center justify-between pl-12">
                        <p className="text-xs text-white/30">
                          {new Date(u.created_at).toLocaleDateString("en-MY", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {canDelete && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDelete(u)}
                            disabled={deletingId === u.id}
                            className="hover:!text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t("users.remove")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Desktop row */}
                    <div className="hidden sm:grid sm:grid-cols-[2fr_2fr_110px_96px] gap-6 items-center px-6 py-3.5 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColors}`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white truncate">
                              {u.name}
                            </p>
                            <RoleBadge role={u.role} isParent={u.is_parent} />
                          </div>
                          {u.phone_num && (
                            <p className="text-xs text-white/30 mt-0.5">
                              {u.phone_num}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-white/50 truncate">
                        {u.email}
                      </p>

                      <span className="text-xs text-white/30">
                        {new Date(u.created_at).toLocaleDateString("en-MY", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>

                      <div className="flex items-center justify-end gap-1">
                        {isSuperadmin &&
                          u.is_parent &&
                          u.needs_onboarding &&
                          u.email && (
                            <button
                              onClick={() => handleSendOnboarding(u)}
                              disabled={sendingId === u.id}
                              title={t("users.sendOnboarding")}
                              className="p-1.5 rounded-lg text-white/30 hover:text-[#86efac] hover:bg-primary/10 transition-colors disabled:opacity-30"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        {isSuperadmin && u.is_parent && (
                          <button
                            onClick={() => handleToggleParent(u)}
                            disabled={togglingParentId === u.id}
                            title={
                              u.parent_is_active
                                ? t("users.deactivateParent")
                                : t("users.activateParent")
                            }
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                              u.parent_is_active
                                ? "text-white/30 hover:text-red-400 hover:bg-red-900/20"
                                : "text-white/30 hover:text-[#86efac] hover:bg-primary/10"
                            }`}
                          >
                            {u.parent_is_active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deletingId === u.id}
                            title={`${t("users.remove")} ${u.name}`}
                            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-surface-raised rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center">
            <UsersIcon className="w-5 h-5 text-white/30" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">
              {t("users.createStaff")}
            </p>
            <p className="text-xs text-white/30 mt-1">
              {t("users.createStaffDesc")}
            </p>
          </div>
        </div>
      )}

      {createMode && (
        <CreateUserModal
          mode={createMode}
          onClose={() => setCreateMode(null)}
          onSaved={isSuperadmin ? load : () => {}}
        />
      )}
    </div>
  );
}

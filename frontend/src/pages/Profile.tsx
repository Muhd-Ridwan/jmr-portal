import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { useAuth } from "../hooks/useAuth";
import { updateProfile, refreshAccessToken } from "../api/auth";
import PageHeader from "../components/PageHeader";
import FormField from "../components/FormField";
import Input from "../components/Input";
import Button from "../components/Button";

export default function Profile() {
  const { user, updateToken } = useAuth();
  const { t, i18n } = useTranslation();

  const [details, setDetails] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
  });
  const [password, setPassword] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [language, setLanguage] = useState(i18n.language || "en");
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  async function handleSaveDetails() {
    if (!details.name.trim()) {
      toast.error(t("profile.errors.nameRequired"));
      return;
    }
    setSavingDetails(true);
    try {
      const result = await updateProfile({
        name: details.name.trim(),
        email: details.email.trim() || undefined,
      });
      const refresh = localStorage.getItem("refresh_token")!;
      const { access_token } = await refreshAccessToken(refresh);
      updateToken(access_token);
      toast.success(result.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSavePassword() {
    if (!password.current_password) {
      toast.error(t("profile.errors.currentPasswordRequired"));
      return;
    }
    if (!password.new_password) {
      toast.error(t("profile.errors.newPasswordRequired"));
      return;
    }
    if (password.new_password !== password.confirm_password) {
      toast.error(t("profile.errors.passwordsNoMatch"));
      return;
    }
    setSavingPassword(true);
    try {
      const result = await updateProfile({
        current_password: password.current_password,
        new_password: password.new_password,
      });
      toast.success(result.message);
      setPassword({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSavePreferences() {
    setSavingPrefs(true);
    try {
      await updateProfile({ language });
      localStorage.setItem("user_language", language);
      await i18next.changeLanguage(language);
      toast.success(t("profile.savePreferences"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <PageHeader
        title={t("profile.title")}
        description={t("profile.description")}
        backTo={{ label: t("nav.dashboard"), to: "/dashboard" }}
      />

      {/* Details */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          {t("profile.accountDetails")}
        </h2>
        <FormField label={t("profile.name")} required>
          <Input
            type="text"
            value={details.name}
            onChange={(e) =>
              setDetails((d) => ({ ...d, name: e.target.value }))
            }
          />
        </FormField>
        <FormField label={t("profile.email")}>
          <Input
            type="email"
            value={details.email}
            onChange={(e) =>
              setDetails((d) => ({ ...d, email: e.target.value }))
            }
          />
        </FormField>
        <div className="flex justify-end pt-1">
          <Button loading={savingDetails} onClick={handleSaveDetails}>
            {t("profile.saveDetails")}
          </Button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          {t("profile.changePassword")}
        </h2>
        <FormField label={t("profile.currentPassword")} required>
          <Input
            type="password"
            value={password.current_password}
            onChange={(e) =>
              setPassword((p) => ({ ...p, current_password: e.target.value }))
            }
          />
        </FormField>
        <FormField label={t("profile.newPassword")} required>
          <Input
            type="password"
            value={password.new_password}
            onChange={(e) =>
              setPassword((p) => ({ ...p, new_password: e.target.value }))
            }
          />
        </FormField>
        <FormField label={t("profile.confirmNewPassword")} required>
          <Input
            type="password"
            value={password.confirm_password}
            onChange={(e) =>
              setPassword((p) => ({ ...p, confirm_password: e.target.value }))
            }
          />
        </FormField>
        <div className="flex justify-end pt-1">
          <Button loading={savingPassword} onClick={handleSavePassword}>
            {t("profile.changePasswordBtn")}
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-surface border border-surface-raised rounded-xl p-6 space-y-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          {t("profile.preferences")}
        </h2>
        <FormField label={t("profile.languageLabel")}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-surface-raised bg-surface-raised text-white focus:outline-none focus:ring-2 focus:ring-primary/60"
          >
            <option value="en">{t("profile.english")}</option>
            <option value="ms">{t("profile.malay")}</option>
          </select>
        </FormField>
        <div className="flex justify-end pt-1">
          <Button loading={savingPrefs} onClick={handleSavePreferences}>
            {t("profile.savePreferences")}
          </Button>
        </div>
      </div>
    </div>
  );
}

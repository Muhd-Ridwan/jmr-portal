import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resetPassword } from "../api/auth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (form.password.length < 8) e.password = t("resetPassword.minChars");
    if (form.password !== form.confirm)
      e.confirm = t("resetPassword.passwordsNoMatch");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(t("resetPassword.invalidToken"));
      return;
    }
    if (!validate()) return;
    setLoading(true);
    try {
      await resetPassword(token, form.password);
      toast.success(t("resetPassword.success"));
      navigate("/login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#3d6e48] flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="bg-[#4f8c5c] rounded-[2.5rem] px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="JMR Portal" className="h-20 w-auto" />
            <p className="text-white font-semibold text-base mt-2 tracking-wide">
              JMR Portal
            </p>
          </div>
          <p className="text-white/70 text-xs text-center mb-6">
            {t("resetPassword.instruction")}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("resetPassword.newPassword")}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 pr-12 bg-[#e8ede9] rounded-xl text-sm text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-white/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={
                    showPassword
                      ? t("resetPassword.hidePassword")
                      : t("resetPassword.showPassword")
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-white/80 text-xs mt-1 pl-1">
                  {errors.password}
                </p>
              )}
            </div>
            <div>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder={t("resetPassword.confirmPassword")}
                  value={form.confirm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, confirm: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 pr-12 bg-[#e8ede9] rounded-xl text-sm text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-white/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={
                    showConfirm
                      ? t("resetPassword.hidePassword")
                      : t("resetPassword.showPassword")
                  }
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirm && (
                <p className="text-white/80 text-xs mt-1 pl-1">
                  {errors.confirm}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-3.5 bg-[#6ec24a] text-white text-sm font-semibold rounded-full hover:bg-[#5aad38] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? t("resetPassword.saving")
                  : t("resetPassword.setNewPassword")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

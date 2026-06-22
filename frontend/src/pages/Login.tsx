import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { login } from "../api/auth";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login: storeLogin, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = t("login.emailRequired");
    if (!form.password) e.password = t("login.passwordRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const data = (await login(form.email, form.password)) as {
        access_token: string;
        refresh_token: string;
      };
      await storeLogin(data.access_token, data.refresh_token);
      navigate("/dashboard", { replace: true });
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
          <div className="flex flex-col items-center mb-10">
            <img src="/logo.png" alt="JMR Portal" className="h-24 w-auto" />
            <p className="text-white font-semibold text-base mt-2 tracking-wide">
              JMR Portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder={t("login.emailPlaceholder")}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full px-4 py-3.5 bg-[#e8ede9] rounded-xl text-sm text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-white/40 transition-all"
              />
              {errors.email && (
                <p className="text-white/80 text-xs mt-1 pl-1">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("login.passwordPlaceholder")}
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
                      ? t("login.hidePassword")
                      : t("login.showPassword")
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

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#6ec24a] text-white text-sm font-semibold rounded-full hover:bg-[#5aad38] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t("login.signingIn") : t("login.login")}
              </button>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-white/80 text-xs hover:text-white transition-colors"
              >
                {t("login.forgotPassword")}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

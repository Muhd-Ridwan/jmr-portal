import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { forgotPassword } from "../api/auth";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
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
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-white text-sm">
                {t("forgotPassword.successMessage")}
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-0.5 text-white/80 text-xs hover:text-white transition-colors"
              >
                <ChevronLeft size={12} /> {t("forgotPassword.backToLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-white/70 text-xs text-center mb-2">
                {t("forgotPassword.instruction")}
              </p>
              <input
                type="email"
                placeholder={t("common.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-[#e8ede9] rounded-xl text-sm text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-white/40 transition-all"
              />
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#6ec24a] text-white text-sm font-semibold rounded-full hover:bg-[#5aad38] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading
                    ? t("forgotPassword.sending")
                    : t("forgotPassword.sendResetLink")}
                </button>
              </div>
              <div className="flex justify-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-0.5 text-white/80 text-xs hover:text-white transition-colors"
                >
                  <ChevronLeft size={12} /> {t("forgotPassword.backToLogin")}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

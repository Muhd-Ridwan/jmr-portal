import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { setup } from "../api/auth";

export default function Setup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (form.password.length < 8) e.password = "Min. 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await setup(form.name, form.email, form.password);
      toast.success("Account created. Please log in.");
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
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="JMR Portal" className="h-20 w-auto" />
          </div>

          <p className="text-white/70 text-xs text-center mb-6">
            Create the superadmin account. This can only be done once.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Name */}
            <div>
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full px-4 py-3.5 bg-[#e8ede9] rounded-xl text-sm text-gray-800 placeholder-gray-500 outline-none focus:ring-2 focus:ring-white/40 transition-all"
              />
              {errors.name && (
                <p className="text-white/80 text-xs mt-1 pl-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <input
                type="email"
                placeholder="Email"
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

            {/* Password */}
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
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

            {/* Confirm Password */}
            <div>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm Password"
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
                  aria-label={showConfirm ? "Hide password" : "Show password"}
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

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#6ec24a] text-white text-sm font-semibold rounded-full hover:bg-[#5aad38] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

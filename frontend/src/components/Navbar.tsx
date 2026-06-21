import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings, Layers, Users } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <header className="bg-surface text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo — clicks back to dashboard */}
          <Link
            to="/dashboard"
            className="flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity"
          >
            <img src="/logo.png" alt="JMR Portal" className="h-9 w-auto" />
            <span className="font-semibold text-white text-sm hidden sm:block">
              JMR Portal
            </span>
          </Link>

          {/* Avatar dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold text-white select-none">
                {initial}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/70 transition-transform duration-150 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-xl border border-surface-raised z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-raised">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5 truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-surface-raised hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4 text-white/40" />
                    Edit Profile
                  </button>
                  {(user?.role === "admin" || user?.role === "superadmin") && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate("/services");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-surface-raised hover:text-white transition-colors"
                    >
                      <Layers className="w-4 h-4 text-white/40" />
                      Manage Services
                    </button>
                  )}
                  {(user?.role === "admin" || user?.role === "superadmin") && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate("/users");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-surface-raised hover:text-white transition-colors"
                    >
                      <Users className="w-4 h-4 text-white/40" />
                      Manage Users
                    </button>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

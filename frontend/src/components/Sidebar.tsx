import { NavLink, useNavigate } from "react-router-dom";
import { Home, Users, CreditCard, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navItems = [
    {
      to: "/dashboard",
      label: t("nav.dashboard"),
      icon: <Home className="w-5 h-5" />,
    },
    {
      to: "/parents",
      label: t("nav.parents"),
      icon: <Users className="w-5 h-5" />,
    },
    {
      to: "/payments",
      label: t("nav.payments"),
      icon: <CreditCard className="w-5 h-5" />,
    },
  ];

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="JMR Portal" className="h-8 w-auto" />
          <span className="font-semibold text-gray-800 text-sm">
            JMR Portal
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-800 truncate">
            {user?.name}
          </p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}

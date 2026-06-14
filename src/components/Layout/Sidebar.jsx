import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import TopBar from "./TopBar";
import { useTranslation } from "react-i18next";
import logo from "../../assets/logo.png";

export default function Sidebar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logOut, userRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/dashboard", label: t("dashboard"), icon: "fas fa-tachometer-alt", roles: ["citizen", "agent", "gestionnaire"] },
    { path: "/map", label: t("map"), icon: "fas fa-map-marked-alt", roles: ["citizen", "agent", "gestionnaire"] },
    { path: "/reports", label: t("reports"), icon: "fas fa-flag-checkered", roles: ["citizen", "agent", "gestionnaire"] },
    { path: "/tours", label: t("tours"), icon: "fas fa-truck", roles: ["agent", "gestionnaire"] },
    { path: "/optim", label: t("optimization"), icon: "fas fa-chart-line", roles: ["agent", "gestionnaire"] },
    { path: "/employments", label: t("employments"), icon: "fas fa-calendar-alt", roles: ["agent", "gestionnaire"] }, // NEW
    { path: "/collab", label: t("collaboration"), icon: "fas fa-users", roles: ["citizen", "agent", "gestionnaire"] },
    { path: "/settings", label: t("settings"), icon: "fas fa-cog", roles: ["citizen", "agent", "gestionnaire"] }
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-container">
      {/* Hamburger button – visible only on mobile */}
      <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
        <i className="fas fa-bars"></i>
      </button>

      {/* Overlay backdrop */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={closeMenu}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="mobile-close-btn" onClick={closeMenu}>
          <i className="fas fa-times"></i>
        </div>
        <button className="logo-area" onClick={() => navigate("/")}>
          <img src={logo} alt="logo" className="logo-img" />
          <div className="logo-text">
            <h1>UrbanClean</h1>
            <span>intelligent · urbain</span>
          </div>
        </button>
        <div className="nav-menu">
          {filteredNavItems.map(item => (
            <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? "active" : ""}`} onClick={closeMenu}>
              <i className={item.icon}></i><span>{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="bottom-nav">
          <div className="nav-item" onClick={() => { toggleTheme(); closeMenu(); }}>
            <i className={`fas ${theme === "light" ? "fa-moon" : "fa-sun"}`}></i>
            <span>{theme === "light" ? t("dark") : t("light")}</span>
          </div>
          <div className="nav-item" onClick={() => { logOut(); closeMenu(); }}>
            <i className="fas fa-sign-out-alt"></i><span>{t("logout")}</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <TopBar />
        <Outlet />
      </main>
    </div>
  );
}
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function TopBar() {
  const { t } = useTranslation();
  const { currentUser, userRole } = useAuth();
  
  const getPageTitle = () => {
    const path = window.location.pathname;
    if (path === "/dashboard") return t("dashboard");
    if (path === "/map") return t("map");
    if (path === "/reports") return t("reports");
    if (path === "/tours") return t("tours");
    if (path === "/optim") return t("optimization");
    if (path === "/collab") return t("collaboration");
    if (path === "/settings") return t("settings");
    return path.slice(1).charAt(0).toUpperCase() + path.slice(2);
  };

  const getRoleLabel = () => {
    if (userRole === "gestionnaire") return t("manager");
    if (userRole === "agent") return t("agent");
    return t("citizen");
  };

  return (
    <div className="top-bar">
      <div className="page-title">
        <h2>{getPageTitle()}</h2>
        <p><i className="fas fa-sync-alt fa-fw"></i> {t("realtime_overview")}</p>
      </div>
      <div className="user-profile">
        <span className="badge-role"><i className="fas fa-user-check"></i> {getRoleLabel()}</span>
        <div className="avatar">{currentUser?.email?.charAt(0).toUpperCase()}</div>
      </div>
    </div>
  );
}
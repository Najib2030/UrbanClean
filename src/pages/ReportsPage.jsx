import { useState } from "react";
import ReportList from "../components/Reports/ReportList";
import ReportForm from "../components/Reports/ReportForm";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function ReportsPage() {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h3><i className="fas fa-list"></i> {t("list_of_reports")}</h3>
        {userRole === "citizen" && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <i className="fas fa-plus"></i>
            {t("new_report")}
          </button>
        )}
      </div>
      <ReportList />
      {showForm && <ReportForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
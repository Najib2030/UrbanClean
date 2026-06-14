// src/pages/MapPage.jsx
import { useState, useEffect } from "react";
import ReportsMap from "../components/Map/ReportsMap";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function MapPage() {
  const { t } = useTranslation();
  const { userRole, currentUser } = useAuth();
  const [filter, setFilter] = useState("all");
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    setMapKey(prev => prev + 1);
  }, []);

  return (
    <div>
      <div className="card">
        <h3><i className="fas fa-map-marked-alt"></i> {t("cartography_title") || "Cartographie des signalements – Taroudant"}</h3>
        
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <button 
            className={`btn-secondary ${filter === "all" ? "active-filter" : ""}`}
            onClick={() => setFilter("all")}
            style={{ background: filter === "all" ? "#2b7a4b" : "", color: filter === "all" ? "white" : "inherit" }}
          >
            {t("all_reports")}
          </button>
          <button 
            className={`btn-secondary ${filter === "active" ? "active-filter" : ""}`}
            onClick={() => setFilter("active")}
            style={{ background: filter === "active" ? "#2b7a4b" : "", color: filter === "active" ? "white" : "inherit" }}
          >
            {t("active")}
          </button>
          <button 
            className={`btn-secondary ${filter === "resolved" ? "active-filter" : ""}`}
            onClick={() => setFilter("resolved")}
            style={{ background: filter === "resolved" ? "#2b7a4b" : "", color: filter === "resolved" ? "white" : "inherit" }}
          >
            {t("resolved_status")}
          </button>
          {(userRole === "citizen" || userRole === "agent") && (
            <button 
              className={`btn-secondary ${filter === "my" ? "active-filter" : ""}`}
              onClick={() => setFilter("my")}
              style={{ background: filter === "my" ? "#2b7a4b" : "", color: filter === "my" ? "white" : "inherit" }}
            >
              {userRole === "citizen" ? t("my_reports") : t("my_tasks")}
            </button>
          )}
        </div>

        <ReportsMap key={mapKey} filter={filter} userRole={userRole} currentUserId={currentUser?.uid} />
      </div>

      {/* Updated legend with markers and zone colors */}
      <div className="card">
        <h4><i className="fas fa-info-circle"></i> {t("map_legend")}</h4>
        
        {/* Report markers */}
        <div style={{ marginBottom: "16px" }}>
          <strong>{t("report_markers") || "Type de signalement"}</strong>
          <div style={{ display: "flex", gap: "16px", marginTop: "8px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#dc2626", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><i className="fas fa-trash-alt" style={{ fontSize: "12px" }}></i></div>
              <span>{t("illegal_dumping")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#f97316", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><i className="fas fa-dumpster" style={{ fontSize: "12px" }}></i></div>
              <span>{t("full_container")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#8b5cf6", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><i className="fas fa-couch" style={{ fontSize: "12px" }}></i></div>
              <span>{t("bulky_items")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#ec489a", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><i className="fas fa-paint-brush" style={{ fontSize: "12px" }}></i></div>
              <span>{t("graffiti")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#10b981", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}><i className="fas fa-check-circle" style={{ fontSize: "12px" }}></i></div>
              <span>{t("resolved_marker")}</span>
            </div>
          </div>
        </div>

        {/* City zone colors */}
        <div>
          <strong>{t("city_zones") || "Zones de la ville (X)"}</strong>
          <div style={{ display: "flex", gap: "16px", marginTop: "8px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#a955f7af", width: "24px", height: "24px", borderRadius: "4px" }}></div>
              <span>{t("zone_north")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#facc15af", width: "24px", height: "24px", borderRadius: "4px" }}></div>
              <span>{t("zone_east")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#22c55eaf", width: "24px", height: "24px", borderRadius: "4px" }}></div>
              <span>{t("zone_south")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#3b82f6af", width: "24px", height: "24px", borderRadius: "4px" }}></div>
              <span>{t("zone_west")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ background: "#ff0000af", width: "24px", height: "24px", borderRadius: "4px", border: "1px solid #ccc" }}></div>
              <span>{t("outside_city") || "Hors de Taroudant (rouge transparent)"}</span>
            </div>
          </div>
        </div>

        <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "#5b6e8c" }}>
          {t("click_marker")}
        </p>
      </div>
    </div>
  );
}
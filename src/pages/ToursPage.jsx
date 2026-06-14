import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, getDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { createNotification } from "../utils/createNotification";

export default function ToursPage() {
  const { t } = useTranslation();
  const { userRole, currentUser } = useAuth();
  const [unassignedReports, setUnassignedReports] = useState([]);
  const [assignedReports, setAssignedReports] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole === "gestionnaire") {
      const fetchAgents = async () => {
        const q = query(collection(db, "users"), where("role", "==", "agent"));
        const snap = await getDocs(q);
        const agentsList = snap.docs.map(doc => ({ id: doc.id, name: doc.data().fullName || doc.data().email }));
        setAllAgents(agentsList);
      };
      fetchAgents();
    }
  }, [userRole]);

  useEffect(() => {
    const q = query(collection(db, "reports"), where("status", "in", ["En attente", "En cours", "Résolu"]));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (userRole === "agent") {
        setUnassignedReports(allReports.filter(r => !r.assignedTo && r.status !== "Résolu"));
        setAssignedReports(allReports.filter(r => r.assignedTo === currentUser.uid && r.status !== "Résolu"));
      } else if (userRole === "gestionnaire") {
        setUnassignedReports(allReports.filter(r => !r.assignedTo && r.status !== "Résolu"));
        setAssignedReports(allReports.filter(r => r.assignedTo && r.status !== "Résolu"));
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [userRole, currentUser]);

  const assignToSelf = async (reportId) => {
    try {
      await updateDoc(doc(db, "reports", reportId), { 
        assignedTo: currentUser.uid, 
        status: "En cours" 
      });
      toast.success(t("assigned_to_self"));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const assignToAgent = async (reportId, agentId, agentName) => {
    if (!agentId) return;
    try {
      await updateDoc(doc(db, "reports", reportId), { 
        assignedTo: agentId,
        status: "En attente"
      });
      toast.success(t("assigned_to_agent_success", { name: agentName }));
      
      // Notify the agent
      const agentDoc = await getDoc(doc(db, "users", agentId));
      if (agentDoc.data()?.notif_assigned !== false) {
        await createNotification(
          agentId,
          t("new_assignment"),
          t("new_report_assigned_to_you"),
          "📋",
          "/tours"
        );
      }
      
      // Notify the report creator
      const reportDoc = await getDoc(doc(db, "reports", reportId));
      const creatorId = reportDoc.data()?.createdBy;
      if (creatorId && creatorId !== agentId) {
        const creatorDoc = await getDoc(doc(db, "users", creatorId));
        if (creatorDoc.data()?.notif_assigned_creator !== false) {
          await createNotification(
            creatorId,
            t("assignment_update"),
            t("your_report_assigned"),
            "✅",
            "/reports"
          );
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const unassignReport = async (reportId) => {
    try {
      await updateDoc(doc(db, "reports", reportId), { 
        assignedTo: null,
        status: "En attente"
      });
      toast.success(t("unassigned_success"));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updateStatus = async (reportId, newStatus) => {
    try {
      await updateDoc(doc(db, "reports", reportId), { status: newStatus });
      toast.success(t("status_updated", { status: newStatus }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="loading">{t("loading")}</div>;

  if (userRole === "agent") {
    return (
      <div>
        <h3><i className="fas fa-truck"></i> {t("my_tours")}</h3>
        
        <div className="card">
          <h4>📋 {t("available_reports")}</h4>
          {unassignedReports.length === 0 ? (
            <p>{t("no_available_reports")}</p>
          ) : (
            unassignedReports.map(report => (
              <div key={report.id} className="tour-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", padding: "8px", borderBottom: "1px solid #eee", flexWrap: "wrap", gap: "6px" }}>
                <div>
                  <strong>{report.type}</strong><br />
                  <small>{report.address}</small>
                </div>
                <button onClick={() => assignToSelf(report.id)} className="btn-primary small">{t("assign_to_me")}</button>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h4>🚀 {t("my_ongoing_interventions")}</h4>
          {assignedReports.length === 0 ? (
            <p>{t("no_ongoing_interventions")}</p>
          ) : (
            assignedReports.map(report => (
              <div key={report.id} style={{ marginBottom: "16px", padding: "12px", background: "var(--hover-bg)", borderRadius: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <strong>{report.type}</strong> – {report.address}
                    <br />
                    <span className="status-badge" style={{ 
                      background: report.status === "Résolu" ? "#e0f2e9" : report.status === "En cours" ? "#e0f2fe" : "#fff3e0",
                      color: report.status === "Résolu" ? "#1f7840" : report.status === "En cours" ? "#0369a1" : "#c2410c"
                    }}>
                      {report.status === "En attente" ? t("waiting") : report.status === "En cours" ? t("in_progress") : t("resolved")}
                    </span>
                  </div>
                  <select 
                    value={report.status} 
                    onChange={(e) => updateStatus(report.id, e.target.value)}
                    style={{ width: "auto", padding: "4px 8px", background: "var(--bg-card)" }}
                  >
                    <option>{t("waiting")}</option>
                    <option>{t("in_progress")}</option>
                    <option>{t("resolved")}</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (userRole === "gestionnaire") {
    return (
      <div>
        <h3><i className="fas fa-calendar-alt"></i> {t("tour_management")}</h3>
        
        <div className="card">
          <h4>📌 {t("unassigned_reports")}</h4>
          {unassignedReports.length === 0 ? (
            <p>{t("all_reports_assigned")}</p>
          ) : (
            unassignedReports.map(report => (
              <div key={report.id} className="tour-item" style={{ marginBottom: "16px", padding: "12px", borderBottom: "1px solid var(--border-light)" }}>
                <div><strong>{report.type}</strong> – {report.address}</div>
                <div style={{ marginTop: "8px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <span>{t("assign_to")} :</span>
                  <select 
                    onChange={(e) => assignToAgent(report.id, e.target.value, e.target.options[e.target.selectedIndex].text)}
                    defaultValue=""
                    style={{ width: "200px", background: "var(--bg-card)" }}
                  >
                    <option value="" disabled>{t("select_agent")}</option>
                    {allAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h4>👥 {t("assigned_reports")}</h4>
          {assignedReports.length === 0 ? (
            <p>{t("no_assigned_reports")}</p>
          ) : (
            assignedReports.map(report => {
              const currentAgentName = allAgents.find(a => a.id === report.assignedTo)?.name || report.assignedTo;
              return (
                <div key={report.id} style={{ marginBottom: "16px", padding: "12px", background: "var(--hover-bg)", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <strong>{report.type}</strong> – {report.address}<br />
                      <small>{t("assigned_to")} <strong>{currentAgentName}</strong></small>
                      <br />
                      <span className="status-badge" style={{ 
                        background: report.status === "Résolu" ? "#e0f2e9" : report.status === "En cours" ? "#e0f2fe" : "#fff3e0",
                        color: report.status === "Résolu" ? "#1f7840" : report.status === "En cours" ? "#0369a1" : "#c2410c"
                      }}>
                        {report.status === "En attente" ? t("waiting") : report.status === "En cours" ? t("in_progress") : t("resolved")}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <select 
                        value={report.assignedTo || ""}
                        onChange={(e) => {
                          const newAgentId = e.target.value;
                          const newAgentName = e.target.options[e.target.selectedIndex].text;
                          assignToAgent(report.id, newAgentId, newAgentName);
                        }}
                        style={{ width: "180px", background: "var(--bg-card)" }}
                      >
                        <option value="" disabled>{t("change_agent")}</option>
                        {allAgents.map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                      <button onClick={() => unassignReport(report.id)} className="btn-secondary small">{t("unassign")}</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return <div>{t("unauthorized")}</div>;
}
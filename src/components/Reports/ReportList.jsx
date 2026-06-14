import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, query, orderBy, where, getDocs } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import ReportCard from "./ReportCard";
import LoadingSpinner from "../Common/LoadingSpinner";
import { useTranslation } from "react-i18next";

export default function ReportList() {
  const { t } = useTranslation();
  const { currentUser, userRole } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [userFeedbacks, setUserFeedbacks] = useState(new Set()); // reportIds where current user already gave feedback

  // Fetch user's own feedbacks to know where the button should be hidden
  useEffect(() => {
    const fetchUserFeedbacks = async () => {
      if (!currentUser) return;
      const q = query(collection(db, "reportFeedback"), where("userId", "==", currentUser.uid));
      const snap = await getDocs(q);
      const givenSet = new Set(snap.docs.map(doc => doc.data().reportId));
      setUserFeedbacks(givenSet);
    };
    fetchUserFeedbacks();
  }, [currentUser]);

  // Real-time reports fetch (same as before)
  useEffect(() => {
    let q;
    if (filter === "my" && (userRole === "citizen" || userRole === "agent")) {
      if (userRole === "citizen") {
        q = query(collection(db, "reports"), where("createdBy", "==", currentUser.uid), orderBy("createdAt", "desc"));
      } else if (userRole === "agent") {
        q = query(collection(db, "reports"), where("assignedTo", "==", currentUser.uid), where("status", "in", ["En attente", "En cours"]), orderBy("createdAt", "desc"));
      }
    } else if (filter === "résolu") {
      q = query(collection(db, "reports"), where("status", "==", "Résolu"), orderBy("createdAt", "desc"));
    } else if (filter === "myRésolu") {
      if (userRole === "citizen") {
        q = query(collection(db, "reports"), where("createdBy", "==", currentUser.uid), where("status", "==", "Résolu"), orderBy("createdAt", "desc"));
      } else if (userRole === "agent") {
        q = query(collection(db, "reports"), where("assignedTo", "==", currentUser.uid), where("status", "==", "Résolu"), orderBy("createdAt", "desc"));
      }
    } else if (filter === "Encours") {
      q = query(collection(db, "reports"), where("status", "in", ["En attente", "En cours"]), orderBy("createdAt", "desc"));
    } else {
      q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [currentUser, userRole, filter]);

  const refreshFeedbackStatus = async () => {
    if (!currentUser) return;
    const q = query(collection(db, "reportFeedback"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    const givenSet = new Set(snap.docs.map(doc => doc.data().reportId));
    setUserFeedbacks(givenSet);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Filter buttons (unchanged) */}
      {(userRole === "citizen" || userRole === "agent") ? (
        <div className="filter-buttons" style={{ marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className={`btn-secondary ${filter === "all" ? "active-filter" : ""}`} onClick={() => setFilter("all")} style={{ background: filter === "all" ? "#2b7a4b" : "", color: filter === "all" ? "white" : "inherit" }}>{t("all_reports")}</button>
          <button className={`btn-secondary ${filter === "my" ? "active-filter" : ""}`} onClick={() => setFilter("my")} style={{ background: filter === "my" ? "#2b7a4b" : "", color: filter === "my" ? "white" : "inherit" }}>{userRole === "citizen" ? t("my_reports") : t("my_tasks")}</button>
          <button className={`btn-secondary ${filter === "myRésolu" ? "active-filter" : ""}`} onClick={() => setFilter(userRole === "agent" ? "myRésolu" : "myRésolu")} style={{ background: filter === "myRésolu" ? "#2b7a4b" : "", color: filter === "myRésolu" ? "white" : "inherit" }}>{t("my_completed_tasks")}</button>
          
        </div>
      ) : (
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <button className={`btn-secondary ${filter === "all" ? "active-filter" : ""}`} onClick={() => setFilter("all")} style={{ background: filter === "all" ? "#2b7a4b" : "", color: filter === "all" ? "white" : "inherit" }}>{t("all_reports")}</button>
          <button className={`btn-secondary ${filter === "Encours" ? "active-filter" : ""}`} onClick={() => setFilter("Encours")} style={{ background: filter === "Encours" ? "#2b7a4b" : "", color: filter === "Encours" ? "white" : "inherit" }}>{t("active_reports")}</button>
          <button className={`btn-secondary ${filter === "résolu" ? "active-filter" : ""}`} onClick={() => setFilter("résolu")} style={{ background: filter === "résolu" ? "#2b7a4b" : "", color: filter === "résolu" ? "white" : "inherit" }}>{t("resolved_status")}</button>
        </div>
      )}
      
      {reports.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <i className="fas fa-inbox" style={{ fontSize: "48px", color: "#94a3b8" }}></i>
          <p style={{ marginTop: "16px" }}>{t("no_reports")}</p>
        </div>
      ) : (
        <div className="reports-list">
          {reports.map(report => {
            const canGiveFeedback = userRole === "citizen" && 
                                    report.createdBy === currentUser?.uid && 
                                    report.status === "Résolu" && 
                                    !userFeedbacks.has(report.id);
            return (
              <ReportCard 
                key={report.id} 
                report={report} 
                onUpdate={() => {}} 
                canGiveFeedback={canGiveFeedback}
                onFeedbackGiven={refreshFeedbackStatus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
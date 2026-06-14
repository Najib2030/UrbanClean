import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase/config";
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where } from "firebase/firestore";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, userRole, logOut } = useAuth(); // added logOut
  const [fullName, setFullName] = useState("");
  
  // Citizen preferences
  const [notifComments, setNotifComments] = useState(true);
  const [notifStatusCreated, setNotifStatusCreated] = useState(true);
  const [notifAssignedCreator, setNotifAssignedCreator] = useState(true);
  const [citizenAllChecked, setCitizenAllChecked] = useState(true);
  
  // Agent preferences
  const [notifAssigned, setNotifAssigned] = useState(true);
  const [notifStatusAssigned, setNotifStatusAssigned] = useState(true);
  const [agentAllChecked, setAgentAllChecked] = useState(true);
  
  // Manager preferences
  const [notifNewUnassigned, setNotifNewUnassigned] = useState(true);
  
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [language, setLanguage] = useState(localStorage.getItem("language") || "fr");

  useEffect(() => {
    setLanguage(i18n.language);
    localStorage.setItem("language", i18n.language);
  }, [i18n.language]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", currentUser.email)));
        if (!userDoc.empty) {
          const data = userDoc.docs[0].data();
          setFullName(data.fullName || "");
          
          // Role-specific preferences
          if (userRole === "citizen") {
            const comments = data.notif_comments !== false;
            const statusCreated = data.notif_status_created !== false;
            const assignedCreator = data.notif_assigned_creator !== false;
            setNotifComments(comments);
            setNotifStatusCreated(statusCreated);
            setNotifAssignedCreator(assignedCreator);
            setCitizenAllChecked(comments && statusCreated && assignedCreator);
          } else if (userRole === "agent") {
            const assigned = data.notif_assigned !== false;
            const statusAssigned = data.notif_status_assigned !== false;
            setNotifAssigned(assigned);
            setNotifStatusAssigned(statusAssigned);
            setAgentAllChecked(assigned && statusAssigned);
          } else if (userRole === "gestionnaire") {
            setNotifNewUnassigned(data.notif_new_unassigned !== false);
          }
          setLoadingPrefs(false);
        }
      } catch (error) {
        console.error(error);
        setLoadingPrefs(false);
      }
    };
    fetchUserData();
  }, [currentUser, userRole]);

  useEffect(() => {
    if (userRole === "gestionnaire" && (activeTab === "users" || activeTab === "blocked")) {
      const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
          const snap = await getDocs(collection(db, "users"));
          const usersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(usersList);
        } catch (error) {
          toast.error(t("error_loading_users"));
        }
        setLoadingUsers(false);
      };
      fetchUsers();
    }
  }, [userRole, activeTab, t]);

  const handleSavePreference = async (field, value) => {
    try {
      const userQuery = query(collection(db, "users"), where("email", "==", currentUser.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const userId = userSnap.docs[0].id;
        await updateDoc(doc(db, "users", userId), { [field]: value });
        toast.success(t("preference_saved"));
      }
    } catch (error) {
      toast.error(t("error_saving_preferences"));
    }
  };

  // Citizen: update all checkboxes
  const handleCitizenAllChange = async (checked) => {
    setCitizenAllChecked(checked);
    setNotifComments(checked);
    setNotifStatusCreated(checked);
    setNotifAssignedCreator(checked);
    await Promise.all([
      handleSavePreference("notif_comments", checked),
      handleSavePreference("notif_status_created", checked),
      handleSavePreference("notif_assigned_creator", checked)
    ]);
  };

  // Citizen: individual change – update "all" state
  const handleCitizenIndividualChange = async (field, value, setter) => {
    setter(value);
    const newComments = field === "notif_comments" ? value : notifComments;
    const newStatus = field === "notif_status_created" ? value : notifStatusCreated;
    const newAssigned = field === "notif_assigned_creator" ? value : notifAssignedCreator;
    setCitizenAllChecked(newComments && newStatus && newAssigned);
    await handleSavePreference(field, value);
  };

  // Agent: update all checkboxes
  const handleAgentAllChange = async (checked) => {
    setAgentAllChecked(checked);
    setNotifAssigned(checked);
    setNotifStatusAssigned(checked);
    await Promise.all([
      handleSavePreference("notif_assigned", checked),
      handleSavePreference("notif_status_assigned", checked)
    ]);
  };

  // Agent: individual change – update "all" state
  const handleAgentIndividualChange = async (field, value, setter) => {
    setter(value);
    const newAssigned = field === "notif_assigned" ? value : notifAssigned;
    const newStatus = field === "notif_status_assigned" ? value : notifStatusAssigned;
    setAgentAllChecked(newAssigned && newStatus);
    await handleSavePreference(field, value);
  };

  const handleSaveProfile = async () => {
    try {
      const userQuery = query(collection(db, "users"), where("email", "==", currentUser.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        await updateDoc(doc(db, "users", userDoc.id), { fullName });
        toast.success(t("profile_updated"));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      toast.success(t("logged_out"));
      // Navigation to login happens automatically via ProtectedRoute
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      toast.success(t("role_changed"));
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (window.confirm(t("delete_user_confirm", { email: userEmail }))) {
      try {
        await deleteDoc(doc(db, "users", userId));
        toast.success(t("user_deleted"));
        setUsers(users.filter(u => u.id !== userId));
      } catch (error) {
        toast.error(error.message);
      }
    }
  };

  const handleUnblockUser = async (userId, userName) => {
    if (window.confirm(t("unblock_user_confirm", { name: userName }))) {
      try {
        await updateDoc(doc(db, "users", userId), { blocked: false });
        toast.success(t("user_unblocked_success"));
        const snap = await getDocs(collection(db, "users"));
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        toast.error(t("error_unblocking"));
      }
    }
  };

  const ProfileForm = () => (
    <div className="card">
      <h3>{t("profile")}</h3>
      <div className="form-group">
        <label>{t("email")}</label>
        <input type="email" value={currentUser?.email || ""} disabled />
      </div>
      <div className="form-group">
        <label>{t("full_name")}</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t("role")}</label>
        <input type="text" value={userRole === "gestionnaire" ? t("manager") : userRole === "agent" ? t("agent") : t("citizen")} disabled />
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "space-between" }}>
        <button className="btn-primary" onClick={handleSaveProfile}>{t("save_profile")}</button>
        <button className="btn-secondary" onClick={handleLogout} style={{ background: "#fee2e2", color: "#b91c1c" }}>
          <i className="fas fa-sign-out-alt"></i> {t("logout")}
        </button>
      </div>
    </div>
  );

  const NotificationsForm = () => {
    if (userRole === "citizen") {
      return (
        <div className="card">
          <h3>{t("notifications")}</h3>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", fontWeight: "bold" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={citizenAllChecked} onChange={(e) => handleCitizenAllChange(e.target.checked)} disabled={loadingPrefs} />
            {t("all_notifications")}
          </label>
          <hr style={{ margin: "8px 0" }} />
          <label style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={notifComments} onChange={(e) => handleCitizenIndividualChange("notif_comments", e.target.checked, setNotifComments)} disabled={loadingPrefs} />
            {t("notif_comments")}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={notifStatusCreated} onChange={(e) => handleCitizenIndividualChange("notif_status_created", e.target.checked, setNotifStatusCreated)} disabled={loadingPrefs} />
            {t("notif_status_your_report")}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={notifAssignedCreator} onChange={(e) => handleCitizenIndividualChange("notif_assigned_creator", e.target.checked, setNotifAssignedCreator)} disabled={loadingPrefs} />
            {t("notif_report_assigned")}
          </label>
        </div>
      );
    }
    
    if (userRole === "agent") {
      return (
        <div className="card">
          <h3>{t("notifications")}</h3>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", fontWeight: "bold" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={agentAllChecked} onChange={(e) => handleAgentAllChange(e.target.checked)} disabled={loadingPrefs} />
            {t("all_notifications")}
          </label>
          <hr style={{ margin: "8px 0" }} />
          <label style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={notifAssigned} onChange={(e) => handleAgentIndividualChange("notif_assigned", e.target.checked, setNotifAssigned)} disabled={loadingPrefs} />
            {t("notif_assigned_to_you")}
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={notifStatusAssigned} onChange={(e) => handleAgentIndividualChange("notif_status_assigned", e.target.checked, setNotifStatusAssigned)} disabled={loadingPrefs} />
            {t("notif_status_assigned_to_you")}
          </label>
        </div>
      );
    }
    
    if (userRole === "gestionnaire") {
      return (
        <div className="card">
          <h3>{t("notifications")}</h3>
          <label style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input style={{ width: "auto" }} type="checkbox" checked={notifNewUnassigned} onChange={(e) => { setNotifNewUnassigned(e.target.checked); handleSavePreference("notif_new_unassigned", e.target.checked); }} disabled={loadingPrefs} />
            {t("notif_new_unassigned")}
          </label>
        </div>
      );
    }
    
    return null;
  };

  const PreferencesForm = () => (
    <div className="card">
      <h3>{t("preferences")}</h3>
      <div className="form-group">
        <label>{t("theme")}</label>
        <button onClick={toggleTheme} className="btn-secondary small">
          <i className={`fas ${theme === "light" ? "fa-moon" : "fa-sun"}`}></i> {theme === "light" ? t("dark") : t("light")}
        </button>
      </div>
      <div className="form-group">
        <label>{t("language")}</label>
        <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
          <option value="fr">{t("french")}</option>
          <option value="en">{t("english")}</option>
          <option value="ar">{t("arabic")}</option>
        </select>
      </div>
    </div>
  );

  const UserManagement = () => (
    <div className="card">
      <h3>{t("user_management")}</h3>
      {loadingUsers ? (
        <p>{t("loading")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>{t("email")}</th><th>{t("full_name")}</th><th>{t("role")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.fullName || "—"}</td>
                  <td>
                    <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value)}>
                      <option value="citizen">{t("citizen")}</option>
                      <option value="agent">{t("agent")}</option>
                      <option value="gestionnaire">{t("manager")}</option>
                    </select>
                  </td>
                  <td>{user.blocked ? <span style={{ color: "#b91c1c" }}>{t("blocked")}</span> : t("active_status")}</td>
                  <td>
                    <button onClick={() => handleDeleteUser(user.id, user.email)} className="btn-secondary small" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                      <i className="fas fa-trash"></i> {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const BlockedUsersList = () => {
    const blockedUsers = users.filter(u => u.blocked === true);
    return (
      <div className="card">
        <h3><i className="fas fa-ban"></i> {t("blocked_users")}</h3>
        {loadingUsers ? (
          <p>{t("loading")}</p>
        ) : blockedUsers.length === 0 ? (
          <p>{t("no_blocked_users")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>{t("email")}</th><th>{t("full_name")}</th><th>{t("role")}</th><th>{t("actions")}</th></tr>
              </thead>
              <tbody>
                {blockedUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.fullName || "—"}</td>
                    <td>{user.role === "gestionnaire" ? t("manager") : user.role === "agent" ? t("agent") : t("citizen")}</td>
                    <td>
                      <button onClick={() => handleUnblockUser(user.id, user.fullName || user.email)} className="btn-primary small">
                        <i className="fas fa-unlock-alt"></i> {t("unblock_user")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (userRole === "citizen" || userRole === "agent") {
    return (
      <div>
        <ProfileForm />
        <NotificationsForm />
        <PreferencesForm />
      </div>
    );
  }

  if (userRole === "gestionnaire") {
    return (
      <div>
        <div className="tabs" style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button className={`btn-secondary ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>{t("profile")}</button>
          <button className={`btn-secondary ${activeTab === "notifications" ? "active" : ""}`} onClick={() => setActiveTab("notifications")}>{t("notifications")}</button>
          <button className={`btn-secondary ${activeTab === "preferences" ? "active" : ""}`} onClick={() => setActiveTab("preferences")}>{t("preferences")}</button>
          <button className={`btn-secondary ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>{t("user_management")}</button>
          <button className={`btn-secondary ${activeTab === "blocked" ? "active" : ""}`} onClick={() => setActiveTab("blocked")}>
            <i className="fas fa-ban"></i> {t("blocked_users")}
          </button>
        </div>
        {activeTab === "profile" && <ProfileForm />}
        {activeTab === "notifications" && <NotificationsForm />}
        {activeTab === "preferences" && <PreferencesForm />}
        {activeTab === "users" && <UserManagement />}
        {activeTab === "blocked" && <BlockedUsersList />}
      </div>
    );
  }

  return null;
}
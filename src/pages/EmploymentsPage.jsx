// src/pages/EmploymentsPage.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, query, where, serverTimestamp, getDocs 
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import LoadingSpinner from "../components/Common/LoadingSpinner";

export default function EmploymentsPage() {
  const { t } = useTranslation();
  const { currentUser, userRole } = useAuth();
  const [employments, setEmployments] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // "list" or "calendar"
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [formData, setFormData] = useState({
    agentId: "",
    agentName: "",
    zone: "north",
    periodType: "day",
    startDate: new Date().toISOString().split("T")[0],
    customDays: 7,
    shift: "morning",
    notes: "",
  });
  const [filterZone, setFilterZone] = useState("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");

  // Fetch all agents for manager
  useEffect(() => {
    if (userRole === "gestionnaire") {
      const fetchAgents = async () => {
        const q = query(collection(db, "users"), where("role", "==", "agent"));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ 
          id: doc.id, 
          name: doc.data().fullName || doc.data().email?.split("@")[0] || t("agent") 
        }));
        setAgents(list);
      };
      fetchAgents();
    }
  }, [userRole, t]);

  // Fetch employments with realtime updates
  useEffect(() => {
    let q;
    if (userRole === "agent") {
      q = query(collection(db, "agentEmployments"), where("agentId", "==", currentUser.uid));
    } else {
      q = collection(db, "agentEmployments");
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => {
        const dateA = a.startDate?.toDate?.() || new Date(0);
        const dateB = b.startDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setEmployments(list);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error(t("error_loading_employments"));
      setLoading(false);
    });
    return unsubscribe;
  }, [userRole, currentUser]);

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      agentId: "",
      agentName: "",
      zone: "north",
      periodType: "day",
      startDate: new Date().toISOString().split("T")[0],
      customDays: 7,
      shift: "morning",
      notes: "",
    });
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (employment) => {
    setEditingItem(employment);
    setFormData({
      agentId: employment.agentId,
      agentName: employment.agentName,
      zone: employment.zone,
      periodType: employment.periodType || "day",
      startDate: employment.startDate?.toDate?.()?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      customDays: employment.customDays || 7,
      shift: employment.shift,
      notes: employment.notes || "",
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "agentId") {
      const selectedAgent = agents.find(a => a.id === value);
      setFormData(prev => ({
        ...prev,
        agentId: value,
        agentName: selectedAgent?.name || "",
      }));
    } else if (name === "periodType") {
      setFormData(prev => ({ ...prev, periodType: value }));
    } else if (name === "customDays") {
      setFormData(prev => ({ ...prev, customDays: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const calculateEndDate = () => {
    const start = new Date(formData.startDate);
    if (isNaN(start)) return null;
    let daysToAdd = 0;
    if (formData.periodType === "day") daysToAdd = 0;
    else if (formData.periodType === "week") daysToAdd = 7;
    else if (formData.periodType === "month") daysToAdd = 30;
    else if (formData.periodType === "custom") daysToAdd = formData.customDays;
    const end = new Date(start);
    end.setDate(start.getDate() + daysToAdd);
    return end;
  };

  const validateDates = () => {
    const start = new Date(formData.startDate);
    if (isNaN(start)) {
      toast.error(t("invalid_start_date"));
      return false;
    }
    if (formData.periodType === "custom" && (!formData.customDays || formData.customDays < 1)) {
      toast.error(t("custom_days_required"));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agentId && userRole === "gestionnaire") {
      toast.error(t("select_agent_required"));
      return;
    }
    if (!formData.startDate) {
      toast.error(t("start_date_required"));
      return;
    }
    if (!validateDates()) return;

    const startDateObj = new Date(formData.startDate);
    startDateObj.setHours(0, 0, 0, 0);
    
    const endDateObj = calculateEndDate();
    if (!endDateObj) {
      toast.error(t("error_calculating_end_date"));
      return;
    }
    endDateObj.setHours(23, 59, 59, 999);

    const employmentData = {
      agentId: userRole === "agent" ? currentUser.uid : formData.agentId,
      agentName: userRole === "agent" 
        ? (currentUser.displayName || currentUser.email?.split("@")[0] || t("agent"))
        : formData.agentName,
      zone: formData.zone,
      periodType: formData.periodType,
      startDate: startDateObj,
      endDate: endDateObj,
      customDays: formData.periodType === "custom" ? formData.customDays : null,
      shift: formData.shift,
      notes: formData.notes || null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, "agentEmployments", editingItem.id), employmentData);
        toast.success(t("employment_updated"));
      } else {
        await addDoc(collection(db, "agentEmployments"), {
          ...employmentData,
          createdAt: serverTimestamp(),
        });
        toast.success(t("employment_added"));
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error(t("error_saving_employment"));
    }
  };

  const handleDelete = async (id, agentName) => {
    if (window.confirm(t("confirm_delete_employment", { name: agentName }))) {
      try {
        await deleteDoc(doc(db, "agentEmployments", id));
        toast.success(t("employment_deleted"));
      } catch (error) {
        toast.error(t("error_deleting_employment"));
      }
    }
  };

  // Format period for display in table
  const formatPeriod = (emp) => {
    const start = emp.startDate?.toDate?.();
    const end = emp.endDate?.toDate?.();
    if (!start) return t("unknown_date");
    if (emp.periodType === "day") {
      return formatDate(start);
    } else if (emp.periodType === "custom") {
      return `${formatDate(start)} - ${formatDate(end)} (${emp.customDays} ${t("days")})`;
    }
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  // Filter employments (used for list view)
  const filteredEmployments = employments.filter(emp => {
    if (filterZone !== "all" && emp.zone !== filterZone) return false;
    if (filterAgent !== "all" && emp.agentId !== filterAgent) return false;
    if (filterPeriod !== "all" && emp.periodType !== filterPeriod) return false;
    return true;
  });

  // Calendar logic: map all employments to individual dates within their range
  const getEmploymentDaysMap = () => {
    const daysMap = new Map(); // key: YYYY-MM-DD, value: array of employments on that day
    employments.forEach(emp => {
      const start = emp.startDate?.toDate();
      const end = emp.endDate?.toDate();
      if (!start || !end) return;
      // Apply filters to calendar view as well
      if (filterZone !== "all" && emp.zone !== filterZone) return;
      if (filterAgent !== "all" && emp.agentId !== filterAgent) return;
      if (filterPeriod !== "all" && emp.periodType !== filterPeriod) return;
      
      let current = new Date(start);
      while (current <= end) {
        const dateKey = current.toISOString().split("T")[0];
        if (!daysMap.has(dateKey)) daysMap.set(dateKey, []);
        daysMap.get(dateKey).push(emp);
        current.setDate(current.getDate() + 1);
      }
    });
    return daysMap;
  };

  // Generate calendar grid for current month
  const getCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Get days from previous month to fill first row
    const prevMonthDays = [];
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push({
        date: new Date(year, month - 1, prevMonthLastDate - i),
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      currentMonthDays.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Next month days to fill grid (42 days total)
    const totalCells = 42;
    const nextMonthDays = [];
    const remaining = totalCells - (prevMonthDays.length + currentMonthDays.length);
    for (let i = 1; i <= remaining; i++) {
      nextMonthDays.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  };

  const employmentDaysMap = getEmploymentDaysMap();
  const calendarDays = getCalendarDays();
  const weekdays = [t("sun"), t("mon"), t("tue"), t("wed"), t("thu"), t("fri"), t("sat")];

  const goPrevMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1));
    setSelectedDayDetails(null);
  };
  const goNextMonth = () => {
    setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1));
    setSelectedDayDetails(null);
  };
  const goToday = () => {
    setCurrentCalendarDate(new Date());
    setSelectedDayDetails(null);
  };

  const handleDayClick = (date) => {
    const dateKey = date.toISOString().split("T")[0];
    const employmentsOnDay = employmentDaysMap.get(dateKey) || [];
    setSelectedDayDetails({ date, employments: employmentsOnDay });
  };

  // Stats calculation (for list view - keep existing)
  const totalEmployments = filteredEmployments.length;
  const uniqueAgents = new Set(filteredEmployments.map(e => e.agentId)).size;
  const zoneStats = {
    north: filteredEmployments.filter(e => e.zone === "north").length,
    south: filteredEmployments.filter(e => e.zone === "south").length,
    east: filteredEmployments.filter(e => e.zone === "east").length,
    west: filteredEmployments.filter(e => e.zone === "west").length,
  };
  const currentMonthEmployments = filteredEmployments.filter(emp => {
    const date = emp.startDate?.toDate?.();
    if (!date) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const getZoneLabel = (zone) => {
    switch(zone) {
      case "north": return t("zone_north");
      case "south": return t("zone_south");
      case "east": return t("zone_east");
      case "west": return t("zone_west");
      default: return zone;
    }
  };

  const getShiftLabel = (shift) => {
    switch(shift) {
      case "morning": return t("shift_morning");
      case "afternoon": return t("shift_afternoon");
      case "full": return t("shift_full");
      default: return shift;
    }
  };

  const getPeriodLabel = (type) => {
    switch(type) {
      case "day": return t("period_day");
      case "week": return t("period_week");
      case "month": return t("period_month");
      case "custom": return t("period_custom");
      default: return type;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Stats Cards (same) */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title"><i className="fas fa-briefcase"></i> {t("total_employments")}</div>
          <div className="stat-value">{totalEmployments}</div>
          <div className="stat-trend">{t("total_records")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title"><i className="fas fa-users"></i> {t("active_agents")}</div>
          <div className="stat-value">{uniqueAgents}</div>
          <div className="stat-trend">{t("agents_with_employments")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title"><i className="fas fa-calendar-month"></i> {t("this_month")}</div>
          <div className="stat-value">{currentMonthEmployments}</div>
          <div className="stat-trend">{t("employments_this_month")}</div>
        </div>
      </div>

      {/* Zone Distribution (same) */}
      <div className="card">
        <h4><i className="fas fa-chart-pie"></i> {t("zone_distribution")}</h4>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "12px" }}>
          {Object.entries(zoneStats).map(([zone, count]) => (
            <div key={zone} style={{ textAlign: "center", minWidth: "70px" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--text-primary)" }}>{count}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{getZoneLabel(zone)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* View Toggle & Filters */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button 
              className={`btn-secondary ${viewMode === "list" ? "active-filter" : ""}`}
              onClick={() => setViewMode("list")}
              style={{ background: viewMode === "list" ? "#2b7a4b" : "", color: viewMode === "list" ? "white" : "inherit" }}
            >
              <i className="fas fa-list"></i> {t("list_view")}
            </button>
            <button 
              className={`btn-secondary ${viewMode === "calendar" ? "active-filter" : ""}`}
              onClick={() => setViewMode("calendar")}
              style={{ background: viewMode === "calendar" ? "#2b7a4b" : "", color: viewMode === "calendar" ? "white" : "inherit" }}
            >
              <i className="fas fa-calendar-alt"></i> {t("calendar_view")}
            </button>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <select 
              value={filterZone} 
              onChange={(e) => setFilterZone(e.target.value)}
              style={{ width: "auto", padding: "8px 12px" }}
            >
              <option value="all">{t("all_zones")}</option>
              <option value="north">{t("zone_north")}</option>
              <option value="south">{t("zone_south")}</option>
              <option value="east">{t("zone_east")}</option>
              <option value="west">{t("zone_west")}</option>
            </select>
            <select 
              value={filterPeriod} 
              onChange={(e) => setFilterPeriod(e.target.value)}
              style={{ width: "auto", padding: "8px 12px" }}
            >
              <option value="all">{t("all_periods")}</option>
              <option value="day">{t("period_day")}</option>
              <option value="week">{t("period_week")}</option>
              <option value="month">{t("period_month")}</option>
              <option value="custom">{t("period_custom")}</option>
            </select>
            {userRole === "gestionnaire" && (
              <select 
                value={filterAgent} 
                onChange={(e) => setFilterAgent(e.target.value)}
                style={{ width: "auto", padding: "8px 12px", minWidth: "150px" }}
              >
                <option value="all">{t("all_agents")}</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            )}
            {userRole === "gestionnaire" && (
              <button className="btn-primary" onClick={openAddModal}>
                <i className="fas fa-plus"></i> {t("add_employment")}
              </button>
            )}
          </div>
        </div>

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <>
            {filteredEmployments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                <i className="fas fa-calendar-alt" style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}></i>
                <p>{t("no_employments")}</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>{t("agent")}</th>
                      <th>{t("zone")}</th>
                      <th>{t("period")}</th>
                      <th>{t("shift")}</th>
                      <th>{t("notes")}</th>
                      {userRole === "gestionnaire" && <th>{t("actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployments.map(emp => (
                      <tr key={emp.id}>
                        <td>{emp.agentName || emp.agentId}</td>
                        <td>{getZoneLabel(emp.zone)}</td>
                        <td>
                          <span className="period-badge" style={{ background: "var(--hover-bg)", padding: "2px 8px", borderRadius: "20px", fontSize: "0.75rem" }}>
                            {getPeriodLabel(emp.periodType)}
                          </span>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                            {formatPeriod(emp)}
                          </div>
                        </td>
                        <td>{getShiftLabel(emp.shift)}</td>
                        <td style={{ maxWidth: "200px", wordBreak: "break-word" }}>{emp.notes || "—"}</td>
                        {userRole === "gestionnaire" && (
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => openEditModal(emp)} className="btn-secondary small" title={t("edit")}>
                                <i className="fas fa-edit"></i>
                              </button>
                              <button onClick={() => handleDelete(emp.id, emp.agentName)} className="btn-secondary small" style={{ background: "#fee2e2", color: "#b91c1c" }} title={t("delete")}>
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* CALENDAR VIEW */}
        {viewMode === "calendar" && (
          <div className="calendar-container">
            <div className="calendar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <button onClick={goToday} className="btn-secondary small">{t("today")}</button>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={goPrevMonth} className="btn-secondary small"><i className="fas fa-chevron-left"></i></button>
                <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
                  {currentCalendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={goNextMonth} className="btn-secondary small"><i className="fas fa-chevron-right"></i></button>
              </div>
            </div>
            <div className="calendar-weekdays" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontWeight: "bold", marginBottom: "8px" }}>
              {weekdays.map(day => <div key={day} style={{ padding: "8px" }}>{day}</div>)}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day, idx) => {
                const dateKey = day.date.toISOString().split("T")[0];
                const dayEmployments = employmentDaysMap.get(dateKey) || [];
                const isToday = dateKey === new Date().toISOString().split("T")[0];
                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(day.date)}
                    className={`calendar-day-cell ${isToday ? "today" : ""}`}
                    style={{
                      background: day.isCurrentMonth ? "var(--bg-card)" : "var(--hover-bg)",
                    }}
                  >
                    <div className="calendar-day-number">
                      {day.date.getDate()}
                    </div>
                    {dayEmployments.length > 0 && (
                      <div>
                        {dayEmployments.slice(0, 2).map((emp, i) => {
                          let zoneColor;
                          switch(emp.zone) {
                            case "north": zoneColor = "#a855f733"; break;
                            case "south": zoneColor = "#22c55e33"; break;
                            case "east": zoneColor = "#facc1533"; break;
                            case "west": zoneColor = "#3b82f633"; break;
                            default: zoneColor = "var(--hover-bg)";
                          }
                          return (
                            <div key={i} className="calendar-assignment" style={{ background: zoneColor }}>
                              <i className="fas fa-user"></i> <span>{emp.agentName?.substring(0, 8)}</span>
                            </div>
                          );
                        })}
                        {dayEmployments.length > 2 && (
                          <div className="calendar-assignment-more">
                            +{dayEmployments.length - 2} {t("more")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Day Details Modal - already responsive via existing modal styles */}
            {selectedDayDetails && (
              <div className="modal" onClick={() => setSelectedDayDetails(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px", maxHeight: "80vh", overflowY: "auto" }}>
                  <h3>{formatDate(selectedDayDetails.date)}</h3>
                  {selectedDayDetails.employments.length === 0 ? (
                    <p>{t("no_employments_on_day")}</p>
                  ) : (
                    <div>
                      {selectedDayDetails.employments.map((emp, idx) => (
                        <div key={idx} style={{ marginBottom: "16px", padding: "12px", background: "var(--hover-bg)", borderRadius: "12px" }}>
                          <div><strong>{emp.agentName || emp.agentId}</strong></div>
                          <div><i className="fas fa-map-marker-alt"></i> {getZoneLabel(emp.zone)}</div>
                          <div><i className="fas fa-clock"></i> {getShiftLabel(emp.shift)}</div>
                          <div><i className="fas fa-tag"></i> {getPeriodLabel(emp.periodType)}</div>
                          {emp.notes && <div><i className="fas fa-sticky-note"></i> {emp.notes}</div>}
                          {userRole === "gestionnaire" && (
                            <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                              <button onClick={() => { setSelectedDayDetails(null); openEditModal(emp); }} className="btn-secondary small">
                                <i className="fas fa-edit"></i> {t("edit")}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn-primary" onClick={() => setSelectedDayDetails(null)} style={{ marginTop: "16px", width: "100%" }}>{t("close")}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal (same as before) */}
      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <h3>{editingItem ? t("edit_employment") : t("add_employment")}</h3>
            <form onSubmit={handleSubmit}>
              {userRole === "gestionnaire" && (
                <div className="form-group">
                  <label>{t("agent")} *</label>
                  <select name="agentId" value={formData.agentId} onChange={handleFormChange} required>
                    <option value="">{t("select_agent")}</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>{t("zone")} *</label>
                <select name="zone" value={formData.zone} onChange={handleFormChange} required>
                  <option value="north">{t("zone_north")}</option>
                  <option value="south">{t("zone_south")}</option>
                  <option value="east">{t("zone_east")}</option>
                  <option value="west">{t("zone_west")}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t("period_type")} *</label>
                <select name="periodType" value={formData.periodType} onChange={handleFormChange} required>
                  <option value="day">{t("period_day")}</option>
                  <option value="week">{t("period_week")} (7 {t("days")})</option>
                  <option value="month">{t("period_month")} (30 {t("days")})</option>
                  <option value="custom">{t("period_custom")}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t("start_date")} *</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleFormChange} required />
              </div>
              {formData.periodType === "custom" && (
                <div className="form-group">
                  <label>{t("number_of_days")} *</label>
                  <input type="number" name="customDays" value={formData.customDays} onChange={handleFormChange} min="1" max="365" required />
                </div>
              )}
              <div className="form-group">
                <label>{t("end_date")}</label>
                <input 
                  type="text" 
                  value={calculateEndDate() ? formatDate(calculateEndDate()) : t("auto_calculated")} 
                  disabled 
                  style={{ background: "var(--hover-bg)", cursor: "not-allowed" }}
                />
                <small style={{ color: "var(--text-secondary)" }}>{t("end_date_auto_hint")}</small>
              </div>
              <div className="form-group">
                <label>{t("shift")} *</label>
                <select name="shift" value={formData.shift} onChange={handleFormChange} required>
                  <option value="morning">{t("shift_morning")}</option>
                  <option value="afternoon">{t("shift_afternoon")}</option>
                  <option value="full">{t("shift_full")}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t("notes")}</label>
                <textarea name="notes" rows="3" value={formData.notes} onChange={handleFormChange} placeholder={t("optional")}></textarea>
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t("cancel")}</button>
                <button type="submit" className="btn-primary">{t("save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
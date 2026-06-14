import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { t } = useTranslation();
  const { userRole, currentUser } = useAuth();
  const [stats, setStats] = useState({
    activeReports: 0,
    resolvedCount: 0,
    totalReports: 0,
    resolutionRate: 0,
    monthlyChange: 0,
    myAssignedReports: 0,
    myCompletedReports: 0,
    pendingUnassigned: 0,
  });
  const [allReports, setAllReports] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [dateFilter, setDateFilter] = useState("last7");
  const [satisfaction, setSatisfaction] = useState(0);

  useEffect(() => {
    const fetchSatisfaction = async () => {
      const feedbackSnap = await getDocs(collection(db, "reportFeedback"));
      const ratings = feedbackSnap.docs.map(doc => doc.data().rating).filter(r => r);
      if (ratings.length === 0) {
        setSatisfaction(0);
        return;
      }
      const avg = ratings.reduce((a,b) => a + b, 0) / ratings.length;
      setSatisfaction(parseFloat(avg.toFixed(1)));
    };
    fetchSatisfaction();
  }, []);

  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reportsSnap = await getDocs(collection(db, "reports"));
        const reports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllReports(reports);
      } catch (error) {
        console.error("Error fetching reports:", error);
      }
    };
    fetchReports();
  }, []);

  useEffect(() => {
    if (!allReports.length) return;

    const totalReports = allReports.length;
    const resolvedReports = allReports.filter(r => r.status === "Résolu");
    const resolvedCount = resolvedReports.length;
    const resolutionRate = totalReports === 0 ? 0 : (resolvedCount / totalReports) * 100;
    const activeReports = allReports.filter(r => r.status !== "Résolu").length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let currentMonthCount = 0;
    let prevMonthCount = 0;
    allReports.forEach(report => {
      if (report.createdAt) {
        const date = report.createdAt.toDate ? report.createdAt.toDate() : new Date(report.createdAt);
        if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) currentMonthCount++;
        if (date.getFullYear() === prevYear && date.getMonth() === prevMonth) prevMonthCount++;
      }
    });
    let monthlyChange = 0;
    if (prevMonthCount > 0) monthlyChange = ((currentMonthCount - prevMonthCount) / prevMonthCount) * 100;
    else if (currentMonthCount > 0) monthlyChange = 100;
    monthlyChange = Math.round(monthlyChange);

    let myAssigned = 0, myCompleted = 0, pendingUnassigned = 0;
    if (userRole === "agent") {
      myAssigned = allReports.filter(r => r.assignedTo === currentUser.uid && r.status !== "Résolu").length;
      myCompleted = allReports.filter(r => r.assignedTo === currentUser.uid && r.status === "Résolu").length;
    }
    if (userRole === "gestionnaire") {
      pendingUnassigned = allReports.filter(r => !r.assignedTo && r.status !== "Résolu").length;
    }

    setStats({
      activeReports,
      resolvedCount,
      totalReports,
      resolutionRate: Math.round(resolutionRate),
      monthlyChange,
      myAssignedReports: myAssigned,
      myCompletedReports: myCompleted,
      pendingUnassigned,
    });
  }, [allReports, userRole, currentUser]);

  // Chart fetch logic unchanged (no upvotes involved)
  useEffect(() => {
    const fetchStatsForChart = async () => {
      try {
        const statsSnap = await getDocs(collection(db, "dailyReportStats"));
        const statsMap = new Map();
        statsSnap.docs.forEach(doc => {
          statsMap.set(doc.id, doc.data().count);
        });

        const now = new Date();
        let dataPoints = [];

        switch (dateFilter) {
          case "today": {
            const todayStr = getLocalDateKey(now);
            const hourMap = new Map();
            allReports.forEach(r => {
              if (!r.createdAt) return;
              const date = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
              const dateStr = getLocalDateKey(date);
              if (dateStr === todayStr) {
                const hour = date.getHours();
                hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
              }
            });
            for (let i = 0; i < 24; i++) {
              dataPoints.push({ period: `${i}${t("hour")}`, count: hourMap.get(i) || 0 });
            }
            setChartData(dataPoints);
            return;
          }
          case "last7": {
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const dateKey = getLocalDateKey(d);
              const day = d.getDate();
              const month = d.getMonth() + 1;
              const label = `${day}/${month}`;
              last7Days.push({ date: label, fullDate: dateKey, count: statsMap.get(dateKey) || 0 });
            }
            setChartData(last7Days.map(({ date, count }) => ({ date, count })));
            return;
          }
          case "lastMonth": {
            const endDate = new Date();
            endDate.setDate(endDate.getDate());
            endDate.setHours(23, 59, 59, 999);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 31);
            startDate.setHours(0, 0, 0, 0);
            const dateMap = new Map();
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dateKey = getLocalDateKey(currentDate);
              const day = currentDate.getDate();
              const month = currentDate.getMonth() + 1;
              const label = `${day}/${month}`;
              dateMap.set(dateKey, { label, count: statsMap.get(dateKey) || 0 });
              currentDate.setDate(currentDate.getDate() + 1);
            }
            const monthData = Array.from(dateMap.values()).map(({ label, count }) => ({ date: label, count }));
            setChartData(monthData);
            return;
          }
          case "last12Months": {
            const monthsData = [];
            for (let i = 11; i >= 0; i--) {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const monthNumber = d.getMonth() + 1;
              const year = d.getFullYear();
              const monthIndex = d.getMonth();
              const firstDay = new Date(year, monthIndex, 1);
              const lastDay = new Date(year, monthIndex + 1, 0);
              let total = 0;
              for (let day = 1; day <= lastDay.getDate(); day++) {
                const dateObj = new Date(year, monthIndex, day);
                const dateKey = getLocalDateKey(dateObj);
                total += statsMap.get(dateKey) || 0;
              }
              monthsData.push({ month: monthNumber.toString(), count: total });
            }
            setChartData(monthsData);
            return;
          }
          default:
            setChartData([]);
        }
      } catch (error) {
        console.error("Error fetching daily stats:", error);
        setChartData([]);
      }
    };
    fetchStatsForChart();
  }, [dateFilter, allReports, t]);

  const renderChart = () => {
    // same as before
    if (dateFilter === "today") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2b7a4b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (dateFilter === "last12Months") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2b7a4b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2b7a4b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  };

  const FilterButtons = () => (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
      <button className={`btn-secondary ${dateFilter === "today" ? "active-filter" : ""}`} onClick={() => setDateFilter("today")} style={{ background: dateFilter === "today" ? "#2b7a4b" : "", color: dateFilter === "today" ? "white" : "inherit" }}>{t("today")}</button>
      <button className={`btn-secondary ${dateFilter === "last7" ? "active-filter" : ""}`} onClick={() => setDateFilter("last7")} style={{ background: dateFilter === "last7" ? "#2b7a4b" : "", color: dateFilter === "last7" ? "white" : "inherit" }}>{t("last_7_days")}</button>
      <button className={`btn-secondary ${dateFilter === "lastMonth" ? "active-filter" : ""}`} onClick={() => setDateFilter("lastMonth")} style={{ background: dateFilter === "lastMonth" ? "#2b7a4b" : "", color: dateFilter === "lastMonth" ? "white" : "inherit" }}>{t("last_month")}</button>
      <button className={`btn-secondary ${dateFilter === "last12Months" ? "active-filter" : ""}`} onClick={() => setDateFilter("last12Months")} style={{ background: dateFilter === "last12Months" ? "#2b7a4b" : "", color: dateFilter === "last12Months" ? "white" : "inherit" }}>{t("last_12_months")}</button>
    </div>
  );

  // Citizen Dashboard
  if (userRole === "citizen") {
    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-exclamation-triangle"></i> {t("active_reports")}</div>
            <div className="stat-value">{stats.activeReports}</div>
            <div className="stat-trend">{t("active_reports_realtime")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-check-circle"></i> {t("resolution_rate")}</div>
            <div className="stat-value">{stats.resolutionRate}%</div>
            <div className="stat-trend">{stats.resolvedCount} {t("resolved")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-chart-line"></i> {t("monthly_evolution")}</div>
            <div className="stat-value">{stats.monthlyChange > 0 ? `+${stats.monthlyChange}` : stats.monthlyChange}%</div>
            <div className="stat-trend">{t("vs_last_month")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-star"></i> {t("satisfaction")}</div>
            <div className="stat-value">{satisfaction}/5</div>
            <div className="stat-trend">{t("based_on_feedback")}</div>
          </div>
        </div>
        <div className="card">
          <h3><i className="fas fa-chart-line"></i> {t("reports_evolution")}</h3>
          <FilterButtons />
          {chartData.length > 0 ? renderChart() : <div style={{ textAlign: "center", padding: "40px" }}>{t("no_data")}</div>}
        </div>
        <div className="card">
          <h3><i className="fas fa-bullhorn"></i> {t("participate_cleanliness")}</h3>
          <p>{t("report_problem")}</p>
        </div>
      </div>
    );
  }

  // Agent Dashboard
  if (userRole === "agent") {
    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-tasks"></i> {t("my_interventions")}</div>
            <div className="stat-value">{stats.myAssignedReports}</div>
            <div className="stat-trend">{t("waiting")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-check-double"></i> {t("completed_tasks")}</div>
            <div className="stat-value">{stats.myCompletedReports}</div>
            <div className="stat-trend">{t("this_month")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-chart-line"></i> {t("personal_performance")}</div>
            <div className="stat-value">{stats.myAssignedReports + stats.myCompletedReports === 0 ? 0 : Math.round((stats.myCompletedReports / (stats.myCompletedReports + stats.myAssignedReports)) * 100)}%</div>
            <div className="stat-trend">{t("resolution_rate")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-star"></i> {t("satisfaction")}</div>
            <div className="stat-value">{satisfaction}/5</div>
            <div className="stat-trend">{t("based_on_feedback")}</div>
          </div>
        </div>
        <div className="card">
          <h3><i className="fas fa-chart-line"></i> {t("reports_evolution")}</h3>
          <FilterButtons />
          {chartData.length > 0 ? renderChart() : <div style={{ textAlign: "center", padding: "40px" }}>{t("no_data")}</div>}
        </div>
        <div className="card">
          <h3><i className="fas fa-route"></i> {t("optimized_route_today")}</h3>
          <div style={{ background: 'var(--hover-bg)', borderRadius: '20px', padding: '16px', marginTop: '12px' }}>
            🚀 {stats.myAssignedReports} {t("reports_to_treat")}
          </div>
        </div>
      </div>
    );
  }

  // Gestionnaire Dashboard
  if (userRole === "gestionnaire") {
    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-exclamation-triangle"></i> {t("active_reports")}</div>
            <div className="stat-value">{stats.activeReports}</div>
            <div className="stat-trend">{t("waiting")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-broom"></i> {t("resolution_rate")}</div>
            <div className="stat-value">{stats.resolutionRate}%</div>
            <div className="stat-trend">{stats.resolvedCount} {t("resolved")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-user-plus"></i> {t("pending_unassigned")}</div>
            <div className="stat-value">{stats.pendingUnassigned}</div>
            <div className="stat-trend">{t("needs_assignment")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title"><i className="fas fa-star"></i> {t("satisfaction")}</div>
            <div className="stat-value">{satisfaction}/5</div>
            <div className="stat-trend">{t("based_on_feedback")}</div>
          </div>
        </div>
        <div className="card">
          <h3><i className="fas fa-chart-line"></i> {t("reports_evolution")}</h3>
          <FilterButtons />
          {chartData.length > 0 ? renderChart() : <div style={{ textAlign: "center", padding: "40px" }}>{t("no_data")}</div>}
        </div>
        <div className="card">
          <h3><i className="fas fa-clock"></i> {t("ai_alerts_recommendations")}</h3>
          <ul>
            <li>✅ {t("grouping_unassigned", { count: stats.pendingUnassigned })}</li>
            <li>📊 {t("overall_performance", { rate: stats.resolutionRate })}</li>
          </ul>
        </div>
      </div>
    );
  }
  return null;
}
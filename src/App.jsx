import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense, useEffect } from "react";
import Login from "./pages/Login";
import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import Layout from "./components/Layout/Sidebar";
import { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import LoadingScreen from "./components/Common/LoadingScreen";
import { requestNotificationPermission } from "./utils/notify";
import NotificationListener from "./components/Common/NotificationListener";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import { db } from "./firebase/config";
import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const MapPage = lazy(() => import("./pages/MapPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ToursPage = lazy(() => import("./pages/ToursPage"));
const OptimPage = lazy(() => import("./pages/OptimPage"));
const CollaborationPage = lazy(() => import("./pages/CollaborationPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const EmploymentsPage = lazy(() => import("./pages/EmploymentsPage"));

function AppContent() {
  const { t } = useTranslation();
  const { loading, currentUser } = useAuth();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Clean up old notifications (unchanged)
  useEffect(() => {
    const cleanupOldNotifications = async (q) => {
      if (!currentUser) return;
      try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          console.log(`🗑️ Cleaned up ${snapshot.size} old notifications`);
        }
      } catch (error) {
        console.error("Error cleaning old notifications:", error);
      }
    };
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    cleanupOldNotifications(query(collection(db, "notifications"), where("read", "==", false), where("createdAt", "<", sevenDaysAgo)));
    cleanupOldNotifications(query(collection(db, "notifications"), where("read", "==", true)));
  }, [currentUser]);

  // Clean up old reports and their comments (unchanged)
  useEffect(() => {
    const cleanupOldReports = async () => {
      if (!currentUser) return;
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      const snapshot = await getDocs(query(collection(db, "reports"), where("createdAt", "<", twoMonthsAgo)));
      if (snapshot.empty) return;
      const batch = writeBatch(db);
      for (const doc of snapshot.docs) {
        const commentsSnap = await getDocs(query(collection(db, "comments"), where("reportId", "==", doc.id)));
        commentsSnap.forEach(comment => batch.delete(comment.ref));
        batch.delete(doc.ref);
      }
      await batch.commit();
      console.log(`🗑️ Cleaned up ${snapshot.size} old reports`);
    };
    cleanupOldReports().catch(console.error);
  }, [currentUser]);

  // NEW: Compact cleanup for dailyReportStats older than 1 year
  useEffect(() => {
    if (!currentUser) return;
    const cleanupDailyStats = async () => {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      const cutoff = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth()+1).padStart(2,'0')}-${String(yearAgo.getDate()).padStart(2,'0')}`;
      const snapshot = await getDocs(query(collection(db, "dailyReportStats"), where("__name__", "<", cutoff)));
      if (snapshot.empty) return;
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i+500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log(`🗑️ Deleted ${snapshot.docs.length} dailyReportStats older than 1 year`);
    };
    cleanupDailyStats().catch(console.error);
  }, [currentUser]);

  if (loading) return <LoadingScreen />;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log(err));
    });
  }

  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<HomePage/>} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/tours" element={<ToursPage />} />
              <Route path="/optim" element={<OptimPage />} />
              <Route path="/employments" element={<EmploymentsPage />} />
              <Route path="/collab" element={<CollaborationPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
      <NotificationListener />
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
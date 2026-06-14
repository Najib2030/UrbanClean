// src/pages/HomePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { db } from "../firebase/config";
import toast from "react-hot-toast";
import { collection, getDocs, query, where } from "firebase/firestore";
import FadeInSection from "../components/Common/FadeInSection";

import logo from "../assets/logo.png";
import city from "../assets/city.png";
import phoneCardLight from "../assets/phone-card-light.jpg";
import phoneCardDark from "../assets/phone-card-dark.jpg";

function HomePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDarkMode = theme === "dark";

  const [stats, setStats] = useState({
    citizenCount: 0,
    resolvedReports: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    const fetchAvgRating = async () => {
      const feedbackSnap = await getDocs(collection(db, "reportFeedback"));
      const ratings = feedbackSnap.docs.map(doc => doc.data().rating).filter(r => r);
      if (ratings.length === 0) {
        setAvgRating(0);
        return;
      }
      const avg = ratings.reduce((a,b) => a + b, 0) / ratings.length;
      setAvgRating(parseFloat(avg.toFixed(1)));
    };
    fetchAvgRating();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const citizensQuery = query(collection(db, "users"), where("role", "==", "citizen"));
        const citizensSnap = await getDocs(citizensQuery);
        const citizenCount = citizensSnap.size;

        const reportsSnap = await getDocs(collection(db, "reports"));
        const reports = reportsSnap.docs.map(doc => doc.data());
        const resolvedReports = reports.filter(r => r.status === "Résolu").length;

        setStats({ citizenCount, resolvedReports });
      } catch (error) {
        console.error("Error fetching homepage stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const formatCount = (count) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "k";
    }
    if (count >= 20 && count % 10 !== 0) {
      return ((count / 10 - 1).toFixed(0) * 10).toString();
    }
    return (count - 1).toString();
  };

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast(t("app_already_installed"), {icon: 'ℹ️'});
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        toast.success(t("installation_started"));
      } else {
        toast(t("installation_cancelled"), { icon: 'ℹ️' });
      }
    } else {
      toast(t("install_instruction"), { icon: '📲', duration: 10000 });
    }
  };

  return (
    <div className="home-page">
      <nav className="home-navbar">
        <div className="home-logo" style={{cursor: "pointer"}}>
          <img src={logo} alt="logo" className="logo-img" />
          <h2>Urbain<span>Clean</span></h2>
        </div>
        <div className="home-links">
          <Link to="/" className="active">{t("home_nav_home")}</Link>
          <Link to="/how-it-works">{t("home_nav_how_it_works")}</Link>
          <Link to="/about">{t("home_nav_about")}</Link>
          <Link to="/contact">{t("home_nav_contact")}</Link>
        </div>
        <div className="home-actions">
          <button onClick={toggleTheme} className="theme-toggle">
            <i className={`fas ${isDarkMode ? "fa-sun" : "fa-moon"}`}></i>
          </button>
          <button className="btn-outline" onClick={() => navigate("/dashboard")}>
            {t("login")} <i className="far fa-user"></i>
          </button>
          <button className="btn-primary" onClick={handleInstallClick}>
            {t("download")} <i className="fas fa-download"></i>
          </button>
        </div>
      </nav>

      <FadeInSection>
        <section className="hero-section" id="accueil">
          <div className="hero-left">
            <div className="badge">
              <i className="fas fa-seedling"></i>
              {t("home_badge")}
            </div>
            <h1>
              {t("home_title_line1")}<br />
              <span>{t("home_title_line2")}</span>
            </h1>
            <p>{t("home_description")}</p>
            <div className="hero-buttons">
              <button className="btn-primary" onClick={handleInstallClick}>
                {t("download_app")} <i className="fas fa-download"></i>
              </button>
              <button className="btn-outline" onClick={() => navigate("/how-it-works")}>
                {t("learn_more")} <i className="fas fa-arrow-right"></i>
              </button>
            </div>
            <div className="citizens">
              <div className="avatars">
                <span><i className="fas fa-user"></i></span>
                <span><i className="fas fa-user"></i></span>
                <span><i className="fas fa-user"></i></span>
                <span className="plus">
                  {loadingStats ? "..." : `+${formatCount(stats.citizenCount)}`}
                </span>
              </div>
              <p>
                {loadingStats
                  ? t("home_citizens_text", { count: "..." })
                  : t("home_citizens_text", { count: formatCount(stats.citizenCount).toLocaleString() })}
              </p>
            </div>
          </div>
          <div className="hero-right">
            <div className="city-image" style={{ backgroundImage: `url(${city})` }}></div>
            <div className="phone-card">
              <img src={isDarkMode ? phoneCardDark : phoneCardLight} alt={t("app_preview")} className="phone-card-image" />
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection delay={100}>
        <section className="why-section" id="services">
          <div className="section-title">
            <i className="fas fa-leaf"></i>
            <h2>{t("home_why_title")}</h2>
            <p>{t("home_why_subtitle")}</p>
          </div>
          <div className="features">
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-shield-alt"></i></div>
              <h3>{t("home_feature1_title")}</h3>
              <p>{t("home_feature1_desc")}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-bell"></i></div>
              <h3>{t("home_feature2_title")}</h3>
              <p>{t("home_feature2_desc")}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-users"></i></div>
              <h3>{t("home_feature3_title")}</h3>
              <p>{t("home_feature3_desc")}</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-leaf"></i></div>
              <h3>{t("home_feature4_title")}</h3>
              <p>{t("home_feature4_desc")}</p>
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection delay={200}>
        <div className="stats-box">
          <div>
            <h3><i className="fas fa-users"></i> {loadingStats ? "..." : stats.citizenCount.toLocaleString()}</h3>
            <p>{t("home_stat_users")}</p>
          </div>
          <div>
            <h3><i className="fas fa-calendar-check"></i> {loadingStats ? "..." : stats.resolvedReports.toLocaleString()}</h3>
            <p>{t("home_stat_reports")}</p>
          </div>
          <div>
            <h3><i className="fas fa-leaf"></i> {t("home_mission_title")}</h3>
            <p>{t("home_mission_desc")}</p>
          </div>
          <div>
            <h3><i className="fas fa-star"></i> {avgRating}/5</h3>
            <p>{t("home_stat_satisfaction")}</p>
          </div>
        </div>
      </FadeInSection>

      <FadeInSection delay={300}>
        <div className="cta-section">
          <h2>{t("home_cta_title")}</h2>
          <p>{t("home_cta_desc")}</p>
          <button className="btn-primary" onClick={() => navigate("/dashboard")}>
            {t("get_started")}
          </button>
        </div>
      </FadeInSection>

      <footer className="home-footer">
        <p>&copy; 2025 UrbanClean. {t("all_rights")}</p>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="language-switcher" style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => changeLanguage("fr")} className="lang-btn" style={{ background: i18n.language === "fr" ? "#007a4d" : "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "6px 12px", borderRadius: "30px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>FR</button>
            <button onClick={() => changeLanguage("en")} className="lang-btn" style={{ background: i18n.language === "en" ? "#007a4d" : "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "6px 12px", borderRadius: "30px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>EN</button>
            <button onClick={() => changeLanguage("ar")} className="lang-btn" style={{ background: i18n.language === "ar" ? "#007a4d" : "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "6px 12px", borderRadius: "30px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>AR</button>
          </div>
          <button onClick={toggleTheme} className="theme-toggle">
            <i className={`fas ${isDarkMode ? "fa-sun" : "fa-moon"}`}></i>
          </button>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
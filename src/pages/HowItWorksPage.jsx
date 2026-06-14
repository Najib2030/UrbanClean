// src/pages/HowItWorksPage.jsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import FadeInSection from "../components/Common/FadeInSection";

function HowItWorksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDarkMode = theme === "dark";
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    
      useEffect(() => {
        const handler = (e) => {
          e.preventDefault();
          setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
      }, []);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const steps = [
    {
      icon: "fas fa-user-plus",
      title: t("how_step1_title"),
      description: t("how_step1_desc"),
      details: [t("how_step1_detail1"), t("how_step1_detail2"), t("how_step1_detail3")],
    },
    {
      icon: "fas fa-map-marked-alt",
      title: t("how_step2_title"),
      description: t("how_step2_desc"),
      details: [t("how_step2_detail1"), t("how_step2_detail2"), t("how_step2_detail3")],
    },
    {
      icon: "fas fa-user-check",
      title: t("how_step3_title"),
      description: t("how_step3_desc"),
      details: [t("how_step3_detail1"), t("how_step3_detail2"), t("how_step3_detail3")],
    },
    {
      icon: "fas fa-chart-line",
      title: t("how_step4_title"),
      description: t("how_step4_desc"),
      details: [t("how_step4_detail1"), t("how_step4_detail2"), t("how_step4_detail3")],
    },
  ];

  const quickStats = [
    { icon: "fas fa-clock", value: "< 30s", label: t("how_stat_time") },
    { icon: "fas fa-map-pin", value: "100%", label: t("how_stat_location") },
    { icon: "fas fa-bolt", value: "24/7", label: t("how_stat_availability") },
    { icon: "fas fa-shield-alt", value: t("how_stat_secure"), label: t("how_stat_secure_label") },
  ];

  // Show helpful message instead of trying to force a prompt
  const handleInstallClick = async() => {
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
      toast(
        t("install_instruction"),
        { icon: '📲',duration: 10000 }
      );
    }
  };

  return (
    <div className="home-page how-it-works-page">
      {/* Navigation */}
      <nav className="home-navbar">
        <div className="home-logo" onClick={() => navigate("/")} style={{cursor: "pointer"}}>
          <img src="/src/assets/logo.png" alt="logo" className="logo-img" />
          <h2>Urbain<span>Clean</span></h2>
        </div>
        <div className="home-links">
          <Link to="/" className={location.pathname === "/" ? "active" : ""}>
            {t("home_nav_home")}
          </Link>
          <Link to="/how-it-works" className={location.pathname === "/how-it-works" ? "active" : ""}>
            {t("home_nav_how_it_works")}
          </Link>
          <Link to="/about" className={location.pathname === "/about" ? "active" : ""}>
            {t("home_nav_about")}
          </Link>
          <Link to="/contact" className={location.pathname === "/contact" ? "active" : ""}>
            {t("home_nav_contact")}
          </Link>
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

      <div className="how-it-works-container">
        <FadeInSection>
          <div className="section-title">
            <i className="fas fa-question-circle"></i>
            <h2>{t("how_title")}</h2>
            <p>{t("how_subtitle")}</p>
          </div>
        </FadeInSection>

        <FadeInSection delay={100}>
          <div className="quick-stats">
            {quickStats.map((stat, idx) => (
              <div key={idx} className="quick-stat">
                <i className={stat.icon}></i>
                <div className="quick-stat-value">{stat.value}</div>
                <div className="quick-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </FadeInSection>

        <FadeInSection delay={200}>
          <div className="steps-grid-detailed">
            {steps.map((step, index) => (
              <div key={index} className="step-card-detailed">
                <div className="step-number">{index + 1}</div>
                <div className="step-icon"><i className={step.icon}></i></div>
                <h3>{step.title}</h3>
                <p className="step-description">{step.description}</p>
                <ul className="step-details">
                  {step.details.map((detail, i) => (
                    <li key={i}><i className="fas fa-check-circle"></i> {detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </FadeInSection>

        <FadeInSection delay={300}>
          <div className="benefits-section">
            <h3><i className="fas fa-star-of-life"></i> {t("how_benefits_title")}</h3>
            <div className="benefits-grid">
              <div className="benefit-card">
                <i className="fas fa-gavel"></i>
                <h4>{t("how_benefit1_title")}</h4>
                <p>{t("how_benefit1_desc")}</p>
              </div>
              <div className="benefit-card">
                <i className="fas fa-chart-simple"></i>
                <h4>{t("how_benefit2_title")}</h4>
                <p>{t("how_benefit2_desc")}</p>
              </div>
              <div className="benefit-card">
                <i className="fas fa-hand-holding-heart"></i>
                <h4>{t("how_benefit3_title")}</h4>
                <p>{t("how_benefit3_desc")}</p>
              </div>
              <div className="benefit-card">
                <i className="fas fa-mobile-alt"></i>
                <h4>{t("how_benefit4_title")}</h4>
                <p>{t("how_benefit4_desc")}</p>
              </div>
            </div>
          </div>
        </FadeInSection>

        <FadeInSection delay={400}>
          <div className="cta-section" style={{ marginTop: "40px" }}>
            <h2>{t("home_cta_title")}</h2>
            <p>{t("home_cta_desc")}</p>
            <button className="btn-primary" onClick={() => navigate("/dashboard")}>
              {t("get_started")}
            </button>
          </div>
        </FadeInSection>
      </div>

      {/* Footer */}
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

export default HowItWorksPage;
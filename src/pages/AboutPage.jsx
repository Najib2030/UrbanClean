// src/pages/AboutPage.jsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import FadeInSection from "../components/Common/FadeInSection";

function AboutPage() {
  const navigate = useNavigate();
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
    <div className="home-page about-page">
      <nav className="home-navbar">
        <div className="home-logo" onClick={() => navigate("/")} style={{cursor: "pointer"}}>
          <img src="/src/assets/logo.png" alt="logo" className="logo-img" />
          <h2>Urbain<span>Clean</span></h2>
        </div>
        <div className="home-links">
          <a onClick={() => navigate("/")}>{t("home_nav_home")}</a>
          <a onClick={() => navigate("/how-it-works")}>{t("home_nav_how_it_works")}</a>
          <a onClick={() => navigate("/about")} className="active">{t("home_nav_about")}</a>
          <a onClick={() => navigate("/contact")}>{t("home_nav_contact")}</a>
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

      <div className="about-container">
        <FadeInSection>
          <div className="section-title">
            <i className="fas fa-info-circle"></i>
            <h2>{t("about_title")}</h2>
            <p>{t("about_subtitle")}</p>
          </div>
        </FadeInSection>

        <FadeInSection delay={100}>
          <div className="about-content">
            <div className="about-mission">
              <h3><i className="fas fa-bullseye"></i> {t("about_mission_title")}</h3>
              <p>{t("about_mission_desc")}</p>
            </div>
            <div className="about-values">
              <h3><i className="fas fa-heart"></i> {t("about_values_title")}</h3>
              <ul>
                <li><strong>{t("about_value1_title")}</strong> – {t("about_value1_desc")}</li>
                <li><strong>{t("about_value2_title")}</strong> – {t("about_value2_desc")}</li>
                <li><strong>{t("about_value3_title")}</strong> – {t("about_value3_desc")}</li>
                <li><strong>{t("about_value4_title")}</strong> – {t("about_value4_desc")}</li>
              </ul>
            </div>
            <div className="about-team">
              <h3><i className="fas fa-users"></i> {t("about_team_title")}</h3>
              <p>{t("about_team_desc")}</p>
            </div>
          </div>
        </FadeInSection>

        <FadeInSection delay={200}>
          <div className="cta-section" style={{ marginTop: "40px" }}>
            <h2>{t("home_cta_title")}</h2>
            <p>{t("home_cta_desc")}</p>
            <button className="btn-primary" onClick={() => navigate("/dashboard")}>
              {t("get_started")}
            </button>
          </div>
        </FadeInSection>
      </div>

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

export default AboutPage;
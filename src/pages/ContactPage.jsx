// src/pages/ContactPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import emailjs from "@emailjs/browser";
import ReCAPTCHA from "react-google-recaptcha";
import toast from "react-hot-toast";
import FadeInSection from "../components/Common/FadeInSection";
import logo from "../assets/logo.png";

function ContactPage() {
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [captchaValue, setCaptchaValue] = useState(null);
  const recaptchaRef = useRef(null);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCaptchaChange = (value) => {
    setCaptchaValue(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaValue) {
      toast.error(t("please_complete_captcha") || "Please complete the reCAPTCHA verification.");
      return;
    }
    setSending(true);
    const templateParams = {
      name: formData.name,
      reply_email: formData.email,
      message: formData.message,
      "g-recaptcha-response": captchaValue,
    };
    try {
      const response = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
      if (response.status === 200) {
        toast.success(t("contact_success") || "Message sent! We'll get back to you soon.");
        setFormData({ name: "", email: "", message: "" });
        setCaptchaValue(null);
        recaptchaRef.current.reset();
      } else {
        throw new Error("Failed to send");
      }
    } catch (error) {
      console.error("EmailJS error:", error);
      toast.error(t("contact_error") || "Failed to send message. Please try again later.");
    } finally {
      setSending(false);
    }
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
    <div className="home-page contact-page">
      <nav className="home-navbar">
        <div className="home-logo" onClick={() => navigate("/")} style={{cursor: "pointer"}}>
          <img src={logo} alt="logo" className="logo-img" />
          <h2>Urbain<span>Clean</span></h2>
        </div>
        <div className="home-links">
          <a onClick={() => navigate("/")}>{t("home_nav_home")}</a>
          <a onClick={() => navigate("/how-it-works")}>{t("home_nav_how_it_works")}</a>
          <a onClick={() => navigate("/about")}>{t("home_nav_about")}</a>
          <a onClick={() => navigate("/contact")} className="active">{t("home_nav_contact")}</a>
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

      <div className="contact-container">
        <FadeInSection>
          <div className="section-title">
            <i className="fas fa-envelope"></i>
            <h2>{t("contact_title")}</h2>
            <p>{t("contact_subtitle")}</p>
          </div>
        </FadeInSection>

        <FadeInSection delay={100}>
          <div className="contact-grid">
            <div className="contact-info">
              <h3><i className="fas fa-map-marker-alt"></i> {t("contact_address_title")}</h3>
              <p>{t("contact_address")}</p>
              <h3><i className="fas fa-phone-alt"></i> {t("contact_phone_title")}</h3>
              <p>{t("contact_phone")}</p>
              <h3><i className="fas fa-envelope"></i> {t("contact_email_title")}</h3>
              <p>{t("contact_email")}</p>
              <h3><i className="fas fa-clock"></i> {t("contact_hours_title")}</h3>
              <p>{t("contact_hours")}</p>
            </div>

            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t("contact_name")}</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t("contact_email_label")}</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t("contact_message")}</label>
                <textarea name="message" rows="5" value={formData.message} onChange={handleChange} required></textarea>
              </div>
              <div className="form-group captcha-container">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                  onChange={handleCaptchaChange}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? t("sending") : t("contact_send")}
              </button>
            </form>
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

export default ContactPage;
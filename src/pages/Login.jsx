import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import i18n from "../i18n";
import logo from "../assets/logo.png";

export default function Login() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);
  const { signUp, logIn } = useAuth();
  const navigate = useNavigate();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          toast.error(t("passwords_do_not_match"));
          return;
        }
        await signUp(email, password, "citizen", fullName);
        toast.success(t("account_created"));
        setIsSignUp(false);
      } else {
        await logIn(email, password);
        navigate("/dashboard");
        toast.success(t("welcome"));
      }
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetEmail) {
      toast.error(t("email_required"));
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success(t("reset_email_sent"));
      setShowResetModal(false);
      setResetEmail("");
    } catch (error) {
      toast.error(t("reset_email_error"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ textAlign: "center" }}>
        {/* App Logo - Clickable to go home */}
        <div
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            cursor: "pointer",
            marginBottom: "24px",
          }}
        >
          <img src={logo} alt="UrbanClean Logo" style={{ width: "40px", height: "40px", border: "2px solid #005e35", borderRadius: "100%" }} />
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>
            Urbain<span style={{ color: "#007a4d" }}>Clean</span>
          </h2>
        </div>

        {/* Controls for theme and language */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <button
            onClick={toggleTheme}
            className="btn-secondary small"
            style={{ padding: "6px 12px" }}
          >
            <i className={`fas ${theme === "light" ? "fa-moon" : "fa-sun"}`}></i>{" "}
            {theme === "light" ? t("dark") : t("light")}
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => changeLanguage("fr")}
              className={`btn-secondary small ${i18n.language === "fr" ? "active-filter" : ""}`}
              style={{ background: i18n.language === "fr" ? "#2b7a4b" : "", color: i18n.language === "fr" ? "white" : "inherit" }}
            >
              FR
            </button>
            <button
              onClick={() => changeLanguage("en")}
              className={`btn-secondary small ${i18n.language === "en" ? "active-filter" : ""}`}
              style={{ background: i18n.language === "en" ? "#2b7a4b" : "", color: i18n.language === "en" ? "white" : "inherit" }}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage("ar")}
              className={`btn-secondary small ${i18n.language === "ar" ? "active-filter" : ""}`}
              style={{ background: i18n.language === "ar" ? "#2b7a4b" : "", color: i18n.language === "ar" ? "white" : "inherit" }}
            >
              AR
            </button>
          </div>
        </div>

        <h2>{isSignUp ? t("signup") : t("login")}</h2>
        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <input type="text" placeholder={t("full_name")} value={fullName} onChange={e => setFullName(e.target.value)} required />
          )}
          <input type="email" placeholder={t("email")} value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder={t("password")} value={password} onChange={e => setPassword(e.target.value)} required />
          {isSignUp && (
            <input type="password" placeholder={t("confirm_password")} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px", justifyContent: "space-between", flexWrap: "wrap" }}>
            <button type="submit" className="btn-primary">
              {isSignUp ? t("signup") : t("login")}
            </button>
            {!isSignUp && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowResetModal(true)}
              >
                {t("forgot_password")}
              </button>
            )}
          </div>
        </form>
        <button className="toggle-btn" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? t("already_account") : t("no_account")}
        </button>
      </div>

      {showResetModal && (
        <div className="modal" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t("reset_password")}</h3>
            <p>{t("reset_password_instruction")}</p>
            <form onSubmit={handleResetPassword}>
              <input
                type="email"
                placeholder={t("email")}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button type="submit" className="btn-primary" disabled={resetting}>
                  {resetting ? t("sending") : t("send")}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowResetModal(false)}>
                  {t("close")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
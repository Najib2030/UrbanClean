import { useTranslation } from "react-i18next";

export default function LoadingScreen() {
  const { t } = useTranslation();
  
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <div className="loading-icon">
          <i className="fas fa-leaf"></i>
        </div>
        <h1>UrbanClean</h1>
      </div>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      <p className="loading-text">{t("loading")}</p>
    </div>
  );
}
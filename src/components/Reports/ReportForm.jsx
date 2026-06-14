import { useState, useRef } from "react";
import { db } from "../../firebase/config";
import { collection, addDoc, serverTimestamp, GeoPoint, query, where, getDocs, doc, runTransaction, increment } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { createNotification } from "../../utils/createNotification";

export default function ReportForm({ onClose }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [type, setType] = useState("Dépôt sauvage");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const MAX_SIZE = 500 * 1024;
  const MAX_WIDTH = 800;
  const JPEG_QUALITY = 0.7;

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setSelectedFile(null);
      setBase64Image(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("image_too_large", { max: "500KB" }));
      fileInputRef.current.value = "";
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t("invalid_image_format"));
      fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
    try {
      const compressed = await compressImage(file);
      setBase64Image(compressed);
    } catch (error) {
      console.error("Compression error:", error);
      toast.error(t("image_compression_error"));
    }
  };

  const handleGeolocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        setAddress(`Lat: ${latitude}, Lng: ${longitude}`);
        window.tempLocation = new GeoPoint(latitude, longitude);
        toast.success(t("location_captured"));
      }, () => toast.error(t("location_error")));
    } else {
      toast.error(t("geolocation_not_supported"));
    }
  };

  // Helper: local YYYY-MM-DD
  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Increment daily report count (static historical data)
  const incrementDailyStat = async () => {
    const today = new Date();
    const dateStr = getLocalDateKey(today);
    const statDocRef = doc(db, "dailyReportStats", dateStr);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(statDocRef);
        if (docSnap.exists()) {
          transaction.update(statDocRef, { count: increment(1) });
        } else {
          transaction.set(statDocRef, { count: 1 });
        }
      });
    } catch (error) {
      console.error("Failed to update daily stats:", error);
      // Do not block report creation if stats update fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address) {
      toast.error(t("address_required"));
      return;
    }
    setLoading(true);
    try {
      // Create the report
      await addDoc(collection(db, "reports"), {
        type,
        description,
        address,
        location: window.tempLocation || null,
        status: "En attente",
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        assignedTo: null,
        upvotes: 0,
        upvotedBy: [],
        dislikes: 0,
        dislikedBy: [],
        photoBase64: base64Image || null
      });

      // Update historical daily stats (never decreases, even if report is later deleted)
      await incrementDailyStat();

      toast.success(t("report_sent"));

      // Notify all managers who have enabled "new unassigned report" notifications
      const managersQuery = query(collection(db, "users"), where("role", "==", "gestionnaire"));
      const managersSnap = await getDocs(managersQuery);
      managersSnap.forEach(async (managerDoc) => {
        const managerPrefs = managerDoc.data();
        if (managerPrefs.notif_new_unassigned !== false) {
          await createNotification(
            managerDoc.id,
            t("new_unassigned_report"),
            t("new_unassigned_report_body", { type, address }),
            "📢",
            "/tours"
          );
        }
      });

      if (onClose) onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <h3><i className="fas fa-flag"></i> {t("new_report")}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t("type_problem")}</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option>{t("illegal_dumping")}</option>
              <option>{t("full_container")}</option>
              <option>{t("bulky_items")}</option>
              <option>{t("graffiti")}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t("description")}</label>
            <textarea rows="2" value={description} onChange={e => setDescription(e.target.value)} placeholder={t("description_placeholder")}></textarea>
          </div>
          <div className="form-group">
            <label>{t("address_location")}</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} disabled placeholder={t("use_position_placeholder")} required />
          </div>
          <button type="button" className="btn-secondary" onClick={handleGeolocate} style={{ marginBottom: '12px' }}>{t("use_my_position")}</button>
          <div className="form-group">
            <label>{t("photo_optional")}</label>
            <input type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleFileChange} ref={fileInputRef} />
            {base64Image && (
              <div style={{ marginTop: "8px" }}>
                <img src={base64Image} alt="Preview" style={{ maxWidth: "100px", borderRadius: "8px" }} />
              </div>
            )}
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? t("sending") : t("send_report")}</button>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ fontSize: "0.9rem" }}>{t("cancel")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
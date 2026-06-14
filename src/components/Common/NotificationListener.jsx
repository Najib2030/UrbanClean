import { useEffect } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { sendBrowserNotification } from "../../utils/notify";
import useReceiveAlerts from "../../hooks/useReceiveAlerts";
import { useNavigate } from "react-router-dom";

export default function NotificationListener() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { receiveAlerts } = useReceiveAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const notif = { id: change.doc.id, ...change.doc.data() };
          if (receiveAlerts) {
            // Show toast with action button
            toast.success(notif.message, {
              icon: notif.icon || "🔔",
              duration: 8000,
              action: notif.url ? {
                label: t("view"),
                onClick: () => navigate(notif.url)
              } : undefined
            });
            // Send browser notification with click handler
            sendBrowserNotification(notif.title, notif.body, true, notif.url);
          }
          await deleteDoc(doc(db, "notifications", notif.id));
        }
      });
    });

    return unsubscribe;
  }, [currentUser, receiveAlerts, navigate, t]);

  return null;
}
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

export default function useReceiveAlerts() {
  const { currentUser } = useAuth();
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const pref = docSnap.data().receiveAlerts;
          setReceiveAlerts(pref !== false); // default true if undefined
        } else {
          setReceiveAlerts(true);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to receiveAlerts:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  return { receiveAlerts, loading };
}
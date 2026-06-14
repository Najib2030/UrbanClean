import { db } from "../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function createNotification(userId, title, message, icon = "🔔", url = null) {
  if (!userId) return;
  await addDoc(collection(db, "notifications"), {
    userId,
    title,
    message,
    icon,
    url,
    createdAt: serverTimestamp(),
    read: false
  });
}
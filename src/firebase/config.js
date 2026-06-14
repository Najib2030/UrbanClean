import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB2jzAtBg-WaGlMoiPjbdpYrgECCCehPoQ",
  authDomain: "urbanclean-f91a5.firebaseapp.com",
  projectId: "urbanclean-f91a5",
  storageBucket: "urbanclean-f91a5.firebasestorage.app",
  messagingSenderId: "68782383366",
  appId: "1:68782383366:web:8065c5338daf317252fe87",
  measurementId: "G-QQJX3NH7SE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
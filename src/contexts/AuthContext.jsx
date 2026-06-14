import { createContext, useContext, useEffect, useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signUp(email, password, role, fullName) {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    
    // Default notification preferences based on role
    let notifPrefs = {};
    if (role === "citizen") {
      notifPrefs = {
        notif_comments: true,
        notif_status_created: true,
        notif_assigned_creator: true,
      };
    } else if (role === "agent") {
      notifPrefs = {
        notif_assigned: true,
        notif_status_assigned: true,
      };
    } else if (role === "gestionnaire") {
      notifPrefs = {
        notif_new_unassigned: true,
      };
    }

    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      role,
      fullName,
      createdAt: new Date().toISOString(),
      ...notifPrefs,
    });
    return userCred;
  }

  function logIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logOut() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        } else {
          setUserRole(null);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    signUp,
    logIn,
    logOut,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
// src/pages/CollaborationPage.jsx
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { 
  collection, addDoc, onSnapshot, serverTimestamp, 
  doc, updateDoc, deleteDoc, getDoc, query, where, 
  orderBy, getCountFromServer 
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { validateComment } from "../utils/blacklist";
import { recordViolation } from "../utils/userBlockManager";

export default function CollaborationPage() {
  const { t } = useTranslation();
  const { currentUser, userRole } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [newSuggestion, setNewSuggestion] = useState("");
  const [citizenCount, setCitizenCount] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState({});
  const [isCurrentUserBlocked, setIsCurrentUserBlocked] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(null);
  const [remainingTimeStr, setRemainingTimeStr] = useState("");
  const [blockReason, setBlockReason] = useState(null); // "manual" or "temporary"
  const countdownInterval = useRef(null);

  // Violation modal state
  const [violationModal, setViolationModal] = useState({
    show: false,
    reason: "", // "vulgar" or "bad_url"
    match: "",
    durationMinutes: 0,
  });

  // Helper: format remaining milliseconds to mm:ss
  const formatRemainingTime = (ms) => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const updateRemainingTime = () => {
    if (!blockedUntil) {
      setRemainingTimeStr("");
      return;
    }
    const now = new Date();
    const remainingMs = blockedUntil - now;
    if (remainingMs <= 0) {
      setIsCurrentUserBlocked(false);
      setBlockedUntil(null);
      setRemainingTimeStr("");
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      toast.success(t("you_can_comment_again"));
      return;
    }
    setRemainingTimeStr(formatRemainingTime(remainingMs));
  };

  // Countdown effect
  useEffect(() => {
    if (isCurrentUserBlocked && blockedUntil) {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      updateRemainingTime();
      countdownInterval.current = setInterval(updateRemainingTime, 1000);
      return () => {
        if (countdownInterval.current) clearInterval(countdownInterval.current);
      };
    } else if (!isCurrentUserBlocked && countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
  }, [isCurrentUserBlocked, blockedUntil]);

  useEffect(() => {
    const fetchCitizenCount = async () => {
      const q = query(collection(db, "users"), where("role", "==", "citizen"));
      const snap = await getCountFromServer(q);
      setCitizenCount(snap.data().count);
    };
    fetchCitizenCount();
  }, []);

  // Fetch suggestions and update blocked statuses
  useEffect(() => {
    const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSuggestions(list);
      const uniqueUserIds = [...new Set(list.map(s => s.userId).filter(id => id))];
      for (const uid of uniqueUserIds) {
        if (blockedUsers[uid] === undefined) {
          const userDoc = await getDoc(doc(db, "users", uid));
          const blocked = userDoc.exists() ? userDoc.data().blocked === true : false;
          setBlockedUsers(prev => ({ ...prev, [uid]: blocked }));
        }
      }
    });
    return unsubscribe;
  }, []);

  // Real-time listener for current user block status
  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isManuallyBlocked = data.blocked === true;
        const tempBlockedUntil = data.blockedUntil?.toDate() || null;
        const now = new Date();

        if (isManuallyBlocked) {
          setIsCurrentUserBlocked(true);
          setBlockReason("manual");
          setBlockedUntil(null);
        } else if (tempBlockedUntil && tempBlockedUntil > now) {
          setIsCurrentUserBlocked(true);
          setBlockReason("temporary");
          setBlockedUntil(tempBlockedUntil);
        } else {
          setIsCurrentUserBlocked(false);
          setBlockReason(null);
          setBlockedUntil(null);
          setRemainingTimeStr("");
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const isUserBlocked = (userId) => blockedUsers[userId] === true;

  // Show violation modal (no block yet)
  const showViolationModal = (reason, match, durationMinutes) => {
    setViolationModal({
      show: true,
      reason,
      match,
      durationMinutes,
    });
  };

  // Called when Confirm is clicked – block the user immediately
  const confirmViolationAndBlock = async () => {
    const { reason } = violationModal;
    setViolationModal({ show: false, reason: "", match: "", durationMinutes: 0 });
    try {
      const result = await recordViolation(currentUser.uid);
      // The listener will update the block status automatically
      const blockMessage = reason === "vulgar"
        ? t("vulgar_block_warning", { minutes: result.durationMinutes })
        : t("bad_url_block_warning", { minutes: result.durationMinutes });
      toast.error(blockMessage);
    } catch (err) {
      toast.error(t("error_processing_violation"));
    }
  };

  // Validate suggestion content – returns true if clean, false otherwise
  const validateAndHandleSuggestion = async (text) => {
    const { valid, reason, match } = validateComment(text);
    if (valid) return true;

    if (reason === "url_safe") {
      toast.error(t("url_not_allowed"));
      return false;
    }

    if (reason === "vulgar" || reason === "url_bad") {
      // Calculate next block duration without recording yet
      let nextDuration = 2;
      try {
        const { getUserViolationData } = await import("../utils/userBlockManager");
        const { violationCount } = await getUserViolationData(currentUser.uid);
        const nextLevel = Math.min((violationCount || 0) + 1, 5);
        const durations = { 1: 2, 2: 30, 3: 1440, 4: 10080, 5: 43200 };
        nextDuration = durations[nextLevel];
      } catch (err) { console.error(err); }
      showViolationModal(reason, match, nextDuration);
      return false;
    }
    return false;
  };

  const addSuggestion = async (e) => {
    e.preventDefault();
    if (isCurrentUserBlocked) {
      if (blockReason === "manual") toast.error(t("you_are_blocked"));
      else toast.error(t("currently_blocked", { time: remainingTimeStr }));
      return;
    }
    if (!newSuggestion.trim()) {
      toast.error(t("suggestion_empty"));
      return;
    }
    const isValid = await validateAndHandleSuggestion(newSuggestion);
    if (!isValid) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const userName = userDoc.exists() 
        ? (userDoc.data().fullName || userDoc.data().email?.split('@')[0] || t("citizen"))
        : t("citizen");
      await addDoc(collection(db, "suggestions"), {
        text: newSuggestion,
        userId: currentUser.uid,
        userName: userName,
        createdAt: serverTimestamp(),
        updatedAt: null
      });
      setNewSuggestion("");
      toast.success(t("suggestion_added"));
    } catch (error) {
      toast.error(t("error_adding_suggestion"));
    }
    setLoading(false);
  };

  const toggleBlockUser = async (userId, userName, currentBlockedStatus) => {
    const action = currentBlockedStatus ? t("unblock") : t("block");
    if (window.confirm(t("confirm_block", { action, name: userName }))) {
      try {
        await updateDoc(doc(db, "users", userId), { blocked: !currentBlockedStatus });
        setBlockedUsers(prev => ({ ...prev, [userId]: !currentBlockedStatus }));
        toast.success(currentBlockedStatus ? t("user_unblocked") : t("user_blocked"));
      } catch (error) {
        toast.error(t("error_block_operation"));
      }
    }
  };

  const deleteSuggestion = async (id) => {
    if (window.confirm(t("confirm_delete_suggestion"))) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, "suggestions", id));
        toast.success(t("suggestion_deleted"));
      } catch (error) {
        toast.error(t("error_deleting_suggestion"));
      }
      setLoading(false);
    }
  };

  const startEdit = (suggestion) => {
    setEditingId(suggestion.id);
    setEditText(suggestion.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (id) => {
    if (isCurrentUserBlocked) {
      if (blockReason === "manual") toast.error(t("you_are_blocked"));
      else toast.error(t("currently_blocked", { time: remainingTimeStr }));
      return;
    }
    if (!editText.trim()) {
      toast.error(t("suggestion_empty"));
      return;
    }
    const isValid = await validateAndHandleSuggestion(editText);
    if (!isValid) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "suggestions", id), {
        text: editText,
        updatedAt: serverTimestamp()
      });
      toast.success(t("suggestion_updated"));
      setEditingId(null);
      setEditText("");
    } catch (error) {
      toast.error(t("error_updating_suggestion"));
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title"><i className="fas fa-users"></i> {t("engaged_citizens")}</div>
          <div className="stat-value">{citizenCount}</div>
          <div className="stat-trend">{t("registered_citizens_count")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title"><i className="fas fa-lightbulb"></i> {t("suggestions_received")}</div>
          <div className="stat-value">{suggestions.length}</div>
          <div className="stat-trend">{t("ideas_shared_by_community")}</div>
        </div>
      </div>

      <div className="card">
        <h3><i className="fas fa-comments"></i> {t("collaboration_forum")}</h3>
        <div className="suggestions-list" style={{ maxHeight: "400px", overflowY: "auto", margin: "20px 0 10px" }}>
          {suggestions.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>
              {t("no_suggestions")}
            </p>
          ) : (
            suggestions.map(s => {
              const isOwn = s.userId === currentUser?.uid;
              const isEditing = editingId === s.id;
              const isBlocked = isUserBlocked(s.userId);
              return (
                <div key={s.id} className="suggestion-item" style={{ 
                  borderRadius: "16px", 
                  padding: "16px", 
                  marginBottom: "12px",
                  borderLeft: "4px solid #2b7a4b",
                  position: "relative",
                  background: "var(--hover-bg)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ color: "#2b7a4b" }}>
                      <i className="fas fa-user-circle"></i> {s.userName || t("user")}
                      {isBlocked && <span style={{ marginLeft: "8px", fontSize: "0.7rem", color: "#b91c1c" }}>({t("blocked")})</span>}
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <small style={{ color: "#94a3b8" }}>
                        {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : t("unknown_date")}
                        {s.updatedAt && ` (${t("modified")})`}
                      </small>
                      {userRole === "gestionnaire" && (
                        <div style={{ position: "relative" }}>
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                            className="btn-secondary small"
                            style={{ padding: "4px 8px" }}
                          >
                            <i className="fas fa-ellipsis-v"></i>
                          </button>
                          {openMenuId === s.id && (
                            <div style={{
                              position: "absolute", right: 0, top: "100%",
                              background: "var(--bg-card)", border: "1px solid var(--border-light)",
                              borderRadius: "8px", zIndex: 10, minWidth: "150px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                            }}>
                              <button 
                                onClick={() => {
                                  deleteSuggestion(s.id);
                                  setOpenMenuId(null);
                                }}
                                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}
                              >
                                <i className="fas fa-trash"></i> {t("delete")}
                              </button>
                              <button 
                                onClick={async () => {
                                  const userDoc = await getDoc(doc(db, "users", s.userId));
                                  const currentBlocked = userDoc.exists() ? userDoc.data().blocked === true : false;
                                  toggleBlockUser(s.userId, s.userName, currentBlocked);
                                  setOpenMenuId(null);
                                }}
                                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#d97706" }}
                              >
                                <i className="fas fa-ban"></i> {isBlocked ? t("unblock_user") : t("block_user")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap", marginTop: "8px" }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows="2"
                        style={{ flex: 1, borderRadius: "12px", padding: "8px" }}
                      />
                      <button onClick={() => saveEdit(s.id)} className="btn-primary small" disabled={loading}>
                        {t("save")}
                      </button>
                      <button onClick={cancelEdit} className="btn-secondary small">
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{s.text}</p>
                      {isOwn && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button onClick={() => startEdit(s)} className="btn-secondary small" disabled={loading}>
                            <i className="fas fa-edit"></i> {t("edit")}
                          </button>
                          <button onClick={() => deleteSuggestion(s.id)} className="btn-secondary small" style={{ background: "#fee2e2", color: "#b91c1c" }} disabled={loading}>
                            <i className="fas fa-trash"></i> {t("delete")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={addSuggestion} className="form-group">
          {isCurrentUserBlocked ? (
            blockReason === "manual" ? (
              <input
                placeholder={t("you_are_blocked")}
                value={t("you_are_blocked")}
                disabled
                style={{ textAlign: "center", width: "100%", padding: "12px" }}
              />
            ) : (
              <input
                placeholder={t("currently_blocked_placeholder", { time: remainingTimeStr })}
                value={t("currently_blocked_placeholder", { time: remainingTimeStr })}
                disabled
                style={{ textAlign: "center", width: "100%", padding: "12px" }}
              />
            )
          ) : (
            <>
              <textarea
                placeholder={t("add_suggestion")}
                rows="3"
                value={newSuggestion}
                onChange={e => setNewSuggestion(e.target.value)}
                style={{ whiteSpace: "pre-wrap" }}
              />
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? t("sending") : t("send")}
              </button>
            </>
          )}
        </form>
      </div>

      {/* Violation Modal (same as comments) */}
      {violationModal.show && (
        <div className="modal" onClick={confirmViolationAndBlock}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px", textAlign: "center" }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: "48px", color: "#e67e22", marginBottom: "16px" }}></i>
            <h3>{violationModal.reason === "vulgar" ? t("modal_vulgar_title") : t("modal_bad_url_title")}</h3>
            <p>
              {violationModal.reason === "vulgar"
                ? t("modal_vulgar_message", { word: violationModal.match })
                : t("modal_bad_url_message", { url: violationModal.match })}
            </p>
            <p style={{ fontWeight: "bold", marginTop: "12px", color: "#2b7a4b" }}>
              {t("modal_block_duration", { minutes: violationModal.durationMinutes })}
            </p>
            <button onClick={confirmViolationAndBlock} className="btn-primary" style={{ marginTop: "24px" }}>
              {t("modal_confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
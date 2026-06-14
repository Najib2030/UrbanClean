// src/components/Collaboration/Comments.jsx
import { useState, useEffect, useRef } from "react";
import { 
  collection, addDoc, query, where, onSnapshot, 
  serverTimestamp, doc, updateDoc, deleteDoc, getDoc 
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { createNotification } from "../../utils/createNotification";
import { validateComment } from "../../utils/blacklist";
import { recordViolation } from "../../utils/userBlockManager";

export default function Comments({ reportId }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentUser, userRole } = useAuth();
  const [currentUserName, setCurrentUserName] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState({});
  const [isCurrentUserBlocked, setIsCurrentUserBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState(null); // "manual" or "temporary"
  const [blockedUntil, setBlockedUntil] = useState(null);
  const [remainingTimeStr, setRemainingTimeStr] = useState("");
  const countdownInterval = useRef(null);

  // Violation modal state
  const [violationModal, setViolationModal] = useState({
    show: false,
    reason: "",
    match: "",
    durationMinutes: 0,
  });

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
      setBlockReason(null);
      setBlockedUntil(null);
      setRemainingTimeStr("");
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      toast.success(t("you_can_comment_again"));
      return;
    }
    setRemainingTimeStr(formatRemainingTime(remainingMs));
  };

  useEffect(() => {
    if (isCurrentUserBlocked && blockReason === "temporary" && blockedUntil) {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      updateRemainingTime();
      countdownInterval.current = setInterval(updateRemainingTime, 1000);
      return () => {
        if (countdownInterval.current) clearInterval(countdownInterval.current);
      };
    } else if (!isCurrentUserBlocked && countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
  }, [isCurrentUserBlocked, blockReason, blockedUntil]);

  // Real-time listener for current user block status + fetch user name once
  useEffect(() => {
    if (!currentUser) return;

    // 1. Fetch user name once
    const fetchUserName = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCurrentUserName(data.fullName || data.email?.split('@')[0] || t("citizen"));
        } else {
          setCurrentUserName(t("citizen"));
        }
      } catch (error) {
        console.error("Error fetching user name:", error);
        setCurrentUserName(t("citizen"));
      }
    };
    fetchUserName();

    // 2. Real-time listener for block status
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
  }, [currentUser, t]);

  // Comments listener
  useEffect(() => {
    if (!reportId) return;
    const q = query(collection(db, "comments"), where("reportId", "==", reportId));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setComments(list);

      const uniqueUserIds = [...new Set(list.map(c => c.userId).filter(id => id))];
      for (const uid of uniqueUserIds) {
        if (blockedUsers[uid] === undefined) {
          const userDoc = await getDoc(doc(db, "users", uid));
          const blocked = userDoc.exists() ? userDoc.data().blocked === true : false;
          setBlockedUsers(prev => ({ ...prev, [uid]: blocked }));
        }
      }
    });
    return unsubscribe;
  }, [reportId, t]);

  const isUserBlocked = (userId) => blockedUsers[userId] === true;

  const handleViolation = async (reason, match, durationMinutes) => {
    setViolationModal({
      show: true,
      reason,
      match,
      durationMinutes,
    });
  };

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

  const checkAndHandleContent = async (text) => {
    const { valid, reason, match } = validateComment(text);
    if (valid) return true;

    if (reason === "url_safe") {
      toast.error(t("url_not_allowed"));
      return false;
    }

    if (reason === "vulgar" || reason === "url_bad") {
      let nextDuration = 2;
      try {
        const { getUserViolationData } = await import("../../utils/userBlockManager");
        const { violationCount } = await getUserViolationData(currentUser.uid);
        const nextLevel = Math.min((violationCount || 0) + 1, 5);
        const durations = { 1: 2, 2: 30, 3: 1440, 4: 10080, 5: 43200 };
        nextDuration = durations[nextLevel];
      } catch (err) { console.error(err); }
      await handleViolation(reason, match, nextDuration);
      return false;
    }

    return false;
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (isCurrentUserBlocked) {
      if (blockReason === "manual") toast.error(t("you_are_blocked"));
      else toast.error(t("currently_blocked", { time: remainingTimeStr }));
      return;
    }
    if (!newComment.trim()) {
      toast.error(t("comment_empty"));
      return;
    }
    const canProceed = await checkAndHandleContent(newComment);
    if (!canProceed) return;

    if (!currentUserName) {
      toast.error(t("cannot_identify_user"));
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "comments"), {
        reportId,
        userId: currentUser.uid,
        userName: currentUserName,
        text: newComment,
        createdAt: serverTimestamp()
      });
      setNewComment("");
      toast.success(t("comment_added"));

      const reportDoc = await getDoc(doc(db, "reports", reportId));
      const ownerId = reportDoc.data()?.createdBy;
      if (ownerId && ownerId !== currentUser.uid) {
        const ownerDoc = await getDoc(doc(db, "users", ownerId));
        if (ownerDoc.data()?.notif_comments !== false) {
          await createNotification(
            ownerId,
            t("new_comment"),
            t("new_comment_on_your_report", { user: currentUserName, comment: newComment.slice(0, 50) }),
            "💬",
            "/reports"
          );
        }
      }
    } catch (error) {
      toast.error(t("error_adding_comment"));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (commentId) => {
    if (isCurrentUserBlocked) {
      if (blockReason === "manual") toast.error(t("you_are_blocked"));
      else toast.error(t("currently_blocked", { time: remainingTimeStr }));
      return;
    }
    if (!editText.trim()) {
      toast.error(t("comment_empty"));
      return;
    }
    const canProceed = await checkAndHandleContent(editText);
    if (!canProceed) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "comments", commentId), { text: editText });
      toast.success(t("comment_updated"));
      setEditingId(null);
      setEditText("");
    } catch (error) {
      toast.error(t("error_updating_comment"));
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (window.confirm(t("confirm_delete_comment"))) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, "comments", commentId));
        toast.success(t("comment_deleted"));
      } catch (error) {
        toast.error(t("error_deleting_comment"));
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleBlockUser = async (userId, userName, currentBlockedStatus) => {
    const action = currentBlockedStatus ? t("unblock") : t("block");
    if (window.confirm(t("confirm_block", { action, name: userName }))) {
      setLoading(true);
      try {
        await updateDoc(doc(db, "users", userId), { blocked: !currentBlockedStatus });
        setBlockedUsers(prev => ({ ...prev, [userId]: !currentBlockedStatus }));
        toast.success(currentBlockedStatus ? t("user_unblocked") : t("user_blocked"));
      } catch (error) {
        toast.error(t("error_block_operation"));
      } finally {
        setLoading(false);
      }
    }
  };

  if (!reportId) return <p>{t("no_report_id_error")}</p>;

  return (
    <div className="comments-section" style={{ marginTop: "16px", borderTop: "1px solid var(--border-light)", paddingTop: "16px" }}>
      <h4><i className="fas fa-comments"></i> {t("comments")} ({comments.length})</h4>
      <div className="comments-list" style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "12px" }}>
        {comments.length === 0 && (
          <p style={{ textAlign: "center", padding: "12px", color: "var(--text-secondary)" }}>{t("no_comments")}</p>
        )}
        {comments.map(comment => {
          const isOwn = comment.userId === currentUser?.uid;
          const isEditing = editingId === comment.id;
          const isBlocked = isUserBlocked(comment.userId);
          return (
            <div key={comment.id} className="comment-item" style={{ background: "var(--hover-bg)", borderRadius: "16px", padding: "12px", marginBottom: "8px", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ fontSize: "0.85rem", color: "#2b7a4b" }}>
                  <i className="fas fa-user-circle"></i> {comment.userName || t("user")}
                  {isBlocked && <span style={{ marginLeft: "8px", fontSize: "0.7rem", color: "#b91c1c" }}>({t("blocked")})</span>}
                </strong>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <small style={{ color: "var(--text-secondary)" }}>
                    {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleString() : t("just_now")}
                  </small>
                  {userRole === "gestionnaire" && (
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setOpenMenuId(openMenuId === comment.id ? null : comment.id)} className="btn-secondary small" style={{ padding: "4px 8px" }}>
                        <i className="fas fa-ellipsis-v"></i>
                      </button>
                      {openMenuId === comment.id && (
                        <div style={{ position: "absolute", right: 0, top: "100%", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "8px", zIndex: 10, minWidth: "150px" }}>
                          <button onClick={() => { deleteComment(comment.id); setOpenMenuId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}>
                            <i className="fas fa-trash"></i> {t("delete")}
                          </button>
                          <button onClick={async () => {
                            const userDoc = await getDoc(doc(db, "users", comment.userId));
                            const currentBlocked = userDoc.exists() ? userDoc.data().blocked === true : false;
                            toggleBlockUser(comment.userId, comment.userName, currentBlocked);
                            setOpenMenuId(null);
                          }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#d97706" }}>
                            <i className="fas fa-ban"></i> {isBlocked ? t("unblock_user") : t("block_user")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows="2" style={{ flex: 1, borderRadius: "12px", padding: "8px" }} />
                  <button onClick={() => saveEdit(comment.id)} className="btn-primary small" disabled={loading}>{t("save")}</button>
                  <button onClick={cancelEdit} className="btn-secondary small">{t("cancel")}</button>
                </div>
              ) : (
                <>
                  <p style={{ margin: "0 0 8px 0", whiteSpace: "pre-wrap" }}>{comment.text}</p>
                  {isOwn && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => startEdit(comment)} className="btn-secondary small" disabled={loading}><i className="fas fa-edit"></i> {t("edit")}</button>
                      <button onClick={() => deleteComment(comment.id)} className="btn-secondary small" style={{ background: "#fee2e2", color: "#b91c1c" }} disabled={loading}><i className="fas fa-trash"></i> {t("delete")}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={addComment} className="comment-form" style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
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
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t("add_comment")}
              rows="3"
              style={{ flex: 1, resize: "vertical", borderRadius: "16px", padding: "8px 12px", border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-text)", whiteSpace: "pre-wrap" }}
            />
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? t("sending") : t("send")}</button>
          </>
        )}
      </form>

      {/* Violation Modal */}
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
import { useState, useEffect, useRef } from "react";
import { doc, updateDoc, deleteDoc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import Comments from "../Collaboration/Comments";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { createNotification } from "../../utils/createNotification";
import { validateComment } from "../../utils/blacklist";
import { recordViolation, checkBlockStatus } from "../../utils/userBlockManager";

export default function ReportCard({ report, onUpdate, canGiveFeedback = false, onFeedbackGiven }) {
  const { t } = useTranslation();
  const [commentsCount, setCommentsCount] = useState(0);
  const { currentUser, userRole } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignedToName, setAssignedToName] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(report.status);
  const [feedbacks, setFeedbacks] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [showEditFeedbackModal, setShowEditFeedbackModal] = useState(false);

  // Block status states
  const [isCurrentUserBlocked, setIsCurrentUserBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState(null);
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

  // Helper: format remaining time
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

  // Countdown effect
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

  // Fetch feedbacks for this report in real-time
  useEffect(() => {
    if (!report.id) return;
    const q = query(collection(db, "reportFeedback"), where("reportId", "==", report.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setFeedbacks(list);
    });
    return unsubscribe;
  }, [report.id]);

  // Fetch comments count
  useEffect(() => {
    if (!report.id) return;
    const q = query(collection(db, "comments"), where("reportId", "==", report.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommentsCount(snapshot.docs.length);
    });
    return unsubscribe;
  }, [report.id]);

  // Fetch assigned agent name
  useEffect(() => {
    const fetchAssignedToName = async () => {
      const assignedId = report.assignedTo;
      if (!assignedId) {
        setAssignedToName(null);
        return;
      }
      if (currentUser && assignedId === currentUser.uid) {
        setAssignedToName(t("me"));
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", assignedId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setAssignedToName(data.fullName || data.email || assignedId);
        } else {
          setAssignedToName(assignedId);
        }
      } catch (error) {
        console.error("Error fetching agent name:", error);
        setAssignedToName(assignedId);
      }
    };
    fetchAssignedToName();
  }, [report.assignedTo, currentUser, t]);

  useEffect(() => {
    setCurrentStatus(report.status);
  }, [report.status]);

  const isAssignedToMe = userRole === "agent" && report.assignedTo === currentUser?.uid;

  const getTranslatedStatus = (status) => {
    if (status === "En attente") return t("waiting");
    if (status === "En cours") return t("in_progress");
    if (status === "Résolu") return t("resolved");
    return status;
  };
  
  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    const previousStatus = currentStatus;
    setCurrentStatus(newStatus);
    try {
      await updateDoc(doc(db, "reports", report.id), { status: newStatus });
      toast.success(t("status_updated", { status: getTranslatedStatus(newStatus) }));
      if (onUpdate) onUpdate();

      const reportDoc = await getDoc(doc(db, "reports", report.id));
      const createdBy = reportDoc.data()?.createdBy;
      const assignedTo = reportDoc.data()?.assignedTo;
      const newStatusText = t(newStatus);
          
      if (createdBy && createdBy !== currentUser.uid) {
        const creatorDoc = await getDoc(doc(db, "users", createdBy));
        if (creatorDoc.data()?.notif_status_created !== false) {
          await createNotification(createdBy, t("status_update"), t("your_report_status_changed", { status: newStatusText }), "📌", "/reports");
        }
        if (newStatus === "Résolu") {
          await createNotification(createdBy, t("feedback_request_title"), t("feedback_request_body"), "⭐", "/reports");
        }
      }
      if (assignedTo && assignedTo !== currentUser.uid && assignedTo !== createdBy) {
        const assigneeDoc = await getDoc(doc(db, "users", assignedTo));
        if (assigneeDoc.data()?.notif_status_assigned !== false) {
          await createNotification(assignedTo, t("status_update"), t("assigned_report_status_changed", { status: newStatusText }), "📌", "/reports");
        }
      }
    } catch (error) {
      setCurrentStatus(previousStatus);
      toast.error(error.message);
    }
    setLoading(false);
  };

  const getStatusLabel = (status) => {
    if (status === "Résolu") return t("resolved");
    if (status === "En cours") return t("in_progress");
    return t("waiting");
  };

  const getStatusStyle = (status) => {
    if (status === "Résolu") return { background: "#e0f2e9", color: "#1f7840" };
    if (status === "En cours") return { background: "#e0f2fe", color: "#0369a1" };
    return { background: "#fff3e0", color: "#c2410c" };
  };

  // Validate feedback comment and handle violations
  const validateFeedbackComment = async (text) => {
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
      setViolationModal({
        show: true,
        reason,
        match,
        durationMinutes: nextDuration,
      });
      return false;
    }
    return false;
  };

  const confirmViolationAndBlock = async () => {
    const { reason } = violationModal;
    setViolationModal({ show: false, reason: "", match: "", durationMinutes: 0 });
    try {
      const result = await recordViolation(currentUser.uid);
      const blockMessage = reason === "vulgar"
        ? t("vulgar_block_warning", { minutes: result.durationMinutes })
        : t("bad_url_block_warning", { minutes: result.durationMinutes });
      toast.error(blockMessage);
      setShowFeedbackModal(false)
    } catch (err) {
      toast.error(t("error_processing_violation"));
    }
  };

  // Submit new feedback with blacklist validation
  const openFeedbackModal = () => {
    if (isCurrentUserBlocked) {
      if (blockReason === "manual") toast.error(t("you_are_blocked"));
      else toast.error(t("currently_blocked", { time: remainingTimeStr }));
      return;
    }
    setFeedbackRating(5);
    setFeedbackComment("");
    setShowFeedbackModal(true);
  };

  const submitFeedback = async () => {
    if (!currentUser) return;
    if (isCurrentUserBlocked) {
      toast.error(t("you_are_blocked"));
      return;
    }
    // Validate comment text
    if (feedbackComment.trim()) {
      const isValid = await validateFeedbackComment(feedbackComment);
      if (!isValid) return;
    }

    setFeedbackLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const userName = userDoc.exists()
        ? (userDoc.data().fullName || userDoc.data().email?.split('@')[0] || t("citizen"))
        : t("citizen");
      await addDoc(collection(db, "reportFeedback"), {
        reportId: report.id,
        userId: currentUser.uid,
        userName: userName,
        rating: feedbackRating,
        comment: feedbackComment,
        createdAt: serverTimestamp(),
      });
      toast.success(t("feedback_thanks"));
      setShowFeedbackModal(false);
      if (onFeedbackGiven) onFeedbackGiven();
    } catch (error) {
      toast.error(t("error_submitting_feedback"));
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Edit feedback with blacklist validation
  const openEditFeedbackModal = (feedback) => {
    if (isCurrentUserBlocked) {
      if (blockReason === "manual") toast.error(t("you_are_blocked"));
      else toast.error(t("currently_blocked", { time: remainingTimeStr }));
      return;
    }
    setEditingFeedback({ id: feedback.id, rating: feedback.rating, comment: feedback.comment || "" });
    setShowEditFeedbackModal(true);
  };

  const updateFeedback = async () => {
    if (!editingFeedback) return;
    if (isCurrentUserBlocked) {
      toast.error(t("you_are_blocked"));
      return;
    }
    // Validate comment text
    if (editingFeedback.comment.trim()) {
      const isValid = await validateFeedbackComment(editingFeedback.comment);
      if (!isValid) return;
    }

    setFeedbackLoading(true);
    try {
      await updateDoc(doc(db, "reportFeedback", editingFeedback.id), {
        rating: editingFeedback.rating,
        comment: editingFeedback.comment,
      });
      toast.success(t("feedback_updated"));
      setShowEditFeedbackModal(false);
      setEditingFeedback(null);
    } catch (error) {
      toast.error(t("error_updating_feedback"));
    } finally {
      setFeedbackLoading(false);
    }
  };

  const deleteFeedback = async (feedbackId, userName) => {
    if (window.confirm(t("confirm_delete_feedback", { name: userName }))) {
      setFeedbackLoading(true);
      try {
        await deleteDoc(doc(db, "reportFeedback", feedbackId));
        toast.success(t("feedback_deleted"));
        if (onFeedbackGiven) onFeedbackGiven();
      } catch (error) {
        toast.error(t("error_deleting_feedback"));
      } finally {
        setFeedbackLoading(false);
      }
    }
  };

  return (
    <div className="report-card card">
      <div className="report-card-inner">
        {report.photoBase64 && (
          <div className="report-card-photo">
            <img src={report.photoBase64} alt={t("report_photo")} onClick={() => setShowPhotoModal(true)} className="report-photo-thumb" />
          </div>
        )}
        <div className="report-card-content">
          <div className="report-header">
            <span className="status-badge" style={getStatusStyle(currentStatus)}>{getStatusLabel(currentStatus)}</span>
            <h4>{report.type}</h4>
          </div>
          <p><strong>📍 {report.address}</strong></p>
          {report.description && <p className="report-description">{report.description}</p>}
          {(userRole === "agent" || userRole === "gestionnaire") && report.assignedTo && (
            <p><i className="fas fa-user-check"></i> {t("assigned_to")} {assignedToName || report.assignedTo}</p>
          )}

          {/* Display all feedbacks */}
          {feedbacks.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              
              <div style={{ marginTop: "8px" }}>
                {feedbacks.map(fb => {
                  const isOwn = fb.userId === currentUser?.uid;
                  return (
                    <div key={fb.id} style={{ marginBottom: "12px", padding: "8px", background: "var(--hover-bg)", borderRadius: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong>{fb.userName || t("user")}</strong>
                          <span style={{ color: "#f5b042", fontSize: "16px" }}>
                            {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                          </span>
                          <small style={{ color: "var(--text-secondary)" }}>
                            {fb.createdAt?.toDate?.().toLocaleDateString()}
                          </small>
                        </div>
                        {isOwn && (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => openEditFeedbackModal(fb)} className="btn-secondary small" title={t("edit")}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button onClick={() => deleteFeedback(fb.id, fb.userName)} className="btn-secondary small" style={{ background: "#fee2e2", color: "#b91c1c" }} title={t("delete")}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        )}
                      </div>
                      {fb.comment && <p style={{ marginTop: "4px", fontSize: "0.9rem" }}>"{fb.comment}"</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback button for creator – only if report is resolved and user is not blocked */}
          {canGiveFeedback && report.status === "Résolu" && (
            <div style={{ marginTop: "12px" }}>
              {isCurrentUserBlocked ? (
                blockReason === "temporary" ? (
                  <small style={{ display: "block", marginTop: "4px", color: "#b91c1c" }}>
                    {t("currently_blocked", { time: remainingTimeStr })}
                  </small>
                ) : (
                  <small style={{ display: "block", marginTop: "4px", color: "#b91c1c" }}>
                    {t("you_are_blocked")}
                  </small>
                )
              ) : (
                <button 
                  className="btn-primary small" 
                  onClick={openFeedbackModal}
                  disabled={isCurrentUserBlocked}
                >
                  <i className="fas fa-star"></i> {t("give_feedback")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="report-meta">
        <div className="report-actions">
          <button onClick={() => setShowComments(!showComments)} className="btn-secondary small">💬 {t("comments")} ({commentsCount})</button>
          {userRole === "gestionnaire" && (
            <select value={currentStatus} onChange={(e) => handleStatusChange(e.target.value)} className="status-select" disabled={loading}>
              <option value="En attente">{t("waiting")}</option>
              <option value="En cours">{t("in_progress")}</option>
              <option value="Résolu">{t("resolved")}</option>
            </select>
          )}
          {userRole === "agent" && isAssignedToMe && (
            <select value={currentStatus} onChange={(e) => handleStatusChange(e.target.value)} className="status-select" disabled={loading}>
              <option value="En attente">{t("waiting")}</option>
              <option value="En cours">{t("in_progress")}</option>
              <option value="Résolu">{t("resolved")}</option>
            </select>
          )}
        </div>
      </div>

      {showComments && <Comments reportId={report.id} />}
      {showPhotoModal && (
        <div className="photo-modal" onClick={() => setShowPhotoModal(false)}>
          <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={report.photoBase64} alt={t("report_photo")} />
            <button className="photo-modal-close" onClick={() => setShowPhotoModal(false)}>✕</button>
          </div>
        </div>
      )}

      {/* New Feedback Modal */}
      {showFeedbackModal && (
        <div className="modal" onClick={() => setShowFeedbackModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h3>{t("feedback_title")}</h3>
            <div className="form-group">
              <label>{t("rating")}</label>
              <div style={{ display: "flex", gap: "8px", fontSize: "28px", cursor: "pointer" }}>
                {[1,2,3,4,5].map(star => (
                  <span key={star} onClick={() => setFeedbackRating(star)} style={{ color: star <= feedbackRating ? "#f5b042" : "#ccc" }}>★</span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>{t("comment_optional")}</label>
              <textarea rows="3" value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder={t("feedback_placeholder")} />
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowFeedbackModal(false)}>{t("cancel")}</button>
              <button className="btn-primary" onClick={submitFeedback} disabled={feedbackLoading || isCurrentUserBlocked}>{feedbackLoading ? t("sending") : t("submit")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Feedback Modal */}
      {showEditFeedbackModal && editingFeedback && (
        <div className="modal" onClick={() => setShowEditFeedbackModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h3>{t("edit_feedback")}</h3>
            <div className="form-group">
              <label>{t("rating")}</label>
              <div style={{ display: "flex", gap: "8px", fontSize: "28px", cursor: "pointer" }}>
                {[1,2,3,4,5].map(star => (
                  <span key={star} onClick={() => setEditingFeedback(prev => ({ ...prev, rating: star }))} style={{ color: star <= editingFeedback.rating ? "#f5b042" : "#ccc" }}>★</span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>{t("comment_optional")}</label>
              <textarea rows="3" value={editingFeedback.comment} onChange={e => setEditingFeedback(prev => ({ ...prev, comment: e.target.value }))} placeholder={t("feedback_placeholder")} />
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowEditFeedbackModal(false)}>{t("cancel")}</button>
              <button className="btn-primary" onClick={updateFeedback} disabled={feedbackLoading || isCurrentUserBlocked}>{feedbackLoading ? t("saving") : t("save")}</button>
            </div>
          </div>
        </div>
      )}

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
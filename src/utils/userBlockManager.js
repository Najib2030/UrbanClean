// src/utils/userBlockManager.js
import { db } from "../firebase/config";
import { doc, getDoc, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore";

const BLOCK_DURATIONS = {
  1: 2 * 60 * 1000,
  2: 30 * 60 * 1000,
  3: 24 * 60 * 60 * 1000,
  4: 7 * 24 * 60 * 60 * 1000,
  5: 30 * 24 * 60 * 60 * 1000,
};

const CLEAN_RESET_HOURS = 48;

export async function getUserViolationData(userId) {
  const userDoc = await getDoc(doc(db, "users", userId));
  if (!userDoc.exists()) {
    return { violationCount: 0, lastViolationTime: null, blockedUntil: null, blocked: false };
  }
  const data = userDoc.data();
  return {
    violationCount: data.violationCount || 0,
    lastViolationTime: data.lastViolationTime?.toDate() || null,
    blockedUntil: data.blockedUntil?.toDate() || null,
    blocked: data.blocked === true,
  };
}

export async function checkBlockStatus(userId) {
  const { violationCount, lastViolationTime, blockedUntil, blocked } = await getUserViolationData(userId);
  const now = new Date();

  // First check permanent manual block
  if (blocked) {
    return { blocked: true, reason: "manual", blockedUntil: null, reset: false };
  }

  // Then check temporary violation block
  if (blockedUntil && blockedUntil > now) {
    return { blocked: true, reason: "temporary", blockedUntil, reset: false };
  }

  // Block expired – check if we should reset violation count
  let reset = false;
  if (violationCount > 0 && lastViolationTime) {
    const hoursSinceLastViolation = (now - lastViolationTime) / (1000 * 60 * 60);
    if (hoursSinceLastViolation >= CLEAN_RESET_HOURS) {
      await updateDoc(doc(db, "users", userId), {
        violationCount: 0,
        blockedUntil: null,
        lastViolationTime: null,
      });
      reset = true;
    }
  }
  return { blocked: false, reason: null, blockedUntil: null, reset };
}

export async function recordViolation(userId) {
  const userRef = doc(db, "users", userId);
  let newViolationCount = 0;
  let blockDurationMs = 0;
  let blockedUntil = null;

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error("User document not found");
    }
    const currentCount = userSnap.data().violationCount || 0;
    newViolationCount = currentCount + 1;
    const level = Math.min(newViolationCount, 5);
    blockDurationMs = BLOCK_DURATIONS[level];
    blockedUntil = new Date(Date.now() + blockDurationMs);
    transaction.update(userRef, {
      violationCount: newViolationCount,
      lastViolationTime: serverTimestamp(),
      blockedUntil: blockedUntil,
      // blocked flag remains false (manual block only set by manager)
    });
  });

  const durationMinutes = Math.ceil(blockDurationMs / (60 * 1000));
  return {
    blocked: true,
    durationMinutes,
    newViolationCount,
    blockedUntil,
  };
}
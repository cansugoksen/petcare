import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { firestore } from '@/lib/firebase';

function userDoc(uid) {
  return doc(firestore, 'users', uid);
}

function petsCol(uid) {
  return collection(firestore, 'users', uid, 'pets');
}

function petDoc(uid, petId) {
  return doc(firestore, 'users', uid, 'pets', petId);
}

function remindersCol(uid, petId) {
  return collection(firestore, 'users', uid, 'pets', petId, 'reminders');
}

function reminderDoc(uid, petId, reminderId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'reminders', reminderId);
}

function weightsCol(uid, petId) {
  return collection(firestore, 'users', uid, 'pets', petId, 'weights');
}

function weightDoc(uid, petId, entryId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'weights', entryId);
}

function logsCol(uid, petId) {
  return collection(firestore, 'users', uid, 'pets', petId, 'logs');
}

function logDoc(uid, petId, logId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'logs', logId);
}

function deviceTokensCol(uid) {
  return collection(firestore, 'users', uid, 'deviceTokens');
}

function postsCol() {
  return collection(firestore, 'posts');
}

function postDoc(postId) {
  return doc(firestore, 'posts', postId);
}

function postLikesCol(postId) {
  return collection(firestore, 'posts', postId, 'likes');
}

function postLikeDoc(postId, uid) {
  return doc(firestore, 'posts', postId, 'likes', uid);
}

function postCommentsCol(postId) {
  return collection(firestore, 'posts', postId, 'comments');
}

export async function ensureUserDoc(uid, extra = {}) {
  await setDoc(
    userDoc(uid),
    {
      ...extra,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribePets(uid, callback, onError) {
  const q = query(petsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError
  );
}

export function subscribePet(uid, petId, callback, onError) {
  return onSnapshot(
    petDoc(uid, petId),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    onError
  );
}

export async function createPet(uid, pet) {
  const ref = await addDoc(petsCol(uid), {
    ...pet,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePet(uid, petId, patch) {
  await updateDoc(petDoc(uid, petId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePet(uid, petId) {
  const reminderSnap = await getDocs(remindersCol(uid, petId));
  await Promise.all(reminderSnap.docs.map((d) => deleteDoc(d.ref)));

  const weightSnap = await getDocs(weightsCol(uid, petId));
  await Promise.all(weightSnap.docs.map((d) => deleteDoc(d.ref)));

  const logSnap = await getDocs(logsCol(uid, petId));
  await Promise.all(logSnap.docs.map((d) => deleteDoc(d.ref)));

  await deleteDoc(petDoc(uid, petId));
}

export async function getPet(uid, petId) {
  const snap = await getDoc(petDoc(uid, petId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeReminders(uid, petId, callback, onError) {
  const q = query(remindersCol(uid, petId), orderBy('dueDate', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createReminder(uid, petId, reminder) {
  const ref = await addDoc(remindersCol(uid, petId), {
    ...reminder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastNotifiedAt: reminder.lastNotifiedAt ?? null,
  });
  return ref.id;
}

export async function updateReminder(uid, petId, reminderId, patch) {
  await updateDoc(reminderDoc(uid, petId, reminderId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReminder(uid, petId, reminderId) {
  await deleteDoc(reminderDoc(uid, petId, reminderId));
}

export async function getReminder(uid, petId, reminderId) {
  const snap = await getDoc(reminderDoc(uid, petId, reminderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeUpcomingReminders(uid, callback, onError) {
  const reminderUnsubs = new Map();
  const reminderRowsByPet = new Map();

  const emit = () => {
    const nowMs = Date.now();
    const merged = Array.from(reminderRowsByPet.values())
      .flat()
      .filter((item) => {
        const due = item?.dueDate?.toDate ? item.dueDate.toDate() : item?.dueDate;
        const dueMs = due instanceof Date ? due.getTime() : new Date(due).getTime();
        return item.active && Number.isFinite(dueMs) && dueMs >= nowMs;
      })
      .sort((a, b) => {
        const aMs =
          a?.dueDate?.toDate instanceof Function
            ? a.dueDate.toDate().getTime()
            : new Date(a.dueDate).getTime();
        const bMs =
          b?.dueDate?.toDate instanceof Function
            ? b.dueDate.toDate().getTime()
            : new Date(b.dueDate).getTime();
        return aMs - bMs;
      });

    callback(merged);
  };

  const petsUnsub = onSnapshot(
    petsCol(uid),
    (petsSnap) => {
      const currentPetIds = new Set(petsSnap.docs.map((d) => d.id));

      for (const [petId, unsub] of reminderUnsubs.entries()) {
        if (!currentPetIds.has(petId)) {
          unsub();
          reminderUnsubs.delete(petId);
          reminderRowsByPet.delete(petId);
        }
      }

      petsSnap.docs.forEach((petSnap) => {
        const petId = petSnap.id;
        const pet = petSnap.data();

        if (reminderUnsubs.has(petId)) {
          return;
        }

        const q = query(remindersCol(uid, petId), orderBy('dueDate', 'asc'));
        const unsub = onSnapshot(
          q,
          (reminderSnap) => {
            reminderRowsByPet.set(
              petId,
              reminderSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
                petId,
                petName: d.data().petName || pet.name || '',
              }))
            );
            emit();
          },
          onError
        );

        reminderUnsubs.set(petId, unsub);
      });

      emit();
    },
    onError
  );

  return () => {
    petsUnsub?.();
    for (const unsub of reminderUnsubs.values()) {
      unsub?.();
    }
    reminderUnsubs.clear();
    reminderRowsByPet.clear();
  };
}

export function subscribeWeights(uid, petId, callback, onError) {
  const q = query(weightsCol(uid, petId), orderBy('measuredAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createWeightEntry(uid, petId, payload) {
  const ref = await addDoc(weightsCol(uid, petId), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteWeightEntry(uid, petId, entryId) {
  await deleteDoc(weightDoc(uid, petId, entryId));
}

export function subscribeHealthLogs(uid, petId, callback, onError) {
  const q = query(logsCol(uid, petId), orderBy('loggedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createHealthLog(uid, petId, payload) {
  const ref = await addDoc(logsCol(uid, petId), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteHealthLog(uid, petId, logId) {
  await deleteDoc(logDoc(uid, petId, logId));
}

export async function saveDeviceToken(uid, tokenRecord) {
  const tokenId = (tokenRecord.token || '').replace(/[/.#[\]\s]/g, '_');
  if (!tokenId) {
    return;
  }

  await setDoc(
    doc(deviceTokensCol(uid), tokenId),
    {
      ...tokenRecord,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeDeviceTokens(uid, callback, onError) {
  const q = query(deviceTokensCol(uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function subscribeSocialFeed(callback, onError, options = {}) {
  const q = query(postsCol(), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(typeof options.limit === 'number' ? rows.slice(0, options.limit) : rows);
    },
    onError
  );
}

export function subscribeSocialPost(postId, callback, onError) {
  if (!postId) {
    callback(null);
    return () => {};
  }

  return onSnapshot(
    postDoc(postId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ id: snap.id, ...snap.data() });
    },
    onError
  );
}

export async function createSocialPost(uid, payload) {
  const ref = await addDoc(postsCol(), {
    ownerUid: uid,
    ownerName: payload.ownerName || 'PetCare Kullanıcısı',
    ownerPhotoUrl: payload.ownerPhotoUrl || null,
    petId: payload.petId || null,
    petName: payload.petName || null,
    imageUrl: payload.imageUrl,
    imagePath: payload.imagePath || null,
    caption: payload.caption || '',
    visibility: 'public',
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribePostLikeState(postId, uid, callback, onError) {
  if (!postId || !uid) {
    callback(false);
    return () => {};
  }

  return onSnapshot(
    postLikeDoc(postId, uid),
    (snap) => callback(snap.exists()),
    onError
  );
}

export async function togglePostLike(postId, uid) {
  await runTransaction(firestore, async (tx) => {
    const likeRef = postLikeDoc(postId, uid);
    const pRef = postDoc(postId);
    const [likeSnap, postSnap] = await Promise.all([tx.get(likeRef), tx.get(pRef)]);

    if (!postSnap.exists()) {
      throw new Error('Post bulunamadi.');
    }

    const currentLikeCount = Number(postSnap.data().likeCount || 0);

    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(pRef, {
        likeCount: Math.max(0, currentLikeCount - 1),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    tx.set(likeRef, {
      uid,
      createdAt: serverTimestamp(),
    });
    tx.update(pRef, {
      likeCount: currentLikeCount + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export function subscribePostComments(postId, callback, onError) {
  const q = query(postCommentsCol(postId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createPostComment(postId, uid, payload) {
  await addDoc(postCommentsCol(postId), {
    uid,
    userName: payload.userName || 'PetCare Kullanıcısı',
    text: payload.text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await runTransaction(firestore, async (tx) => {
    const pRef = postDoc(postId);
    const snap = await tx.get(pRef);
    if (!snap.exists()) {
      return;
    }
    tx.update(pRef, {
      commentCount: Number(snap.data().commentCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

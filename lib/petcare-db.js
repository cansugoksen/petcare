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

function expensesCol(uid, petId) {
  return collection(firestore, 'users', uid, 'pets', petId, 'expenses');
}

function expenseDoc(uid, petId, expenseId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'expenses', expenseId);
}

function documentsCol(uid, petId) {
  return collection(firestore, 'users', uid, 'pets', petId, 'documents');
}

function documentDoc(uid, petId, documentId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'documents', documentId);
}

function eventsCol(uid, petId) {
  return collection(firestore, 'users', uid, 'pets', petId, 'events');
}

function eventDoc(uid, petId, eventId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'events', eventId);
}

function qrProfileDoc(uid, petId) {
  return doc(firestore, 'users', uid, 'pets', petId, 'qrProfile', 'default');
}

function deviceTokensCol(uid) {
  return collection(firestore, 'users', uid, 'deviceTokens');
}

function postsCol() {
  return collection(firestore, 'posts');
}

function sharedPetsCol() {
  return collection(firestore, 'pets');
}

function sharedPetDoc(petId) {
  return doc(firestore, 'pets', petId);
}

function sharedPetMembersCol(petId) {
  return collection(firestore, 'pets', petId, 'members');
}

function sharedPetMemberDoc(petId, uid) {
  return doc(firestore, 'pets', petId, 'members', uid);
}

function userPetMembershipsCol(uid) {
  return collection(firestore, 'users', uid, 'petMemberships');
}

function userPetMembershipDoc(uid, petId) {
  return doc(firestore, 'users', uid, 'petMemberships', petId);
}

function petInvitesCol() {
  return collection(firestore, 'petInvites');
}

function publicPetProfileDoc(publicToken) {
  return doc(firestore, 'publicPetProfiles', publicToken);
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

// Shared pets model helpers (V2.1 draft)
export function subscribeSharedPetMemberships(uid, callback, onError) {
  const q = query(userPetMembershipsCol(uid), orderBy('joinedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function subscribeSharedPet(petId, callback, onError) {
  return onSnapshot(
    sharedPetDoc(petId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export function subscribeSharedPetMembers(petId, callback, onError) {
  const q = query(sharedPetMembersCol(petId), orderBy('joinedAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function getFirstAccessiblePetId(uid) {
  if (!uid) return null;

  try {
    const sharedSnap = await getDocs(query(userPetMembershipsCol(uid), orderBy('joinedAt', 'desc')));
    const firstShared = sharedSnap.docs[0];
    if (firstShared) {
      const data = firstShared.data() || {};
      return data.petId || firstShared.id;
    }
  } catch {
    // shared draft model her kullanıcıda hazır olmayabilir; legacy fallback'e geç.
  }

  const legacySnap = await getDocs(query(petsCol(uid), orderBy('createdAt', 'desc')));
  const firstLegacy = legacySnap.docs[0];
  return firstLegacy ? firstLegacy.id : null;
}

export async function createPetInviteCode({ petId, createdByUid, role = 'family', expiresAt = null }) {
  const code = generateInviteCode();
  const ref = await addDoc(petInvitesCol(), {
    petId,
    createdByUid,
    role,
    code,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: expiresAt || null,
  });
  return { id: ref.id, code };
}

export async function acceptPetInviteCode({ uid, inviteCode, displayName = null }) {
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!code) throw new Error('Davet kodu gerekli.');

  const inviteQuery = query(petInvitesCol(), where('code', '==', code));
  const inviteSnap = await getDocs(inviteQuery);
  if (inviteSnap.empty) throw new Error('Davet kodu bulunamadı.');

  const inviteRef = inviteSnap.docs[0].ref;
  const invite = inviteSnap.docs[0].data();
  if (invite.status !== 'pending') throw new Error('Davet kodu kullanılamaz durumda.');

  const petRef = sharedPetDoc(invite.petId);
  const memberRef = sharedPetMemberDoc(invite.petId, uid);
  const membershipRef = userPetMembershipDoc(uid, invite.petId);

  await runTransaction(firestore, async (tx) => {
    const [petSnap, memberSnap] = await Promise.all([tx.get(petRef), tx.get(memberRef)]);
    if (!petSnap.exists()) throw new Error('Pet bulunamadı.');
    if (memberSnap.exists()) throw new Error('Bu pet erişimi zaten mevcut.');

    const pet = petSnap.data();
    tx.set(memberRef, {
      uid,
      role: invite.role || 'family',
      displayName: displayName || null,
      joinedAt: serverTimestamp(),
      addedByUid: invite.createdByUid || null,
      notificationsEnabled: true,
    });
    tx.set(membershipRef, {
      petId: invite.petId,
      role: invite.role || 'family',
      petName: pet.name || 'Pet',
      species: pet.species || null,
      joinedAt: serverTimestamp(),
    });
    tx.set(
      inviteRef,
      {
        status: 'accepted',
        acceptedByUid: uid,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return true;
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

  const expenseSnap = await getDocs(expensesCol(uid, petId));
  await Promise.all(expenseSnap.docs.map((d) => deleteDoc(d.ref)));

  const eventSnap = await getDocs(eventsCol(uid, petId));
  await Promise.all(eventSnap.docs.map((d) => deleteDoc(d.ref)));

  const documentSnap = await getDocs(documentsCol(uid, petId));
  await Promise.all(documentSnap.docs.map((d) => deleteDoc(d.ref)));

  await deleteDoc(petDoc(uid, petId));
}

export async function getPet(uid, petId) {
  const snap = await getDoc(petDoc(uid, petId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribePetQrProfile(uid, petId, callback, onError) {
  return onSnapshot(
    qrProfileDoc(uid, petId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export async function upsertPetQrProfile(uid, petId, payload) {
  await setDoc(
    qrProfileDoc(uid, petId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      createdAt: payload?.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribePublicPetProfile(publicToken, callback, onError) {
  if (!publicToken) {
    callback?.(null);
    return () => {};
  }

  return onSnapshot(
    publicPetProfileDoc(publicToken),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export async function upsertPublicPetProfileSnapshot(publicToken, payload) {
  if (!publicToken) throw new Error('publicToken gerekli.');
  await setDoc(
    publicPetProfileDoc(publicToken),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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
  await upsertTimelineEvent(uid, petId, buildReminderEvent(ref.id, reminder));
  return ref.id;
}

export async function updateReminder(uid, petId, reminderId, patch) {
  await updateDoc(reminderDoc(uid, petId, reminderId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  const latest = await getReminder(uid, petId, reminderId);
  if (latest) {
    await upsertTimelineEvent(uid, petId, buildReminderEvent(reminderId, latest));
  }
}

export async function deleteReminder(uid, petId, reminderId) {
  await deleteDoc(reminderDoc(uid, petId, reminderId));
  await deleteTimelineEvent(uid, petId, 'reminder', reminderId);
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
    updatedAt: serverTimestamp(),
  });
  await upsertTimelineEvent(uid, petId, buildWeightEvent(ref.id, payload));
  return ref.id;
}

export async function getWeightEntry(uid, petId, entryId) {
  const snap = await getDoc(weightDoc(uid, petId, entryId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateWeightEntry(uid, petId, entryId, payload) {
  await updateDoc(weightDoc(uid, petId, entryId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await upsertTimelineEvent(uid, petId, buildWeightEvent(entryId, payload));
}

export async function deleteWeightEntry(uid, petId, entryId) {
  await deleteDoc(weightDoc(uid, petId, entryId));
  await deleteTimelineEvent(uid, petId, 'weight', entryId);
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
    updatedAt: serverTimestamp(),
  });
  await upsertTimelineEvent(uid, petId, buildLogEvent(ref.id, payload));
  return ref.id;
}

export async function getHealthLog(uid, petId, logId) {
  const snap = await getDoc(logDoc(uid, petId, logId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateHealthLog(uid, petId, logId, payload) {
  await updateDoc(logDoc(uid, petId, logId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await upsertTimelineEvent(uid, petId, buildLogEvent(logId, payload));
}

export async function deleteHealthLog(uid, petId, logId) {
  await deleteDoc(logDoc(uid, petId, logId));
  await deleteTimelineEvent(uid, petId, 'log', logId);
}

export function subscribeTimelineEvents(uid, petId, callback, onError) {
  const q = query(eventsCol(uid, petId), orderBy('occurredAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function subscribeExpenses(uid, petId, callback, onError) {
  const q = query(expensesCol(uid, petId), orderBy('expenseDate', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export function subscribeDocuments(uid, petId, callback, onError) {
  const q = query(documentsCol(uid, petId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createDocument(uid, petId, payload) {
  const ref = await addDoc(documentsCol(uid, petId), {
    ...payload,
    ocrStatus: payload?.ocrStatus || 'pending',
    detections: payload?.detections || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getDocument(uid, petId, documentId) {
  const snap = await getDoc(documentDoc(uid, petId, documentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateDocument(uid, petId, documentId, payload) {
  await updateDoc(documentDoc(uid, petId, documentId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(uid, petId, documentId) {
  await deleteDoc(documentDoc(uid, petId, documentId));
}

export async function createExpense(uid, petId, payload) {
  const ref = await addDoc(expensesCol(uid, petId), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await upsertTimelineEvent(uid, petId, buildExpenseEvent(ref.id, payload));
  return ref.id;
}

export async function getExpense(uid, petId, expenseId) {
  const snap = await getDoc(expenseDoc(uid, petId, expenseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateExpense(uid, petId, expenseId, payload) {
  await updateDoc(expenseDoc(uid, petId, expenseId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await upsertTimelineEvent(uid, petId, buildExpenseEvent(expenseId, payload));
}

export async function deleteExpense(uid, petId, expenseId) {
  await deleteDoc(expenseDoc(uid, petId, expenseId));
  await deleteTimelineEvent(uid, petId, 'expense', expenseId);
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

function timelineEventId(type, sourceId) {
  return `${type}_${sourceId}`;
}

async function upsertTimelineEvent(uid, petId, event) {
  if (!event?.type || !event?.sourceRef?.id || !event?.occurredAt) return;
  const eventId = timelineEventId(event.type, event.sourceRef.id);
  await setDoc(
    eventDoc(uid, petId, eventId),
    {
      ...event,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function deleteTimelineEvent(uid, petId, type, sourceId) {
  if (!type || !sourceId) return;
  await deleteDoc(eventDoc(uid, petId, timelineEventId(type, sourceId)));
}

function buildReminderEvent(reminderId, reminder) {
  const subtype = reminder?.type || null;
  const title = reminder?.title || reminderTypeLabel(subtype) || 'Hatırlatma';
  const repeat = reminder?.repeatType ? ` • ${repeatTypeLabel(reminder.repeatType)}` : '';
  return {
    type: 'reminder',
    subtype,
    occurredAt: reminder?.dueDate || null,
    sourceRef: { collection: 'reminders', id: reminderId },
    title,
    summary: `${reminderTypeLabel(subtype) || 'Hatırlatma'}${repeat}`,
    status: reminder?.active ? 'active' : 'inactive',
    meta: {
      dueDate: reminder?.dueDate || null,
      repeatType: reminder?.repeatType || 'none',
      customDaysInterval: reminder?.customDaysInterval || null,
    },
  };
}

function buildWeightEvent(entryId, entry) {
  const valueKg = Number(entry?.valueKg ?? entry?.weight ?? 0);
  return {
    type: 'weight',
    subtype: null,
    occurredAt: entry?.measuredAt || null,
    sourceRef: { collection: 'weights', id: entryId },
    title: 'Kilo Kaydı',
    summary: Number.isFinite(valueKg) ? `${valueKg} kg ölçüldü` : 'Kilo kaydı eklendi',
    valueKg: Number.isFinite(valueKg) ? valueKg : null,
    meta: {
      note: entry?.note || null,
    },
  };
}

function buildLogEvent(logId, log) {
  const tags = Array.isArray(log?.tags) ? log.tags.filter(Boolean) : [];
  const note = String(log?.note || '').trim();
  return {
    type: 'log',
    subtype: null,
    occurredAt: log?.loggedAt || null,
    sourceRef: { collection: 'logs', id: logId },
    title: 'Sağlık Notu',
    summary: note ? note.slice(0, 100) : tags.length ? `${tags.slice(0, 3).join(', ')} gözlemi` : 'Sağlık notu eklendi',
    tags,
    meta: {
      note: note || null,
    },
  };
}

function buildExpenseEvent(expenseId, expense) {
  const amount = Number(expense?.amount || 0);
  const category = expense?.category || 'other';
  return {
    type: 'expense',
    subtype: category,
    occurredAt: expense?.expenseDate || null,
    sourceRef: { collection: 'expenses', id: expenseId },
    title: expense?.title || expenseCategoryLabel(category) || 'Gider',
    summary: `${expenseCategoryLabel(category) || 'Gider'} • ${amount ? formatExpenseAmount(amount, expense?.currency || 'TRY') : 'Kayıt eklendi'}`,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: expense?.currency || 'TRY',
    meta: {
      clinicName: expense?.clinicName || null,
      note: expense?.note || null,
    },
  };
}

function reminderTypeLabel(type) {
  if (type === 'vaccine') return 'Aşı';
  if (type === 'medication') return 'İlaç';
  if (type === 'vetVisit') return 'Veteriner';
  return 'Hatırlatma';
}

function repeatTypeLabel(type) {
  if (type === 'weekly') return 'Haftalık';
  if (type === 'monthly') return 'Aylık';
  if (type === 'yearly') return 'Yıllık';
  if (type === 'customDays') return 'Özel';
  return 'Tek Sefer';
}

function expenseCategoryLabel(category) {
  if (category === 'vet') return 'Veteriner';
  if (category === 'medication') return 'İlaç';
  if (category === 'vaccine') return 'Aşı';
  if (category === 'food') return 'Mama';
  if (category === 'grooming') return 'Bakım';
  return 'Diğer';
}

function formatExpenseAmount(amount, currency = 'TRY') {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${amount}`;
  }
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

function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firestore } from '@/lib/firebase';

const MIGRATION_KEY = 'petcare:migrations:local-to-firestore:v1';
const PROTECTED_KEYS = new Set(['petcare:lastViewedPetId', MIGRATION_KEY]);

function parseJson(value) {
  if (typeof value !== 'string' || !value.length) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stripUndefined(input) {
  if (!input || typeof input !== 'object') return input;
  const out = {};
  Object.entries(input).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function looksLikePet(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.name || item.petName) && Boolean(item.species || item.type || item.breed || item.age || item.birthDate);
}

function looksLikeSocialPost(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.imageUrl || item.imagePath || item.imageLocalUri || item.caption || item.text);
}

function looksLikeDocument(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.fileUrl || item.url || item.fileName || item.title || item.ocrText || item.documentDate);
}

function extractArray(payload, predicate) {
  if (Array.isArray(payload)) return payload.filter(predicate);
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.items)) return payload.items.filter(predicate);
    if (Array.isArray(payload.rows)) return payload.rows.filter(predicate);
    if (Array.isArray(payload.data)) return payload.data.filter(predicate);
  }
  return [];
}

function keyIncludesAny(key, candidates) {
  const lc = String(key || '').toLowerCase();
  return candidates.some((needle) => lc.includes(needle));
}

function normalizePet(raw, fallbackId) {
  const id = String(raw?.id || raw?.petId || fallbackId || '').trim();
  if (!id) return null;

  return {
    id,
    payload: stripUndefined({
      name: raw?.name || raw?.petName || '',
      species: raw?.species || raw?.type || null,
      breed: raw?.breed || null,
      sex: raw?.sex || raw?.gender || null,
      age: raw?.age ?? null,
      birthDate: raw?.birthDate || null,
      weightKg: raw?.weightKg ?? raw?.weight ?? null,
      notes: raw?.notes || raw?.note || null,
      photoUrl: raw?.photoUrl || raw?.imageUrl || null,
      photoLocalUri: raw?.photoLocalUri || raw?.photoUri || null,
      vaccinated: typeof raw?.vaccinated === 'boolean' ? raw.vaccinated : null,
      migratedFromLocal: true,
      updatedAt: serverTimestamp(),
      createdAt: raw?.createdAt || serverTimestamp(),
    }),
  };
}

function normalizeQr(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return stripUndefined({
    displayName: raw.displayName || raw.petName || null,
    ownerName: raw.ownerName || null,
    ownerPhone: raw.ownerPhone || raw.phone || null,
    allergies: Array.isArray(raw.allergies) ? raw.allergies : null,
    emergencyNote: raw.emergencyNote || raw.note || null,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    visibleFields: raw.visibleFields && typeof raw.visibleFields === 'object' ? raw.visibleFields : null,
    publicToken: raw.publicToken || null,
    tokenVersion: Number(raw.tokenVersion || 1),
    migratedFromLocal: true,
    updatedAt: serverTimestamp(),
    createdAt: raw.createdAt || serverTimestamp(),
  });
}

function normalizeDocument(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return stripUndefined({
    title: raw.title || raw.fileName || 'Belge',
    documentDate: raw.documentDate || raw.createdAt || null,
    fileName: raw.fileName || null,
    fileUrl: raw.fileUrl || raw.url || null,
    filePath: raw.filePath || raw.path || null,
    note: raw.note || raw.description || null,
    ocrText: raw.ocrText || null,
    ocrStatus: raw.ocrStatus || 'pending',
    detections: raw.detections || null,
    migratedFromLocal: true,
    createdAt: raw.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function normalizeSocialPost(raw, uid, userProfile) {
  if (!raw || typeof raw !== 'object') return null;
  return stripUndefined({
    ownerUid: uid,
    ownerName: raw.ownerName || userProfile?.displayName || userProfile?.email || 'PetCare Kullanicisi',
    ownerPhotoUrl: raw.ownerPhotoUrl || null,
    petId: raw.petId || null,
    petName: raw.petName || null,
    imageUrl: raw.imageUrl || raw.imageLocalUri || null,
    imagePath: raw.imagePath || null,
    caption: raw.caption || raw.text || '',
    visibility: 'public',
    likeCount: Number(raw.likeCount || 0),
    commentCount: Number(raw.commentCount || 0),
    migratedFromLocal: true,
    createdAt: raw.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function extractPetIdFromKey(key) {
  const match = String(key || '').match(/pet[s]?(?::|\/)([^:/]+)(?::|\/)/i);
  return match?.[1] ? String(match[1]) : null;
}

export async function migrateLocalDataToFirestore({ uid, userProfile }) {
  if (!uid) return { skipped: true, reason: 'missing-uid' };

  const marker = parseJson(await AsyncStorage.getItem(MIGRATION_KEY));
  if (marker?.done) {
    return { skipped: true, reason: 'already-migrated', marker };
  }

  const keys = await AsyncStorage.getAllKeys();
  const candidateKeys = keys.filter(
    (key) => key?.startsWith('petcare:') && !PROTECTED_KEYS.has(key) && !key.startsWith('petcare:migrations:')
  );

  if (!candidateKeys.length) {
    await AsyncStorage.setItem(
      MIGRATION_KEY,
      JSON.stringify({ done: true, migratedAt: new Date().toISOString(), noLegacyKeys: true })
    );
    return { skipped: true, reason: 'no-legacy-keys' };
  }

  const entries = await AsyncStorage.multiGet(candidateKeys);

  const pets = new Map();
  const qrByPetId = new Map();
  const documents = [];
  const posts = [];
  const consumedKeys = new Set();

  entries.forEach(([key, value]) => {
    const payload = parseJson(value);
    if (!payload) return;

    if (keyIncludesAny(key, ['pet']) && !keyIncludesAny(key, ['qr', 'document', 'social', 'post'])) {
      const fromArray = extractArray(payload, looksLikePet);
      if (fromArray.length) {
        fromArray.forEach((pet, idx) => {
          const normalized = normalizePet(pet, `${key}-${idx}`);
          if (normalized) pets.set(normalized.id, normalized.payload);
        });
        consumedKeys.add(key);
        return;
      }

      if (looksLikePet(payload)) {
        const normalized = normalizePet(payload, extractPetIdFromKey(key) || key);
        if (normalized) pets.set(normalized.id, normalized.payload);
        consumedKeys.add(key);
        return;
      }
    }

    if (keyIncludesAny(key, ['qr', 'digital-id'])) {
      const petId = payload?.petId || extractPetIdFromKey(key);
      if (petId && payload && typeof payload === 'object') {
        const normalized = normalizeQr(payload);
        if (normalized) qrByPetId.set(String(petId), normalized);
        consumedKeys.add(key);
      }
      return;
    }

    if (keyIncludesAny(key, ['document', 'belge'])) {
      const petId = payload?.petId || extractPetIdFromKey(key);
      const rows = extractArray(payload, looksLikeDocument);
      if (petId && rows.length) {
        rows.forEach((row) => {
          const normalized = normalizeDocument(row);
          if (normalized) documents.push({ petId: String(petId), payload: normalized });
        });
        consumedKeys.add(key);
        return;
      }

      if (petId && looksLikeDocument(payload)) {
        const normalized = normalizeDocument(payload);
        if (normalized) documents.push({ petId: String(petId), payload: normalized });
        consumedKeys.add(key);
      }
      return;
    }

    if (keyIncludesAny(key, ['social', 'post'])) {
      const rows = extractArray(payload, looksLikeSocialPost);
      if (rows.length) {
        rows.forEach((row) => {
          const normalized = normalizeSocialPost(row, uid, userProfile);
          if (normalized && normalized.imageUrl) posts.push(normalized);
        });
        consumedKeys.add(key);
        return;
      }

      if (looksLikeSocialPost(payload)) {
        const normalized = normalizeSocialPost(payload, uid, userProfile);
        if (normalized && normalized.imageUrl) posts.push(normalized);
        consumedKeys.add(key);
      }
    }
  });

  let petsMigrated = 0;
  let qrMigrated = 0;
  let docsMigrated = 0;
  let postsMigrated = 0;

  try {
    for (const [petId, petPayload] of pets.entries()) {
      await setDoc(doc(firestore, 'users', uid, 'pets', petId), petPayload, { merge: true });
      petsMigrated += 1;
    }

    for (const [petId, qrPayload] of qrByPetId.entries()) {
      await setDoc(doc(firestore, 'users', uid, 'pets', petId, 'qrProfile', 'default'), qrPayload, { merge: true });
      qrMigrated += 1;
    }

    for (const row of documents) {
      await addDoc(collection(firestore, 'users', uid, 'pets', row.petId, 'documents'), row.payload);
      docsMigrated += 1;
    }

    for (const row of posts) {
      await addDoc(collection(firestore, 'posts'), row);
      postsMigrated += 1;
    }

    const keysToDelete = Array.from(new Set([...candidateKeys, ...consumedKeys]));
    if (keysToDelete.length) {
      await AsyncStorage.multiRemove(keysToDelete);
    }

    await AsyncStorage.setItem(
      MIGRATION_KEY,
      JSON.stringify({
        done: true,
        migratedAt: new Date().toISOString(),
        petsMigrated,
        qrMigrated,
        docsMigrated,
        postsMigrated,
        cleanedKeys: keysToDelete.length,
      })
    );

    return { done: true, petsMigrated, qrMigrated, docsMigrated, postsMigrated, cleanedKeys: keysToDelete.length };
  } catch (error) {
    await AsyncStorage.setItem(
      MIGRATION_KEY,
      JSON.stringify({
        done: false,
        failedAt: new Date().toISOString(),
        error: String(error?.message || error),
        petsMigrated,
        qrMigrated,
        docsMigrated,
        postsMigrated,
      })
    );
    throw error;
  }
}

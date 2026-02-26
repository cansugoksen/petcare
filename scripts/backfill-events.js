const path = require('path');
const admin = require('firebase-admin');

const serviceAccountPath = path.resolve(
  __dirname,
  '..',
  'petcare-7361d-firebase-adminsdk-fbsvc-da47efedab.json'
);

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const usersSnap = args.uid
    ? await db.collection('users').where(admin.firestore.FieldPath.documentId(), '==', args.uid).get()
    : await db.collection('users').get();

  let usersCount = 0;
  let petsCount = 0;
  let eventsUpserted = 0;

  for (const userDoc of usersSnap.docs) {
    usersCount += 1;
    const uid = userDoc.id;

    const petsSnap = args.petId
      ? await db.collection('users').doc(uid).collection('pets').where(admin.firestore.FieldPath.documentId(), '==', args.petId).get()
      : await db.collection('users').doc(uid).collection('pets').get();

    for (const petDoc of petsSnap.docs) {
      petsCount += 1;
      const petId = petDoc.id;

      const upserts = [];
      upserts.push(...(await backfillReminders(uid, petId)));
      upserts.push(...(await backfillWeights(uid, petId)));
      upserts.push(...(await backfillLogs(uid, petId)));
      upserts.push(...(await backfillExpenses(uid, petId)));

      eventsUpserted += await commitInChunks(upserts, args.dryRun);
      console.log(`[${uid}/${petId}] events hazırlandı: ${upserts.length}`);
    }
  }

  console.log(
    args.dryRun
      ? `DRY RUN tamamlandı • users=${usersCount} pets=${petsCount} eventWrites=${eventsUpserted}`
      : `Backfill tamamlandı • users=${usersCount} pets=${petsCount} eventWrites=${eventsUpserted}`
  );
}

async function backfillReminders(uid, petId) {
  const snap = await db.collection('users').doc(uid).collection('pets').doc(petId).collection('reminders').get();
  return snap.docs
    .map((d) => {
      const row = d.data();
      if (!row?.dueDate) return null;
      return buildUpsert(uid, petId, 'reminder', d.id, {
        type: 'reminder',
        subtype: row.type || null,
        occurredAt: row.dueDate,
        sourceRef: { collection: 'reminders', id: d.id },
        title: row.title || reminderTypeLabel(row.type) || 'Hatırlatma',
        summary: `${reminderTypeLabel(row.type) || 'Hatırlatma'}${row.repeatType ? ` • ${repeatTypeLabel(row.repeatType)}` : ''}`,
        status: row.active ? 'active' : 'inactive',
        meta: {
          dueDate: row.dueDate || null,
          repeatType: row.repeatType || 'none',
          customDaysInterval: row.customDaysInterval || null,
        },
      });
    })
    .filter(Boolean);
}

async function backfillWeights(uid, petId) {
  const snap = await db.collection('users').doc(uid).collection('pets').doc(petId).collection('weights').get();
  return snap.docs
    .map((d) => {
      const row = d.data();
      if (!row?.measuredAt) return null;
      const valueKg = Number(row.valueKg ?? row.weight ?? 0);
      return buildUpsert(uid, petId, 'weight', d.id, {
        type: 'weight',
        subtype: null,
        occurredAt: row.measuredAt,
        sourceRef: { collection: 'weights', id: d.id },
        title: 'Kilo Kaydı',
        summary: Number.isFinite(valueKg) ? `${valueKg} kg ölçüldü` : 'Kilo kaydı eklendi',
        valueKg: Number.isFinite(valueKg) ? valueKg : null,
        meta: { note: row.note || null },
      });
    })
    .filter(Boolean);
}

async function backfillLogs(uid, petId) {
  const snap = await db.collection('users').doc(uid).collection('pets').doc(petId).collection('logs').get();
  return snap.docs
    .map((d) => {
      const row = d.data();
      if (!row?.loggedAt) return null;
      const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean) : [];
      const note = String(row.note || '').trim();
      return buildUpsert(uid, petId, 'log', d.id, {
        type: 'log',
        subtype: null,
        occurredAt: row.loggedAt,
        sourceRef: { collection: 'logs', id: d.id },
        title: 'Sağlık Notu',
        summary: note ? note.slice(0, 100) : tags.length ? `${tags.slice(0, 3).join(', ')} gözlemi` : 'Sağlık notu eklendi',
        tags,
        meta: { note: note || null },
      });
    })
    .filter(Boolean);
}

async function backfillExpenses(uid, petId) {
  const snap = await db.collection('users').doc(uid).collection('pets').doc(petId).collection('expenses').get();
  return snap.docs
    .map((d) => {
      const row = d.data();
      if (!row?.expenseDate) return null;
      const amount = Number(row.amount || 0);
      const category = row.category || 'other';
      return buildUpsert(uid, petId, 'expense', d.id, {
        type: 'expense',
        subtype: category,
        occurredAt: row.expenseDate,
        sourceRef: { collection: 'expenses', id: d.id },
        title: row.title || expenseCategoryLabel(category) || 'Gider',
        summary: `${expenseCategoryLabel(category) || 'Gider'} • ${formatTRY(amount, row.currency || 'TRY')}`,
        amount: Number.isFinite(amount) ? amount : 0,
        currency: row.currency || 'TRY',
        meta: {
          clinicName: row.clinicName || null,
          note: row.note || null,
        },
      });
    })
    .filter(Boolean);
}

function buildUpsert(uid, petId, type, sourceId, payload) {
  const ref = db
    .collection('users')
    .doc(uid)
    .collection('pets')
    .doc(petId)
    .collection('events')
    .doc(`${type}_${sourceId}`);

  return {
    ref,
    data: {
      ...payload,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: payload.createdAt || FieldValue.serverTimestamp(),
    },
  };
}

async function commitInChunks(upserts, dryRun = false) {
  if (!upserts.length) return 0;
  if (dryRun) return upserts.length;

  let total = 0;
  for (let i = 0; i < upserts.length; i += 400) {
    const chunk = upserts.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
    await batch.commit();
    total += chunk.length;
  }
  return total;
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

function formatTRY(amount, currency = 'TRY') {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return String(amount || 0);
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, uid: '', petId: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') args.dryRun = true;
    if (token === '--uid') args.uid = argv[i + 1] || '';
    if (token === '--pet') args.petId = argv[i + 1] || '';
  }
  return args;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Events backfill hatası:', error);
    process.exit(1);
  });

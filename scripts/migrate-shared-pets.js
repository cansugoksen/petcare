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
  const userDocs = args.uid
    ? (await db.collection('users').doc(args.uid).get()).exists
      ? [await db.collection('users').doc(args.uid).get()]
      : []
    : (await db.collection('users').get()).docs;

  let migratedPets = 0;
  let copiedDocs = 0;

  for (const userDoc of userDocs) {
    const uid = userDoc.id;
    const petsSnap = args.petId
      ? await db.collection('users').doc(uid).collection('pets').where(admin.firestore.FieldPath.documentId(), '==', args.petId).get()
      : await db.collection('users').doc(uid).collection('pets').get();

    for (const legacyPetDoc of petsSnap.docs) {
      const legacyPetId = legacyPetDoc.id;
      const legacyPet = legacyPetDoc.data();

      if (legacyPet?.migratedToPetId && !args.force) {
        console.log(`[skip] ${uid}/${legacyPetId} already migrated -> ${legacyPet.migratedToPetId}`);
        continue;
      }

      const sharedPetId = args.keepIds ? legacyPetId : db.collection('pets').doc().id;
      const counts = await migrateSinglePet({ uid, legacyPetId, sharedPetId, legacyPet, dryRun: args.dryRun });
      migratedPets += 1;
      copiedDocs += counts.copied;

      console.log(
        `${args.dryRun ? '[dry-run]' : '[migrated]'} ${uid}/${legacyPetId} -> pets/${sharedPetId} • copied=${counts.copied}`
      );
    }
  }

  console.log(
    `${args.dryRun ? 'DRY RUN' : 'Migration'} tamamlandı • pets=${migratedPets} copiedDocs=${copiedDocs}`
  );
}

async function migrateSinglePet({ uid, legacyPetId, sharedPetId, legacyPet, dryRun }) {
  const copied = { value: 0 };
  const ops = [];

  const sharedPetRef = db.collection('pets').doc(sharedPetId);
  const memberRef = sharedPetRef.collection('members').doc(uid);
  const membershipRef = db.collection('users').doc(uid).collection('petMemberships').doc(sharedPetId);
  const legacyPetRef = db.collection('users').doc(uid).collection('pets').doc(legacyPetId);

  ops.push({
    ref: sharedPetRef,
    data: {
      ...legacyPet,
      createdByUid: uid,
      legacyOwnerUid: uid,
      legacyPetId,
      migratedFromPath: `users/${uid}/pets/${legacyPetId}`,
      sharedModelEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: legacyPet.createdAt || FieldValue.serverTimestamp(),
    },
  });

  ops.push({
    ref: memberRef,
    data: {
      uid,
      role: 'owner',
      displayName: legacyPet.ownerName || null,
      notificationsEnabled: true,
      joinedAt: FieldValue.serverTimestamp(),
      addedByUid: uid,
    },
  });

  ops.push({
    ref: membershipRef,
    data: {
      petId: sharedPetId,
      role: 'owner',
      petName: legacyPet.name || 'Pet',
      species: legacyPet.species || null,
      joinedAt: FieldValue.serverTimestamp(),
      migratedFromPath: `users/${uid}/pets/${legacyPetId}`,
    },
  });

  const subcollections = ['reminders', 'weights', 'logs', 'expenses', 'events'];
  for (const sub of subcollections) {
    const snap = await legacyPetRef.collection(sub).get();
    snap.docs.forEach((d) => {
      ops.push({
        ref: sharedPetRef.collection(sub).doc(d.id),
        data: {
          ...d.data(),
          migratedFromPath: `users/${uid}/pets/${legacyPetId}/${sub}/${d.id}`,
          updatedAt: d.data().updatedAt || FieldValue.serverTimestamp(),
        },
      });
    });
  }

  // Marker on legacy pet to allow dual-read migration phase.
  ops.push({
    ref: legacyPetRef,
    data: {
      migratedToPetId: sharedPetId,
      migrationStatus: 'migrated',
      migratedAt: FieldValue.serverTimestamp(),
    },
    merge: true,
  });

  if (dryRun) {
    copied.value = ops.length;
    return { copied: copied.value };
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    const chunk = ops.slice(i, i + 400);
    chunk.forEach((op) => {
      batch.set(op.ref, op.data, { merge: op.merge !== false });
    });
    await batch.commit();
    copied.value += chunk.length;
  }

  return { copied: copied.value };
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    uid: '',
    petId: '',
    keepIds: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--dry-run') args.dryRun = true;
    if (t === '--uid') args.uid = argv[i + 1] || '';
    if (t === '--pet') args.petId = argv[i + 1] || '';
    if (t === '--keep-ids') args.keepIds = true;
    if (t === '--force') args.force = true;
  }
  return args;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Shared pets migration hatası:', err);
    process.exit(1);
  });

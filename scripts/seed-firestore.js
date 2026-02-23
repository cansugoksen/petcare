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

async function seed() {
  const now = admin.firestore.Timestamp.now();

  await db.collection('owners').doc('demo-owner').set(
    {
      name: 'Demo Kullanici',
      phone: '+90 555 000 00 00',
      createdAt: now,
      source: 'seed-script',
    },
    { merge: true }
  );

  await db.collection('pets').doc('demo-pet').set(
    {
      ownerId: 'demo-owner',
      name: 'Boncuk',
      species: 'cat',
      age: 3,
      vaccinated: true,
      createdAt: now,
      source: 'seed-script',
    },
    { merge: true }
  );

  await db.collection('appointments').doc('demo-appointment').set(
    {
      ownerId: 'demo-owner',
      petId: 'demo-pet',
      status: 'scheduled',
      service: 'general-checkup',
      appointmentAt: now,
      createdAt: now,
      source: 'seed-script',
    },
    { merge: true }
  );

  console.log('Firestore seed tamamlandi. Koleksiyonlar: owners, pets, appointments');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed hatasi:', error);
    process.exit(1);
  });

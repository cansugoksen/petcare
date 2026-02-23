const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const DEFAULT_TZ = 'Europe/Istanbul';
const BATCH_LIMIT = 200;
const LOOKBACK_MINUTES = 10;

exports.processReminderNotifications = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: DEFAULT_TZ,
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const now = new Date();
    const lookback = new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000);

    logger.info('Reminder scheduler started', {
      now: now.toISOString(),
      lookback: lookback.toISOString(),
    });

    const remindersQuery = db
      .collectionGroup('reminders')
      .where('active', '==', true)
      .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(now))
      .orderBy('dueDate', 'asc')
      .limit(BATCH_LIMIT);

    const reminderSnap = await remindersQuery.get();
    if (reminderSnap.empty) {
      logger.info('No due reminders found');
      return;
    }

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const doc of reminderSnap.docs) {
      try {
        const reminder = { id: doc.id, ...doc.data() };

        if (!shouldNotifyReminder(reminder, now, lookback)) {
          skippedCount += 1;
          continue;
        }

        const path = parseReminderPath(doc.ref.path);
        if (!path) {
          logger.warn('Unexpected reminder path', { path: doc.ref.path });
          skippedCount += 1;
          continue;
        }

        const tokens = await loadUserTokens(path.uid);
        if (tokens.length === 0) {
          logger.info('No device tokens for user', { uid: path.uid, reminderId: doc.id });
          await markReminderNotified(doc.ref, reminder, now);
          skippedCount += 1;
          continue;
        }

        const sendResult = await sendReminderNotification({
          reminder,
          tokens,
          petId: path.petId,
          petName: reminder.petName || '',
        });

        await handlePostSend({
          reminderRef: doc.ref,
          reminder,
          now,
          sendResult,
        });

        if (sendResult.successCount > 0) {
          sentCount += 1;
        } else {
          failedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        logger.error('Reminder processing failed', {
          reminderId: doc.id,
          path: doc.ref.path,
          error: error.message,
          stack: error.stack,
        });
      }
    }

    logger.info('Reminder scheduler completed', {
      total: reminderSnap.size,
      sentCount,
      skippedCount,
      failedCount,
    });
  }
);

function parseReminderPath(path) {
  const parts = path.split('/');
  // users/{uid}/pets/{petId}/reminders/{reminderId}
  if (parts.length !== 6 || parts[0] !== 'users' || parts[2] !== 'pets' || parts[4] !== 'reminders') {
    return null;
  }

  return {
    uid: parts[1],
    petId: parts[3],
    reminderId: parts[5],
  };
}

function shouldNotifyReminder(reminder, now, lookback) {
  const dueDate = toJsDate(reminder.dueDate);
  if (!dueDate) {
    return false;
  }

  if (dueDate > now) {
    return false;
  }

  // Çok eski bir reminder'ı sonsuza kadar tekrar işlememek için pencere kısıtı.
  if (dueDate < lookback && !isRepeating(reminder.repeatType)) {
    return false;
  }

  const lastNotifiedAt = toJsDate(reminder.lastNotifiedAt);
  if (!lastNotifiedAt) {
    return true;
  }

  // Aynı dueDate için tekrar bildirim göndermeyi engelle.
  return lastNotifiedAt.getTime() < dueDate.getTime();
}

async function loadUserTokens(uid) {
  const snap = await db.collection('users').doc(uid).collection('deviceTokens').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => typeof item.token === 'string' && item.token.trim())
    .map((item) => ({
      token: item.token.trim(),
      platform: item.platform || '',
      provider: item.provider || '',
      ref: dRef(uid, item.id),
    }));
}

function dRef(uid, tokenId) {
  return db.collection('users').doc(uid).collection('deviceTokens').doc(tokenId);
}

async function sendReminderNotification({ reminder, tokens, petId, petName }) {
  const dueDate = toJsDate(reminder.dueDate);
  const title = `PetCare • ${translateReminderType(reminder.type)}`;
  const body = `${petName ? `${petName}: ` : ''}${reminder.title || 'Hatirlatma'}${
    dueDate ? ` (${formatTimeTR(dueDate)})` : ''
  }`;

  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: {
      title,
      body,
    },
    data: {
      type: 'reminder_due',
      reminderId: String(reminder.id),
      petId: String(petId || reminder.petId || ''),
      reminderType: String(reminder.type || ''),
      screen: 'petDetail',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'petcare-reminders',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
      headers: {
        'apns-priority': '10',
      },
    },
  });

  // Geçersiz tokenları temizle
  const cleanupOps = [];
  response.responses.forEach((r, idx) => {
    if (r.success) {
      return;
    }

    const code = r.error?.code || '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token')
    ) {
      cleanupOps.push(tokens[idx].ref.delete());
    }
  });

  if (cleanupOps.length) {
    await Promise.allSettled(cleanupOps);
  }

  return response;
}

async function handlePostSend({ reminderRef, reminder, now, sendResult }) {
  const patch = {
    lastNotifiedAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (sendResult.successCount > 0) {
    const nextDueDate = computeNextDueDate(reminder, toJsDate(reminder.dueDate) || now);
    if (nextDueDate) {
      patch.dueDate = admin.firestore.Timestamp.fromDate(nextDueDate);
    } else {
      patch.active = false;
    }
  }

  await reminderRef.set(patch, { merge: true });
}

async function markReminderNotified(reminderRef, reminder, now) {
  const nextDueDate = computeNextDueDate(reminder, toJsDate(reminder.dueDate) || now);
  const patch = {
    lastNotifiedAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (nextDueDate) {
    patch.dueDate = admin.firestore.Timestamp.fromDate(nextDueDate);
  } else {
    patch.active = false;
  }

  await reminderRef.set(patch, { merge: true });
}

function computeNextDueDate(reminder, baseDueDate) {
  const repeatType = reminder.repeatType || 'none';
  if (!isRepeating(repeatType)) {
    return null;
  }

  const next = new Date(baseDueDate.getTime());

  if (repeatType === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (repeatType === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  if (repeatType === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  if (repeatType === 'customDays') {
    const interval = Number(reminder.customDaysInterval);
    if (!Number.isFinite(interval) || interval < 1) {
      return null;
    }
    next.setDate(next.getDate() + interval);
    return next;
  }

  return null;
}

function isRepeating(repeatType) {
  return ['weekly', 'monthly', 'yearly', 'customDays'].includes(repeatType);
}

function toJsDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function translateReminderType(type) {
  if (type === 'vaccine') {
    return 'Asi';
  }
  if (type === 'medication') {
    return 'Ilac';
  }
  if (type === 'vetVisit') {
    return 'Veteriner';
  }
  return 'Hatirlatma';
}

function formatTimeTR(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

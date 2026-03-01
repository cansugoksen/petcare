const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const DEFAULT_TZ = 'Europe/Istanbul';
const BATCH_LIMIT = 200;
const LOOKBACK_MINUTES = 10;
const AI_RECENT_LIMIT = 20;
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

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

exports.generateAiAssistantSummary = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [OPENAI_API_KEY],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Oturum doğrulaması gerekli.');
    }

    const petId = String(request.data?.petId || '').trim();
    const task = String(request.data?.task || '').trim();
    const prompt = String(request.data?.prompt || '');

    if (!petId) {
      throw new HttpsError('invalid-argument', 'petId gerekli.');
    }

    if (!['healthSummary', 'vetSummary', 'reminderHelper', 'riskAnalysis'].includes(task)) {
      throw new HttpsError('invalid-argument', 'Geçersiz görev tipi.');
    }

    const petRef = db.collection('users').doc(uid).collection('pets').doc(petId);
    const [petSnap, logsSnap, remindersSnap, weightsSnap, expensesSnap] = await Promise.all([
      petRef.get(),
      petRef.collection('logs').orderBy('loggedAt', 'desc').limit(AI_RECENT_LIMIT).get(),
      petRef.collection('reminders').orderBy('dueDate', 'asc').limit(AI_RECENT_LIMIT).get(),
      petRef.collection('weights').orderBy('measuredAt', 'desc').limit(AI_RECENT_LIMIT).get(),
      petRef.collection('expenses').orderBy('expenseDate', 'desc').limit(AI_RECENT_LIMIT).get(),
    ]);

    if (!petSnap.exists) {
      throw new HttpsError('not-found', 'Pet bulunamadı.');
    }

    const pet = { id: petSnap.id, ...petSnap.data() };
    const logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const reminders = remindersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const weights = weightsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let result;
    if (task === 'healthSummary') {
      result = buildAiHealthSummary(pet, logs);
    } else if (task === 'vetSummary') {
      result = buildAiVetSummary(pet, logs, reminders, weights);
    } else if (task === 'riskAnalysis') {
      result = buildAiRiskAnalysis(pet, logs, reminders, weights, expenses);
    } else {
      result = buildAiReminderSuggestion(pet, prompt);
    }

    const aiResult = await tryGenerateOpenAiSummary({
      task,
      pet,
      logs,
      reminders,
      weights,
      expenses,
      prompt,
      fallback: result,
    });

    return {
      ...(aiResult || result),
      source: aiResult ? 'openai' : 'server',
      generatedAt: new Date().toISOString(),
    };
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
  const body = `${petName ? `${petName}: ` : ''}${reminder.title || 'Hatırlatma'}${
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
    return 'Aşı';
  }
  if (type === 'medication') {
    return 'İlaç';
  }
  if (type === 'vetVisit') {
    return 'Veteriner';
  }
  return 'Hatırlatma';
}

function formatTimeTR(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildAiHealthSummary(pet, logs) {
  const tagLabels = {
    appetite: 'İştah',
    vomiting: 'Kusma',
    lethargy: 'Halsizlik',
    behavior: 'Davranış',
  };

  const now = Date.now();
  const last14Days = now - 14 * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter((log) => (toJsDate(log.loggedAt)?.getTime() || 0) >= last14Days);

  const tagCounts = {};
  for (const row of recentLogs) {
    for (const tag of Array.isArray(row.tags) ? row.tags : []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const highlights = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => `${tagLabels[tag] || tag}: ${count}`);

  const latest = logs[0];
  const latestDate = latest ? formatDateTR(toJsDate(latest.loggedAt) || toJsDate(latest.createdAt), true) : 'Kayıt yok';
  const recentNotes = recentLogs
    .filter((row) => String(row.note || '').trim())
    .slice(0, 3)
    .map((row) => `${formatDateTR(toJsDate(row.loggedAt) || toJsDate(row.createdAt))} • ${String(row.note || '').trim()}`);

  return {
    title: `${pet.name || 'Pet'} için Sağlık Özeti`,
    meta: 'Sunucu özeti',
    highlights: highlights.length ? highlights : ['Belirti etiketi yoğunluğu düşük'],
    sections: [
      {
        title: 'Genel Durum',
        items: [
          `Son 14 günde ${recentLogs.length} sağlık kaydı bulundu.`,
          `En son sağlık kaydı: ${latestDate}`,
          highlights.length ? 'Tekrarlayan etiketler takip edilmeli.' : 'Tekrarlayan etiket görünmüyor.',
        ],
      },
      {
        title: 'Son Notlar',
        items: recentNotes.length ? recentNotes : ['Son 14 günde metin notu bulunmuyor.'],
      },
    ],
  };
}

function buildAiVetSummary(pet, logs, reminders, weights) {
  const latestWeight = weights[0];
  const activeReminders = reminders.filter((r) => r.active);
  const upcoming = activeReminders
    .filter((r) => (toJsDate(r.dueDate)?.getTime() || 0) >= Date.now())
    .slice(0, 3);
  const recentLogs = logs.slice(0, 5);

  return {
    title: `${pet.name || 'Pet'} için Veteriner Özeti`,
    meta: 'Sunucu özeti',
    highlights: [
      latestWeight ? `Son kilo: ${latestWeight.weight} kg` : 'Kilo kaydı yok',
      `${activeReminders.length} aktif hatırlatma`,
      `${recentLogs.length} sağlık notu`,
    ],
    sections: [
      {
        title: 'Ziyaret Öncesi',
        items: [
          `Pet: ${pet.name || '-'} (${translateSpecies(pet.species)})`,
          latestWeight
            ? `Son kilo: ${latestWeight.weight} kg (${formatDateTR(toJsDate(latestWeight.measuredAt) || toJsDate(latestWeight.createdAt))})`
            : 'Kilo ölçümü kaydı bulunmuyor.',
          recentLogs.length ? 'Son sağlık notları aşağıda özetlenmiştir.' : 'Sağlık notu bulunmuyor.',
        ],
      },
      {
        title: 'Yaklaşan Hatırlatmalar',
        items: upcoming.length
          ? upcoming.map((r) => `${translateReminderType(r.type)} • ${r.title || '-'} • ${formatDateTR(toJsDate(r.dueDate), true)}`)
          : ['Yaklaşan aktif hatırlatma bulunmuyor.'],
      },
      {
        title: 'Son Sağlık Notları',
        items: recentLogs.length
          ? recentLogs.map((row) => {
              const tags = Array.isArray(row.tags) && row.tags.length ? ` [${row.tags.map((t) => translateTag(t)).join(', ')}]` : '';
              const note = String(row.note || '').trim();
              return `${formatDateTR(toJsDate(row.loggedAt) || toJsDate(row.createdAt))}${tags}${note ? ` • ${note}` : ''}`;
            })
          : ['Sağlık notu bulunmuyor.'],
      },
    ],
  };
}

function buildAiReminderSuggestion(pet, inputRaw) {
  const input = String(inputRaw || '').trim();
  if (!input) {
    return {
      title: 'Hatırlatma Yardımcısı',
      meta: 'Sunucu önerisi',
      highlights: ['Metin gerekli'],
      sections: [
        {
          title: 'Örnek Komutlar',
          items: [
            'Her gün 20:00 ilaç hatırlatması',
            '1 ay sonra veteriner kontrolü',
            'Senede bir aşı hatırlatması',
          ],
        },
      ],
    };
  }

  const lower = input.toLocaleLowerCase('tr-TR');
  const type =
    lower.includes('veteriner') || lower.includes('vet')
      ? 'vetVisit'
      : lower.includes('ilaç') || lower.includes('ilac')
        ? 'medication'
        : 'vaccine';

  let repeat = 'Tek sefer';
  if (lower.includes('her gün') || lower.includes('hergun')) {
    repeat = 'Özel (1 günde bir)';
  } else if (lower.includes('hafta')) {
    repeat = 'Haftalık';
  } else if (lower.includes('ay')) {
    repeat = 'Aylık';
  } else if (lower.includes('yıl') || lower.includes('yil')) {
    repeat = 'Yıllık';
  }

  const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})/);
  const due = new Date();
  if (timeMatch) {
    due.setHours(Math.min(23, Number(timeMatch[1])), Math.min(59, Number(timeMatch[2])), 0, 0);
    if (due.getTime() < Date.now()) due.setDate(due.getDate() + 1);
  } else {
    due.setHours(due.getHours() + 1, 0, 0, 0);
  }

  return {
    title: 'Hatırlatma Yardımcısı Önerisi',
    meta: 'Sunucu önerisi',
    highlights: [translateReminderType(type), repeat, timeMatch ? 'Saat algılandı' : 'Varsayılan saat'],
    sections: [
      {
        title: 'Önerilen Alanlar',
        items: [
          `Başlık: ${(pet.name || 'Pet') + ' • ' + translateReminderType(type)}`,
          `Tür: ${translateReminderType(type)}`,
          `Tekrar: ${repeat}`,
          `Önerilen zaman: ${formatDateTR(due, true)}`,
        ],
      },
      {
        title: 'Not',
        items: ['Bu öneri taslaktır. Reminder formunda tarih/saat ve tekrar tipini kontrol edin.'],
      },
    ],
  };
}

function buildAiRiskAnalysis(pet, logs, reminders, weights, expenses) {
  const findings = [];

  const weightRisk = serverAnalyzeWeightChange90d(weights);
  if (weightRisk) findings.push(weightRisk);

  const vetGapRisk = serverAnalyzeVetGap(reminders, expenses, logs);
  if (vetGapRisk) findings.push(vetGapRisk);

  const vaccineDelayRisk = serverAnalyzeVaccineDelay(reminders);
  if (vaccineDelayRisk) findings.push(vaccineDelayRisk);

  const expenseSpikeRisk = serverAnalyzeExpenseSpike(expenses);
  if (expenseSpikeRisk) findings.push(expenseSpikeRisk);

  const severity = highestSeverityLevel(findings.map((f) => f.severity));
  const generatedAt = new Date().toLocaleString('tr-TR');

  return {
    title: `${pet.name || 'Pet'} için Sağlık Risk Analizi`,
    meta: 'Sunucu kurallı analiz',
    severity,
    highlights: findings.length
      ? findings.map((f) => `${severityLabelTR(f.severity)} • ${f.short}`)
      : ['Belirgin risk sinyali bulunmadı', 'Düzenli takip sürdürülüyor'],
    sections: findings.length
      ? [
          {
            title: 'Tespit Edilen Sinyaller',
            items: findings.map((f) => `${severityLabelTR(f.severity)}: ${f.description}`),
          },
          {
            title: 'Öneriler',
            items: uniqueStrings(findings.flatMap((f) => f.recommendations || [])),
          },
        ]
      : [
          {
            title: 'Özet',
            items: [
              'Mevcut kayıtlarda yüksek öncelikli bir risk sinyali tespit edilmedi.',
              'Düzenli kilo, not ve hatırlatma takibi önerilir.',
            ],
          },
        ],
    shareText: buildServerRiskShareText(pet, severity, findings, generatedAt),
  };
}

function serverAnalyzeWeightChange90d(weights) {
  const rows = (weights || [])
    .map((w) => ({
      value: Number(w.valueKg ?? w.weight),
      date: toJsDate(w.measuredAt) || toJsDate(w.createdAt),
    }))
    .filter((w) => Number.isFinite(w.value) && w.date)
    .sort((a, b) => a.date - b.date);

  if (rows.length < 2) return null;
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const in90 = rows.filter((r) => r.date.getTime() >= cutoff);
  if (in90.length < 2) return null;

  const first = in90[0];
  const last = in90[in90.length - 1];
  if (!first.value) return null;
  const changePct = ((last.value - first.value) / first.value) * 100;

  if (changePct <= -10) {
    return {
      severity: 'high',
      short: '90 günde kilo düşüşü',
      description: `Son 90 günde kilo yaklaşık %${Math.abs(changePct).toFixed(1)} azalmış görünüyor (${first.value} kg → ${last.value} kg).`,
      recommendations: ['Kilo ölçümlerini doğrulayın ve veteriner görüşü planlayın.'],
    };
  }
  if (changePct <= -5) {
    return {
      severity: 'medium',
      short: 'Kilo düşüş trendi',
      description: `Son 90 günde kilo yaklaşık %${Math.abs(changePct).toFixed(1)} azalmış görünüyor.`,
      recommendations: ['Kilo takibini sıklaştırarak sağlık notları ile birlikte izleyin.'],
    };
  }
  return null;
}

function serverAnalyzeVetGap(reminders, expenses, logs) {
  const dates = [];
  (reminders || []).forEach((r) => {
    if (r.type === 'vetVisit') {
      const d = toJsDate(r.dueDate);
      if (d) dates.push(d.getTime());
    }
  });
  (expenses || []).forEach((e) => {
    if (e.category === 'vet') {
      const d = toJsDate(e.expenseDate);
      if (d) dates.push(d.getTime());
    }
  });
  (logs || []).forEach((l) => {
    const note = String(l.note || '').toLocaleLowerCase('tr-TR');
    if (note.includes('vet') || note.includes('veteriner')) {
      const d = toJsDate(l.loggedAt) || toJsDate(l.createdAt);
      if (d) dates.push(d.getTime());
    }
  });

  if (!dates.length) {
    return {
      severity: 'medium',
      short: 'Veteriner kaydı yok',
      description: 'Kayıtlarda veteriner ziyareti veya veteriner gideri görünmüyor.',
      recommendations: ['Rutin veteriner kontrol periyodunu takvime ekleyin.'],
    };
  }

  const gapDays = Math.floor((Date.now() - Math.max(...dates)) / (24 * 60 * 60 * 1000));
  if (gapDays >= 365) {
    return {
      severity: 'high',
      short: 'Veteriner kaydı uzun süredir yok',
      description: `Son veteriner ilişkili kayıt yaklaşık ${gapDays} gün önce.`,
      recommendations: ['Rutin kontrol ziyareti planlamayı değerlendirin.'],
    };
  }
  if (gapDays >= 180) {
    return {
      severity: 'medium',
      short: 'Veteriner kaydı 6+ ay',
      description: `Son veteriner ilişkili kayıt yaklaşık ${gapDays} gün önce.`,
      recommendations: ['Takvim ve hatırlatmaları gözden geçirerek kontrol tarihi planlayın.'],
    };
  }
  return null;
}

function serverAnalyzeVaccineDelay(reminders) {
  const now = Date.now();
  const overdue = (reminders || []).filter((r) => {
    if (!r.active || r.type !== 'vaccine') return false;
    const due = toJsDate(r.dueDate)?.getTime() || 0;
    return due > 0 && due < now;
  });
  if (!overdue.length) return null;
  overdue.sort((a, b) => (toJsDate(a.dueDate)?.getTime() || 0) - (toJsDate(b.dueDate)?.getTime() || 0));
  const oldestTs = toJsDate(overdue[0].dueDate)?.getTime() || now;
  const lateDays = Math.max(1, Math.floor((now - oldestTs) / (24 * 60 * 60 * 1000)));

  return {
    severity: lateDays >= 30 ? 'high' : 'medium',
    short: 'Aşı gecikmesi',
    description: `${overdue.length} aktif aşı hatırlatması geçmiş tarihte görünüyor. En eski gecikme yaklaşık ${lateDays} gün.`,
    recommendations: ['Aşı tarihlerini doğrulayın ve gerekirse veterinere danışın.'],
  };
}

function serverAnalyzeExpenseSpike(expenses) {
  const now = Date.now();
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  let current = 0;
  let previous = 0;

  (expenses || []).forEach((e) => {
    const ts = toJsDate(e.expenseDate)?.getTime() || 0;
    const amount = Number(e.amount || 0);
    if (!ts || !Number.isFinite(amount)) return;
    if (ts >= now - ms30) current += amount;
    else if (ts >= now - ms30 * 2) previous += amount;
  });

  if (current <= 0 || previous <= 0) return null;
  const ratio = current / previous;
  if (ratio >= 2) {
    return {
      severity: 'medium',
      short: 'Gider artışı',
      description: `Son 30 gün giderleri önceki 30 güne göre yaklaşık ${ratio.toFixed(1)} kat artmış görünüyor.`,
      recommendations: ['Gider dağılımını kategori bazında inceleyin.'],
    };
  }
  if (ratio >= 1.5) {
    return {
      severity: 'low',
      short: 'Gider trendi yükseliyor',
      description: `Son 30 gün giderleri önceki döneme göre artış gösteriyor (${ratio.toFixed(1)}x).`,
      recommendations: ['Aylık giderleri takip ederek artış nedenini not edin.'],
    };
  }
  return null;
}

function highestSeverityLevel(levels) {
  if ((levels || []).includes('high')) return 'high';
  if ((levels || []).includes('medium')) return 'medium';
  return 'low';
}

function severityLabelTR(level) {
  if (level === 'high') return 'Yüksek';
  if (level === 'medium') return 'Orta';
  return 'Düşük';
}

function uniqueStrings(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function buildServerRiskShareText(pet, severity, findings, generatedAt) {
  const lines = [
    `PetCare Risk Analizi (${generatedAt})`,
    `Pet: ${pet?.name || 'Pet'}`,
    `Risk Seviyesi: ${severityLabelTR(severity)}`,
    '',
  ];
  if (findings.length) {
    lines.push('Tespitler:');
    findings.forEach((f) => lines.push(`- ${severityLabelTR(f.severity)}: ${f.description}`));
    lines.push('');
    lines.push('Öneriler:');
    uniqueStrings(findings.flatMap((f) => f.recommendations || [])).forEach((r) => lines.push(`- ${r}`));
  } else {
    lines.push('Belirgin risk sinyali tespit edilmedi.');
  }
  lines.push('');
  lines.push('Not: Bu analiz bilgilendirme amaçlıdır, veteriner değerlendirmesinin yerine geçmez.');
  return lines.join('\n');
}

function translateTag(tag) {
  if (tag === 'appetite') return 'İştah';
  if (tag === 'vomiting') return 'Kusma';
  if (tag === 'lethargy') return 'Halsizlik';
  if (tag === 'behavior') return 'Davranış';
  return tag || '-';
}

function translateSpecies(species) {
  if (species === 'dog') return 'Köpek';
  if (species === 'cat') return 'Kedi';
  if (species === 'bird') return 'Kuş';
  return 'Pet';
}

function formatDateTR(date, withTime = false) {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat(
    'tr-TR',
    withTime
      ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' }
  ).format(date);
}

async function tryGenerateOpenAiSummary({ task, pet, logs, reminders, weights, expenses, prompt, fallback }) {
  const apiKey = getOpenAiApiKeySafe();
  if (!apiKey) {
    return null;
  }

  try {
    const payload = buildOpenAiPayload({ task, pet, logs, reminders, weights, expenses, prompt, fallback });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Sen PetCare için yardımcı asistansın. Türkçe yaz. Teşhis koyma, tedavi önerme, veteriner yerine geçme. Kısa ve maddeli yaz. Sadece geçerli JSON dön. JSON formatı: {title, meta, severity?, shareText?, highlights:string[], sections:[{title, items:string[]}]}',
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await safeReadText(response);
      logger.warn('OpenAI call failed', { status: response.status, body: errorText?.slice(0, 800) });
      return null;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    const parsed = safeParseJson(content);
    if (!isValidAiOutput(parsed)) {
      logger.warn('OpenAI response invalid shape');
      return null;
    }

    return normalizeAiOutput(parsed);
  } catch (error) {
    logger.warn('OpenAI summary generation failed', { error: error.message });
    return null;
  }
}

function getOpenAiApiKeySafe() {
  try {
    const secretVal = OPENAI_API_KEY.value();
    if (typeof secretVal === 'string' && secretVal.trim()) {
      return secretVal.trim();
    }
  } catch {
    // secret local/dev yoksa sessizce fallback
  }

  if (typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  return null;
}

function buildOpenAiPayload({ task, pet, logs, reminders, weights, expenses, prompt, fallback }) {
  return {
    task,
    prompt: String(prompt || '').slice(0, 600),
    pet: {
      name: pet?.name || 'Pet',
      species: translateSpecies(pet?.species),
      gender: pet?.gender || null,
      breed: pet?.breed || null,
    },
    data: {
      recentLogs: logs.slice(0, 10).map((row) => ({
        date: formatDateTR(toJsDate(row.loggedAt) || toJsDate(row.createdAt)),
        tags: (Array.isArray(row.tags) ? row.tags : []).map((t) => translateTag(t)),
        note: String(row.note || '').trim().slice(0, 220),
      })),
      activeReminders: reminders
        .filter((r) => r.active)
        .slice(0, 10)
        .map((r) => ({
          title: String(r.title || ''),
          type: translateReminderType(r.type),
          dueDate: formatDateTR(toJsDate(r.dueDate), true),
          repeatType: String(r.repeatType || 'none'),
        })),
      recentWeights: weights.slice(0, 6).map((w) => ({
        weight: Number(w.weight || 0),
        date: formatDateTR(toJsDate(w.measuredAt) || toJsDate(w.createdAt)),
      })),
      recentExpenses: (expenses || []).slice(0, 8).map((e) => ({
        amount: Number(e.amount || 0),
        category: String(e.category || 'other'),
        date: formatDateTR(toJsDate(e.expenseDate) || toJsDate(e.createdAt)),
      })),
    },
    fallbackDraft: fallback,
    guardrails: [
      'Teşhis koyma',
      'Tedavi/ilaç dozu önermeyin',
      'Acil belirtilerde veterinere yönlendir',
      'Kısa ve maddeli yaz',
    ],
  };
}

function safeParseJson(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isValidAiOutput(obj) {
  return obj && typeof obj === 'object' && typeof obj.title === 'string' && Array.isArray(obj.highlights) && Array.isArray(obj.sections);
}

function normalizeAiOutput(obj) {
  return {
    title: String(obj.title || 'AI Özeti').slice(0, 120),
    meta: typeof obj.meta === 'string' ? obj.meta.slice(0, 120) : 'OpenAI özeti',
    severity: ['low', 'medium', 'high'].includes(String(obj.severity || '')) ? String(obj.severity) : undefined,
    shareText: typeof obj.shareText === 'string' ? obj.shareText.slice(0, 4000) : undefined,
    highlights: (Array.isArray(obj.highlights) ? obj.highlights : [])
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, 6),
    sections: (Array.isArray(obj.sections) ? obj.sections : [])
      .map((section) => ({
        title: String(section?.title || 'Bölüm').slice(0, 80),
        items: (Array.isArray(section?.items) ? section.items : [])
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 8),
      }))
      .filter((section) => section.items.length),
  };
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}


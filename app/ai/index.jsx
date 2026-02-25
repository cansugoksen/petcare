import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme, healthLogTags } from '@/constants/petcare-theme';
import { formatDateOnly, formatDateTime, toDate } from '@/lib/date-utils';
import { generateAiAssistantSummary } from '@/lib/ai-assistant';
import {
  subscribeHealthLogs,
  subscribePets,
  subscribeReminders,
  subscribeWeights,
} from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const TASKS = [
  {
    key: 'healthSummary',
    icon: 'description',
    title: 'Sağlık Özeti',
    description: 'Son kayıtları özetler ve tekrar eden belirtileri listeler.',
  },
  {
    key: 'vetSummary',
    icon: 'medical-services',
    title: 'Veteriner Ziyareti Özeti',
    description: 'Kilo, son notlar ve aktif hatırlatmaları tek özet halinde sunar.',
  },
  {
    key: 'reminderHelper',
    icon: 'auto-awesome',
    title: 'Hatırlatma Yardımcısı',
    description: 'Yazdığınız metinden hatırlatma önerisi oluşturur.',
  },
];

const tagLabelMap = Object.fromEntries(healthLogTags.map((tag) => [tag.key, tag.label]));

export default function AiAssistantRoute() {
  return (
    <AuthGate>
      <AiAssistantScreen />
    </AuthGate>
  );
}

function AiAssistantScreen() {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [weights, setWeights] = useState([]);
  const [activeTask, setActiveTask] = useState('healthSummary');
  const [assistantInput, setAssistantInput] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastSource, setLastSource] = useState('local');

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    return subscribePets(
      user.uid,
      (rows) => {
        setPets(rows);
        setError(null);
      },
      (err) => setError(err)
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!pets.length) {
      setSelectedPetId(null);
      return;
    }

    setSelectedPetId((prev) => (prev && pets.some((pet) => pet.id === prev) ? prev : pets[0].id));
  }, [pets]);

  useEffect(() => {
    if (!user?.uid || !selectedPetId) {
      setLogs([]);
      setReminders([]);
      setWeights([]);
      return undefined;
    }

    const unsubs = [
      subscribeHealthLogs(user.uid, selectedPetId, setLogs, () => {}),
      subscribeReminders(user.uid, selectedPetId, setReminders, () => {}),
      subscribeWeights(user.uid, selectedPetId, setWeights, () => {}),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub?.());
    };
  }, [user?.uid, selectedPetId]);

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) || null, [pets, selectedPetId]);

  const quickStats = useMemo(() => {
    const now = Date.now();
    const next7d = now + 7 * 24 * 60 * 60 * 1000;
    const activeUpcoming = reminders.filter((item) => {
      const due = toDate(item.dueDate)?.getTime() ?? 0;
      return item.active && due >= now;
    });
    const thisWeek = activeUpcoming.filter((item) => {
      const due = toDate(item.dueDate)?.getTime() ?? 0;
      return due <= next7d;
    });
    return {
      logs: logs.length,
      reminders: activeUpcoming.length,
      remindersThisWeek: thisWeek.length,
      weights: weights.length,
    };
  }, [logs, reminders, weights]);

  const handleRun = async () => {
    if (!selectedPet) {
      Alert.alert('Pet seçin', 'Önce bir pet seçmeniz gerekiyor.');
      return;
    }

    try {
      setBusy(true);
      setResult(null);

      let next = null;
      let source = 'server';

      try {
        next = await generateAiAssistantSummary({
          petId: selectedPet.id,
          task: activeTask,
          prompt: assistantInput,
        });
      } catch {
        source = 'local';
      }

      if (!next) {
        if (activeTask === 'healthSummary') {
          next = buildHealthSummary(selectedPet, logs);
        } else if (activeTask === 'vetSummary') {
          next = buildVetVisitSummary(selectedPet, logs, reminders, weights);
        } else {
          next = buildReminderSuggestion(selectedPet, assistantInput);
        }
      }

      if (next?.source === 'openai') {
        source = 'openai';
      } else if (next?.source === 'server') {
        source = 'server';
      }

      if (source === 'local') {
        next = {
          ...next,
          meta: `${next.meta || ''}${next.meta ? ' • ' : ''}Yerel yedek mod`,
          highlights: Array.from(new Set([...(next.highlights || []), 'Sunucu bağlantısı bekleniyor'])),
        };
      }

      setLastSource(source);
      setResult(next);
    } catch (err) {
      Alert.alert('AI Asistan', err.message || 'Özet hazırlanırken bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="AI Asistan"
      subtitle="Kayıtlarınızı özetleyen ve hatırlatma girişini kolaylaştıran yardımcı araçlar."
      right={
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.82 }]}>
          <MaterialIcons name="close" size={20} color={PetCareTheme.colors.textMuted} />
        </Pressable>
      }>
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIconWrap}>
            <MaterialIcons name="auto-awesome" size={20} color="#2C6FA7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>PetCare AI V2 Başlangıç</Text>
            <Text style={styles.heroText}>
              Bu ekran ilk aşamada yerel verilerinizden özet üretir. Sunucu tarafı AI entegrasyonu sonraki aşamada bağlanacaktır.
            </Text>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <StatBadge icon="description" label={`${quickStats.logs} log`} />
          <StatBadge icon="notifications-active" label={`${quickStats.remindersThisWeek} bu hafta`} />
      <StatBadge icon="timeline" label={`${quickStats.weights} kilo`} />
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>Veriler alınamadı: {error.message}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Pet Seçimi</Text>
        {!pets.length ? (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="pets" size={22} color="#6A879B" />
            <Text style={styles.emptyTitle}>Henüz pet bulunmuyor</Text>
            <Text style={styles.emptyText}>AI araçlarını kullanmak için önce bir pet profili ekleyin.</Text>
            <Button title="Pet Ekle" onPress={() => router.push('/pets/new')} />
          </View>
        ) : (
          <View style={styles.petChipWrap}>
            {pets.map((pet) => (
              <Pressable
                key={pet.id}
                onPress={() => setSelectedPetId(pet.id)}
                style={({ pressed }) => [
                  styles.petChipBtn,
                  selectedPetId === pet.id && styles.petChipBtnActive,
                  pressed && { opacity: 0.92 },
                ]}>
                <MaterialIcons
                  name="pets"
                  size={14}
                  color={selectedPetId === pet.id ? '#0F5B51' : '#5E7D91'}
                />
                <Text style={[styles.petChipLabel, selectedPetId === pet.id && styles.petChipLabelActive]} numberOfLines={1}>
                  {pet.name || 'Pet'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {pets.length ? (
        <>
          <Card>
            <Text style={styles.sectionTitle}>Araç Seçimi</Text>
            <View style={styles.taskGrid}>
              {TASKS.map((task) => (
                <Pressable
                  key={task.key}
                  onPress={() => setActiveTask(task.key)}
                  style={({ pressed }) => [
                    styles.taskCard,
                    activeTask === task.key && styles.taskCardActive,
                    pressed && { opacity: 0.95 },
                  ]}>
                  <View style={[styles.taskIconWrap, activeTask === task.key && styles.taskIconWrapActive]}>
                    <MaterialIcons
                      name={task.icon}
                      size={18}
                      color={activeTask === task.key ? PetCareTheme.colors.primary : '#5D7A8E'}
                    />
                  </View>
                  <Text style={[styles.taskTitle, activeTask === task.key && styles.taskTitleActive]}>{task.title}</Text>
                  <Text style={styles.taskText}>{task.description}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {activeTask === 'reminderHelper' ? (
            <Card>
              <Text style={styles.sectionTitle}>Hatırlatma Metni</Text>
              <Text style={styles.helperText}>
                Örnek: “Mavi için her gün akşam 20:00 ilaç hatırlatması kur” veya “1 ay sonra veteriner kontrolü”
              </Text>
              <Field
                label="Kısa komut"
                value={assistantInput}
                onChangeText={setAssistantInput}
                placeholder="Hatırlatma isteğinizi yazın"
                multiline
                autoCapitalize="sentences"
              />
            </Card>
          ) : null}

          <Card style={styles.runCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.runTitle}>Özet Hazırla</Text>
              <Text style={styles.runText}>
                {selectedPet ? `${selectedPet.name} için ${TASKS.find((t) => t.key === activeTask)?.title.toLowerCase()} oluşturulur.` : ''}
              </Text>
              <Text style={styles.runSubText}>
                Çalışma modu:{' '}
                {lastSource === 'openai' ? 'OpenAI (beta)' : lastSource === 'server' ? 'Sunucu (kurallı)' : 'Yerel yedek'}
              </Text>
            </View>
            <Button title={busy ? 'Hazırlanıyor...' : 'Çalıştır'} onPress={handleRun} loading={busy} style={{ minWidth: 118 }} />
          </Card>
        </>
      ) : null}

      {result ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.resultIconWrap}>
              <MaterialIcons name="psychology" size={18} color="#285E8D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>{result.title}</Text>
              <Text style={styles.resultMeta}>{result.meta}</Text>
            </View>
          </View>

          {result.highlights?.length ? (
            <View style={styles.highlightRow}>
              {result.highlights.map((item) => (
                <Chip key={item} label={item} tone="primary" />
              ))}
            </View>
          ) : null}

          {result.sections?.map((section) => (
            <View key={section.title} style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>{section.title}</Text>
              {section.items.map((line, idx) => (
                <View key={`${section.title}-${idx}`} style={styles.resultBulletRow}>
                  <View style={styles.resultDot} />
                  <Text style={styles.resultLine}>{line}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.disclaimerCard}>
            <MaterialIcons name="info-outline" size={16} color="#7B6505" />
            <Text style={styles.disclaimerText}>
              AI çıktıları bilgilendirme amaçlıdır, veteriner değerlendirmesinin yerine geçmez.
            </Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function buildHealthSummary(pet, logs) {
  const now = Date.now();
  const days14 = now - 14 * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter((log) => (toDate(log.loggedAt)?.getTime() ?? 0) >= days14);
  const tagCounts = {};
  for (const log of recentLogs) {
    const tags = Array.isArray(log.tags) ? log.tags : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => `${tagLabelMap[key] || key}: ${count}`);

  const latest = logs[0];
  const latestDate = latest ? formatDateTime(latest.loggedAt || latest.createdAt) : 'Kayıt yok';
  const notesWithText = recentLogs.filter((row) => String(row.note || '').trim()).slice(0, 3);

  return {
    title: `${pet.name} için Sağlık Özeti`,
    meta: `Yerel özet • ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
    highlights: topTags.length ? topTags : ['Son 14 gün kaydı sınırlı'],
    sections: [
      {
        title: 'Genel Durum',
        items: [
          `${recentLogs.length} sağlık kaydı son 14 gün içinde bulundu.`,
          `En son sağlık notu: ${latestDate}`,
          topTags.length ? 'Etiket tekrarları izleniyor.' : 'Belirti etiketi tekrarları henüz oluşmadı.',
        ],
      },
      {
        title: 'Son Notlardan Seçmeler',
        items: notesWithText.length
          ? notesWithText.map((row) => `${formatDateOnly(row.loggedAt || row.createdAt)} • ${String(row.note).trim()}`)
          : ['Son 14 günde metin notu bulunmuyor.'],
      },
    ],
  };
}

function buildVetVisitSummary(pet, logs, reminders, weights) {
  const lastWeight = weights[0];
  const activeReminders = reminders.filter((item) => item.active);
  const upcoming = activeReminders
    .filter((item) => (toDate(item.dueDate)?.getTime() ?? 0) >= Date.now())
    .slice(0, 3);
  const recentLogs = logs.slice(0, 5);

  return {
    title: `${pet.name} için Veteriner Ziyareti Özeti`,
    meta: `Yerel özet • ${new Date().toLocaleString('tr-TR')}`,
    highlights: [
      lastWeight ? `Son kilo: ${lastWeight.weight} kg` : 'Kilo kaydı yok',
      `${activeReminders.length} aktif hatırlatma`,
      `${recentLogs.length} son sağlık notu`,
    ],
    sections: [
      {
        title: 'Ziyaret Öncesi Kısa Özet',
        items: [
          `Pet: ${pet.name}${pet.species ? ` (${pet.species})` : ''}`,
          lastWeight
            ? `Son kilo ölçümü: ${lastWeight.weight} kg (${formatDateOnly(lastWeight.measuredAt || lastWeight.createdAt)})`
            : 'Son kilo ölçümü bulunmuyor.',
          recentLogs.length ? 'Son sağlık notları aşağıda listelendi.' : 'Sağlık notu kaydı bulunmuyor.',
        ],
      },
      {
        title: 'Yaklaşan Hatırlatmalar',
        items: upcoming.length
          ? upcoming.map((item) => {
              const typeLabel =
                item.type === 'medication' ? 'İlaç' : item.type === 'vetVisit' ? 'Veteriner' : item.type === 'vaccine' ? 'Aşı' : item.type || 'Hatırlatma';
              return `${typeLabel} • ${item.title || '-'} • ${formatDateTime(item.dueDate)}`;
            })
          : ['Yaklaşan aktif hatırlatma bulunmuyor.'],
      },
      {
        title: 'Son Sağlık Notları',
        items: recentLogs.length
          ? recentLogs.map((row) => {
              const tags = Array.isArray(row.tags) && row.tags.length ? ` [${row.tags.map((t) => tagLabelMap[t] || t).join(', ')}]` : '';
              const note = String(row.note || '').trim();
              return `${formatDateOnly(row.loggedAt || row.createdAt)}${tags}${note ? ` • ${note}` : ''}`;
            })
          : ['Henüz sağlık notu yok.'],
      },
    ],
  };
}

function buildReminderSuggestion(pet, rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) {
    return {
      title: 'Hatırlatma Yardımcısı',
      meta: 'Yerel öneri',
      highlights: ['Metin gerekli'],
      sections: [
        {
          title: 'Ne yapabilirsiniz?',
          items: [
            'Kısa bir metin yazın: “Her hafta ilaç hatırlatması”',
            'Saat belirtin: “20:30”',
            'Tür belirtin: aşı / ilaç / veteriner',
          ],
        },
      ],
    };
  }

  const text = input.toLocaleLowerCase('tr-TR');
  const type = text.includes('veteriner') || text.includes('vet') ? 'vetVisit' : text.includes('ilaç') || text.includes('ilac') ? 'medication' : 'vaccine';

  let repeat = 'Tek sefer';
  let repeatKey = 'none';
  if (text.includes('her gün') || text.includes('hergun') || text.includes('günde bir')) {
    repeat = 'Özel (1 günde bir)';
    repeatKey = 'customDays';
  } else if (text.includes('hafta')) {
    repeat = 'Haftalık';
    repeatKey = 'weekly';
  } else if (text.includes('ayda') || text.includes('her ay') || text.includes('aylık') || text.includes('aylik')) {
    repeat = 'Aylık';
    repeatKey = 'monthly';
  } else if (text.includes('yıl') || text.includes('yil') || text.includes('senede')) {
    repeat = 'Yıllık';
    repeatKey = 'yearly';
  }

  const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
  const suggestedDate = new Date();
  if (timeMatch) {
    suggestedDate.setHours(Math.min(23, Number(timeMatch[1])), Math.min(59, Number(timeMatch[2])), 0, 0);
    if (suggestedDate.getTime() < Date.now()) {
      suggestedDate.setDate(suggestedDate.getDate() + 1);
    }
  } else {
    suggestedDate.setHours(suggestedDate.getHours() + 1, 0, 0, 0);
  }

  const typeText = type === 'medication' ? 'İlaç' : type === 'vetVisit' ? 'Veteriner' : 'Aşı';
  const suggestedTitle = `${pet.name} • ${typeText}`;

  return {
    title: 'Hatırlatma Yardımcısı Önerisi',
    meta: `Yerel öneri • ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
    highlights: [typeText, repeat, timeMatch ? 'Saat algılandı' : 'Saat varsayılanı kullanıldı'],
    sections: [
      {
        title: 'Önerilen Alanlar',
        items: [
          `Başlık: ${suggestedTitle}`,
          `Tür: ${typeText}`,
          `Tekrar: ${repeat}`,
          `Önerilen zaman: ${formatDateTime(suggestedDate)}`,
        ],
      },
      {
        title: 'Not',
        items: [
          'Bu öneri otomatik oluşturuldu. Kayıt oluşturmadan önce tarih/saat ve tekrar tipini kontrol edin.',
          repeatKey === 'customDays' ? 'Mevcut reminder formunda “Özel gün aralığı” seçip 1 gün girebilirsiniz.' : 'Reminder formunda doğrudan düzenlenebilir.',
        ],
      },
    ],
  };
}

function StatBadge({ icon, label }) {
  return (
    <View style={styles.statBadge}>
      <MaterialIcons name={icon} size={14} color="#4E7A9E" />
      <Text style={styles.statBadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  heroCard: {
    backgroundColor: '#EEF6FD',
    borderColor: '#D8E7F5',
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#DDEDFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#173B56',
    fontSize: 15,
    fontWeight: '700',
  },
  heroText: {
    color: '#56758D',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#D4E4F4',
    backgroundColor: '#F7FBFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statBadgeText: {
    color: '#486B86',
    fontSize: 12,
    fontWeight: '600',
  },
  errorCard: {
    borderColor: '#F0CAD0',
    backgroundColor: '#FFF5F6',
  },
  errorText: {
    color: PetCareTheme.colors.danger,
    fontSize: 13,
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  emptyTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 2,
  },
  petChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  petChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#D7E3EC',
    backgroundColor: '#F8FBFD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  petChipBtnActive: {
    borderColor: '#B8E0D6',
    backgroundColor: '#EAF9F4',
  },
  petChipLabel: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  petChipLabelActive: {
    color: '#0F5B51',
  },
  taskGrid: {
    gap: 10,
  },
  taskCard: {
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    borderRadius: PetCareTheme.radius.md,
    backgroundColor: '#FAFCFE',
    padding: 12,
    gap: 6,
  },
  taskCardActive: {
    borderColor: '#BFE6DD',
    backgroundColor: '#F1FBF8',
  },
  taskIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8E5EF',
    backgroundColor: '#F2F7FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIconWrapActive: {
    borderColor: '#CBEADF',
    backgroundColor: '#E7F8F2',
  },
  taskTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  taskTitleActive: {
    color: '#0F5B51',
  },
  taskText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  helperText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  runCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  runText: {
    marginTop: 2,
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  runSubText: {
    marginTop: 4,
    color: '#6C8BA0',
    fontSize: 11,
    fontWeight: '600',
  },
  resultCard: {
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EAF2FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9E6F2',
  },
  resultTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultMeta: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  highlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultSection: {
    gap: 6,
  },
  resultSectionTitle: {
    color: '#173B56',
    fontSize: 13,
    fontWeight: '700',
  },
  resultBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#7DBAAE',
    marginTop: 6,
  },
  resultLine: {
    flex: 1,
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EFE0A5',
    backgroundColor: '#FFF9E3',
    borderRadius: PetCareTheme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  disclaimerText: {
    flex: 1,
    color: '#79620C',
    fontSize: 11,
    lineHeight: 16,
  },
});

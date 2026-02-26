import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, EmptyState, Screen } from '@/components/pc/ui';
import {
  getPetGenderLabel,
  getPetSpeciesLabel,
  PetCareTheme,
  reminderTypeLabels,
  repeatTypeLabels,
} from '@/constants/petcare-theme';
import { formatDateOnly, formatDateTime, toDate } from '@/lib/date-utils';
import {
  deleteExpense,
  deleteHealthLog,
  deleteReminder,
  deleteWeightEntry,
  subscribeExpenses,
  subscribeHealthLogs,
  subscribePet,
  subscribeReminders,
  subscribeTimelineEvents,
  subscribeWeights,
} from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const LAST_VIEWED_PET_KEY = 'petcare:lastViewedPetId';

const PET_TABS = [
  { key: 'timeline', label: 'Timeline', icon: 'view-timeline' },
  { key: 'reminders', label: 'Hat\u0131rlatmalar', icon: 'notifications-active' },
  { key: 'weights', label: 'Kilo', icon: 'timeline' },
  { key: 'logs', label: 'Sa\u011fl\u0131k', icon: 'fact-check' },
  { key: 'expenses', label: 'Giderler', icon: 'payments' },
];
const DETAIL_TAB_KEYS = new Set(['album', ...PET_TABS.map((tab) => tab.key)]);

const EXPENSE_CATEGORY_LABELS = {
  vet: 'Veteriner',
  medication: '\u0130la\u00e7',
  vaccine: 'A\u015f\u0131',
  food: 'Mama',
  grooming: 'Bak\u0131m',
  other: 'Di\u011fer',
};

const TIMELINE_FILTERS = [
  { key: 'all', label: 'T\u00fcm\u00fc', icon: 'apps' },
  { key: 'reminder', label: 'A\u015f\u0131/Vet', icon: 'notifications-active' },
  { key: 'weight', label: 'Kilo', icon: 'monitor-weight' },
  { key: 'log', label: 'Not', icon: 'fact-check' },
  { key: 'expense', label: 'Gider', icon: 'payments' },
];

export default function PetDetailRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  return (
    <AuthGate>
      <PetDetailScreen petId={petId} initialTab={tab} />
    </AuthGate>
  );
}

function PetDetailScreen({ petId, initialTab }) {
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [weights, setWeights] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(DETAIL_TAB_KEYS.has(initialTab) ? initialTab : 'timeline');
  const [expenseFocusDate, setExpenseFocusDate] = useState(new Date());
  const [timelineFocusDate, setTimelineFocusDate] = useState(new Date());
  const [timelineTypeFilter, setTimelineTypeFilter] = useState('all');
  const [albumYear, setAlbumYear] = useState(new Date().getFullYear());
  const isAlbumFocused = activeTab === 'album';

  useEffect(() => {
    if (!user?.uid || !petId) {
      return undefined;
    }

    const unsubs = [
      subscribePet(user.uid, petId, setPet, setError),
      subscribeReminders(user.uid, petId, setReminders, setError),
      subscribeWeights(user.uid, petId, setWeights, setError),
      subscribeHealthLogs(user.uid, petId, setLogs, setError),
      subscribeExpenses(user.uid, petId, setExpenses, setError),
      subscribeTimelineEvents(user.uid, petId, setTimelineEvents, setError),
    ];

    return () => unsubs.forEach((unsub) => unsub?.());
  }, [petId, user?.uid]);

  useEffect(() => {
    if (!petId) return;
    AsyncStorage.setItem(LAST_VIEWED_PET_KEY, String(petId)).catch(() => {});
  }, [petId]);

  useEffect(() => {
    if (DETAIL_TAB_KEYS.has(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const reminderSummary = useMemo(() => {
    const activeCount = reminders.filter((item) => item.active).length;
    return `${activeCount} aktif / ${reminders.length} toplam`;
  }, [reminders]);

  const weightSummary = useMemo(() => {
    if (!weights.length) return 'Hen\u00fcz kay\u0131t yok';
    const latest = weights[0];
    return `Son kayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t: ${latest?.valueKg ?? latest?.weight ?? '-'} kg`;
  }, [weights]);

  const logSummary = useMemo(() => {
    if (!logs.length) return 'Hen\u00fcz not yok';
    return `${logs.length} saÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¸lÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±k notu`;
  }, [logs]);

  const expenseSummary = useMemo(() => {
    if (!expenses.length) return 'Hen\u00fcz gider yok';
    const now = new Date();
    const month = getMonthTotal(expenses, now);
    const year = getYearTotal(expenses, now);
    return `Bu ay ${formatTRY(month)} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Bu yÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±l ${formatTRY(year)}`;
  }, [expenses]);

  const filteredExpenses = useMemo(() => filterExpensesByMonth(expenses, expenseFocusDate), [expenses, expenseFocusDate]);
  const filteredExpenseInsights = useMemo(() => buildExpenseInsights(filteredExpenses, expenseFocusDate), [filteredExpenses, expenseFocusDate]);
  const monthlyTrend = useMemo(() => buildMonthlyExpenseTrend(expenses, 6, expenseFocusDate), [expenses, expenseFocusDate]);
  const expenseYearOptions = useMemo(() => buildExpenseYearOptions(expenses, expenseFocusDate), [expenses, expenseFocusDate]);
  const filteredTimelineEvents = useMemo(
    () => filterTimelineEvents(timelineEvents, timelineFocusDate, timelineTypeFilter),
    [timelineEvents, timelineFocusDate, timelineTypeFilter]
  );
  const timelineGroups = useMemo(() => groupTimelineByDay(filteredTimelineEvents), [filteredTimelineEvents]);
  const albumYearOptions = useMemo(() => buildAlbumYearOptions({ timelineEvents, expenses, weights, logs, pet }), [timelineEvents, expenses, weights, logs, pet]);
  const albumYearSummary = useMemo(
    () =>
      buildAlbumYearSummary({
        year: albumYear,
        pet,
        timelineEvents,
        reminders,
        expenses,
        weights,
        logs,
      }),
    [albumYear, pet, timelineEvents, reminders, expenses, weights, logs]
  );
  const firstYearAlbumSummary = useMemo(
    () => buildFirstYearAlbumSummary({ pet, timelineEvents, expenses, weights, logs }),
    [pet, timelineEvents, expenses, weights, logs]
  );


  const confirmDeleteReminder = (reminder) => {
    Alert.alert('HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatmayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± sil', reminder.title || 'HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatma', [
      { text: 'Vazge\u00e7', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(user.uid, petId, reminder.id);
            Alert.alert('Silindi', 'HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatma silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const confirmDeleteWeight = (entry) => {
    Alert.alert('Kilo kaydÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±nÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± sil', `${entry.valueKg ?? entry.weight ?? '-'} kg`, [
      { text: 'Vazge\u00e7', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWeightEntry(user.uid, petId, entry.id);
            Alert.alert('Silindi', 'Kilo kaydÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const confirmDeleteLog = (entry) => {
    Alert.alert('SaÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¸lÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±k notunu sil', 'Bu kayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t silinecek.', [
      { text: 'Vazge\u00e7', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHealthLog(user.uid, petId, entry.id);
            Alert.alert('Silindi', 'SaÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¸lÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±k notu silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const confirmDeleteExpense = (entry) => {
    Alert.alert('Gider kaydÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±nÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± sil', `${formatTRY(Number(entry.amount || 0))} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ ${EXPENSE_CATEGORY_LABELS[entry.category] || 'Gider'}`, [
      { text: 'Vazge\u00e7', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(user.uid, petId, entry.id);
            Alert.alert('Silindi', 'Gider kaydÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â± silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const handleTimelineEventPress = (event) => {
    const sourceId = event?.sourceRef?.id;
    if (!event?.type || !sourceId) {
      return;
    }

    if (event.type === 'reminder') {
      router.push(`/pets/${petId}/reminders/${sourceId}/edit`);
      return;
    }

    if (event.type === 'expense') {
      router.push(`/pets/${petId}/expenses/${sourceId}/edit`);
      return;
    }

    if (event.type === 'weight') {
      router.push(`/pets/${petId}/weights/${sourceId}/edit`);
      return;
    }

    if (event.type === 'log') {
      router.push(`/pets/${petId}/logs/${sourceId}/edit`);
    }
  };

  return (
    <Screen
      title={pet?.name || 'Pet Detay\u0131'}
      subtitle={isAlbumFocused ? 'Pet Yaşam Albümü' : pet ? `${getPetSpeciesLabel(pet.species)} sağlık takibi` : 'Yükleniyor...'}
      right={isAlbumFocused ? null : <Button title={'Düzenle'} variant="secondary" onPress={() => router.push(`/pets/${petId}/edit`)} />}>
      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error.message}</Text>
        </Card>
      ) : null}

      {pet ? (
        <Card style={styles.heroCard}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          <View style={styles.petHeader}>
            <View style={styles.photoWrapOuter}>
              <View style={styles.photoWrap}>
                {pet.photoUrl || pet.photoLocalUri ? (
                  <Image source={{ uri: pet.photoUrl || pet.photoLocalUri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <Text style={styles.photoFallback}>{pet.name?.slice(0, 1)?.toUpperCase() || '?'}</Text>
                )}
              </View>
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.petName}>{pet.name}</Text>
              <View style={styles.petBadgeRow}>
                <SpeciesPill species={pet.species} />
                {pet.gender ? <Chip label={getPetGenderLabel(pet.gender)} /> : null}
                {pet.breed ? <Chip label={pet.breed} /> : null}
              </View>

              <View style={styles.infoRowWrap}>
                {pet.currentWeight ? <InfoPill icon="monitor-weight" label={`${pet.currentWeight} kg`} tone="mint" /> : null}
                {pet.birthDate ? <InfoPill icon="cake" label={formatDateOnly(pet.birthDate)} tone="sky" /> : null}
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {!isAlbumFocused ? (
      <Card style={styles.segmentCard}>
        <View style={styles.segmentHeader}>
          <Text style={styles.segmentTitle}>{'Takip B\u00f6l\u00fcmleri'}</Text>
          <Text style={styles.segmentSub}>{'Sekmeler aras\u0131nda ge\u00e7i\u015f yap\u0131n'}</Text>
        </View>

        <View style={styles.segmentRow}>
          {PET_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && { opacity: 0.92 }]}>
                <MaterialIcons name={tab.icon} size={15} color={active ? '#174D73' : '#5C7D94'} />
                <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      ) : null}

      {activeTab === 'album' ? (
        <SectionBlock
          title="Pet Yaşam Albümü"
          subtitle={`${albumYear} yılı anı özeti`}
          addLabel="AI Özet"
          onAdd={() =>
            router.push({
              pathname: '/ai',
              params: { petId, task: 'vetSummary' },
            })
          }>
          <Card style={styles.expenseFilterCard}>
            <View style={styles.expenseFilterTop}>
              <Text style={styles.itemTitle}>Yıl Seçimi</Text>
              <Chip label={`${albumYearSummary.eventCount} olay`} />
            </View>
            <View style={styles.yearFilterRow}>
              {albumYearOptions.map((year) => {
                const selected = year === albumYear;
                return (
                  <Pressable
                    key={`album-year-${year}`}
                    onPress={() => setAlbumYear(year)}
                    style={({ pressed }) => [styles.yearChip, selected && styles.yearChipSelected, pressed && { opacity: 0.9 }]}>
                    <Text style={[styles.yearChipText, selected && styles.yearChipTextSelected]}>{year}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card style={styles.heroCard}>
            <View style={styles.heroGlowA} />
            <View style={styles.heroGlowB} />
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.itemTitle}>{`${pet?.name || 'Pet'} için ${albumYear} özeti`}</Text>
                <Text style={styles.subText}>
                  {albumYearSummary.ageLine}
                </Text>
              </View>
              <Chip label={albumYearSummary.coverLabel} />
            </View>
            <View style={styles.expenseOverviewRow}>
              <ExpenseStatCard label="Olay" value={`${albumYearSummary.eventCount}`} tone="sky" />
              <ExpenseStatCard label="Kilo" value={albumYearSummary.weightLine} tone="mint" />
            </View>
            <View style={styles.expenseOverviewRow}>
              <ExpenseStatCard label="Sağlık Notu" value={`${albumYearSummary.logCount}`} tone="violet" />
              <ExpenseStatCard label="Gider" value={formatTRY(albumYearSummary.expenseTotal)} tone="amber" />
            </View>
          </Card>

          {firstYearAlbumSummary ? (
            <Card style={styles.contentCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.itemTitle}>1 Yaş Özeti</Text>
                <Chip label={firstYearAlbumSummary.label} tone="warning" />
              </View>
              <Text style={styles.subText}>{firstYearAlbumSummary.summaryLine}</Text>
              <View style={styles.expenseOverviewRow}>
                <ExpenseStatCard label="Olay" value={`${firstYearAlbumSummary.eventCount}`} tone="sky" />
                <ExpenseStatCard label="Kilo" value={firstYearAlbumSummary.weightLine} tone="mint" />
              </View>
              <View style={styles.expenseOverviewRow}>
                <ExpenseStatCard label="Not" value={`${firstYearAlbumSummary.logCount}`} tone="violet" />
                <ExpenseStatCard label="Gider" value={formatTRY(firstYearAlbumSummary.expenseTotal)} tone="amber" />
              </View>
              {firstYearAlbumSummary.note ? <Text style={styles.noteText}>{firstYearAlbumSummary.note}</Text> : null}
            </Card>
          ) : null}

          <Card style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.itemTitle}>Anı Akışı (Öne Çıkanlar)</Text>
              <Chip label={`${albumYearSummary.highlights.length} kayıt`} />
            </View>
            {albumYearSummary.highlights.length ? (
              <View style={{ gap: 8 }}>
                {albumYearSummary.highlights.map((item) => (
                  <View key={item.key} style={styles.memberTimelineRow}>
                    <View style={[styles.timelineIconWrap, { backgroundColor: item.bg, borderColor: item.border }]}>
                      <MaterialIcons name={item.icon} size={15} color={item.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.subText}>{item.subtitle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="Henüz albüm verisi yok" description="Bu yıl için kayıt eklendikçe anı özeti burada görünür." />
            )}
          </Card>

          <Card style={styles.contentCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.itemTitle}>Fotoğraf Albümü</Text>
              <Chip label={pet?.photoUrl || pet?.photoLocalUri ? '1 kapak fotoğrafı' : 'Fotoğraf yok'} />
            </View>
            {pet?.photoUrl || pet?.photoLocalUri ? (
              <View style={styles.albumPhotoCard}>
                <Image source={{ uri: pet.photoUrl || pet.photoLocalUri }} style={styles.albumPhoto} contentFit="cover" />
                <View style={styles.albumPhotoOverlay}>
                  <Text style={styles.albumPhotoTitle}>{pet.name}</Text>
                  <Text style={styles.albumPhotoSub}>{albumYear} albüm kapağı</Text>
                </View>
              </View>
            ) : (
              <EmptyState title="Fotoğraf bulunamadı" description="Pet profil fotoğrafı eklendiğinde albüm kapağı burada görünür." />
            )}
          </Card>
        </SectionBlock>
      ) : null}

      {activeTab === 'timeline' ? (
        <SectionBlock
          title="Health Timeline 2.0"
          subtitle={`${filteredTimelineEvents.length} olay \u2022 ${formatMonthYearTR(timelineFocusDate)}`}
          addLabel="AI Analiz"
          onAdd={() =>
            router.push({
              pathname: '/ai',
              params: {
                petId,
                task: 'riskAnalysis',
                timelineMonth: `${timelineFocusDate.getFullYear()}-${String(timelineFocusDate.getMonth() + 1).padStart(2, '0')}` ,
                timelineFilter: timelineTypeFilter,
              },
            })
          }>
          <Card style={styles.expenseFilterCard}>
            <View style={styles.expenseFilterTop}>
              <Text style={styles.itemTitle}>{'Zaman Ak\u0131\u015f\u0131'}</Text>
              <Chip label={`${timelineGroups.length} g\u00fcn`} />
            </View>
            <View style={styles.monthNavRow}>
              <Pressable onPress={() => setTimelineFocusDate((prev) => shiftMonth(prev, -1))} style={({ pressed }) => [styles.monthNavBtn, pressed && { opacity: 0.9 }]}>
                <MaterialIcons name="chevron-left" size={18} color="#2D6C9E" />
              </Pressable>
              <View style={styles.monthPill}>
                <MaterialIcons name="calendar-month" size={14} color="#4B7697" />
                <Text style={styles.monthPillText}>{formatMonthYearTR(timelineFocusDate)}</Text>
              </View>
              <Pressable onPress={() => setTimelineFocusDate((prev) => shiftMonth(prev, 1))} style={({ pressed }) => [styles.monthNavBtn, pressed && { opacity: 0.9 }]}>
                <MaterialIcons name="chevron-right" size={18} color="#2D6C9E" />
              </Pressable>
            </View>
            <View style={styles.timelineFilterRow}>
              {TIMELINE_FILTERS.map((filter) => {
                const active = timelineTypeFilter === filter.key;
                return (
                  <Pressable key={filter.key} onPress={() => setTimelineTypeFilter(filter.key)} style={({ pressed }) => [styles.timelineFilterChip, active && styles.timelineFilterChipActive, pressed && { opacity: 0.9 }]}>
                    <MaterialIcons name={filter.icon} size={13} color={active ? '#1E5B86' : '#6B8BA1'} />
                    <Text style={[styles.timelineFilterChipText, active && styles.timelineFilterChipTextActive]}>{filter.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {timelineGroups.length === 0 ? (
            <EmptyState title={'Timeline bo\u015f'} description={'Se\u00e7ili ay ve filtre i\u00e7in sa\u011fl\u0131k olay\u0131 bulunmuyor.'} />
          ) : (
            timelineGroups.map((group) => (
              <View key={group.key} style={styles.timelineDayBlock}>
                <View style={styles.timelineDayHeader}>
                  <Text style={styles.timelineDayTitle}>{group.label}</Text>
                  <Chip label={`${group.items.length} olay`} />
                </View>
                {group.items.map((event) => {
                  const ui = getTimelineTypeUi(event.type);
                  return (
                    <Pressable key={event.id} onPress={() => handleTimelineEventPress(event)} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
                    <Card style={styles.timelineCard}>
                      <View style={styles.rowBetween}>
                        <View style={styles.timelineLeft}>
                          <View style={[styles.timelineIconWrap, { backgroundColor: ui.bg, borderColor: ui.border }]}>
                            <MaterialIcons name={ui.icon} size={16} color={ui.color} />
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.itemTitle}>{event.title || 'Olay'}</Text>
                            <Text style={styles.subText}>{event.summary || 'KayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t detayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±'}</Text>
                          </View>
                        </View>
                        <View style={styles.timelineRight}>
                          <Text style={styles.timelineTimeText}>{formatEventTime(event.occurredAt)}</Text>
                          <Chip label={ui.label} />
                        </View>
                      </View>

                      {event.type === 'expense' && Number(event.amount || 0) > 0 ? <Text style={styles.timelineMetaLine}>{formatTRY(event.amount)}</Text> : null}
                      {event.type === 'weight' && (event.valueKg || event.valueKg === 0) ? <Text style={styles.timelineMetaLine}>{event.valueKg} kg</Text> : null}
                      {event.type === 'log' && (event.tags || []).length ? (
                        <View style={styles.tagsWrap}>
                          {(event.tags || []).slice(0, 4).map((tag) => (
                            <Chip key={`${event.id}-${tag}`} label={tag} />
                          ))}
                        </View>
                      ) : null}
                    </Card>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </SectionBlock>
      ) : null}

      {activeTab === 'reminders' ? (
        <SectionBlock title="HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatmalar" subtitle={reminderSummary} addLabel="HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatma" onAdd={() => router.push(`/pets/${petId}/reminders/new`)}>
          {reminders.length === 0 ? (
            <EmptyState title={'Hat\u0131rlatma yok'} description={'A\u015f\u0131, ila\u00e7 veya veteriner randevusu ekleyin.'} />
          ) : (
            reminders.map((item) => (
              <Card key={item.id} style={styles.contentCard}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.itemTitle}>{item.title || 'HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatma'}</Text>
                    <Text style={styles.subText}>{formatDateTime(item.dueDate)}</Text>
                    <Text style={styles.subText}>
                      Tekrar: {repeatTypeLabels[item.repeatType] || 'Yok'}
                      {item.repeatType === 'customDays' && item.customDaysInterval ? ` (${item.customDaysInterval} g\u00fcnde bir)` : ''}
                    </Text>
                  </View>
                  <Chip label={reminderTypeLabels[item.type] || item.type || 'HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatma'} tone="primary" />
                </View>

                <View style={styles.footerRow}>
                  <StateDot active={!!item.active} />
                  <View style={styles.inlineActions}>
                    <IconButton icon="edit" tone="sky" onPress={() => router.push(`/pets/${petId}/reminders/${item.id}/edit`)} />
                    <IconButton icon="delete" tone="danger" onPress={() => confirmDeleteReminder(item)} />
                  </View>
                </View>
              </Card>
            ))
          )}
        </SectionBlock>
      ) : null}

      {activeTab === 'weights' ? (
        <SectionBlock title={'Kilo Ge\u00e7mi\u015fi'} subtitle={weightSummary} addLabel={'Kilo'} onAdd={() => router.push(`/pets/${petId}/weights/new`)}>
          {weights.length === 0 ? (
            <EmptyState title={'Kilo kayd\u0131 yok'} description={'D\u00fczenli kilo takibi i\u00e7in kay\u0131t ekleyin.'} />
          ) : (
            weights.map((item) => (
              <Card key={item.id} style={styles.contentCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.itemTitle}>{item.valueKg ?? item.weight} kg</Text>
                    <Text style={styles.subText}>{formatDateTime(item.measuredAt)}</Text>
                  </View>
                  <IconButton icon="delete" tone="danger" onPress={() => confirmDeleteWeight(item)} />
                </View>
                {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
              </Card>
            ))
          )}
        </SectionBlock>
      ) : null}

      {activeTab === 'logs' ? (
        <SectionBlock title="SaÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¸lÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±k NotlarÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±" subtitle={logSummary} addLabel="Not" onAdd={() => router.push(`/pets/${petId}/logs/new`)}>
          {logs.length === 0 ? (
            <EmptyState title={'Sa\u011fl\u0131k notu yok'} description={'Belirti ve davran\u0131\u015f g\u00f6zlemlerini kaydedin.'} />
          ) : (
            logs.map((item) => (
              <Card key={item.id} style={styles.contentCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{formatDateTime(item.loggedAt)}</Text>
                  <IconButton icon="delete" tone="danger" onPress={() => confirmDeleteLog(item)} />
                </View>

                {(item.tags || []).length ? (
                  <View style={styles.tagsWrap}>
                    {(item.tags || []).map((tag) => (
                      <Chip key={tag} label={tag} />
                    ))}
                  </View>
                ) : null}

                <Text style={styles.noteText}>{item.note || 'Not yok'}</Text>
              </Card>
            ))
          )}
        </SectionBlock>
      ) : null}

      {activeTab === 'expenses' ? (
        <SectionBlock title="Gider Takibi" subtitle={expenseSummary} addLabel="Gider" onAdd={() => router.push(`/pets/${petId}/expenses/new`)}>
          {expenses.length === 0 ? (
            <EmptyState title={'Gider kayd\u0131 yok'} description={'Veteriner, ila\u00e7 ve bak\u0131m giderlerini ekleyerek ayl\u0131k analizi ba\u015flat\u0131n.'} />
          ) : (
            <>
              <Card style={styles.expenseFilterCard}>
                <View style={styles.expenseFilterTop}>
                  <Text style={styles.itemTitle}>{'Analiz D\u00f6nemi'}</Text>
                  <Chip label={`${filteredExpenses.length} kayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t`} />
                </View>
                <View style={styles.monthNavRow}>
                  <Pressable onPress={() => setExpenseFocusDate((prev) => shiftMonth(prev, -1))} style={({ pressed }) => [styles.monthNavBtn, pressed && { opacity: 0.9 }]}>
                    <MaterialIcons name="chevron-left" size={18} color="#2D6C9E" />
                  </Pressable>
                  <View style={styles.monthPill}>
                    <MaterialIcons name="calendar-month" size={14} color="#4B7697" />
                    <Text style={styles.monthPillText}>{formatMonthYearTR(expenseFocusDate)}</Text>
                  </View>
                  <Pressable onPress={() => setExpenseFocusDate((prev) => shiftMonth(prev, 1))} style={({ pressed }) => [styles.monthNavBtn, pressed && { opacity: 0.9 }]}>
                    <MaterialIcons name="chevron-right" size={18} color="#2D6C9E" />
                  </Pressable>
                </View>
                <View style={styles.yearFilterRow}>
                  {expenseYearOptions.map((year) => {
                    const selected = year === expenseFocusDate.getFullYear();
                    return (
                      <Pressable
                        key={String(year)}
                        onPress={() =>
                          setExpenseFocusDate((prev) => new Date(year, prev.getMonth(), 1))
                        }
                        style={({ pressed }) => [
                          styles.yearChip,
                          selected && styles.yearChipSelected,
                          pressed && { opacity: 0.9 },
                        ]}>
                        <Text style={[styles.yearChipText, selected && styles.yearChipTextSelected]}>{year}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <Card style={styles.expenseSummaryCard}>
                <View style={styles.expenseOverviewRow}>
                  <ExpenseStatCard label={'Se\u00e7ili Ay'} value={formatTRY(filteredExpenseInsights.monthTotal)} tone="violet" />
                  <ExpenseStatCard label={'Se\u00e7ili Y\u0131l'} value={formatTRY(filteredExpenseInsights.yearTotal)} tone="sky" />
                </View>
                <View style={styles.expenseOverviewRow}>
                  <ExpenseStatCard label="KayÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±t" value={`${filteredExpenses.length}`} tone="mint" />
                  <ExpenseStatCard label="Ortalama" value={formatTRY(filteredExpenseInsights.avgAmount)} tone="amber" />
                </View>
              </Card>

              {monthlyTrend.length ? (
                <Card style={styles.contentCard}>
                  <Text style={styles.itemTitle}>Son 6 Ay Gider Trendi</Text>
                  <View style={styles.barChartWrap}>
                    {monthlyTrend.map((row) => (
                      <Pressable
                        key={row.key}
                        onPress={() => setExpenseFocusDate(new Date(row.date))}
                        style={({ pressed }) => [styles.barCol, pressed && { opacity: 0.92 }]}>
                        <Text style={styles.barValueText}>{row.total > 0 ? compactTRY(row.total) : '0'}</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              row.isSelected && styles.barFillSelected,
                              { height: `${Math.max(4, row.ratio * 100)}%` },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barLabel, row.isSelected && styles.barLabelSelected]}>{row.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              ) : null}

              {filteredExpenseInsights.topCategories.length ? (
                <Card style={styles.contentCard}>
                  <Text style={styles.itemTitle}>{'Kategori Da\u011f\u0131l\u0131m\u0131 (Se\u00e7ili Ay)'}</Text>
                  <View style={styles.categoryList}>
                    {filteredExpenseInsights.topCategories.map((row) => (
                      <View key={row.category} style={styles.categoryRowWrap}>
                        <View style={styles.categoryRow}>
                          <View style={styles.categoryLeft}>
                            <View style={[styles.categoryDot, { backgroundColor: getExpenseCategoryColor(row.category) }]} />
                            <Text style={styles.subText}>{EXPENSE_CATEGORY_LABELS[row.category] || 'DiÃƒÆ’Ã¢â‚¬ÂÃƒâ€¦Ã‚Â¸er'}</Text>
                          </View>
                          <Text style={styles.categoryValue}>{formatTRY(row.total)}</Text>
                        </View>
                        <View style={styles.categoryBarTrack}>
                          <View
                            style={[
                              styles.categoryBarFill,
                              {
                                width: `${Math.max(6, row.ratio * 100)}%`,
                                backgroundColor: getExpenseCategoryColor(row.category),
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {(filteredExpenses.length ? filteredExpenses : expenses).slice(0, 12).map((item) => (
                <Card key={item.id} style={styles.contentCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.itemTitle}>{item.title || EXPENSE_CATEGORY_LABELS[item.category] || 'Gider'}</Text>
                      <Text style={styles.subText}>
                        {(EXPENSE_CATEGORY_LABELS[item.category] || 'Gider')} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ {formatDateTime(item.expenseDate)}
                      </Text>
                      {item.clinicName ? <Text style={styles.subText}>Kurum: {item.clinicName}</Text> : null}
                    </View>
                    <View style={styles.expenseRight}>
                      <Text style={styles.expenseAmount}>{formatTRY(Number(item.amount || 0))}</Text>
                      <View style={styles.inlineActions}>
                        <IconButton icon="edit" tone="sky" onPress={() => router.push(`/pets/${petId}/expenses/${item.id}/edit`)} />
                        <IconButton icon="delete" tone="danger" onPress={() => confirmDeleteExpense(item)} />
                      </View>
                    </View>
                  </View>
                  {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
                </Card>
              ))}

              {!filteredExpenses.length ? (
                <Card style={styles.contentCard}>
                  <Text style={styles.subText}>{'Se\u00e7ili ay i\u00e7in gider kayd\u0131 bulunmuyor. Yine de y\u0131ll\u0131k toplamlar \u00fcstte g\u00f6r\u00fcn\u00fcr.'}</Text>
                </Card>
              ) : null}
            </>
          )}
        </SectionBlock>
      ) : null}
    </Screen>
  );
}

function SectionBlock({ title, subtitle, addLabel, onAdd, children }) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <Button title={`+ ${addLabel}`} variant="secondary" onPress={onAdd} />
      </View>
      {children}
    </>
  );
}

function buildAlbumYearOptions({ timelineEvents, expenses, weights, logs, pet }) {
  const years = new Set([new Date().getFullYear()]);
  [timelineEvents, expenses, weights, logs].forEach((rows) => {
    (rows || []).forEach((item) => {
      const d =
        toDate(item?.occurredAt) ||
        toDate(item?.expenseDate) ||
        toDate(item?.measuredAt) ||
        toDate(item?.loggedAt) ||
        toDate(item?.createdAt);
      if (d) years.add(d.getFullYear());
    });
  });
  const birth = toDate(pet?.birthDate);
  if (birth) years.add(birth.getFullYear());
  return Array.from(years).sort((a, b) => b - a).slice(0, 8);
}

function buildAlbumYearSummary({ year, pet, timelineEvents, expenses, weights, logs }) {
  const inYear = (d) => d && d.getFullYear() === year;
  const eventsInYear = (timelineEvents || []).filter((e) => inYear(toDate(e.occurredAt)));
  const expensesInYear = (expenses || []).filter((e) => inYear(toDate(e.expenseDate)));
  const weightsInYear = (weights || []).filter((e) => inYear(toDate(e.measuredAt)));
  const logsInYear = (logs || []).filter((e) => inYear(toDate(e.loggedAt)));

  const firstWeight = weightsInYear[weightsInYear.length - 1];
  const lastWeight = weightsInYear[0];
  const firstValue = Number(firstWeight?.valueKg ?? firstWeight?.weight ?? NaN);
  const lastValue = Number(lastWeight?.valueKg ?? lastWeight?.weight ?? NaN);
  const weightLine =
    Number.isFinite(firstValue) && Number.isFinite(lastValue)
      ? `${firstValue.toFixed(1)} → ${lastValue.toFixed(1)} kg`
      : weightsInYear.length
        ? `${weightsInYear.length} ölçüm`
        : 'Kayıt yok';

  const expenseTotal = expensesInYear.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const birthDate = toDate(pet?.birthDate);
  const ageLine = birthDate
    ? `${year} içinde yaklaşık ${Math.max(0, year - birthDate.getFullYear())} yaş dönemine ait kayıtlar`
    : `${year} yılı sağlık ve bakım kayıt özeti`;

  const highlights = [
    {
      key: 'events',
      icon: 'event-note',
      title: `${eventsInYear.length} sağlık olayı`,
      subtitle: `${year} yılı timeline kaydı`,
      bg: '#EEF6FF',
      border: '#D8EAFB',
      color: '#2D6C9E',
    },
    {
      key: 'logs',
      icon: 'fact-check',
      title: `${logsInYear.length} sağlık notu`,
      subtitle: logsInYear.length ? 'Belirti ve gözlem kayıtları mevcut' : 'Bu yıl not kaydı yok',
      bg: '#F7F3FF',
      border: '#E4DAFB',
      color: '#6A52B0',
    },
    {
      key: 'expenses',
      icon: 'payments',
      title: `${formatTRY(expenseTotal)} gider`,
      subtitle: `${year} yılı toplam sağlık/bakım harcaması`,
      bg: '#FFF8EE',
      border: '#F2E0BF',
      color: '#A16E17',
    },
  ];

  return {
    eventCount: eventsInYear.length,
    logCount: logsInYear.length,
    expenseTotal,
    weightLine,
    ageLine,
    coverLabel: pet?.photoUrl || pet?.photoLocalUri ? 'Kapak hazır' : 'Kapak bekleniyor',
    highlights,
  };
}

function buildFirstYearAlbumSummary({ pet, timelineEvents, expenses, weights, logs }) {
  const birthDate = toDate(pet?.birthDate);
  if (!birthDate) return null;

  const firstBirthday = new Date(birthDate);
  firstBirthday.setFullYear(firstBirthday.getFullYear() + 1);
  const inRange = (d) => d && d >= birthDate && d < firstBirthday;

  const eventsInRange = (timelineEvents || []).filter((e) => inRange(toDate(e.occurredAt)));
  const expensesInRange = (expenses || []).filter((e) => inRange(toDate(e.expenseDate)));
  const weightsInRange = (weights || []).filter((e) => inRange(toDate(e.measuredAt)));
  const logsInRange = (logs || []).filter((e) => inRange(toDate(e.loggedAt)));

  const firstWeight = weightsInRange[weightsInRange.length - 1];
  const lastWeight = weightsInRange[0];
  const firstValue = Number(firstWeight?.valueKg ?? firstWeight?.weight ?? NaN);
  const lastValue = Number(lastWeight?.valueKg ?? lastWeight?.weight ?? NaN);
  const weightLine = Number.isFinite(firstValue) && Number.isFinite(lastValue)
    ? `${firstValue.toFixed(1)} → ${lastValue.toFixed(1)} kg`
    : (weightsInRange.length ? `${weightsInRange.length} ölçüm` : 'Kayıt yok');

  const expenseTotal = expensesInRange.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const now = new Date();
  const completed = now >= firstBirthday;

  return {
    label: completed ? 'Tamamlandı' : 'Yaklaşıyor',
    eventCount: eventsInRange.length,
    logCount: logsInRange.length,
    expenseTotal,
    weightLine,
    summaryLine: completed
      ? `İlk yaş dönemi özeti (${formatDateOnly(birthDate)} - ${formatDateOnly(firstBirthday)})`
      : `İlk yaş özeti ${formatDateOnly(firstBirthday)} tarihinde tamamlanacak`
    ,
    note: completed ? 'Büyüme dönemini özetleyen ilk taslak kart.' : '',
  };
}

function SpeciesPill({ species }) {
  const map = {
    dog: { bg: '#EAF9F4', border: '#CDEBDE', color: '#1F7D61' },
    cat: { bg: '#F2EEFF', border: '#DED4FA', color: '#694AB9' },
    bird: { bg: '#FFF7E9', border: '#F1DEBB', color: '#A06F17' },
  };
  const tone = map[species] || { bg: '#EFF4F8', border: '#DCE7EF', color: '#4E6E86' };

  return (
    <View style={[styles.speciesPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.speciesPillText, { color: tone.color }]}>{getPetSpeciesLabel(species)}</Text>
    </View>
  );
}

function InfoPill({ icon, label, tone = 'sky' }) {
  const map = {
    sky: { bg: '#EEF6FD', border: '#D7E7F4', color: '#3D7094' },
    mint: { bg: '#EEF9F4', border: '#D4ECDF', color: '#2B8E6B' },
  };
  const t = map[tone] || map.sky;

  return (
    <View style={[styles.infoPill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <MaterialIcons name={icon} size={13} color={t.color} />
      <Text style={[styles.infoPillText, { color: t.color }]}>{label}</Text>
    </View>
  );
}

function StateDot({ active }) {
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.stateDot, { backgroundColor: active ? '#52B58E' : '#B7C8D4' }]} />
      <Text style={styles.stateText}>{active ? 'Aktif' : 'Pasif'}</Text>
    </View>
  );
}

function IconButton({ icon, onPress, tone = 'sky' }) {
  const tones = {
    sky: { bg: '#F4FAFF', border: '#DBEAF8', color: '#2D6C9E' },
    danger: { bg: '#FFF4F6', border: '#F3CFD5', color: PetCareTheme.colors.danger },
  };
  const t = tones[tone] || tones.sky;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: t.bg, borderColor: t.border }, pressed && { opacity: 0.85 }]}>
      <MaterialIcons name={icon} size={18} color={t.color} />
    </Pressable>
  );
}

function ExpenseStatCard({ label, value, tone = 'sky' }) {
  const tones = {
    sky: { bg: '#F3F9FF', border: '#DCEAF8', label: '#5D83A3', value: '#21567F' },
    violet: { bg: '#F7F4FF', border: '#E5DCF8', label: '#7B6BA7', value: '#4C3F7D' },
    mint: { bg: '#F1FBF6', border: '#D6EEDF', label: '#5E8876', value: '#23694F' },
    amber: { bg: '#FFF8EE', border: '#F2E0BC', label: '#957448', value: '#76541E' },
  };
  const t = tones[tone] || tones.sky;
  return (
    <View style={[styles.expenseStatCard, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[styles.expenseStatLabel, { color: t.label }]}>{label}</Text>
      <Text style={[styles.expenseStatValue, { color: t.value }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function buildExpenseInsights(expenses, referenceDate = new Date()) {
  const monthTotal = getMonthTotal(expenses, referenceDate);
  const yearTotal = getYearTotal(expenses, referenceDate);
  const avgAmount = expenses.length ? expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) / expenses.length : 0;

  const categoryMap = new Map();
  expenses.forEach((e) => {
    const category = e.category || 'other';
    categoryMap.set(category, (categoryMap.get(category) || 0) + Number(e.amount || 0));
  });

  const topCategories = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const maxCategoryTotal = Math.max(...topCategories.map((item) => item.total), 0);

  return {
    monthTotal,
    yearTotal,
    avgAmount,
    topCategories: topCategories.map((item) => ({
      ...item,
      ratio: maxCategoryTotal > 0 ? item.total / maxCategoryTotal : 0,
    })),
  };
}

function getMonthTotal(expenses, date) {
  return expenses.reduce((sum, e) => {
    const d = toDate(e.expenseDate);
    if (!d) return sum;
    if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);
}

function getYearTotal(expenses, date) {
  return expenses.reduce((sum, e) => {
    const d = toDate(e.expenseDate);
    if (!d) return sum;
    if (d.getFullYear() === date.getFullYear()) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);
}

function formatTRY(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function compactTRY(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  if (Math.abs(num) >= 1000) {
    return new Intl.NumberFormat('tr-TR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  }
  return Math.round(num).toString();
}

function filterExpensesByMonth(expenses, focusDate) {
  if (!(focusDate instanceof Date) || Number.isNaN(focusDate.getTime())) return expenses;
  return expenses.filter((e) => {
    const d = toDate(e.expenseDate);
    return d && d.getFullYear() === focusDate.getFullYear() && d.getMonth() === focusDate.getMonth();
  });
}

function buildMonthlyExpenseTrend(expenses, monthCount = 6, focusDate = new Date()) {
  const safeCount = Math.max(1, Number(monthCount || 0));
  const list = [];
  for (let i = safeCount - 1; i >= 0; i -= 1) {
    const cursor = shiftMonth(focusDate, -i);
    const total = getMonthTotal(expenses, cursor);
    list.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth() + 1}`,
      label: formatShortMonthTR(cursor),
      date: new Date(cursor),
      total,
    });
  }
  const maxTotal = Math.max(...list.map((item) => item.total), 0);
  return list.map((item) => ({
    ...item,
    ratio: maxTotal > 0 ? item.total / maxTotal : 0,
    isSelected:
      item.date.getFullYear() === focusDate.getFullYear() && item.date.getMonth() === focusDate.getMonth(),
  }));
}

function buildExpenseYearOptions(expenses, focusDate) {
  const years = new Set();
  expenses.forEach((e) => {
    const d = toDate(e.expenseDate);
    if (d) years.add(d.getFullYear());
  });
  years.add(focusDate.getFullYear());
  return Array.from(years).sort((a, b) => b - a).slice(0, 6);
}

function shiftMonth(date, delta) {
  const source = date instanceof Date ? date : new Date();
  const next = new Date(source.getFullYear(), source.getMonth(), 1);
  next.setMonth(next.getMonth() + Number(delta || 0));
  return next;
}

function formatMonthYearTR(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatShortMonthTR(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'short',
  })
    .format(date)
    .replace('.', '');
}

function filterTimelineEvents(events, focusDate, typeFilter = 'all') {
  const monthRows = events.filter((item) => {
    const d = toDate(item.occurredAt);
    return d && d.getFullYear() === focusDate.getFullYear() && d.getMonth() === focusDate.getMonth();
  });

  if (!typeFilter || typeFilter === 'all') return monthRows;
  return monthRows.filter((item) => item.type === typeFilter);
}

function groupTimelineByDay(events) {
  const groups = new Map();
  events.forEach((item) => {
    const d = toDate(item.occurredAt);
    if (!d) return;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        date: d,
        label: formatTimelineDayLabel(d),
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });
  return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

function formatTimelineDayLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Bug\u00fcn';
  if (isSameDay(date, yesterday)) return 'D\u00fcn';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(date);
}

function formatEventTime(dateLike) {
  const d = toDate(dateLike);
  if (!d) return '-';
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getTimelineTypeUi(type) {
  if (type === 'reminder') {
    return { label: 'HatÃƒÆ’Ã¢â‚¬ÂÃƒâ€šÃ‚Â±rlatma', icon: 'notifications-active', bg: '#EEF6FF', border: '#D8EAFB', color: '#2D6C9E' };
  }
  if (type === 'weight') {
    return { label: 'Kilo', icon: 'monitor-weight', bg: '#EEF9F4', border: '#D3ECDf', color: '#2A8A68' };
  }
  if (type === 'log') {
    return { label: 'Not', icon: 'fact-check', bg: '#F7F3FF', border: '#E4DAFB', color: '#6A52B0' };
  }
  if (type === 'expense') {
    return { label: 'Gider', icon: 'payments', bg: '#FFF8EE', border: '#F2E0BF', color: '#A16E17' };
  }
  return { label: 'Olay', icon: 'event', bg: '#F4F7FA', border: '#DEE7EE', color: '#5C7E95' };
}

function getExpenseCategoryColor(category) {
  if (category === 'vet') return '#6FADE4';
  if (category === 'medication') return '#9A7EE8';
  if (category === 'vaccine') return '#51BE94';
  if (category === 'food') return '#D7A448';
  if (category === 'grooming') return '#EC8FA8';
  return '#95AABD';
}

const styles = StyleSheet.create({
  errorCard: {
    borderColor: '#F2D0D5',
    backgroundColor: '#FFF5F6',
  },
  errorText: {
    color: PetCareTheme.colors.danger,
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: '#EEF7FF',
    borderColor: '#D7E8F6',
    overflow: 'hidden',
    position: 'relative',
    gap: 12,
  },
  heroGlowA: {
    position: 'absolute',
    top: -32,
    right: -16,
    width: 114,
    height: 114,
    borderRadius: 999,
    backgroundColor: 'rgba(117, 184, 246, 0.16)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -32,
    left: -18,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(83, 206, 162, 0.12)',
  },
  petHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  photoWrapOuter: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoWrap: {
    width: 78,
    height: 78,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: PetCareTheme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    fontSize: 28,
    fontWeight: '700',
    color: PetCareTheme.colors.textMuted,
  },
  petName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#204F73',
  },
  petBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  speciesPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  speciesPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  infoRowWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  infoPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  segmentCard: {
    gap: 10,
    backgroundColor: '#F4FAFF',
    borderColor: '#D9E9F7',
  },
  segmentHeader: {
    gap: 2,
  },
  segmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#28557A',
  },
  segmentSub: {
    fontSize: 11,
    color: '#6A88A0',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentButton: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E7F6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segmentButtonActive: {
    borderColor: '#94C5EA',
    backgroundColor: '#E6F3FF',
  },
  segmentButtonText: {
    color: '#557B97',
    fontWeight: '700',
    fontSize: 12,
  },
  segmentButtonTextActive: {
    color: '#174D73',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A567B',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#5D84A2',
  },
  contentCard: {
    gap: 10,
    borderColor: '#DFEAF2',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  subText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  noteText: {
    color: '#5F7C90',
    fontSize: 12,
    lineHeight: 18,
  },
  stateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  stateText: {
    color: '#6A8799',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timelineFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DCE8F3',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timelineFilterChipActive: {
    borderColor: '#9CC9ED',
    backgroundColor: '#EAF5FF',
  },
  timelineFilterChipText: {
    color: '#64839A',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineFilterChipTextActive: {
    color: '#1E5B86',
  },
  timelineDayBlock: {
    gap: 8,
  },
  timelineDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  timelineDayTitle: {
    color: '#29587D',
    fontWeight: '700',
    fontSize: 13,
  },
  timelineCard: {
    gap: 8,
    borderColor: '#E0EAF2',
    backgroundColor: '#FFFFFF',
  },
  memberTimelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E3ECF4',
    backgroundColor: '#FBFDFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  timelineLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  timelineRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  timelineIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTimeText: {
    color: '#6A899F',
    fontWeight: '700',
    fontSize: 11,
  },
  timelineMetaLine: {
    color: '#577A92',
    fontSize: 12,
    fontWeight: '600',
  },
  expenseSummaryCard: {
    gap: 8,
    borderColor: '#E0EAF3',
    backgroundColor: '#FFFFFF',
  },
  expenseFilterCard: {
    gap: 10,
    borderColor: '#DCEAF5',
    backgroundColor: '#F7FBFF',
  },
  expenseFilterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4E5F3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E8F7',
    backgroundColor: '#EDF7FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  monthPillText: {
    color: '#356A91',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  yearFilterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  yearChip: {
    minWidth: 58,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E8F6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChipSelected: {
    borderColor: '#9FCBED',
    backgroundColor: '#E8F4FF',
  },
  yearChipText: {
    color: '#5E8098',
    fontWeight: '700',
    fontSize: 12,
  },
  yearChipTextSelected: {
    color: '#235D89',
  },
  expenseOverviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  expenseStatCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  expenseStatLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  expenseStatValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryList: {
    gap: 8,
  },
  categoryRowWrap: {
    gap: 6,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  categoryValue: {
    color: '#395D78',
    fontWeight: '700',
    fontSize: 12,
  },
  categoryBarTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#EEF4F8',
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  barChartWrap: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 134,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barValueText: {
    color: '#5C7A95',
    fontSize: 10,
    fontWeight: '700',
  },
  barTrack: {
    width: '100%',
    maxWidth: 30,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#EEF4FA',
    borderWidth: 1,
    borderColor: '#DFEAF4',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#79B8EE',
    minHeight: 4,
  },
  barFillSelected: {
    backgroundColor: '#4C93D4',
  },
  barLabel: {
    color: '#5E7F99',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  barLabelSelected: {
    color: '#1F5A86',
  },
  albumPhotoCard: {
    height: 168,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDE8F2',
    backgroundColor: '#EEF4F9',
  },
  albumPhoto: {
    width: '100%',
    height: '100%',
  },
  albumPhotoOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(18, 32, 46, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  albumPhotoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  albumPhotoSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseAmount: {
    color: '#5A3FA8',
    fontWeight: '700',
    fontSize: 13,
  },
});

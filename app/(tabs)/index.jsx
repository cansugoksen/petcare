import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Card, Chip, Screen } from '@/components/pc/ui';
import { PetCareTheme, reminderTypeLabels } from '@/constants/petcare-theme';
import { formatDateTime, toDate } from '@/lib/date-utils';
import { subscribePets, subscribeUpcomingReminders } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function HomeTab() {
  return (
    <AuthGate>
      <HomeTabContent />
    </AuthGate>
  );
}

function HomeTabContent() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [pets, setPets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const unsubs = [
      subscribeUpcomingReminders(
        user.uid,
        (rows) => {
          setReminders(rows.slice(0, 20));
          setError(null);
        },
        (err) => setError(err)
      ),
      subscribePets(
        user.uid,
        (rows) => setPets(rows),
        () => {}
      ),
    ];

    return () => unsubs.forEach((unsub) => unsub?.());
  }, [user?.uid]);

  const stats = useMemo(() => buildReminderStats(reminders, pets), [reminders, pets]);
  const nearestReminder = reminders[0] || null;
  const upcomingList = reminders.slice(0, 5);

  const handleQuickAction = (action) => {
    if (action === 'addPet') {
      router.push('/pets/new');
      return;
    }

    if (!pets.length) {
      Alert.alert('Ã–nce pet ekleyin', 'Bu iÅŸlemi kullanmak iÃ§in Ã¶nce bir pet profili oluÅŸturun.');
      return;
    }

    if (pets.length === 1) {
      const petId = pets[0].id;
      if (action === 'addReminder') router.push(`/pets/${petId}/reminders/new`);
      if (action === 'addWeight') router.push(`/pets/${petId}/weights/new`);
      if (action === 'addLog') router.push(`/pets/${petId}/logs/new`);
      return;
    }

    Alert.alert('Pet seÃ§imi gerekli', 'Ä°lgili kaydÄ± eklemek iÃ§in Ã¶nce pet seÃ§in.', [
      { text: 'VazgeÃ§', style: 'cancel' },
      { text: 'Petler', onPress: () => router.push('/(tabs)/pets') },
    ]);
  };

  const handleStatPress = (key) => {
    if (key === 'pets') {
      router.push('/(tabs)/pets');
      return;
    }

    if (!reminders.length) {
      Alert.alert('KayÄ±t bulunmuyor', 'HenÃ¼z aktif bir hatÄ±rlatma bulunmuyor.');
      return;
    }

    router.push(`/pets/${reminders[0].petId}`);
  };

  return (
    <Screen title="PetCare" subtitle="SaÄŸlÄ±k rutinlerini daha canlÄ± ama sade bir panelden yÃ¶netin.">
      <Card style={styles.heroCard}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />

        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>BugÃ¼n</Text>
            <Text style={styles.heroTitle}>{stats.todayCount > 0 ? `${stats.todayCount} hatÄ±rlatma` : 'Sakin gÃ¼n'}</Text>
            <Text style={styles.heroSubtitle}>
              {nearestReminder
                ? `${nearestReminder.petName || 'Pet'} iÃ§in sÄ±radaki kayÄ±t hazÄ±r.`
                : 'BugÃ¼n iÃ§in planlÄ± hatÄ±rlatma gÃ¶rÃ¼nmÃ¼yor.'}
            </Text>
          </View>
          <Chip label={stats.todayCount > 0 ? 'PlanlÄ±' : 'BoÅŸ'} tone={stats.todayCount > 0 ? 'warning' : 'primary'} />
        </View>

        <View style={styles.heroMiniStats}>
          <HeroPill icon="pets" label={`${stats.petCount} pet`} />
          <HeroPill icon="notifications-active" label={`${stats.activeCount} aktif`} />
          <HeroPill icon="calendar-month" label={`${stats.weekCount} bu hafta`} />
        </View>

        {nearestReminder ? (
          <Pressable
            onPress={() => router.push(`/pets/${nearestReminder.petId}`)}
            style={({ pressed }) => [styles.nearestCard, pressed && { opacity: 0.93 }]}>
            <View style={styles.nearestAccent} />
            <View style={styles.nearestIcon}>
              <MaterialIcons name="schedule" size={17} color="#2C6FA7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nearestTitle} numberOfLines={1}>
                {nearestReminder.title || 'HatÄ±rlatma'}
              </Text>
              <Text style={styles.nearestMeta} numberOfLines={1}>
                {nearestReminder.petName || 'Pet'} â€¢ {formatDateTime(nearestReminder.dueDate)}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#7B97AB" />
          </Pressable>
        ) : (
          <View style={styles.calmCard}>
            <View style={styles.calmIcon}>
              <MaterialIcons name="event-available" size={16} color="#3F8C79" />
            </View>
            <Text style={styles.calmText}>YaklaÅŸan aktif hatÄ±rlatma bulunmuyor.</Text>
          </View>
        )}
      </Card>

      <View style={styles.statsRow}>
        <StatCard label="BugÃ¼n" value={stats.todayCount} icon="today" tone="sky" onPress={() => handleStatPress('today')} />
        <StatCard label="Bu Hafta" value={stats.weekCount} icon="calendar-view-week" tone="mint" onPress={() => handleStatPress('week')} />
        <StatCard label="Petler" value={stats.petCount} icon="pets" tone="violet" onPress={() => handleStatPress('pets')} />
        <StatCard label="Aktif" value={stats.activeCount} icon="notifications-active" tone="amber" onPress={() => handleStatPress('active')} />
      </View>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HÄ±zlÄ± Ä°ÅŸlemler</Text>
          <Text style={styles.sectionSubtle}>Tek dokunuÅŸ</Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction icon="pets" label="Pet Ekle" subtitle="Yeni profil" tone="sky" onPress={() => handleQuickAction('addPet')} />
          <QuickAction
            icon="notifications-active"
            label="HatÄ±rlatma"
            subtitle="AÅŸÄ± / ilaÃ§ / vet"
            tone="mint"
            onPress={() => handleQuickAction('addReminder')}
          />
          <QuickAction icon="timeline" label="Kilo" subtitle="Ã–lÃ§Ã¼m ekle" tone="amber" onPress={() => handleQuickAction('addWeight')} />
          <QuickAction icon="fact-check" label="SaÄŸlÄ±k Notu" subtitle="GÃ¼nlÃ¼k durum" tone="violet" onPress={() => handleQuickAction('addLog')} />
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>YaklaÅŸan HatÄ±rlatmalar</Text>
          {upcomingList.length ? <Chip label={`${upcomingList.length}`} /> : null}
        </View>

        {error ? (
          <View style={styles.inlineNotice}>
            <MaterialIcons name="error-outline" size={15} color={PetCareTheme.colors.danger} />
            <Text style={[styles.inlineNoticeText, { color: PetCareTheme.colors.danger }]}>HatÄ±rlatmalar alÄ±namadÄ±.</Text>
          </View>
        ) : null}

        {!upcomingList.length ? (
          <View style={styles.emptyRow}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="event-available" size={18} color="#6990AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>YaklaÅŸan kayÄ±t yok</Text>
              <Text style={styles.emptySub}>Yeni hatÄ±rlatmalar burada listelenir.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.listWrap}>
            <FlatList
              data={upcomingList}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => router.push(`/pets/${item.petId}`)}
                  style={({ pressed }) => [
                    styles.reminderItem,
                    index < upcomingList.length - 1 && styles.reminderItemBorder,
                    pressed && { opacity: 0.93 },
                  ]}>
                  <View style={styles.reminderBadge}>
                    <Text style={styles.reminderBadgeText}>{shortDate(item.dueDate)}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle} numberOfLines={1}>
                      {item.title || 'HatÄ±rlatma'}
                    </Text>
                    <Text style={styles.reminderMeta} numberOfLines={1}>
                      {item.petName || 'Pet'} â€¢ {reminderTypeLabels[item.type] || 'HatÄ±rlatma'}
                    </Text>
                  </View>

                  <Text style={styles.reminderTime}>{shortTime(item.dueDate)}</Text>
                </Pressable>
              )}
              scrollEnabled={false}
              removeClippedSubviews
              initialNumToRender={5}
              maxToRenderPerBatch={8}
              windowSize={3}
            />
          </View>
        )}
      </Card>
    </Screen>
  );
}

function HeroPill({ icon, label }) {
  return (
    <View style={styles.heroPill}>
      <MaterialIcons name={icon} size={13} color="#3F7092" />
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, icon, tone = 'sky', onPress }) {
  const toneStyle = statTones[tone] || statTones.sky;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statCard, toneStyle.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.statTopRow}>
        <View style={[styles.statIconWrap, toneStyle.iconWrap]}>
          <MaterialIcons name={icon} size={14} color={toneStyle.iconColor} />
        </View>
        <Text style={[styles.statLabel, { color: toneStyle.label }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: toneStyle.value }]}>{value}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, label, subtitle, tone = 'sky', onPress }) {
  const toneStyle = quickTones[tone] || quickTones.sky;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickItem, toneStyle.card, pressed && { opacity: 0.92 }]}>
      <View style={[styles.quickIcon, toneStyle.iconWrap]}>
        <MaterialIcons name={icon} size={17} color={toneStyle.iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.quickSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function buildReminderStats(reminders, pets) {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let todayCount = 0;
  let weekCount = 0;
  let activeCount = 0;

  reminders.forEach((reminder) => {
    const due = toDate(reminder.dueDate);
    if (!due) return;
    if (reminder.active) activeCount += 1;
    if (isSameDay(now, due)) todayCount += 1;
    if (due >= now && due <= next7Days) weekCount += 1;
  });

  return {
    todayCount,
    weekCount,
    petCount: pets.length,
    activeCount,
  };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function shortDate(value) {
  const date = toDate(value);
  if (!date) return '--';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit' }).format(date);
}

function shortTime(value) {
  const date = toDate(value);
  if (!date) return '--:--';
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

const statTones = {
  sky: {
    card: { backgroundColor: '#F2F8FF', borderColor: '#D6E8FA' },
    iconWrap: { backgroundColor: '#E5F0FC' },
    iconColor: '#377AB6',
    label: '#5D83A3',
    value: '#1F5680',
  },
  mint: {
    card: { backgroundColor: '#F0FBF6', borderColor: '#D4EDDE' },
    iconWrap: { backgroundColor: '#E1F7EB' },
    iconColor: '#2C9B73',
    label: '#5E8876',
    value: '#22694F',
  },
  violet: {
    card: { backgroundColor: '#F7F4FF', borderColor: '#E5DCF8' },
    iconWrap: { backgroundColor: '#ECE5FD' },
    iconColor: '#7654C5',
    label: '#7C6BA6',
    value: '#4C3F7D',
  },
  amber: {
    card: { backgroundColor: '#FFF8EE', borderColor: '#F2E0BC' },
    iconWrap: { backgroundColor: '#FCEED3' },
    iconColor: '#C68A1A',
    label: '#957448',
    value: '#76541E',
  },
};

const quickTones = {
  sky: {
    card: { backgroundColor: '#F7FBFF', borderColor: '#DCEAF8' },
    iconWrap: { backgroundColor: '#E8F2FD' },
    iconColor: '#3173AF',
  },
  mint: {
    card: { backgroundColor: '#F4FCF8', borderColor: '#D6EEE0' },
    iconWrap: { backgroundColor: '#E4F8EE' },
    iconColor: '#2B9B74',
  },
  amber: {
    card: { backgroundColor: '#FFF9F0', borderColor: '#F2E0BD' },
    iconWrap: { backgroundColor: '#FCEFD8' },
    iconColor: '#C58A20',
  },
  violet: {
    card: { backgroundColor: '#FAF8FF', borderColor: '#E6DDF9' },
    iconWrap: { backgroundColor: '#EEE8FD' },
    iconColor: '#7758C6',
  },
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#EEF6FD',
    borderColor: '#D8E6F4',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowA: {
    position: 'absolute',
    top: -26,
    right: -14,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: 'rgba(124, 182, 245, 0.18)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -36,
    left: -22,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(78, 206, 163, 0.14)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroEyebrow: {
    color: '#4C7695',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 1,
    color: '#153B57',
    fontSize: 21,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 3,
    color: '#68879D',
    fontSize: 12,
    lineHeight: 17,
  },
  heroMiniStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#D7E6F4',
    backgroundColor: '#FFFFFFC8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: '#4E728D',
    fontSize: 11,
    fontWeight: '700',
  },
  nearestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#DAEAF7',
    backgroundColor: '#FFFFFFD4',
    borderRadius: 14,
    padding: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  nearestAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#65AEEA',
  },
  nearestIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E8F2FB',
    borderWidth: 1,
    borderColor: '#D9E7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearestTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  nearestMeta: {
    marginTop: 1,
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
  },
  calmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D6EFE4',
    backgroundColor: '#F4FCF8',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  calmIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#E6F8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calmText: {
    color: '#487D6D',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    minHeight: 86,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
    gap: 6,
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontWeight: '700',
    fontSize: 23,
  },
  sectionCard: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtle: {
    color: PetCareTheme.colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickItem: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  quickSub: {
    marginTop: 2,
    color: PetCareTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  inlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F2D4D9',
    backgroundColor: '#FFF7F8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#DEE8F0',
    backgroundColor: '#FAFCFE',
    borderRadius: 14,
    padding: 10,
  },
  emptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#ECF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  emptySub: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  listWrap: {
    borderWidth: 1,
    borderColor: '#DFEAF2',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  reminderItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E9EFF4',
  },
  reminderBadge: {
    minWidth: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8E7F4',
    backgroundColor: '#EEF6FD',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  reminderBadgeText: {
    color: '#46769A',
    fontSize: 11,
    fontWeight: '700',
  },
  reminderTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reminderMeta: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  reminderTime: {
    color: '#6B889A',
    fontSize: 11,
    fontWeight: '700',
  },
});


import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, Screen } from '@/components/pc/ui';
import { PetCareTheme, reminderTypeLabels, repeatTypeLabels } from '@/constants/petcare-theme';
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

    return () => {
      unsubs.forEach((unsub) => unsub?.());
    };
  }, [user?.uid]);

  const stats = useMemo(() => buildReminderStats(reminders, pets), [reminders, pets]);
  const nearestReminder = reminders[0] || null;

  const handleQuickAction = (action) => {
    if (action === 'addPet') {
      router.push('/pets/new');
      return;
    }

    if (!pets.length) {
      Alert.alert('Önce pet ekleyin', 'Bu işlemi kullanmak için önce bir pet profili oluşturun.');
      return;
    }

    if (pets.length === 1) {
      const petId = pets[0].id;
      if (action === 'addReminder') {
        router.push(`/pets/${petId}/reminders/new`);
        return;
      }
      if (action === 'addWeight') {
        router.push(`/pets/${petId}/weights/new`);
        return;
      }
      if (action === 'addLog') {
        router.push(`/pets/${petId}/logs/new`);
        return;
      }
    }

    Alert.alert('Pet seçimi gerekli', 'Lütfen önce ilgili peti seçmek için Petler ekranına gidin.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Petlere Git', onPress: () => router.push('/(tabs)/pets') },
    ]);
  };

  return (
    <Screen
      title="PetCare"
      subtitle="Sağlık rutinlerini takip edin, hatırlatmaları kaçırmayın."
      right={
        <Button
          title="+ Pet"
          variant="secondary"
          onPress={() => router.push('/pets/new')}
          style={{ minWidth: 74 }}
        />
      }>
      <Card style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>Bugün</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{stats.todayCount > 0 ? 'Planlı gün' : 'Sakin gün'}</Text>
          </View>
        </View>
        {stats.todayCount > 0 ? (
          <>
            <Text style={styles.heroValue}>
              {stats.todayCount} <Text style={styles.heroValueSuffix}>hatırlatma</Text>
            </Text>
            <Text style={styles.heroSub}>Bugün hatırlatma var. En yakın kaydı kontrol edin.</Text>
          </>
        ) : (
          <Text style={styles.heroSub}>Bugün için planlı hatırlatma bulunmuyor.</Text>
        )}
      </Card>

      <View style={styles.statsGrid}>
        <StatCard label="Bugün" value={String(stats.todayCount)} helper="Yaklaşan hatırlatma" />
        <StatCard label="Bu hafta" value={String(stats.weekCount)} helper="7 gün içinde" />
        <StatCard label="Pet" value={String(stats.petCount)} helper="Aktif profil" />
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
        <View style={styles.quickGrid}>
          <QuickAction title="Hatırlatma Ekle" onPress={() => handleQuickAction('addReminder')} />
          <QuickAction title="Kilo Kaydı" onPress={() => handleQuickAction('addWeight')} />
          <QuickAction title="Sağlık Notu" onPress={() => handleQuickAction('addLog')} />
          <QuickAction title="Petlerim" onPress={() => router.push('/(tabs)/pets')} />
        </View>
      </Card>

      <Card style={styles.spotlightCard}>
        <View style={styles.spotlightHeader}>
          <Text style={styles.sectionTitle}>En Yakın Hatırlatma</Text>
          {nearestReminder ? (
            <Chip label={reminderTypeLabels[nearestReminder.type] || nearestReminder.type} tone="primary" />
          ) : null}
        </View>

        {!nearestReminder ? (
          <Text style={styles.mutedText}>Aktif ve yaklaşan hatırlatma bulunmuyor.</Text>
        ) : (
          <>
            <Text style={styles.spotlightTitle}>{nearestReminder.title}</Text>
            <Text style={styles.mutedText}>Pet: {nearestReminder.petName || 'Bilinmiyor'}</Text>
            <Text style={styles.mutedText}>Tarih: {formatDateTime(nearestReminder.dueDate)}</Text>
            <Text style={styles.mutedText}>
              Tekrar: {repeatTypeLabels[nearestReminder.repeatType] || nearestReminder.repeatType || '-'}
            </Text>
            <Button
              title="Detaya Git"
              variant="secondary"
              onPress={() => router.push(`/pets/${nearestReminder.petId}`)}
            />
          </>
        )}
      </Card>

      {error ? (
        <Card>
          <Text style={{ color: PetCareTheme.colors.danger }}>Hatırlatmalar alınamadı: {error.message}</Text>
          <Text style={styles.helperText}>Gerekirse Firestore index / rules ayarlarınızı kontrol edin.</Text>
        </Card>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Yaklaşan Hatırlatmalar</Text>
        {reminders.length ? <Chip label={`${Math.min(reminders.length, 20)} kayıt`} /> : null}
      </View>

      {reminders.length === 0 ? (
        <Card style={styles.homeEmptyCard}>
          <Text style={styles.homeEmptyTitle}>Yaklaşan hatırlatma yok</Text>
          <Text style={styles.homeEmptyDescription}>
            Pet ekleyip hatırlatma oluşturduğunuzda burada listelenecek.
          </Text>
        </Card>
      ) : (
        reminders.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/pets/${item.petId}`)}
            style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
            <Card>
              <View style={styles.reminderHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Chip label={reminderTypeLabels[item.type] || item.type} tone="primary" />
              </View>
              <Text style={styles.cardLine}>Pet: {item.petName || 'Bilinmiyor'}</Text>
              <Text style={styles.cardLine}>Tarih: {formatDateTime(item.dueDate)}</Text>
              <Text style={styles.cardLine}>
                Tekrar: {repeatTypeLabels[item.repeatType] || item.repeatType || '-'}
              </Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  );
}

function QuickAction({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.85 }]}>
      <Text style={styles.quickActionText}>{title}</Text>
    </Pressable>
  );
}

function buildReminderStats(reminders, pets) {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let todayCount = 0;
  let weekCount = 0;

  reminders.forEach((reminder) => {
    const due = toDate(reminder.dueDate);
    if (!due) {
      return;
    }

    if (isSameDay(now, due)) {
      todayCount += 1;
    }

    if (due >= now && due <= next7Days) {
      weekCount += 1;
    }
  });

  return {
    todayCount,
    weekCount,
    petCount: pets.length,
  };
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#EAF5FF',
    borderColor: '#CFE5F8',
    gap: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heroLabel: {
    color: '#2C5E86',
    fontSize: 13,
    fontWeight: '700',
  },
  heroBadge: {
    backgroundColor: '#D8ECFB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#BEDCF5',
  },
  heroBadgeText: {
    color: '#255C87',
    fontSize: 11,
    fontWeight: '700',
  },
  heroValue: {
    color: '#10314A',
    fontSize: 30,
    fontWeight: '700',
  },
  heroValueSuffix: {
    fontSize: 16,
    color: '#46779D',
    fontWeight: '600',
  },
  heroSub: {
    color: '#537892',
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    color: '#5A7F9E',
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: '#173D5B',
    fontSize: 24,
    fontWeight: '700',
  },
  statHelper: {
    color: '#6E90AA',
    fontSize: 11,
  },
  sectionTitle: {
    color: '#285C84',
    fontWeight: '700',
    fontSize: 15,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAction: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  quickActionText: {
    color: '#2C5E86',
    fontWeight: '600',
    fontSize: 13,
  },
  spotlightCard: {
    gap: 8,
  },
  spotlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  spotlightTitle: {
    color: '#1F4F75',
    fontSize: 16,
    fontWeight: '700',
  },
  mutedText: {
    color: '#6A8AA3',
    fontSize: 13,
    lineHeight: 18,
  },
  helperText: {
    color: '#6A8AA3',
    fontSize: 12,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: '#214F73',
    fontWeight: '700',
    fontSize: 16,
  },
  cardLine: {
    color: '#6C8BA4',
    fontSize: 13,
  },
  homeEmptyCard: {
    backgroundColor: '#F2F8FD',
    borderColor: '#D7E8F6',
    gap: 6,
  },
  homeEmptyTitle: {
    color: '#2E628C',
    fontWeight: '700',
    fontSize: 15,
  },
  homeEmptyDescription: {
    color: '#6D8FA8',
    fontSize: 13,
    lineHeight: 18,
  },
});

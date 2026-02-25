import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, EmptyState, Screen } from '@/components/pc/ui';
import {
  getPetGenderLabel,
  getPetSpeciesLabel,
  PetCareTheme,
  reminderTypeLabels,
  repeatTypeLabels,
} from '@/constants/petcare-theme';
import { formatDateOnly, formatDateTime } from '@/lib/date-utils';
import {
  deleteHealthLog,
  deleteReminder,
  deleteWeightEntry,
  subscribeHealthLogs,
  subscribePet,
  subscribeReminders,
  subscribeWeights,
} from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const PET_TABS = [
  { key: 'reminders', label: 'Hatırlatmalar', icon: 'notifications-active' },
  { key: 'weights', label: 'Kilo', icon: 'timeline' },
  { key: 'logs', label: 'Sağlık', icon: 'fact-check' },
];

export default function PetDetailRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <PetDetailScreen petId={petId} />
    </AuthGate>
  );
}

function PetDetailScreen({ petId }) {
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [weights, setWeights] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('reminders');

  useEffect(() => {
    if (!user?.uid || !petId) {
      return undefined;
    }

    const unsubs = [
      subscribePet(user.uid, petId, setPet, setError),
      subscribeReminders(user.uid, petId, setReminders, setError),
      subscribeWeights(user.uid, petId, setWeights, setError),
      subscribeHealthLogs(user.uid, petId, setLogs, setError),
    ];

    return () => unsubs.forEach((unsub) => unsub?.());
  }, [petId, user?.uid]);

  const reminderSummary = useMemo(() => {
    const activeCount = reminders.filter((item) => item.active).length;
    return `${activeCount} aktif / ${reminders.length} toplam`;
  }, [reminders]);

  const weightSummary = useMemo(() => {
    if (!weights.length) return 'Henüz kayıt yok';
    const latest = weights[0];
    return `Son kayıt: ${latest?.valueKg ?? latest?.weight ?? '-'} kg`;
  }, [weights]);

  const logSummary = useMemo(() => {
    if (!logs.length) return 'Henüz not yok';
    return `${logs.length} sağlık notu`;
  }, [logs]);

  const confirmDeleteReminder = (reminder) => {
    Alert.alert('Hatırlatmayı sil', reminder.title || 'Hatırlatma', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(user.uid, petId, reminder.id);
            Alert.alert('Silindi', 'Hatırlatma silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const confirmDeleteWeight = (entry) => {
    Alert.alert('Kilo kaydını sil', `${entry.valueKg ?? entry.weight ?? '-'} kg`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWeightEntry(user.uid, petId, entry.id);
            Alert.alert('Silindi', 'Kilo kaydı silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const confirmDeleteLog = (entry) => {
    Alert.alert('Sağlık notunu sil', 'Bu kayıt silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHealthLog(user.uid, petId, entry.id);
            Alert.alert('Silindi', 'Sağlık notu silindi.');
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      title={pet?.name || 'Pet Detayı'}
      subtitle={pet ? `${getPetSpeciesLabel(pet.species)} sağlık takibi` : 'Yükleniyor...'}
      right={<Button title="Düzenle" variant="secondary" onPress={() => router.push(`/pets/${petId}/edit`)} />}>
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

      <Card style={styles.segmentCard}>
        <View style={styles.segmentHeader}>
          <Text style={styles.segmentTitle}>Takip Bölümleri</Text>
          <Text style={styles.segmentSub}>Sekmeler arasında geçiş yapın</Text>
        </View>

        <View style={styles.segmentRow}>
          {PET_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [
                  styles.segmentButton,
                  active && styles.segmentButtonActive,
                  pressed && { opacity: 0.92 },
                ]}>
                <MaterialIcons name={tab.icon} size={15} color={active ? '#174D73' : '#5C7D94'} />
                <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {activeTab === 'reminders' ? (
        <SectionBlock
          title="Hatırlatmalar"
          subtitle={reminderSummary}
          addLabel="Hatırlatma"
          onAdd={() => router.push(`/pets/${petId}/reminders/new`)}>
          {reminders.length === 0 ? (
            <EmptyState title="Hatırlatma yok" description="Aşı, ilaç veya veteriner randevusu ekleyin." />
          ) : (
            reminders.map((item) => (
              <Card key={item.id} style={styles.contentCard}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.itemTitle}>{item.title || 'Hatırlatma'}</Text>
                    <Text style={styles.subText}>{formatDateTime(item.dueDate)}</Text>
                    <Text style={styles.subText}>
                      Tekrar: {repeatTypeLabels[item.repeatType] || 'Yok'}
                      {item.repeatType === 'customDays' && item.customDaysInterval ? ` (${item.customDaysInterval} günde bir)` : ''}
                    </Text>
                  </View>
                  <Chip label={reminderTypeLabels[item.type] || item.type || 'Hatırlatma'} tone="primary" />
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
        <SectionBlock title="Kilo Geçmişi" subtitle={weightSummary} addLabel="Kilo" onAdd={() => router.push(`/pets/${petId}/weights/new`)}>
          {weights.length === 0 ? (
            <EmptyState title="Kilo kaydı yok" description="Düzenli kilo takibi için kayıt ekleyin." />
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
        <SectionBlock title="Sağlık Notları" subtitle={logSummary} addLabel="Not" onAdd={() => router.push(`/pets/${petId}/logs/new`)}>
          {logs.length === 0 ? (
            <EmptyState title="Sağlık notu yok" description="Belirti ve davranış gözlemlerini kaydedin." />
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
});

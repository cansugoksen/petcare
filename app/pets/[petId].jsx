import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, EmptyState, Screen } from '@/components/pc/ui';
import { getPetSpeciesLabel, PetCareTheme, reminderTypeLabels } from '@/constants/petcare-theme';
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

    return () => {
      unsubs.forEach((unsub) => unsub?.());
    };
  }, [petId, user?.uid]);

  const confirmDeleteReminder = (reminder) => {
    Alert.alert('Hatırlatma sil', reminder.title, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(user.uid, petId, reminder.id);
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const confirmDeleteWeight = (entry) => {
    Alert.alert('Kilo kaydını sil', `${entry.valueKg} kg`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWeightEntry(user.uid, petId, entry.id);
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
        <Card>
          <Text style={{ color: PetCareTheme.colors.danger }}>{error.message}</Text>
        </Card>
      ) : null}

      {pet ? (
        <Card>
          <View style={styles.petHeader}>
            <View style={styles.photoWrap}>
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={styles.photo} contentFit="cover" />
              ) : (
                <Text style={styles.photoFallback}>{pet.name?.slice(0, 1)?.toUpperCase() || '?'}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.petName}>{pet.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={getPetSpeciesLabel(pet.species)} />
                {pet.currentWeight ? <Chip label={`${pet.currentWeight} kg`} tone="primary" /> : null}
              </View>
              {pet.birthDate ? <Text style={styles.subText}>Doğum: {formatDateOnly(pet.birthDate)}</Text> : null}
            </View>
          </View>
        </Card>
      ) : null}

      <SectionHeader
        title="Hatırlatmalar"
        onAdd={() => router.push(`/pets/${petId}/reminders/new`)}
        addLabel="Hatırlatma"
      />
      {reminders.length === 0 ? (
        <EmptyState title="Hatırlatma yok" description="Aşı, ilaç veya veteriner randevusu ekle." />
      ) : (
        reminders.map((item) => (
          <Card key={item.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.subText}>{formatDateTime(item.dueDate)}</Text>
              </View>
              <Chip label={reminderTypeLabels[item.type] || item.type} tone="primary" />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.subText}>{item.active ? 'Aktif' : 'Pasif'}</Text>
              <View style={styles.inlineActions}>
                <IconButton icon="edit" onPress={() => router.push(`/pets/${petId}/reminders/${item.id}/edit`)} />
                <IconButton icon="delete" danger onPress={() => confirmDeleteReminder(item)} />
              </View>
            </View>
          </Card>
        ))
      )}

      <SectionHeader title="Kilo Geçmişi" onAdd={() => router.push(`/pets/${petId}/weights/new`)} addLabel="Kilo" />
      {weights.length === 0 ? (
        <EmptyState title="Kilo kaydı yok" description="Düzenli kilo takibi için kayıt ekle." />
      ) : (
        weights.map((item) => (
          <Card key={item.id}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.itemTitle}>{item.valueKg} kg</Text>
                <Text style={styles.subText}>{formatDateTime(item.measuredAt)}</Text>
              </View>
              <IconButton icon="delete" danger onPress={() => confirmDeleteWeight(item)} />
            </View>
            {item.note ? <Text style={styles.subText}>{item.note}</Text> : null}
          </Card>
        ))
      )}

      <SectionHeader title="Sağlık Notları" onAdd={() => router.push(`/pets/${petId}/logs/new`)} addLabel="Not" />
      {logs.length === 0 ? (
        <EmptyState title="Sağlık notu yok" description="Belirti ve davranış gözlemlerini kaydet." />
      ) : (
        logs.map((item) => (
          <Card key={item.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>{formatDateTime(item.loggedAt)}</Text>
              <IconButton icon="delete" danger onPress={() => confirmDeleteLog(item)} />
            </View>
            <View style={styles.tagsWrap}>
              {(item.tags || []).map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
            <Text style={styles.subText}>{item.note || 'Not yok'}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Button title={`+ ${addLabel}`} variant="secondary" onPress={onAdd} />
    </View>
  );
}

function IconButton({ icon, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.8 }]}>
      <MaterialIcons name={icon} size={18} color={danger ? PetCareTheme.colors.danger : PetCareTheme.colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  petHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  photoWrap: {
    width: 78,
    height: 78,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
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
    color: PetCareTheme.colors.text,
  },
  subText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  rowBetween: {
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
  inlineActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});

import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, EmptyState, Screen } from '@/components/pc/ui';
import { getPetSpeciesLabel, PetCareTheme } from '@/constants/petcare-theme';
import { formatDateOnly } from '@/lib/date-utils';
import { deletePet, subscribePets } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function PetsTab() {
  return (
    <AuthGate>
      <PetsTabContent />
    </AuthGate>
  );
}

function PetsTabContent() {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const unsubscribe = subscribePets(
      user.uid,
      (rows) => {
        setPets(rows);
        setError(null);
      },
      (err) => setError(err)
    );

    return unsubscribe;
  }, [user?.uid]);

  const handleDelete = (pet) => {
    Alert.alert('Pet silinsin mi?', `${pet.name} kaydı ve alt verileri silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(pet.id);
            await deletePet(user.uid, pet.id);
          } catch (err) {
            Alert.alert('Hata', err.message);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      title="Petlerim"
      subtitle="Kedi, köpek ve kuş profillerini buradan yönet."
      right={<Button title="+ Ekle" onPress={() => router.push('/pets/new')} style={{ minWidth: 84 }} />}>
      {error ? (
        <Card>
          <Text style={{ color: PetCareTheme.colors.danger }}>{error.message}</Text>
        </Card>
      ) : null}

      {pets.length === 0 ? (
        <EmptyState
          title="Henüz pet yok"
          description="İlk pet profilini ekleyerek hatırlatmaları oluşturmaya başla."
        />
      ) : (
        pets.map((pet) => (
          <Card key={pet.id}>
            <Pressable onPress={() => router.push(`/pets/${pet.id}`)} style={styles.petRow}>
              <View style={styles.photoBox}>
                {pet.photoUrl ? (
                  <Image source={{ uri: pet.photoUrl }} style={styles.photo} contentFit="cover" />
                ) : (
                  <Text style={styles.photoPlaceholder}>{pet.name?.slice(0, 1)?.toUpperCase() || '?'}</Text>
                )}
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Chip label={getPetSpeciesLabel(pet.species)} />
                </View>
                {pet.birthDate ? (
                  <Text style={styles.metaText}>Doğum: {formatDateOnly(pet.birthDate)}</Text>
                ) : null}
                {pet.currentWeight ? (
                  <Text style={styles.metaText}>Kilo: {pet.currentWeight} kg</Text>
                ) : null}
              </View>
            </Pressable>

            <View style={styles.actionsRow}>
              <Button title="Detay" variant="secondary" onPress={() => router.push(`/pets/${pet.id}`)} />
              <Button title="Düzenle" variant="secondary" onPress={() => router.push(`/pets/${pet.id}/edit`)} />
              <Button
                title={deletingId === pet.id ? 'Siliniyor...' : 'Sil'}
                variant="danger"
                disabled={deletingId === pet.id}
                onPress={() => handleDelete(pet)}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  petRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  photoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
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
  photoPlaceholder: {
    fontSize: 24,
    fontWeight: '700',
    color: PetCareTheme.colors.textMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  petName: {
    fontSize: 17,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  metaText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
});

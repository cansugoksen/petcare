import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, EmptyState, Screen } from '@/components/pc/ui';
import { getPetSpeciesLabel, PetCareTheme } from '@/constants/petcare-theme';
import { deleteLocalFileIfExists } from '@/lib/media';
import { deletePet, subscribePets, subscribeSharedPet, subscribeSharedPetMemberships } from '@/lib/petcare-db';
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
  const [legacyPets, setLegacyPets] = useState([]);
  const [sharedMemberships, setSharedMemberships] = useState([]);
  const [sharedPetsById, setSharedPetsById] = useState({});
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = subscribePets(
      user.uid,
      (rows) => {
        setLegacyPets(rows);
        setError(null);
      },
      (err) => setError(err)
    );

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = subscribeSharedPetMemberships(
      user.uid,
      (rows) => {
        setSharedMemberships(rows);
      },
      () => {
        // Shared pets draft altyapÄ±sÄ± henÃ¼z her kullanÄ±cÄ±da aktif olmayabilir.
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!sharedMemberships.length) {
      setSharedPetsById({});
      return undefined;
    }

    let active = true;
    const nextMap = {};
    const unsubscribers = sharedMemberships.map((membership) => {
      const petId = membership.petId || membership.id;
      return subscribeSharedPet(
        petId,
        (pet) => {
          if (!active) return;
          if (pet) nextMap[petId] = pet;
          else delete nextMap[petId];
          setSharedPetsById({ ...nextMap });
        },
        () => {}
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [sharedMemberships]);

  const pets = useMemo(() => {
    const legacy = legacyPets.map((pet) => ({ ...pet, _source: 'legacy', _role: 'owner' }));
    const legacyIds = new Set(legacy.map((pet) => pet.id));

    const shared = sharedMemberships
      .map((membership) => {
        const petId = membership.petId || membership.id;
        if (!petId || legacyIds.has(petId)) return null;
        const pet = sharedPetsById[petId];
        if (!pet) return null;
        return {
          ...pet,
          id: petId,
          _source: 'shared',
          _role: membership.role || 'viewer',
          _membership: membership,
        };
      })
      .filter(Boolean);

    return [...legacy, ...shared];
  }, [legacyPets, sharedMemberships, sharedPetsById]);

  const summary = useMemo(() => buildPetSummary(pets), [pets]);

  const handleDelete = (pet) => {
    if (pet._source === 'shared') {
      Alert.alert('Bilgi', 'Ortak pet kaydÄ± bu ekrandan silinemez.');
      return;
    }

    Alert.alert('Pet silinsin mi?', `${pet.name} kaydÄ± ve alt verileri silinecek.`, [
      { text: 'VazgeÃ§', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(pet.id);
            await deletePet(user.uid, pet.id);
            await deleteLocalFileIfExists(pet.photoLocalPath || pet.photoLocalUri);
            Alert.alert('Silindi', `${pet.name} kaydÄ± silindi.`);
          } catch (err) {
            Alert.alert('Hata', err.message);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleOpenPet = (pet) => {
    if (pet._source === 'shared') {
      Alert.alert('HazÄ±rlanÄ±yor', 'Ortak pet detay ekranÄ± yeni veri modeline taÅŸÄ±nÄ±yor.');
      return;
    }
    router.push(`/pets/${pet.id}`);
  };

  const handleEditPet = (pet) => {
    if (pet._source === 'shared') {
      Alert.alert('HazÄ±rlanÄ±yor', 'Ortak pet dÃ¼zenleme akÄ±ÅŸÄ± sonraki adÄ±mda aÃ§Ä±lacak.');
      return;
    }
    router.push(`/pets/${pet.id}/edit`);
  };

  return (
    <Screen
      title="Petlerim"
      subtitle="Kedi, kÃ¶pek ve kuÅŸ profillerini tek yerden yÃ¶netin."
      right={<Button title="+ Ekle" onPress={() => router.push('/pets/new')} style={{ minWidth: 84 }} />}>
      <Card style={styles.heroCard}>
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.heroEyebrow}>Profil YÃ¶netimi</Text>
            <Text style={styles.heroTitle}>{pets.length ? `${pets.length} pet profili aktif` : 'Ä°lk pet profilini oluÅŸturun'}</Text>
            <Text style={styles.heroSub}>Profilleri dÃ¼zenleyin, detaylara girin ve saÄŸlÄ±k takibini baÅŸlatÄ±n.</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <MaterialIcons name="pets" size={22} color="#2A5D85" />
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryMiniCard label="Toplam" value={summary.total} tone="sky" />
          <SummaryMiniCard label="Kedi" value={summary.cats} tone="violet" />
          <SummaryMiniCard label="KÃ¶pek" value={summary.dogs} tone="mint" />
          <SummaryMiniCard label="KuÅŸ" value={summary.birds} tone="amber" />
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={16} color={PetCareTheme.colors.danger} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        </Card>
      ) : null}

      {pets.length === 0 ? (
        <EmptyState title="HenÃ¼z pet yok" description="Ä°lk pet profilini ekleyerek hatÄ±rlatmalarÄ± oluÅŸturmaya baÅŸlayÄ±n." />
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(pet) => `${pet._source || 'legacy'}-${pet.id}`}
          renderItem={({ item: pet }) => {
            const isShared = pet._source === 'shared';
            return (
              <Card style={styles.petCard}>
                <Pressable onPress={() => handleOpenPet(pet)} style={({ pressed }) => [styles.petCardPress, pressed && { opacity: 0.95 }]}>
                  <View style={styles.petHeaderRow}>
                    <View style={styles.photoWrap}>
                      <View style={styles.photoGlow} />
                      <View style={styles.photoBox}>
                        {pet.photoUrl || pet.photoLocalUri ? (
                          <Image source={{ uri: pet.photoUrl || pet.photoLocalUri }} style={styles.photo} contentFit="cover" />
                        ) : (
                          <Text style={styles.photoPlaceholder}>{pet.name?.slice(0, 1)?.toUpperCase() || '?'}</Text>
                        )}
                      </View>
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.titleRow}>
                        <Text style={styles.petName} numberOfLines={1}>
                          {pet.name}
                        </Text>
                        <SpeciesPill species={pet.species} />
                      </View>

                      {isShared ? (
                        <View style={styles.badgeRow}>
                          <SoftBadge icon="groups" label={`Ortak â€¢ ${getMemberRoleLabel(pet._role)}`} />
                        </View>
                      ) : (
                        <Text style={styles.metaHint}>Detay ve dÃ¼zenle ekranÄ±ndan yÃ¶netin</Text>
                      )}
                    </View>

                    <View style={styles.chevronWrap}>
                      <MaterialIcons name="chevron-right" size={18} color="#7D99AD" />
                    </View>
                  </View>
                </Pressable>

                <View style={styles.actionRow}>
                  <ActionPill icon="visibility" label="Detay" tone="sky" onPress={() => handleOpenPet(pet)} />
                  {isShared ? (
                    <ActionPill icon="group" label="Aile" tone="mint" onPress={() => router.push(`/pets/${pet.id}/family-access`)} />
                  ) : (
                    <>
                      <ActionPill icon="edit" label="DÃ¼zenle" tone="mint" onPress={() => handleEditPet(pet)} />
                      <ActionPill
                        icon="delete-outline"
                        label={deletingId === pet.id ? 'Siliniyor...' : 'Sil'}
                        tone="danger"
                        disabled={deletingId === pet.id}
                        onPress={() => handleDelete(pet)}
                      />
                    </>
                  )}
                </View>
              </Card>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.petListGap} />}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={12}
          windowSize={5}
          contentContainerStyle={styles.petListContent}
        />
      )}
    </Screen>
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

function SoftBadge({ icon, label }) {
  return (
    <View style={styles.softBadge}>
      <MaterialIcons name={icon} size={12} color="#5C7B92" />
      <Text style={styles.softBadgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SummaryMiniCard({ label, value, tone = 'sky' }) {
  const palette = summaryTones[tone] || summaryTones.sky;
  return (
    <View style={[styles.summaryMiniCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.summaryDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.summaryMiniLabel, { color: palette.label }]}>{label}</Text>
      <Text style={[styles.summaryMiniValue, { color: palette.value }]}>{value}</Text>
    </View>
  );
}

function ActionPill({ icon, label, onPress, tone = 'sky', disabled }) {
  const palette = actionTones[tone] || actionTones.sky;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionPill,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && { opacity: 0.55 },
        pressed && !disabled && { opacity: 0.9 },
      ]}>
      <MaterialIcons name={icon} size={16} color={palette.color} />
      <Text style={[styles.actionPillText, { color: palette.color }]}>{label}</Text>
    </Pressable>
  );
}

function buildPetSummary(pets) {
  return pets.reduce(
    (acc, pet) => {
      acc.total += 1;
      if (pet.species === 'cat') acc.cats += 1;
      if (pet.species === 'dog') acc.dogs += 1;
      if (pet.species === 'bird') acc.birds += 1;
      return acc;
    },
    { total: 0, cats: 0, dogs: 0, birds: 0 }
  );
}

function getMemberRoleLabel(role) {
  if (role === 'owner') return 'Owner';
  if (role === 'family') return 'Family';
  if (role === 'viewer') return 'Viewer';
  return 'Ãœye';
}

const summaryTones = {
  sky: { bg: '#F3F9FF', border: '#DBEAF8', dot: '#65AEEA', label: '#5D82A2', value: '#22557E' },
  violet: { bg: '#F7F4FF', border: '#E6DDF9', dot: '#8D74DC', label: '#7B6BA7', value: '#4C3F7D' },
  mint: { bg: '#F1FBF6', border: '#D7EEDF', dot: '#5BB78B', label: '#5E8876', value: '#23694F' },
  amber: { bg: '#FFF9EE', border: '#F3E1BD', dot: '#D7A448', label: '#957548', value: '#76551F' },
};

const actionTones = {
  sky: { bg: '#F4FAFF', border: '#DBEAF8', color: '#2D6C9E' },
  mint: { bg: '#F2FBF7', border: '#D6EEDF', color: '#2A8E6B' },
  danger: { bg: '#FFF4F6', border: '#F3CFD5', color: PetCareTheme.colors.danger },
};

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#EEF7FF',
    borderColor: '#D7E8F6',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowA: {
    position: 'absolute',
    top: -32,
    right: -18,
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: 'rgba(120, 186, 255, 0.16)',
  },
  heroGlowB: {
    position: 'absolute',
    bottom: -38,
    left: -26,
    width: 102,
    height: 102,
    borderRadius: 999,
    backgroundColor: 'rgba(132, 112, 219, 0.12)',
  },
  heroTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    color: '#5C82A0',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#234F74',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  heroSub: {
    color: '#6F8EA7',
    fontSize: 12,
    lineHeight: 17,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DDEFFD',
    borderWidth: 1,
    borderColor: '#CFE4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryMiniCard: {
    width: '48.8%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 2,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: 2,
  },
  summaryMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.95,
  },
  summaryMiniValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  errorCard: {
    borderColor: '#F2D0D5',
    backgroundColor: '#FFF5F6',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: PetCareTheme.colors.danger,
    flex: 1,
    fontSize: 13,
  },
  petListContent: {
    gap: 0,
  },
  petListGap: {
    height: 10,
  },
  petCard: {
    gap: 12,
    borderRadius: 18,
    borderColor: '#DFEAF2',
    backgroundColor: '#FFFFFF',
  },
  petCardPress: {
    borderRadius: 14,
  },
  petHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  photoWrap: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoGlow: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: '#EDF5FD',
    borderWidth: 1,
    borderColor: '#DEEBF6',
  },
  photoBox: {
    width: 70,
    height: 70,
    borderRadius: 20,
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
    color: '#204F73',
    flexShrink: 1,
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  softBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#DFEAF1',
    backgroundColor: '#F8FBFE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  softBadgeText: {
    color: '#5E7D92',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 180,
  },
  metaWrap: {
    gap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#6E8EA7',
    fontSize: 12,
  },
  metaHint: {
    color: '#7A97AA',
    fontSize: 11,
    fontWeight: '600',
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E1EBF3',
    backgroundColor: '#F8FBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  actionPillText: {
    fontWeight: '700',
    fontSize: 12,
  },
});


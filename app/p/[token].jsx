import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Card, Chip, Screen } from '@/components/pc/ui';
import { getPetGenderLabel, getPetSpeciesLabel, PetCareTheme } from '@/constants/petcare-theme';
import { subscribePublicPetProfile } from '@/lib/petcare-db';

export default function PublicPetProfileRoute() {
  const params = useLocalSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    return subscribePublicPetProfile(
      token,
      (data) => {
        setProfile(data);
        setError('');
      },
      () => setError('Profil yüklenemedi.')
    );
  }, [token]);

  const payload = profile?.payload || null;
  const disabled = profile && profile.enabled === false;

  return (
    <Screen
      title={payload?.displayName || 'Pet Profili'}
      subtitle="PetCare Dijital Kimlik"
      right={payload?.species ? <Chip label={getPetSpeciesLabel(payload.species)} /> : null}>
      {!token ? (
        <Card>
          <Text style={styles.title}>Geçersiz QR</Text>
          <Text style={styles.text}>Bağlantı bilgisi bulunamadı.</Text>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <Text style={styles.title}>Hata</Text>
          <Text style={styles.text}>{error}</Text>
        </Card>
      ) : null}

      {!error && !profile ? (
        <Card>
          <Text style={styles.title}>Yükleniyor...</Text>
          <Text style={styles.text}>Dijital kimlik kartı hazırlanıyor.</Text>
        </Card>
      ) : null}

      {disabled ? (
        <Card style={styles.warnCard}>
          <Text style={styles.warnTitle}>Profil erişime kapalı</Text>
          <Text style={styles.warnText}>Bu QR kart şu anda devre dışı bırakılmış.</Text>
        </Card>
      ) : null}

      {payload && !disabled ? (
        <>
          <Card style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                <MaterialIcons name="pets" size={26} color="#2C6E9F" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.heroName}>{payload.displayName || 'Pet'}</Text>
                <View style={styles.chipRow}>
                  {payload.species ? <Chip label={getPetSpeciesLabel(payload.species)} /> : null}
                  {payload.gender ? <Chip label={getPetGenderLabel(payload.gender)} /> : null}
                  {payload.weight ? <Chip label={`${payload.weight} kg`} /> : null}
                </View>
              </View>
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
            <InfoRow label="Cins" value={payload.breed} />
            <InfoRow label="Alerjiler" value={Array.isArray(payload.allergies) ? payload.allergies.join(', ') : null} />
            <InfoRow label="Aşı Durumu" value={payload.vaccineStatusSummary} />
            <InfoRow label="Acil Not" value={payload.emergencyNote} />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Sahip İletişim</Text>
            <InfoRow label="Sahip" value={payload.ownerName} />
            <InfoRow label="Telefon" value={payload.ownerPhone} />
            {!payload.ownerName && !payload.ownerPhone ? (
              <Text style={styles.text}>Sahip iletişim alanları bu kartta paylaşılmıyor.</Text>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Bilgilendirme</Text>
            <Text style={styles.text}>
              Bu sayfa pet sahibinin paylaşıma açtığı sınırlı dijital kimlik bilgisini gösterir. Acil durumda mümkünse pet sahibine ulaşın.
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#F4FAFF',
    borderColor: '#DCEAF8',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D8EAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  infoRow: {
    borderWidth: 1,
    borderColor: '#E3EDF4',
    borderRadius: 10,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  infoLabel: {
    color: '#5F7B8F',
    fontSize: 11,
    fontWeight: '600',
  },
  infoValue: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  text: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  warnCard: {
    backgroundColor: '#FFF8EB',
    borderColor: '#F2DFBD',
  },
  warnTitle: {
    color: '#845D12',
    fontWeight: '700',
    fontSize: 13,
  },
  warnText: {
    color: '#8F733C',
    fontSize: 12,
    lineHeight: 17,
  },
});


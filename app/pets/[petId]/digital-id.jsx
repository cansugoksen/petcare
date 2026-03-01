import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, Field, Screen } from '@/components/pc/ui';
import { getPetGenderLabel, getPetSpeciesLabel, PetCareTheme } from '@/constants/petcare-theme';
import { formatDateOnly, toDate } from '@/lib/date-utils';
import {
  subscribePet,
  subscribePetQrProfile,
  subscribeReminders,
  upsertPublicPetProfileSnapshot,
  upsertPetQrProfile,
} from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const DEFAULT_VISIBLE_FIELDS = {
  ownerName: true,
  ownerPhone: true,
  allergies: true,
  vaccineStatus: true,
  emergencyNote: true,
  breed: true,
  gender: true,
  weight: false,
};

const FIELD_TOGGLES = [
  { key: 'ownerName', label: 'Sahip adı' },
  { key: 'ownerPhone', label: 'Telefon' },
  { key: 'allergies', label: 'Alerjiler' },
  { key: 'vaccineStatus', label: 'Aşı durumu özeti' },
  { key: 'emergencyNote', label: 'Acil not' },
  { key: 'breed', label: 'Cins' },
  { key: 'gender', label: 'Cinsiyet' },
  { key: 'weight', label: 'Kilo' },
];

export default function PetDigitalIdRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;
  return (
    <AuthGate>
      <PetDigitalIdScreen petId={petId} />
    </AuthGate>
  );
}

function PetDigitalIdScreen({ petId }) {
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [qrProfile, setQrProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    enabled: true,
    displayName: '',
    ownerName: '',
    ownerPhone: '',
    allergiesText: '',
    emergencyNote: '',
    visibleFields: DEFAULT_VISIBLE_FIELDS,
  });

  useEffect(() => {
    if (!user?.uid || !petId) return undefined;
    const unsubs = [
      subscribePet(user.uid, petId, setPet, () => {}),
      subscribeReminders(user.uid, petId, setReminders, () => {}),
      subscribePetQrProfile(user.uid, petId, setQrProfile, () => {}),
    ];
    return () => unsubs.forEach((u) => u?.());
  }, [petId, user?.uid]);

  useEffect(() => {
    if (!pet) return;
    setDraft((prev) => ({
      ...prev,
      displayName: qrProfile?.displayName ?? pet.name ?? '',
      ownerName: qrProfile?.ownerName ?? user?.displayName ?? '',
      ownerPhone: qrProfile?.ownerPhone ?? '',
      allergiesText: Array.isArray(qrProfile?.allergies) ? qrProfile.allergies.join(', ') : '',
      emergencyNote: qrProfile?.emergencyNote ?? '',
      enabled: qrProfile?.enabled ?? true,
      visibleFields: { ...DEFAULT_VISIBLE_FIELDS, ...(qrProfile?.visibleFields || {}) },
    }));
  }, [pet, qrProfile, user?.displayName]);

  const vaccineSummary = useMemo(() => buildVaccineSummary(reminders), [reminders]);
  const publicToken = qrProfile?.publicToken || null;
  const publicUrl = publicToken ? `https://petcare.app/p/${publicToken}` : '';
  const previewRows = useMemo(
    () => buildQrPreviewRows({ pet, draft, vaccineSummary }),
    [pet, draft, vaccineSummary]
  );

  const generateProfile = async () => {
    if (!user?.uid || !petId || !pet) return;
    try {
      setBusy(true);
      const token = publicToken || createQrPublicToken();
      const privatePayload = {
        enabled: draft.enabled,
        publicToken: token,
        tokenVersion: Number(qrProfile?.tokenVersion || 0) + (publicToken ? 0 : 1),
        displayName: draft.displayName || pet.name || 'Pet',
        ownerName: draft.ownerName || '',
        ownerPhone: draft.ownerPhone || '',
        emergencyNote: draft.emergencyNote || '',
        allergies: splitAllergies(draft.allergiesText),
        visibleFields: draft.visibleFields,
        vaccineStatusSummary: vaccineSummary,
      };
      await upsertPetQrProfile(user.uid, petId, privatePayload);
      await upsertPublicPetProfileSnapshot(token, buildPublicQrSnapshot({ pet, privatePayload }));
      Alert.alert('Hazır', 'Dijital kimlik / QR kart profili kaydedildi.');
    } catch (err) {
      Alert.alert('Hata', err.message || 'QR kart kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const rotateToken = async () => {
    if (!user?.uid || !petId || !pet) return;
    Alert.alert('QR bağlantısını yenile', 'Eski QR linki geçersiz olacak. Devam edilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Yenile',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            const nextToken = createQrPublicToken();
            const nextPayload = {
              ...sanitizeQrPayload({ pet, draft, vaccineSummary }),
              publicToken: nextToken,
              tokenVersion: Number(qrProfile?.tokenVersion || 0) + 1,
              enabled: draft.enabled,
            };
            await upsertPetQrProfile(user.uid, petId, nextPayload);
            await upsertPublicPetProfileSnapshot(nextToken, buildPublicQrSnapshot({ pet, privatePayload: nextPayload }));
            Alert.alert('Yenilendi', 'Yeni QR linki oluşturuldu.');
          } catch (err) {
            Alert.alert('Hata', err.message || 'QR token yenilenemedi.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const sharePublicLink = async () => {
    if (!publicUrl) {
      Alert.alert('QR linki yok', 'Önce QR kart profilini oluşturun.');
      return;
    }
    try {
      await Share.share({
        message: `${draft.displayName || pet?.name || 'Pet'} dijital kimlik kartı\n${publicUrl}`,
        url: publicUrl,
        title: 'Pet Dijital Kimlik',
      });
    } catch {}
  };

  const toggleField = (key) => {
    setDraft((prev) => ({
      ...prev,
      visibleFields: {
        ...prev.visibleFields,
        [key]: !prev.visibleFields?.[key],
      },
    }));
  };

  return (
    <Screen
      title="Dijital Kimlik / QR Kart"
      subtitle={pet ? `${pet.name} için paylaşılabilir pet kimlik kartı` : 'Yükleniyor...'}
      right={<Button title="Kapat" variant="secondary" onPress={() => router.back()} />}>
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="qr-code-2" size={26} color="#256B9A" />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.heroTitle}>QR Kart Önizleme (Beta)</Text>
            <Text style={styles.heroText}>
              İlk sürümde dijital kimlik profili ve paylaşım linki hazırlanır. Public sayfa ve tasarım şablonları sonraki fazda açılacak.
            </Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          <Chip label={qrProfile?.enabled === false ? 'Pasif' : 'Aktif'} tone={qrProfile?.enabled === false ? 'warning' : 'primary'} />
          <Chip label={publicToken ? 'QR Linki Hazır' : 'Henüz Oluşturulmadı'} />
        </View>
      </Card>

      <Card style={styles.previewCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kart Önizleme</Text>
          {publicToken ? <Chip label={`v${qrProfile?.tokenVersion || 1}`} /> : null}
        </View>

        <View style={styles.qrMockWrap}>
          <View style={styles.qrMockGrid}>
            {Array.from({ length: 49 }).map((_, idx) => {
              const dark = isQrCellDark(idx, publicToken || 'preview');
              return <View key={idx} style={[styles.qrCell, dark && styles.qrCellDark]} />;
            })}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.previewName}>{draft.displayName || pet?.name || 'Pet'}</Text>
            <View style={styles.previewMetaWrap}>
              {pet?.species ? <Chip label={getPetSpeciesLabel(pet.species)} /> : null}
              {pet?.gender ? <Chip label={getPetGenderLabel(pet.gender)} /> : null}
              {pet?.currentWeight && draft.visibleFields?.weight ? <Chip label={`${pet.currentWeight} kg`} /> : null}
            </View>
            {publicUrl ? (
              <Text selectable style={styles.linkText}>{publicUrl}</Text>
            ) : (
              <Text style={styles.muted}>Henüz link oluşturulmadı</Text>
            )}
          </View>
        </View>

        <FlatList
          data={previewRows}
          keyExtractor={(row) => row.key}
          renderItem={({ item: row }) => (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{row.label}</Text>
              <Text style={styles.previewValue} numberOfLines={2}>{row.value}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.previewListGap} />}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.previewListContent}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>İletişim ve Acil Bilgiler</Text>
        <Field label="Kartta görünen pet adı" value={draft.displayName} onChangeText={(v) => setDraft((p) => ({ ...p, displayName: v }))} placeholder="Örn. Pelu" autoCapitalize="words" />
        <Field label="Sahip adı" value={draft.ownerName} onChangeText={(v) => setDraft((p) => ({ ...p, ownerName: v }))} placeholder="Örn. Cansu" autoCapitalize="words" />
        <Field label="Telefon" value={draft.ownerPhone} onChangeText={(v) => setDraft((p) => ({ ...p, ownerPhone: v }))} placeholder="+90..." keyboardType="phone-pad" />
        <Field label="Alerjiler" value={draft.allergiesText} onChangeText={(v) => setDraft((p) => ({ ...p, allergiesText: v }))} placeholder="Virgülle ayırın (ör. Tavuk, Penisilin)" autoCapitalize="sentences" />
        <Field label="Acil not" value={draft.emergencyNote} onChangeText={(v) => setDraft((p) => ({ ...p, emergencyNote: v }))} placeholder="Örn. Korktuğunda kaçabilir" multiline autoCapitalize="sentences" />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Görünür Alanlar</Text>
          <Chip label="Public profil kontrolü" />
        </View>
        <FlatList
          data={FIELD_TOGGLES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <ButtonToggleRow
              label={item.label}
              enabled={!!draft.visibleFields?.[item.key]}
              onPress={() => toggleField(item.key)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.toggleListGap} />}
          scrollEnabled={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={styles.toggleListContent}
        />
        <Card style={styles.vaccineSummaryCard}>
          <Text style={styles.previewLabel}>Aşı durumu özeti (kurallı)</Text>
          <Text style={styles.previewValue}>{vaccineSummary}</Text>
        </Card>
      </Card>

      <Card>
        <View style={styles.actionsCol}>
          <Button title={busy ? 'Kaydediliyor...' : publicToken ? 'QR Kartı Güncelle' : 'QR Kartı Oluştur'} onPress={generateProfile} loading={busy} />
          <Button title="QR Linkini Paylaş" variant="secondary" onPress={sharePublicLink} disabled={!publicUrl || busy} />
          <Button title="QR Linkini Yenile" variant="danger" onPress={rotateToken} disabled={!publicToken || busy} />
        </View>
      </Card>
    </Screen>
  );
}

function ButtonToggleRow({ label, enabled, onPress }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Button title={enabled ? 'Açık' : 'Kapalı'} variant={enabled ? 'primary' : 'secondary'} onPress={onPress} style={styles.toggleBtn} />
    </View>
  );
}

function buildVaccineSummary(reminders) {
  const vaccineReminders = (reminders || []).filter((r) => (r.type || '').toLowerCase() === 'vaccine');
  if (!vaccineReminders.length) return 'Aşı hatırlatma kaydı bulunmuyor';
  const now = Date.now();
  const overdue = vaccineReminders.filter((r) => {
    const d = toDate(r.dueDate);
    return r.active !== false && d && d.getTime() < now;
  }).length;
  const next = vaccineReminders
    .map((r) => ({ ...r, _date: toDate(r.dueDate) }))
    .filter((r) => r.active !== false && r._date && r._date.getTime() >= now)
    .sort((a, b) => a._date.getTime() - b._date.getTime())[0];

  if (overdue > 0) {
    return `${overdue} aşı hatırlatması gecikmiş görünüyor`;
  }
  if (next?._date) {
    return `Bir sonraki aşı: ${formatDateOnly(next._date)}`;
  }
  return 'Aşı takibi güncel görünüyor';
}

function splitAllergies(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function createQrPublicToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'pc_';
  for (let i = 0; i < 14; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function sanitizeQrPayload({ pet, draft, vaccineSummary }) {
  return {
    displayName: draft.displayName || pet?.name || 'Pet',
    ownerName: draft.ownerName || '',
    ownerPhone: draft.ownerPhone || '',
    emergencyNote: draft.emergencyNote || '',
    allergies: splitAllergies(draft.allergiesText),
    visibleFields: { ...DEFAULT_VISIBLE_FIELDS, ...(draft.visibleFields || {}) },
    vaccineStatusSummary: vaccineSummary,
  };
}

function buildQrPreviewRows({ pet, draft, vaccineSummary }) {
  const rows = [];
  if (draft.visibleFields?.ownerName && draft.ownerName) rows.push({ key: 'ownerName', label: 'Sahip', value: draft.ownerName });
  if (draft.visibleFields?.ownerPhone && draft.ownerPhone) rows.push({ key: 'ownerPhone', label: 'Telefon', value: draft.ownerPhone });
  if (draft.visibleFields?.allergies) rows.push({ key: 'allergies', label: 'Alerjiler', value: splitAllergies(draft.allergiesText).join(', ') || 'Belirtilmedi' });
  if (draft.visibleFields?.vaccineStatus) rows.push({ key: 'vaccine', label: 'Aşı', value: vaccineSummary });
  if (draft.visibleFields?.breed && pet?.breed) rows.push({ key: 'breed', label: 'Cins', value: pet.breed });
  if (draft.visibleFields?.gender && pet?.gender) rows.push({ key: 'gender', label: 'Cinsiyet', value: getPetGenderLabel(pet.gender) });
  if (draft.visibleFields?.weight && pet?.currentWeight) rows.push({ key: 'weight', label: 'Kilo', value: `${pet.currentWeight} kg` });
  if (draft.visibleFields?.emergencyNote && draft.emergencyNote) rows.push({ key: 'note', label: 'Acil Not', value: draft.emergencyNote });
  rows.push({
    key: 'updated',
    label: 'Son Güncelleme',
    value: formatDateOnly(new Date()),
  });
  return rows.slice(0, 8);
}

function buildPublicQrSnapshot({ pet, privatePayload }) {
  const visible = { ...DEFAULT_VISIBLE_FIELDS, ...(privatePayload?.visibleFields || {}) };
  const payload = {
    displayName: privatePayload?.displayName || pet?.name || 'Pet',
    species: pet?.species || null,
    updatedAtMs: Date.now(),
  };

  if (visible.breed && pet?.breed) payload.breed = pet.breed;
  if (visible.gender && pet?.gender) payload.gender = pet.gender;
  if (visible.weight && pet?.currentWeight) payload.weight = pet.currentWeight;
  if (visible.ownerName && privatePayload?.ownerName) payload.ownerName = privatePayload.ownerName;
  if (visible.ownerPhone && privatePayload?.ownerPhone) payload.ownerPhone = privatePayload.ownerPhone;
  if (visible.allergies && privatePayload?.allergies?.length) payload.allergies = privatePayload.allergies;
  if (visible.vaccineStatus && privatePayload?.vaccineStatusSummary) payload.vaccineStatusSummary = privatePayload.vaccineStatusSummary;
  if (visible.emergencyNote && privatePayload?.emergencyNote) payload.emergencyNote = privatePayload.emergencyNote;

  return {
    enabled: privatePayload?.enabled !== false,
    payload,
  };
}

function isQrCellDark(index, seed) {
  const seedText = String(seed || 'petcare');
  let code = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    code = (code + seedText.charCodeAt(i) * (i + 3)) % 9973;
  }
  return ((index * 17 + code) % 7) < 3;
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#F4FAFF',
    borderColor: '#DCEAF8',
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E8F4',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  heroText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewCard: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  qrMockWrap: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  qrMockGrid: {
    width: 112,
    height: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCEAF8',
    backgroundColor: '#fff',
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 2,
  },
  qrCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#EDF4FA',
  },
  qrCellDark: {
    backgroundColor: '#223547',
  },
  previewName: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  previewMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  linkText: {
    color: '#2B6797',
    fontSize: 11,
    lineHeight: 16,
  },
  muted: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
  },
  previewListContent: {
    gap: 0,
  },
  previewListGap: {
    height: 7,
  },
  previewRow: {
    borderWidth: 1,
    borderColor: '#E3EDF4',
    borderRadius: 10,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  previewLabel: {
    color: '#5E7A8F',
    fontSize: 11,
    fontWeight: '600',
  },
  previewValue: {
    color: PetCareTheme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  toggleListContent: {
    gap: 0,
  },
  toggleListGap: {
    height: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2EBF2',
    borderRadius: 10,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleLabel: {
    flex: 1,
    color: PetCareTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  vaccineSummaryCard: {
    backgroundColor: '#F8FBFE',
    borderColor: '#E1EDF5',
    padding: 10,
    gap: 4,
  },
  actionsCol: {
    gap: 8,
  },
});

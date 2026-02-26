import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, Chip, EmptyState, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { formatDateOnly, formatDateTime, toDate } from '@/lib/date-utils';
import { deleteDocument, subscribeDocuments, subscribePet } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const DOC_TYPE_LABELS = {
  vaccineCard: 'Aşı Kartı',
  lab: 'Tahlil',
  prescription: 'Reçete',
  imaging: 'Görüntüleme',
  other: 'Diğer',
};

const FILE_TYPE_LABELS = {
  image: 'Fotoğraf',
  pdf: 'PDF',
  other: 'Dosya',
};

export default function PetDocumentsRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <PetDocumentsScreen petId={petId} />
    </AuthGate>
  );
}

function PetDocumentsScreen({ petId }) {
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid || !petId) return undefined;

    const unsubs = [
      subscribePet(user.uid, petId, setPet, (err) => setError(err?.message || 'Pet alınamadı.')),
      subscribeDocuments(user.uid, petId, setDocs, (err) =>
        setError(err?.message || 'Belgeler alınamadı.')
      ),
    ];

    return () => unsubs.forEach((u) => u?.());
  }, [user?.uid, petId]);

  const handleDelete = (doc) => {
    Alert.alert('Belgeyi sil', doc.title || 'Belge kaydı', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument(user.uid, petId, doc.id);
            Alert.alert('Silindi', 'Belge kaydı silindi.');
          } catch (err) {
            Alert.alert('Hata', err?.message || 'Belge silinemedi.');
          }
        },
      },
    ]);
  };

  return (
    <Screen
      title="Sağlık Belgeleri"
      subtitle={`${pet?.name || 'Pet'} için PDF, reçete ve görüntü kayıt arşivi`}
      right={<Chip label={`${docs.length} belge`} />}>
      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="folder-open" size={20} color="#2C6E9E" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroTitle}>Medical Document Vault</Text>
            <Text style={styles.heroText}>
              Aşı kartı, tahlil, reçete ve görüntüleme belgelerini tek yerde arşivleyin. OCR
              okuma ve akıllı tespit bir sonraki adımda eklenecek.
            </Text>
          </View>
        </View>

        <View style={styles.heroActions}>
          <Button title="+ Belge Ekle" onPress={() => router.push(`/pets/${petId}/documents/new`)} />
          <Button
            title="OCR (Yakında)"
            variant="secondary"
            onPress={() => Alert.alert('OCR', 'Belge OCR okuma özelliği bir sonraki fazda eklenecek.')}
          />
        </View>
      </Card>

      {docs.length === 0 ? (
        <EmptyState
          title="Henüz belge yok"
          description="İlk belgeyi ekleyerek petin sağlık arşivini oluşturmaya başlayın."
        />
      ) : (
        <View style={styles.listWrap}>
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              item={doc}
              onDelete={() => handleDelete(doc)}
              onOpen={() =>
                Alert.alert(
                  doc.title || 'Belge',
                  doc.fileLocalUri || doc.fileUrl || 'Dosya önizleme henüz eklenmedi.'
                )
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function DocumentCard({ item, onDelete, onOpen }) {
  const typeLabel = DOC_TYPE_LABELS[item.type] || 'Belge';
  const fileTypeLabel = FILE_TYPE_LABELS[item.fileType] || 'Dosya';
  const docDate = toDate(item.documentDate);
  const isImage = item.fileType === 'image' && (item.fileLocalUri || item.fileUrl);
  const detectionLine = buildDetectionLine(item);

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={styles.itemLeft}>
          <View style={styles.itemIconWrap}>
            <MaterialIcons
              name={isImage ? 'image' : item.fileType === 'pdf' ? 'picture-as-pdf' : 'description'}
              size={18}
              color="#2D6D9A"
            />
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.itemTitle}>{item.title || typeLabel}</Text>
            <Text style={styles.itemSub}>
              {docDate ? formatDateOnly(docDate) : 'Tarih yok'} • {typeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.inlineActions}>
          <IconPill icon="open-in-new" onPress={onOpen} />
          <IconPill icon="delete-outline" onPress={onDelete} danger />
        </View>
      </View>

      {isImage ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: item.fileLocalUri || item.fileUrl }} style={styles.previewImage} contentFit="cover" />
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Chip label={fileTypeLabel} />
        <Chip label={`OCR: ${ocrStatusLabel(item.ocrStatus)}`} tone={item.ocrStatus === 'done' ? 'primary' : 'default'} />
        {item.clinicName ? <Chip label={item.clinicName} /> : null}
      </View>

      {detectionLine ? <Text style={styles.noteText}>{detectionLine}</Text> : null}
      {item.note ? <Text style={styles.subText}>{item.note}</Text> : null}
      <Text style={styles.footerText}>Kayıt: {formatDateTime(item.createdAt)}</Text>
    </Card>
  );
}

function IconPill({ icon, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconPill,
        danger && styles.iconPillDanger,
        pressed && { opacity: 0.85 },
      ]}>
      <MaterialIcons
        name={icon}
        size={18}
        color={danger ? PetCareTheme.colors.danger : '#2D6D9A'}
      />
    </Pressable>
  );
}

function ocrStatusLabel(status) {
  if (status === 'done') return 'Hazır';
  if (status === 'failed') return 'Hata';
  return 'Bekliyor';
}

function buildDetectionLine(doc) {
  const detections = doc?.detections || {};
  const lines = [];
  if (detections.vaccineName) lines.push(`Aşı: ${detections.vaccineName}`);
  if (detections.vaccineDate) lines.push(`Tarih: ${formatDateOnly(detections.vaccineDate)}`);
  if (Array.isArray(detections.keywords) && detections.keywords.length) {
    lines.push(`Anahtar: ${detections.keywords.slice(0, 3).join(', ')}`);
  }
  return lines.join(' • ');
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
    backgroundColor: '#F4FAFF',
    borderColor: '#DCEAF8',
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E8F4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  heroText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  heroActions: {
    gap: 8,
  },
  listWrap: {
    gap: 10,
  },
  itemCard: {
    gap: 10,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E9F5',
    backgroundColor: '#F3F9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  itemSub: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAF8',
    backgroundColor: '#F5FAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillDanger: {
    borderColor: '#F0D5DB',
    backgroundColor: '#FFF5F7',
  },
  previewWrap: {
    borderWidth: 1,
    borderColor: '#E0EAF2',
    borderRadius: 12,
    overflow: 'hidden',
    height: 150,
    backgroundColor: '#EEF4F9',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  noteText: {
    color: '#4C7089',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  subText: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  footerText: {
    color: '#728A9D',
    fontSize: 11,
    fontWeight: '600',
  },
});


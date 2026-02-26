import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { pickDocumentFile, pickImageFromLibrary } from '@/lib/media';
import { createDocument } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const DOC_TYPES = [
  { key: 'vaccineCard', label: 'Aşı Kartı', icon: 'medical-services' },
  { key: 'lab', label: 'Tahlil', icon: 'science' },
  { key: 'prescription', label: 'Reçete', icon: 'medication' },
  { key: 'imaging', label: 'Görüntüleme', icon: 'image-search' },
  { key: 'other', label: 'Diğer', icon: 'description' },
];

const FILE_TYPES = [
  { key: 'image', label: 'Fotoğraf' },
  { key: 'pdf', label: 'PDF' },
  { key: 'other', label: 'Dosya' },
];

export default function NewDocumentRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <NewDocumentScreen petId={petId} />
    </AuthGate>
  );
}

function NewDocumentScreen({ petId }) {
  const { user } = useAuth();
  const [type, setType] = useState('vaccineCard');
  const [fileType, setFileType] = useState('image');
  const [title, setTitle] = useState('');
  const [documentDateInput, setDocumentDateInput] = useState(toInputDateTime(new Date()));
  const [clinicName, setClinicName] = useState('');
  const [note, setNote] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [fileUri, setFileUri] = useState('');
  const [pickedImage, setPickedImage] = useState(null);
  const [pickedDocument, setPickedDocument] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickingFile, setPickingFile] = useState(false);
  const [error, setError] = useState('');

  const canPickImage = fileType === 'image';
  const canPickDocument = fileType === 'pdf' || fileType === 'other';
  const previewUri = pickedImage?.uri || (fileType === 'image' ? fileUri : '');

  const detectedKeywords = useMemo(() => {
    const source = `${title} ${note} ${allergiesText}`.toLowerCase();
    const list = [];
    if (source.includes('kuduz') || source.includes('rabies')) list.push('kuduz');
    if (source.includes('aşı') || source.includes('asi') || source.includes('vaccine')) list.push('aşı');
    if (source.includes('tahlil') || source.includes('lab')) list.push('tahlil');
    if (source.includes('röntgen') || source.includes('rontgen') || source.includes('xray')) list.push('görüntüleme');
    return Array.from(new Set(list));
  }, [title, note, allergiesText]);

  const pickPhoto = async () => {
    try {
      setPickingFile(true);
      const asset = await pickImageFromLibrary();
      if (!asset) return;
      setPickedImage(asset);
      setPickedDocument(null);
      setFileType('image');
      setFileUri(asset.uri || '');
      if (!title.trim() && asset.fileName) {
        setTitle(String(asset.fileName).replace(/\.[a-z0-9]+$/i, ''));
      }
    } catch (err) {
      Alert.alert('Fotoğraf seçilemedi', err?.message || 'Galeriden belge fotoğrafı alınamadı.');
    } finally {
      setPickingFile(false);
    }
  };

  const pickDocument = async () => {
    try {
      setPickingFile(true);
      const asset = await pickDocumentFile();
      if (!asset) return;

      setPickedDocument(asset);
      setPickedImage(null);
      setFileUri(asset.uri || '');

      const mime = String(asset.mimeType || '').toLowerCase();
      if (mime.includes('pdf')) setFileType('pdf');
      else if (mime.startsWith('image/')) setFileType('image');
      else setFileType('other');

      if (!title.trim() && asset.name) {
        setTitle(String(asset.name).replace(/\.[a-z0-9]+$/i, ''));
      }
    } catch (err) {
      Alert.alert('Belge seçilemedi', err?.message || 'Dosya seçimi sırasında hata oluştu.');
    } finally {
      setPickingFile(false);
    }
  };

  const handleSave = async () => {
    const documentDate = parseInputDateTime(documentDateInput);
    if (!documentDate) {
      setError('Tarih formatı YYYY-AA-GG SS:dd olmalı.');
      return;
    }

    if (!title.trim()) {
      setError('Belge başlığı gerekli.');
      return;
    }

    if (!fileUri.trim()) {
      setError('Belge dosyası veya URI/link alanı gerekli.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await createDocument(user.uid, petId, {
        title: title.trim(),
        type,
        fileType,
        documentDate,
        clinicName: clinicName.trim() || null,
        note: note.trim() || null,
        allergiesText: allergiesText.trim() || null,
        fileLocalUri: fileUri.trim(),
        fileUrl: /^https?:\/\//i.test(fileUri.trim()) ? fileUri.trim() : null,
        fileName: pickedDocument?.name || pickedImage?.fileName || null,
        fileMimeType: pickedDocument?.mimeType || pickedImage?.mimeType || null,
        ocrStatus: 'pending',
        detections: buildInitialDetections({ type, title, note, documentDate, detectedKeywords }),
      });

      router.replace(`/pets/${petId}/documents/index`);
    } catch (err) {
      setError(err?.message || 'Belge kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Belge Ekle" subtitle="PDF, reçete, tahlil ve görüntü kayıtlarını arşivleyin.">
      <Card style={styles.formCard}>
        <View style={styles.heroStrip}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="folder-open" size={16} color="#2C6E9E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Belge Kasası</Text>
            <Text style={styles.heroText}>
              OCR ve akıllı alan tespiti sonraki fazda eklenecek. Bu sürüm belge arşivi temelidir.
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Belge Türü</Text>
          <View style={styles.chipsWrap}>
            {DOC_TYPES.map((item) => {
              const selected = type === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setType(item.key)}
                  style={({ pressed }) => [
                    styles.typeChip,
                    selected && styles.typeChipSelected,
                    pressed && { opacity: 0.9 },
                  ]}>
                  <MaterialIcons
                    name={item.icon}
                    size={14}
                    color={selected ? PetCareTheme.colors.primary : '#607B8D'}
                  />
                  <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Dosya Tipi</Text>
          <View style={styles.rowWrap}>
            {FILE_TYPES.map((item) => {
              const selected = fileType === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFileType(item.key)}
                  style={({ pressed }) => [
                    styles.miniChip,
                    selected && styles.miniChipSelected,
                    pressed && { opacity: 0.9 },
                  ]}>
                  <Text style={[styles.miniChipText, selected && styles.miniChipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {canPickImage ? (
            <Button
              title={pickingFile ? 'Seçiliyor...' : 'Galeriden Belge Fotoğrafı Seç'}
              variant="secondary"
              onPress={pickPhoto}
              loading={pickingFile}
            />
          ) : null}

          {canPickDocument ? (
            <Button
              title={pickingFile ? 'Seçiliyor...' : fileType === 'pdf' ? 'PDF Seç' : 'Dosya Seç'}
              variant="secondary"
              onPress={pickDocument}
              loading={pickingFile}
            />
          ) : null}

          {canPickImage && previewUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="cover" />
            </View>
          ) : null}

          {canPickDocument && pickedDocument ? (
            <View style={styles.docInfoBox}>
              <MaterialIcons
                name={fileType === 'pdf' ? 'picture-as-pdf' : 'description'}
                size={18}
                color="#2C6E9E"
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.docInfoTitle} numberOfLines={1}>
                  {pickedDocument.name || 'Seçilen belge'}
                </Text>
                <Text style={styles.docInfoSub} numberOfLines={1}>
                  {pickedDocument.mimeType || 'Dosya'}
                  {pickedDocument.size ? ` • ${formatFileSize(pickedDocument.size)}` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          <Field
            label="Belge URI / Link"
            value={fileUri}
            onChangeText={setFileUri}
            placeholder="Örn. file:///... veya https://..."
            autoCapitalize="none"
          />

          <Text style={styles.helperText}>
            Not: PDF/dosya yüklemeleri şimdilik cihaz yolu veya link olarak arşivlenir. Cloud OCR ve
            güvenli dosya saklama sonraki fazda eklenecek.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Belge Bilgisi</Text>
          <Field
            label="Başlık"
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Kuduz aşı kartı - 2026"
            autoCapitalize="sentences"
          />
          <Field
            label="Belge Tarihi"
            value={documentDateInput}
            onChangeText={setDocumentDateInput}
            placeholder="2026-02-23 14:30"
          />
          <Field
            label="Klinik / Kurum (opsiyonel)"
            value={clinicName}
            onChangeText={setClinicName}
            placeholder="Örn. Pati Veteriner Kliniği"
            autoCapitalize="sentences"
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Ek Bilgiler</Text>
          <Field
            label="Alerjiler (opsiyonel)"
            value={allergiesText}
            onChangeText={setAllergiesText}
            placeholder="Örn. Tavuk, penisilin"
            autoCapitalize="sentences"
          />
          <Field
            label="Not"
            value={note}
            onChangeText={setNote}
            placeholder="Belge içeriği hakkında kısa not"
            multiline
            autoCapitalize="sentences"
          />

          <View style={styles.detectBox}>
            <MaterialIcons name="analytics" size={16} color="#6B7F90" />
            <Text style={styles.detectText}>
              OCR (yakında). Şimdilik başlık/not içeriğinden ön tespit: {' '}
              {detectedKeywords.length ? detectedKeywords.join(', ') : 'anahtar kelime bulunmadı'}
            </Text>
          </View>
        </View>

        <ErrorText>{error}</ErrorText>

        <View style={styles.footerRow}>
          <Button title="İptal" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Kaydet" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

function buildInitialDetections({ type, title, note, documentDate, detectedKeywords }) {
  const text = `${title || ''} ${note || ''}`.toLowerCase();
  const isVaccineLike =
    type === 'vaccineCard' || text.includes('aşı') || text.includes('asi') || text.includes('vaccine');
  const vaccineName = text.includes('kuduz') || text.includes('rabies') ? 'Kuduz Aşısı' : null;

  return {
    keywords: detectedKeywords,
    vaccineName: isVaccineLike ? vaccineName : null,
    vaccineDate: isVaccineLike ? documentDate : null,
    confidence: detectedKeywords.length ? 0.45 : 0.2,
  };
}

function formatFileSize(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  formCard: {
    gap: 12,
    borderColor: '#DFEAF2',
  },
  heroStrip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D8E8F5',
    backgroundColor: '#F5FAFF',
    borderRadius: 14,
    padding: 10,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#EAF5FF',
    borderWidth: 1,
    borderColor: '#D9EAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#2A628D',
    fontWeight: '700',
    fontSize: 13,
  },
  heroText: {
    marginTop: 1,
    color: '#6788A2',
    fontSize: 11,
    lineHeight: 16,
  },
  panel: {
    borderWidth: 1,
    borderColor: '#E1EAF2',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  panelTitle: {
    color: '#2C5F86',
    fontWeight: '700',
    fontSize: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeChipSelected: {
    borderColor: '#BEE0F5',
    backgroundColor: '#EDF7FF',
  },
  typeChipText: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  typeChipTextSelected: {
    color: PetCareTheme.colors.primary,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniChip: {
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FBFDFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  miniChipSelected: {
    borderColor: '#BEE0F5',
    backgroundColor: '#EDF7FF',
  },
  miniChipText: {
    color: '#5A778C',
    fontWeight: '700',
    fontSize: 12,
  },
  miniChipTextSelected: {
    color: PetCareTheme.colors.primary,
  },
  helperText: {
    color: '#6A8295',
    fontSize: 12,
    lineHeight: 17,
  },
  previewWrap: {
    borderWidth: 1,
    borderColor: '#E0EAF2',
    borderRadius: 12,
    overflow: 'hidden',
    height: 160,
    backgroundColor: '#EEF4F9',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  docInfoBox: {
    borderWidth: 1,
    borderColor: '#E0EAF2',
    backgroundColor: '#F8FBFE',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  docInfoTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  docInfoSub: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 11,
  },
  detectBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E3EBF3',
    backgroundColor: '#F8FBFE',
    borderRadius: 10,
    padding: 9,
  },
  detectText: {
    flex: 1,
    color: '#6A8193',
    fontSize: 11,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
});


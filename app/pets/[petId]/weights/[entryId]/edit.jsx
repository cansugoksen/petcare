import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { getWeightEntry, updateWeightEntry } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function EditWeightRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;
  const entryId = Array.isArray(params.entryId) ? params.entryId[0] : params.entryId;

  return (
    <AuthGate>
      <EditWeightScreen petId={petId} entryId={entryId} />
    </AuthGate>
  );
}

function EditWeightScreen({ petId, entryId }) {
  const { user } = useAuth();
  const [valueKg, setValueKg] = useState('');
  const [measuredAtInput, setMeasuredAtInput] = useState(toInputDateTime(new Date()));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const row = await getWeightEntry(user.uid, petId, entryId);
        if (!mounted) return;
        if (!row) {
          setError('Kilo kaydı bulunamadı.');
          return;
        }
        setValueKg(String(row.valueKg ?? row.weight ?? ''));
        setMeasuredAtInput(toInputDateTime(row.measuredAt || new Date()));
        setNote(row.note || '');
        setError('');
      } catch (err) {
        if (mounted) setError(err.message || 'Kilo kaydı yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (user?.uid && petId && entryId) load();
    return () => {
      mounted = false;
    };
  }, [entryId, petId, user?.uid]);

  const handleSave = async () => {
    const weight = Number(String(valueKg).replace(',', '.'));
    const measuredAt = parseInputDateTime(measuredAtInput);

    if (Number.isNaN(weight) || weight <= 0) {
      setError('Kilo değeri pozitif sayı olmalı.');
      return;
    }
    if (!measuredAt) {
      setError('Tarih formatı YYYY-AA-GG SS:dd olmalı.');
      return;
    }

    try {
      setError('');
      setSaving(true);
      await updateWeightEntry(user.uid, petId, entryId, {
        valueKg: Number(weight.toFixed(2)),
        measuredAt,
        note: note.trim() || null,
      });
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Kilo Kaydı Düzenle" subtitle="Ölçüm bilgisini güncelleyerek geçmişi doğrulayın.">
      <Card style={styles.formCard}>
        <View style={styles.heroStrip}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="timeline" size={16} color="#C48616" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Kilo Takibi</Text>
            <Text style={styles.heroText}>Ölçüm değerlerini düzenleyerek timeline ve grafik görünümünü güncel tutun.</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Ölçüm Bilgisi</Text>
          <Field label="Kilo (kg)" value={valueKg} onChangeText={setValueKg} placeholder="Örn. 5.8" keyboardType="decimal-pad" />
          <Field label="Ölçüm tarihi" value={measuredAtInput} onChangeText={setMeasuredAtInput} placeholder="2026-02-23 14:30" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Not (Opsiyonel)</Text>
          <Field label="Açıklama" value={note} onChangeText={setNote} placeholder="Örn. Aç karna ölçüldü" multiline autoCapitalize="sentences" />
        </View>

        <ErrorText>{error}</ErrorText>

        <View style={styles.footerRow}>
          <Button title="İptal" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Güncelle" onPress={handleSave} loading={saving} disabled={loading} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: 12, borderColor: '#DFEAF2' },
  heroStrip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F0E0BE',
    backgroundColor: '#FFF9EE',
    borderRadius: 14,
    padding: 10,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#FCEFD7',
    borderWidth: 1,
    borderColor: '#F0DEBC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#866011', fontWeight: '700', fontSize: 13 },
  heroText: { marginTop: 1, color: '#957548', fontSize: 11, lineHeight: 16 },
  panel: {
    borderWidth: 1,
    borderColor: '#E1EAF2',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  panelTitle: { color: '#2C5F86', fontWeight: '700', fontSize: 12 },
  footerRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
});

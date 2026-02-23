import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { createWeightEntry } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

export default function NewWeightRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <NewWeightScreen petId={petId} />
    </AuthGate>
  );
}

function NewWeightScreen({ petId }) {
  const { user } = useAuth();
  const [valueKg, setValueKg] = useState('');
  const [measuredAtInput, setMeasuredAtInput] = useState(toInputDateTime(new Date()));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const weight = Number(valueKg.replace(',', '.'));
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
      await createWeightEntry(user.uid, petId, {
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
    <Screen title="Kilo Kaydı Ekle" subtitle="Kronolojik kilo geçmişi için yeni ölçüm">
      <Card>
        <Field
          label="Kilo (kg)"
          value={valueKg}
          onChangeText={setValueKg}
          placeholder="Örn. 5.8"
          keyboardType="decimal-pad"
        />
        <Field
          label="Ölçüm tarihi"
          value={measuredAtInput}
          onChangeText={setMeasuredAtInput}
          placeholder="2026-02-23 14:30"
        />
        <Field
          label="Not (opsiyonel)"
          value={note}
          onChangeText={setNote}
          placeholder="Örn. Aç karna ölçüldü"
          multiline
          autoCapitalize="sentences"
        />
        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="İptal" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
          <Button title="Kaydet" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

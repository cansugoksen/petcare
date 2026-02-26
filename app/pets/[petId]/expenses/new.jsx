import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AuthGate } from '@/components/pc/auth-guard';
import { Button, Card, ErrorText, Field, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { parseInputDateTime, toInputDateTime } from '@/lib/date-utils';
import { createExpense } from '@/lib/petcare-db';
import { useAuth } from '@/providers/auth-provider';

const EXPENSE_CATEGORIES = [
  { key: 'vet', label: 'Veteriner' },
  { key: 'medication', label: 'İlaç' },
  { key: 'vaccine', label: 'Aşı' },
  { key: 'food', label: 'Mama' },
  { key: 'grooming', label: 'Bakım' },
  { key: 'other', label: 'Diğer' },
];

export default function NewExpenseRoute() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <NewExpenseScreen petId={petId} />
    </AuthGate>
  );
}

function NewExpenseScreen({ petId }) {
  const { user } = useAuth();
  const [amountInput, setAmountInput] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('vet');
  const [expenseDateInput, setExpenseDateInput] = useState(toInputDateTime(new Date()));
  const [clinicName, setClinicName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const amount = Number(String(amountInput).replace(',', '.'));
    const expenseDate = parseInputDateTime(expenseDateInput);

    if (Number.isNaN(amount) || amount <= 0) {
      setError('Tutar pozitif sayı olmalı.');
      return;
    }
    if (!expenseDate) {
      setError('Tarih formatı YYYY-AA-GG SS:dd olmalı.');
      return;
    }

    try {
      setError('');
      setSaving(true);
      await createExpense(user.uid, petId, {
        amount: Number(amount.toFixed(2)),
        currency: 'TRY',
        category,
        title: title.trim() || null,
        expenseDate,
        clinicName: clinicName.trim() || null,
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
    <Screen title="Gider Ekle" subtitle="Veteriner ve bakım giderlerini düzenli takip edin.">
      <Card style={styles.formCard}>
        <View style={styles.heroStrip}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="payments" size={16} color="#7A58C9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Gider Kaydı</Text>
            <Text style={styles.heroText}>Aylık ve yıllık analiz için işlemleri tarihli olarak kaydedin.</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Tutar ve Kategori</Text>
          <Field
            label="Tutar (₺)"
            value={amountInput}
            onChangeText={setAmountInput}
            placeholder="Örn. 850"
            keyboardType="decimal-pad"
          />

          <Text style={styles.fieldLabel}>Kategori</Text>
          <View style={styles.categoryWrap}>
            {EXPENSE_CATEGORIES.map((item) => (
              <CategoryChip key={item.key} label={item.label} selected={category === item.key} onPress={() => setCategory(item.key)} />
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Detay</Text>
          <Field
            label="İşlem başlığı (opsiyonel)"
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Kontrol muayenesi, karma aşı"
            autoCapitalize="sentences"
          />
          <Field
            label="Gider tarihi"
            value={expenseDateInput}
            onChangeText={setExpenseDateInput}
            placeholder="2026-02-23 14:30"
          />
          <Field
            label="Klinik / Mağaza (opsiyonel)"
            value={clinicName}
            onChangeText={setClinicName}
            placeholder="Örn. Mutlu Patiler Klinik"
            autoCapitalize="sentences"
          />
          <Field
            label="Not (opsiyonel)"
            value={note}
            onChangeText={setNote}
            placeholder="Örn. Muayene + ilaç ücreti"
            multiline
            autoCapitalize="sentences"
          />
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

function CategoryChip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryChip, selected && styles.categoryChipSelected, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{label}</Text>
    </Pressable>
  );
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
    borderColor: '#E5DCF8',
    backgroundColor: '#F8F5FF',
    borderRadius: 14,
    padding: 10,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#EEE8FD',
    borderWidth: 1,
    borderColor: '#E1D8FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#694DB5',
    fontWeight: '700',
    fontSize: 13,
  },
  heroText: {
    marginTop: 1,
    color: '#7E70A8',
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
  fieldLabel: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipSelected: {
    borderColor: '#CFC2F7',
    backgroundColor: '#F1ECFF',
  },
  categoryChipText: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  categoryChipTextSelected: {
    color: '#6547B8',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
});

import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Card, Chip, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';

export default function SettingsTab() {
  return (
    <AuthGate>
      <SettingsTabContent />
    </AuthGate>
  );
}

function SettingsTabContent() {
  const handleComingSoon = (title) => {
    Alert.alert(title, 'Bu alan MVP sonrası sürümlerde geliştirilecek.');
  };

  return (
    <Screen title="Ayarlar" subtitle="Uygulamayı ve bildirim deneyimini buradan yönetebilirsiniz.">
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="pets" size={20} color="#2C5E86" />
          </View>
          <Chip label="MVP" tone="primary" />
        </View>
        <Text style={styles.heroTitle}>PetCare</Text>
        <Text style={styles.heroText}>
          Evcil dostlarınızın aşı, ilaç ve veteriner takibini sade bir deneyimle yönetin.
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <SettingsRow
          icon="notifications-none"
          title="Bildirim İzinleri"
          subtitle="Bildirim almak için cihaz ayarlarından izin vermeniz gerekir."
          onPress={() => handleComingSoon('Bildirim İzinleri')}
        />
        <SettingsRow
          icon="schedule"
          title="Hatırlatma Saatleri"
          subtitle="Hatırlatmalar pet bazlı olarak ilgili kayıtlarda yönetilir."
          onPress={() => handleComingSoon('Hatırlatma Saatleri')}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Destek</Text>
        <SettingsRow
          icon="help-outline"
          title="Yardım"
          subtitle="Uygulama kullanımı ve sık sorulan sorular."
          onPress={() => handleComingSoon('Yardım')}
        />
        <SettingsRow
          icon="feedback"
          title="Geri Bildirim"
          subtitle="Deneyiminizi geliştirmek için önerilerinizi paylaşın."
          onPress={() => handleComingSoon('Geri Bildirim')}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Hakkında</Text>
        <SettingsRow
          icon="privacy-tip"
          title="Gizlilik"
          subtitle="Verileriniz cihazınız ve Firebase altyapısında saklanır."
          onPress={() => handleComingSoon('Gizlilik')}
        />
        <SettingsRow
          icon="info-outline"
          title="Sürüm"
          subtitle="PetCare MVP"
          onPress={() => handleComingSoon('Sürüm Bilgisi')}
          hideChevron
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Geliştirici</Text>
        <SettingsRow
          icon="build-circle"
          title="Push Test Aracı"
          subtitle="Geçici test ekranı (token kaydı ve push doğrulama)."
          onPress={() => router.push('/dev/push-test')}
        />
      </Card>
    </Screen>
  );
}

function SettingsRow({ icon, title, subtitle, onPress, hideChevron }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowIconWrap}>
        <MaterialIcons name={icon} size={20} color={PetCareTheme.colors.primary} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {!hideChevron ? (
        <MaterialIcons name="chevron-right" size={22} color={PetCareTheme.colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#EAF5FF',
    borderColor: '#CFE5F8',
    gap: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#D8ECFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#173D5B',
    fontSize: 18,
    fontWeight: '700',
  },
  heroText: {
    color: '#5A7E99',
    lineHeight: 20,
    fontSize: 13,
  },
  sectionTitle: {
    color: PetCareTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: PetCareTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  rowSubtitle: {
    color: PetCareTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});

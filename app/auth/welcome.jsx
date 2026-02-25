import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components/pc/ui';

const AUTH_PROMPT_SEEN_KEY = 'petcare:auth-prompt-seen:v1';
const AUTH_PROMPT_SUPPRESS_KEY = 'petcare:auth-prompt-suppress:v1';

export default function AuthWelcomeScreen() {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const persistPromptChoice = async () => {
    try {
      await AsyncStorage.setItem(AUTH_PROMPT_SEEN_KEY, '1');
      await AsyncStorage.setItem(AUTH_PROMPT_SUPPRESS_KEY, dontShowAgain ? '1' : '0');
    } catch {}
  };

  const handleGoAuth = async () => {
    await persistPromptChoice();
    router.replace('/auth');
  };

  const handleContinueAnonymous = async () => {
    await persistPromptChoice();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <Screen
      title="Hoş geldiniz"
      subtitle="PetCare’i hemen kullanmaya başlayabilir veya hesabınızı oluşturabilirsiniz."
      right={
        <Pressable
          onPress={handleContinueAnonymous}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.82 }]}>
          <Text style={styles.skipText}>Atla</Text>
        </Pressable>
      }>
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="pets" size={22} color="#1E8E7E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>PetCare’e Başlamadan Önce</Text>
            <Text style={styles.heroText}>
              Hesapla devam ederseniz ileride verilerinizi yedekleme ve cihazlar arası kullanım için hazır olursunuz.
            </Text>
          </View>
        </View>

        <View style={styles.benefitList}>
          <BenefitRow
            icon="cloud-done"
            title="Yedekleme altyapısına hazır"
            text="Hesaplı kullanım veri taşımayı kolaylaştırır."
          />
          <BenefitRow
            icon="devices"
            title="Cihaz değişiminde avantaj"
            text="Yeni cihaza geçiş senaryoları için temel hazır olur."
          />
          <BenefitRow
            icon="lock"
            title="Anonim kullanım da mümkün"
            text="Hesap oluşturmadan hemen kullanmaya devam edebilirsiniz."
          />
        </View>
      </Card>

      <Card style={styles.choiceCard}>
        <Text style={styles.choiceTitle}>Nasıl devam etmek istersiniz?</Text>

        <Pressable
          onPress={() => setDontShowAgain((prev) => !prev)}
          style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.9 }]}>
          <View style={[styles.checkbox, dontShowAgain && styles.checkboxActive]}>
            {dontShowAgain ? <MaterialIcons name="check" size={15} color="#fff" /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Bir daha gösterme</Text>
            <Text style={styles.toggleText}>Bu ekranı sonraki açılışlarda atla (Ayarlar’dan yine ulaşabilirsiniz).</Text>
          </View>
        </Pressable>

        <View style={styles.choiceButtons}>
          <Button title="Giriş Yap / Kayıt Ol" onPress={handleGoAuth} />
          <Button title="Anonim Devam Et" variant="secondary" onPress={handleContinueAnonymous} />
        </View>

        <Text style={styles.choiceHint}>
          Seçiminiz kaydedilir. İsterseniz daha sonra Ayarlar bölümünden hesap ekranına geçebilirsiniz.
        </Text>
      </Card>
    </Screen>
  );
}

function BenefitRow({ icon, title, text }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIconWrap}>
        <MaterialIcons name={icon} size={16} color="#3E7096" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skipBtn: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE8F2',
    backgroundColor: '#F7FBFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: '#486C88',
    fontWeight: '700',
    fontSize: 12,
  },
  heroCard: {
    backgroundColor: '#F2F9FF',
    borderColor: '#D7E8F6',
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E4F5F1',
    borderWidth: 1,
    borderColor: '#CCEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#214F73',
    fontSize: 15,
    fontWeight: '700',
  },
  heroText: {
    color: '#6D8EA7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  benefitList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  benefitIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EBF4FD',
    borderWidth: 1,
    borderColor: '#D8E8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: {
    color: '#2A587D',
    fontSize: 12,
    fontWeight: '700',
  },
  benefitText: {
    color: '#708FA6',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  choiceCard: {
    gap: 10,
    borderColor: '#DFE9F2',
  },
  choiceTitle: {
    color: '#214F73',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2EBF3',
    backgroundColor: '#FBFDFF',
    borderRadius: 12,
    padding: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CFE0EE',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: '#1E8E7E',
    borderColor: '#1E8E7E',
  },
  toggleTitle: {
    color: '#2A587D',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleText: {
    color: '#708FA6',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  choiceButtons: {
    gap: 8,
  },
  choiceHint: {
    color: '#708FA6',
    fontSize: 11,
    lineHeight: 16,
  },
});


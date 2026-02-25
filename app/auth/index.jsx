import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { Button, Card, Screen } from '@/components/pc/ui';
import { PetCareTheme } from '@/constants/petcare-theme';
import { useAuth } from '@/providers/auth-provider';

export default function AuthEntryScreen() {
  const { authBusy, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isSignUp = mode === 'signUp';

  const formHint = useMemo(() => {
    if (isSignUp) {
      return 'Yeni hesap oluştururken mevcut anonim verileriniz hesapla eşleştirilmeye çalışılır.';
    }
    return 'Farklı bir hesaba giriş yaparsanız cihazdaki anonim veriler ayrı bir kullanıcı altında kalabilir.';
  }, [isSignUp]);

  const handleSubmit = async () => {
    if (isSignUp) {
      if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert('Eksik bilgi', 'Lütfen tüm alanları doldurun.');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Şifre hatası', 'Şifre ve şifre tekrarı aynı olmalıdır.');
        return;
      }

      try {
        await signUpWithEmail({
          email,
          password,
          displayName: fullName,
        });
        Alert.alert('Başarılı', 'Hesabınız oluşturuldu.');
        router.replace('/(tabs)');
      } catch (err) {
        Alert.alert('Kayıt hatası', mapAuthError(err));
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre alanlarını doldurun.');
      return;
    }

    try {
      await signInWithEmail({ email, password });
      Alert.alert('Başarılı', 'Giriş yapıldı.');
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Giriş hatası', mapAuthError(err));
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('E-posta gerekli', 'Şifre sıfırlama bağlantısı için e-posta adresinizi girin.');
      return;
    }

    try {
      await resetPassword(email);
      Alert.alert('Gönderildi', 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
    } catch (err) {
      Alert.alert('Şifre sıfırlama hatası', mapAuthError(err));
    }
  };

  return (
    <Screen
      title="Giriş / Kayıt"
      subtitle="PetCare hesabınızı oluşturun veya giriş yapın."
      right={
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name="close" size={18} color="#456A87" />
        </Pressable>
      }>
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.brandIcon}>
            <MaterialIcons name="pets" size={20} color="#1E8E7E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>PetCare Hesap Merkezi</Text>
            <Text style={styles.heroText}>
              Sağlık kayıtlarını yedeklemek ve ileride cihazlar arası kullanım için hesap altyapısı hazırlandı.
            </Text>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          <ModeButton label="Giriş Yap" active={mode === 'signIn'} onPress={() => setMode('signIn')} icon="login" />
          <ModeButton
            label="Kayıt Ol"
            active={mode === 'signUp'}
            onPress={() => setMode('signUp')}
            icon="person-add-alt-1"
          />
        </View>
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <View style={styles.formHeaderIcon}>
            <MaterialIcons
              name={isSignUp ? 'person-add-alt-1' : 'lock-open'}
              size={18}
              color={isSignUp ? '#2C6FA7' : '#1E8E7E'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formTitle}>{isSignUp ? 'Hesap Oluştur' : 'Giriş Yap'}</Text>
            <Text style={styles.formSubtitle}>
              {isSignUp
                ? 'Temel bilgilerinizi girerek hesabınızı oluşturun.'
                : 'E-posta ve şifreniz ile hesabınıza giriş yapın.'}
            </Text>
          </View>
        </View>

        {isSignUp ? (
          <AuthField
            label="Ad Soyad"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Örn. Cansu Yılmaz"
            autoCapitalize="words"
            icon="badge"
          />
        ) : null}

        <AuthField
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          placeholder="ornek@mail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail-outline"
        />

        <AuthField
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          icon="lock-outline"
        />

        {isSignUp ? (
          <AuthField
            label="Şifre Tekrar"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            icon="verified-user"
          />
        ) : null}

        {!isSignUp ? (
          <Pressable
            onPress={handleResetPassword}
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}>
            <MaterialIcons name="help-outline" size={14} color="#4E7BA0" />
            <Text style={styles.linkText}>Şifremi unuttum</Text>
          </Pressable>
        ) : null}

        <Button title={isSignUp ? 'Kayıt Ol' : 'Giriş Yap'} onPress={handleSubmit} loading={authBusy} />

        <Text style={styles.formHint}>{formHint}</Text>
      </Card>

      <Card style={styles.altActionsCard}>
        <Text style={styles.altActionsTitle}>Hızlı devam seçenekleri</Text>
        <View style={styles.altActionsGrid}>
          <Button
            title="Anonim Devam Et"
            variant="secondary"
            onPress={() => router.replace('/(tabs)')}
            style={styles.altBtn}
          />
          <Button
            title={isSignUp ? 'Giriş Ekranına Geç' : 'Kayıt Ol Ekranına Geç'}
            variant="secondary"
            onPress={() => setMode(isSignUp ? 'signIn' : 'signUp')}
            style={styles.altBtn}
          />
        </View>
      </Card>
    </Screen>
  );
}

function ModeButton({ label, active, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.modeBtn, active && styles.modeBtnActive, pressed && { opacity: 0.88 }]}>
      <MaterialIcons name={icon} size={16} color={active ? '#1E8E7E' : '#628092'} />
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  secureTextEntry = false,
  icon,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <View style={styles.inputIconWrap}>
          <MaterialIcons name={icon} size={17} color="#5D7B90" />
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PetCareTheme.colors.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

function mapAuthError(error) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'E-posta adresi geçersiz görünüyor.';
    case 'auth/email-already-in-use':
      return 'Bu e-posta adresi zaten kullanımda.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-posta veya şifre hatalı.';
    case 'auth/weak-password':
      return 'Şifre çok zayıf. Daha güçlü bir şifre deneyin.';
    case 'auth/operation-not-allowed':
      return 'Email/Password giriş yöntemi Firebase Console üzerinde aktif değil.';
    case 'auth/credential-already-in-use':
      return 'Bu e-posta başka bir hesaba bağlı. Giriş yaparak devam edin.';
    case 'auth/requires-recent-login':
      return 'Bu işlem için yeniden giriş yapmanız gerekiyor.';
    default:
      return error?.message || 'İşlem sırasında bir hata oluştu.';
  }
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE8F2',
    backgroundColor: '#F7FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#F2F9FF',
    borderColor: '#D7E8F6',
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E2F5F1',
    borderWidth: 1,
    borderColor: '#CBEAE4',
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
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE8F2',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeBtnActive: {
    borderColor: '#CDE7E2',
    backgroundColor: '#ECFAF6',
  },
  modeBtnText: {
    color: '#5F7C8F',
    fontWeight: '700',
    fontSize: 13,
  },
  modeBtnTextActive: {
    color: '#1E8E7E',
  },
  formCard: {
    gap: 10,
    borderColor: '#DFE9F2',
  },
  formHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  formHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#ECF5FD',
    borderWidth: 1,
    borderColor: '#D9E8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    color: '#214F73',
    fontSize: 15,
    fontWeight: '700',
  },
  formSubtitle: {
    color: '#6D8EA7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  inputShell: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE8F2',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  inputIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F7FB',
  },
  input: {
    flex: 1,
    color: PetCareTheme.colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  linkText: {
    color: '#4E7BA0',
    fontSize: 12,
    fontWeight: '600',
  },
  formHint: {
    color: '#708FA6',
    fontSize: 12,
    lineHeight: 17,
  },
  altActionsCard: {
    gap: 10,
    backgroundColor: '#FBFDFF',
    borderColor: '#E5EDF4',
  },
  altActionsTitle: {
    color: '#2A587D',
    fontSize: 13,
    fontWeight: '700',
  },
  altActionsGrid: {
    gap: 8,
  },
  altBtn: {
    minHeight: 42,
  },
});

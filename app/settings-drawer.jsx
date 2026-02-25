import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { Chip } from '@/components/pc/ui';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsDrawerRoute() {
  return (
    <AuthGate>
      <SettingsDrawerScreen />
    </AuthGate>
  );
}

function SettingsDrawerScreen() {
  const { user, authBusy, signOutToAnonymous } = useAuth();

  const isAnonymous = !!user?.isAnonymous;
  const displayName = user?.displayName || (isAnonymous ? 'Anonim Kullanıcı' : 'PetCare Kullanıcısı');
  const accountMeta = user?.email || (isAnonymous ? 'Anonim oturum aktif' : 'Hesap oturumu aktif');
  const avatarLetter = (user?.displayName || user?.email || 'P').slice(0, 2).toUpperCase();

  const closeDrawer = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const handleComingSoon = (title) => {
    Alert.alert(title, 'Bu alan MVP sonrası sürümlerde geliştirilecek.');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Çıkış yap',
      'Hesap oturumu kapatılacak. Başlangıç ekranına yönlendirileceksiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutToAnonymous();
              router.replace('/auth/welcome');
            } catch (err) {
              Alert.alert('Hata', err.message);
            }
          },
        },
      ]
    );
  };

  const handleAnonymousMode = () => {
    Alert.alert('Anonim moda dön', 'Hesap oturumu kapatılacak ve anonim mod başlatılacak. Devam edilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Devam Et',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutToAnonymous();
            Alert.alert('Tamamlandı', 'Anonim oturum başlatıldı.');
            closeDrawer();
          } catch (err) {
            Alert.alert('Hata', err.message);
          }
        },
      },
    ]);
  };

  const menuItems = [
    {
      key: 'home',
      icon: 'home-filled',
      label: 'Ana Sayfa',
      onPress: () => {
        closeDrawer();
        router.replace('/(tabs)');
      },
    },
    {
      key: 'pets',
      icon: 'pets',
      label: 'Petlerim',
      onPress: () => {
        closeDrawer();
        router.push('/(tabs)/pets');
      },
    },
    {
      key: 'reminders',
      icon: 'notifications-none',
      label: 'Hatırlatıcılar',
      onPress: () => {
        closeDrawer();
        router.push('/(tabs)/pets');
      },
    },
    {
      key: 'social',
      icon: 'photo-library',
      label: 'Sosyal',
      onPress: () => {
        closeDrawer();
        router.push('/(tabs)/social');
      },
    },
    {
      key: 'ai',
      icon: 'auto-awesome',
      label: 'AI Asistan',
      onPress: () => {
        closeDrawer();
        router.push('/ai');
      },
    },
    {
      key: 'account',
      icon: 'person-outline',
      label: 'Profil / Hesap',
      onPress: () => {
        closeDrawer();
        router.push('/auth');
      },
      hidden: !isAnonymous && !user?.email,
    },
    {
      key: 'help',
      icon: 'help-outline',
      label: 'Yardım',
      onPress: () => handleComingSoon('Yardım'),
    },
    {
      key: 'feedback',
      icon: 'feedback',
      label: 'Sorun Bildir',
      onPress: () => handleComingSoon('Geri Bildirim'),
    },
  ].filter((item) => !item.hidden);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={closeDrawer} />

      <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.accountIdentity}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Merhaba,</Text>
              <Text style={styles.nameText} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {accountMeta}
              </Text>
            </View>
          </View>

          <Pressable onPress={closeDrawer} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.82 }]}>
            <MaterialIcons name="close" size={22} color="#D5DFEC" />
          </Pressable>
        </View>

        <View style={styles.headerStatusRow}>
          <Chip label={isAnonymous ? 'Anonim' : 'Hesaplı'} tone={isAnonymous ? 'warning' : 'primary'} />
          <Text style={styles.versionText}>PetCare MVP</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SectionDivider />

          <Text style={styles.sectionLabel}>Evcil Hayvanlarınız</Text>
          <Pressable
            onPress={() => {
              closeDrawer();
              router.push('/pets/new');
            }}
            style={({ pressed }) => [styles.addPetCard, pressed && { opacity: 0.9 }]}>
            <View style={styles.addPetCircle}>
              <MaterialIcons name="add" size={30} color="#D8E4F0" />
            </View>
            <Text style={styles.addPetText}>Yeni Ekle</Text>
          </Pressable>

          <SectionDivider />

          <View style={styles.menuList}>
            {menuItems.map((item) => (
              <MenuRow key={item.key} icon={item.icon} label={item.label} onPress={item.onPress} />
            ))}
          </View>

          <SectionDivider />

          {!isAnonymous ? (
            <>
              <MenuRow icon="person-outline" label={authBusy ? 'Geçiş yapılıyor...' : 'Anonim Moda Dön'} onPress={authBusy ? () => {} : handleAnonymousMode} />
              <MenuRow icon="power-settings-new" label={authBusy ? 'İşlem yapılıyor...' : 'Çıkış Yap'} onPress={authBusy ? () => {} : handleSignOut} danger />
            </>
          ) : (
            <MenuRow
              icon="login"
              label="Giriş Yap / Kayıt Ol"
              onPress={() => {
                closeDrawer();
                router.push('/auth');
              }}
            />
          )}

          {__DEV__ ? (
            <>
              <SectionDivider />
              <MenuRow
                icon="build-circle"
                label="Push Test Aracı"
                onPress={() => {
                  closeDrawer();
                  router.push('/dev/push-test');
                }}
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
      <MaterialIcons name={icon} size={24} color={danger ? '#FF8F98' : '#E8EEF6'} style={{ width: 30 }} />
      <Text style={[styles.menuRowText, danger && styles.menuRowTextDanger]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 14, 22, 0.38)',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    width: '88%',
    maxWidth: 430,
    backgroundColor: '#273246',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 0 },
    elevation: 12,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  accountIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFB126',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  greeting: {
    color: '#C8D3E0',
    fontSize: 12,
  },
  nameText: {
    color: '#F4F7FB',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  metaText: {
    color: '#AEBBCC',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 10,
  },
  versionText: {
    color: '#9FB0C3',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(210, 222, 238, 0.18)',
    marginVertical: 6,
  },
  sectionLabel: {
    color: '#E8EEF6',
    fontSize: 14,
    fontWeight: '700',
  },
  addPetCard: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  addPetCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: '#A8B8CC',
    backgroundColor: '#1F2939',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPetText: {
    color: '#E8EEF6',
    fontSize: 12,
    fontWeight: '600',
  },
  menuList: {
    gap: 4,
  },
  menuRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  menuRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuRowText: {
    color: '#F0F4FA',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  menuRowTextDanger: {
    color: '#FFD4D8',
  },
});

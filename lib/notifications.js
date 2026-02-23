import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerNativePushToken() {
  if (!Device.isDevice) {
    throw new Error('Push bildirim için fiziksel cihaz gerekli.');
  }

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    throw new Error('Bildirim izni verilmedi.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('petcare-reminders', {
      name: 'PetCare Hatırlatmaları',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#1E8E7E',
    });
  }

  const deviceToken = await Notifications.getDevicePushTokenAsync();

  return {
    token: typeof deviceToken.data === 'string' ? deviceToken.data : '',
    provider: deviceToken.type,
    platform: Platform.OS,
  };
}

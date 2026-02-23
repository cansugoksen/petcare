import { useLocalSearchParams } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { ReminderFormScreen } from '@/features/reminders/reminder-form-screen';

export default function NewReminderScreen() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <ReminderFormScreen mode="create" petId={petId} />
    </AuthGate>
  );
}

import { useLocalSearchParams } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { ReminderFormScreen } from '@/features/reminders/reminder-form-screen';

export default function EditReminderScreen() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;
  const reminderId = Array.isArray(params.reminderId) ? params.reminderId[0] : params.reminderId;

  return (
    <AuthGate>
      <ReminderFormScreen mode="edit" petId={petId} reminderId={reminderId} />
    </AuthGate>
  );
}

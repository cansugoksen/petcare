import { useLocalSearchParams } from 'expo-router';

import { AuthGate } from '@/components/pc/auth-guard';
import { PetFormScreen } from '@/features/pets/pet-form-screen';

export default function EditPetScreen() {
  const params = useLocalSearchParams();
  const petId = Array.isArray(params.petId) ? params.petId[0] : params.petId;

  return (
    <AuthGate>
      <PetFormScreen mode="edit" petId={petId} />
    </AuthGate>
  );
}

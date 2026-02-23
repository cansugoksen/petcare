import { AuthGate } from '@/components/pc/auth-guard';
import { PetFormScreen } from '@/features/pets/pet-form-screen';

export default function NewPetScreen() {
  return (
    <AuthGate>
      <PetFormScreen mode="create" />
    </AuthGate>
  );
}

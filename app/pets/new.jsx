import { AuthGate } from '@/components/pc/auth-guard';
import { PetCreateWizardScreen } from '@/features/pets/pet-create-wizard-screen';

export default function NewPetScreen() {
  return (
    <AuthGate>
      <PetCreateWizardScreen />
    </AuthGate>
  );
}

import { httpsCallable } from 'firebase/functions';

import { functionsClient } from '@/lib/firebase';

export async function generateAiAssistantSummary(payload) {
  const callable = httpsCallable(functionsClient, 'generateAiAssistantSummary');
  const response = await callable({
    petId: payload.petId,
    task: payload.task,
    prompt: payload.prompt || '',
  });
  return response?.data || null;
}

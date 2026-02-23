import { AuthProvider } from '@/providers/auth-provider';

export function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

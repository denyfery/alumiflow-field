import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/auth/session-provider';
import { ScreenState } from '@/components/ScreenState';

export default function FieldLayout() {
  const { status } = useSession();

  if (status === 'loading') return <ScreenState message="Menyiapkan workspace…" />;
  if (status !== 'authenticated') return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

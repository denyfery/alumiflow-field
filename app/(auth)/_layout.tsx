import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/auth/session-provider';
import { ScreenState } from '@/components/ScreenState';

export default function AuthLayout() {
  const { status } = useSession();

  if (status === 'loading') return <ScreenState message="Memeriksa sesi…" />;
  if (status === 'authenticated') return <Redirect href="/home" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

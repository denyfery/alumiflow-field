import { Redirect } from 'expo-router';
import { ScreenState } from '@/components/ScreenState';
import { useSession } from '@/auth/session-provider';

export default function IndexScreen() {
  const { status } = useSession();

  if (status === 'loading') {
    return <ScreenState message="Menyiapkan AlumiFlow Field…" />;
  }

  return <Redirect href={status === 'authenticated' ? '/home' : '/login'} />;
}

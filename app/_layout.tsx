import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/auth/session-provider';
import { PushNotificationProvider } from '@/notifications/push-provider';
import { SyncProvider } from '@/sync/sync-provider';
import { FieldThemeProvider } from '@/ui/theme-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <FieldThemeProvider>
          <SyncProvider>
            <PushNotificationProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </PushNotificationProvider>
          </SyncProvider>
        </FieldThemeProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

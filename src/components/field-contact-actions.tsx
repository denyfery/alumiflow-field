import * as Clipboard from 'expo-clipboard';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';

type Translator = (key: string, vars?: Record<string, string | number>) => string;

type Props = {
  address?: string | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  t: Translator;
};

type InlineActionProps = {
  label: string;
  onPress: () => void;
};

function InlineAction({ label, onPress }: InlineActionProps) {
  const theme = useFieldTheme();

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Text style={[styles.actionText, { color: theme.colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

function ActionSeparator() {
  return <Text style={styles.separator}>·</Text>;
}

export function FieldContactActions({ address, mapsUrl, phone, whatsapp, t }: Props) {
  const cleanAddress = address?.trim() || null;
  const cleanPhone = phone?.trim() || null;
  const cleanWhatsapp = whatsapp?.trim() || null;
  const mapTarget = mapsUrl?.trim() || (cleanAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}`
    : null);

  async function copyText(value: string, successMessage: string) {
    await Clipboard.setStringAsync(value);
    if (Platform.OS === 'android') {
      ToastAndroid.show(t(successMessage), ToastAndroid.SHORT);
      return;
    }
    Alert.alert(t('Copied'), t(successMessage));
  }

  async function openMaps() {
    if (!mapTarget) return;
    try {
      await Linking.openURL(mapTarget);
    } catch {
      Alert.alert(t('Unable to open Maps'), t('Copy the address and open it manually in your map application.'));
    }
  }

  async function openWhatsApp() {
    if (!cleanWhatsapp) return;
    const normalized = normalizeWhatsAppNumber(cleanWhatsapp);
    if (!normalized) {
      Alert.alert(t('Unable to open WhatsApp'), t('The WhatsApp number is not valid.'));
      return;
    }

    try {
      await Linking.openURL(`https://wa.me/${normalized}`);
    } catch {
      Alert.alert(t('Unable to open WhatsApp'), t('Copy the WhatsApp number and open it manually.'));
    }
  }

  if (!mapTarget && !cleanAddress && !cleanPhone && !cleanWhatsapp) return null;

  return (
    <View style={styles.wrap}>
      {(mapTarget || cleanAddress) ? (
        <View style={styles.row}>

          {cleanAddress ? (
            <InlineAction
            label={t('Copy Address')}
            onPress={() => { copyText(cleanAddress, 'Address copied').catch(() => undefined); }}
            />
          ) : null}
          {mapTarget && cleanAddress ? <ActionSeparator /> : null}
          {mapTarget ? (
            <InlineAction
              label={t('Open Maps')}
              onPress={() => { openMaps().catch(() => undefined); }}
            />
          ) : null}
        </View>
      ) : null}

      {(cleanPhone || cleanWhatsapp) ? (
        <View style={styles.row}>
          {cleanPhone ? (
            <InlineAction
              label={t('Copy Phone')}
              onPress={() => { copyText(cleanPhone, 'Phone number copied').catch(() => undefined); }}
            />
          ) : null}
          {cleanPhone && cleanWhatsapp ? <ActionSeparator /> : null}
          {cleanWhatsapp ? (
            <>
              <InlineAction
                label={t('WhatsApp')}
                onPress={() => { openWhatsApp().catch(() => undefined); }}
              />
              {cleanWhatsapp !== cleanPhone ? (
                <>
                  <ActionSeparator />
                  <InlineAction
                    label={t('Copy WhatsApp')}
                    onPress={() => { copyText(cleanWhatsapp, 'WhatsApp number copied').catch(() => undefined); }}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function normalizeWhatsAppNumber(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits;
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  row: { minHeight: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 7, rowGap: 3 },
  action: { minHeight: 28, justifyContent: 'center' },
  actionPressed: { opacity: 0.55 },
  actionText: { color: fieldTheme.colors.primary, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  separator: { color: fieldTheme.colors.textSoft, fontSize: 13, lineHeight: 18 },
});

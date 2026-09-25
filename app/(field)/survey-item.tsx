import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session-provider';
import { FieldActionButton, FieldHeader, LoadingCards } from '@/components/field-ui';
import { listProducts } from '@/database/repositories/products';
import { getSurvey } from '@/database/repositories/surveys';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { saveSurveyItemLocal } from '@/surveys/actions';
import { useSync } from '@/sync/sync-provider';
import { fieldTheme } from '@/ui/theme';
import { useFieldTheme } from '@/ui/theme-provider';
import type { MobileProduct, MobileSurvey } from '@/types/api';

export default function SurveyItemScreen() {
  const theme = useFieldTheme();
  const params = useLocalSearchParams<{ surveyId: string; itemUuid?: string }>();
  const surveyId = Number(params.surveyId);
  const itemUuid = params.itemUuid ? String(params.itemUuid) : null;
  const { profile } = useSession();
  const { t, businessLabel } = useFieldI18n();
  const { connectivity, syncNow } = useSync();
  const [survey, setSurvey] = useState<MobileSurvey | null>(null);
  const [products, setProducts] = useState<MobileProduct[]>([]);
  const [productId, setProductId] = useState<number | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [nextSurvey, nextProducts] = await Promise.all([getSurvey(profile, surveyId), listProducts(profile.company.id)]);
    setSurvey(nextSurvey);
    setProducts(nextProducts);

    if (nextSurvey && itemUuid) {
      const item = nextSurvey.items.find((candidate) => candidate.mobile_uuid === itemUuid);
      if (item) {
        setProductId(item.product_id);
        setMeasurements(Object.fromEntries(Object.entries(item.measurements).map(([key, value]) => [key, String(value)])));
        setQuantity(String(item.quantity));
        setNotes(item.notes ?? '');
      }
    }
  }, [profile, surveyId, itemUuid]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t('Failed to load form.')));
  }, [load, t]);

  const product = useMemo(() => products.find((item) => item.id === productId) ?? null, [products, productId]);
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase();
    if (!query) return products;
    return products.filter((candidate) => [candidate.name, candidate.code, candidate.category, candidate.billing_unit]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(query)));
  }, [products, productQuery]);

  if (!profile || !survey) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loadingWrap}><LoadingCards count={2} /></View></SafeAreaView>;
  }

  const currentProfile = profile;
  const currentSurvey = survey;

  async function save() {
    setError(null);
    if (!product) { setError(t('Select a product first.')); return; }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) { setError(t('Quantity must be at least 1.')); return; }

    const normalized: Record<string, string | number> = {};
    for (const field of product.measurement_schema) {
      const raw = (measurements[field.key] ?? '').trim();
      const visibleLabel = businessLabel(field.label);
      if (field.required && raw === '') { setError(t('{field} is required.', { field: visibleLabel })); return; }
      if (raw === '') continue;
      if (field.type === 'number') {
        const value = Number(raw.replace(',', '.'));
        if (!Number.isFinite(value)) { setError(t('{field} must be a number.', { field: visibleLabel })); return; }
        normalized[field.key] = value;
      } else {
        normalized[field.key] = raw;
      }
    }

    setSaving(true);
    try {
      await saveSurveyItemLocal(currentProfile, currentSurvey, product, {
        localUuid: itemUuid,
        measurements: normalized,
        quantity: qty,
        notes: notes.trim() || null,
      });
      if (connectivity === 'online') await syncNow();
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Failed to save item.'));
    } finally {
      setSaving(false);
    }
  }

  function selectProduct(next: MobileProduct) {
    setProductId(next.id);
    if (!itemUuid) setMeasurements({});
    setProductQuery('');
    setProductPickerOpen(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <FieldHeader
            eyebrow={t('MEASUREMENT')}
            title={itemUuid ? t('Edit Item') : t('Add Item')}
            subtitle={`${survey.survey_number} · ${survey.customer?.name ?? '-'}`}
            onBack={() => router.back()}
            backLabel={t('My Surveys')}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('Product')}</Text>
            {product ? (
              <View style={[styles.selectedProductCard, { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primarySoft }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedProductName}>{product.name}</Text>
                  <Text style={styles.productMeta}>{[product.code, product.category ?? product.billing_unit].filter(Boolean).join(' · ')}</Text>
                </View>
                <Pressable disabled={saving} onPress={() => setProductPickerOpen(true)} style={styles.changeProductButton}>
                  <Text style={[styles.changeProductText, { color: theme.colors.primary }]}>{t('Change product')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable disabled={products.length === 0} onPress={() => setProductPickerOpen(true)} style={[styles.chooseProductButton, products.length === 0 && styles.disabled]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chooseProductTitle}>{t('Choose product')}</Text>
                  <Text style={styles.chooseProductHint}>{t('Search by product name or code')}</Text>
                </View>
                <Text style={[styles.chooseProductArrow, { color: theme.colors.primary }]}>→</Text>
              </Pressable>
            )}
            {products.length === 0 ? <Text style={styles.muted}>{t('Product Master has not synced yet. Go back and press Sync.')}</Text> : null}
          </View>

          {product ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('Measurements · {product}', { product: product.name })}</Text>
              {product.measurement_schema.length === 0 ? <Text style={styles.muted}>{t('This product does not require measurement attributes.')}</Text> : null}
              {product.measurement_schema.map((field) => {
                const visibleLabel = businessLabel(field.label);
                return (
                  <View key={field.key} style={styles.field}>
                    <Text style={styles.label}>{visibleLabel}{field.required ? ' *' : ''}{field.unit ? ` (${field.unit})` : ''}</Text>
                    <TextInput
                      value={measurements[field.key] ?? ''}
                      onChangeText={(value) => setMeasurements((current) => ({ ...current, [field.key]: value }))}
                      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
                      placeholder={field.type === 'number' ? '0' : visibleLabel}
                      placeholderTextColor={fieldTheme.colors.textSoft}
                      style={styles.input}
                    />
                  </View>
                );
              })}

              <View style={styles.field}>
                <Text style={styles.label}>{t('Quantity')} *</Text>
                <TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t('Notes')}</Text>
                <TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder={t('Measurement notes')} placeholderTextColor={fieldTheme.colors.textSoft} style={[styles.input, styles.textarea]} />
              </View>
            </View>
          ) : null}

          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
          <FieldActionButton onPress={save} disabled={saving || !product} label={saving ? t('Saving…') : t('Save Measurement')} />
        </ScrollView>
      </KeyboardAvoidingView>

        <Modal visible={productPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProductPickerOpen(false)}>
          <SafeAreaView style={styles.pickerSafeArea}>
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerEyebrow, { color: theme.colors.primary }]}>{t('PRODUCT')}</Text>
                <Text style={styles.pickerTitle}>{t('Select Product')}</Text>
                <Text style={styles.pickerSubtitle}>{t('{count} products available offline', { count: products.length })}</Text>
              </View>
              <Pressable onPress={() => setProductPickerOpen(false)} hitSlop={8} style={styles.pickerClose}>
                <Text style={styles.pickerCloseText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                autoFocus
                value={productQuery}
                onChangeText={setProductQuery}
                placeholder={t('Search product name or code')}
                placeholderTextColor={fieldTheme.colors.textSoft}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {productQuery ? (
                <Pressable onPress={() => setProductQuery('')} hitSlop={8} style={styles.searchClear}>
                  <Text style={styles.searchClearText}>×</Text>
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={(candidate) => String(candidate.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.productList}
              initialNumToRender={14}
              maxToRenderPerBatch={16}
              windowSize={7}
              renderItem={({ item: candidate }) => (
                <Pressable onPress={() => selectProduct(candidate)} style={({ pressed }) => [styles.productOption, candidate.id === productId && styles.productSelected, candidate.id === productId && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft }, pressed && styles.productPressed]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.productName, candidate.id === productId && styles.productNameSelected, candidate.id === productId && { color: theme.colors.primary }]}>{candidate.name}</Text>
                    <Text style={styles.productMeta}>{[candidate.code, candidate.category ?? candidate.billing_unit].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {candidate.id === productId ? <Text style={[styles.productCheck, { color: theme.colors.primary }]}>✓</Text> : <Text style={styles.productArrow}>→</Text>}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.productEmpty}>
                  <Text style={styles.productEmptyTitle}>{t('Product not found')}</Text>
                  <Text style={styles.productEmptyText}>{t('Try another product name or code. The search works from the product data already stored on this device.')}</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  loadingWrap: { flex: 1, padding: 20, justifyContent: 'center' },
  container: { padding: 20, gap: 15, paddingBottom: 132 },
  card: { backgroundColor: fieldTheme.colors.surface, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.lg, padding: 16, gap: 12 },
  cardTitle: { color: fieldTheme.colors.text, fontSize: 17, fontWeight: '800' },
  selectedProductCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: fieldTheme.colors.primaryBorder, backgroundColor: fieldTheme.colors.primarySoft, borderRadius: fieldTheme.radius.md, padding: 13 },
  selectedProductName: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 15 },
  changeProductButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 10 },
  changeProductText: { color: fieldTheme.colors.primary, fontWeight: '800', fontSize: 12 },
  chooseProductButton: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: fieldTheme.colors.borderStrong, borderRadius: fieldTheme.radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  chooseProductTitle: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 15 },
  chooseProductHint: { color: fieldTheme.colors.textMuted, fontSize: 12, marginTop: 3 },
  chooseProductArrow: { color: fieldTheme.colors.primary, fontSize: 20, fontWeight: '800' },
  productOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: fieldTheme.colors.border, borderRadius: fieldTheme.radius.md, backgroundColor: fieldTheme.colors.surface, paddingHorizontal: 14, paddingVertical: 11 },
  productSelected: { borderColor: fieldTheme.colors.primary, backgroundColor: fieldTheme.colors.primarySoft },
  productPressed: { opacity: 0.72 },
  productName: { color: fieldTheme.colors.text, fontWeight: '700', fontSize: 15 },
  productNameSelected: { color: fieldTheme.colors.primary },
  productMeta: { color: fieldTheme.colors.textMuted, fontSize: 12, marginTop: 3 },
  productCheck: { color: fieldTheme.colors.primary, fontSize: 18, fontWeight: '900' },
  productArrow: { color: fieldTheme.colors.textSoft, fontSize: 18, fontWeight: '800' },
  field: { gap: 6 },
  label: { color: fieldTheme.colors.text, fontWeight: '700', fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: fieldTheme.colors.borderStrong, borderRadius: fieldTheme.radius.md, paddingHorizontal: 13, fontSize: 16, color: fieldTheme.colors.text, backgroundColor: fieldTheme.colors.surface },
  textarea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  muted: { color: fieldTheme.colors.textMuted, lineHeight: 20 },
  errorCard: { backgroundColor: fieldTheme.colors.dangerSoft, borderColor: fieldTheme.colors.dangerBorder, borderWidth: 1, borderRadius: fieldTheme.radius.md, padding: 12 },
  errorText: { color: fieldTheme.colors.danger, lineHeight: 20 },
  disabled: { opacity: 0.5 },
  pickerSafeArea: { flex: 1, backgroundColor: fieldTheme.colors.background },
  pickerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  pickerEyebrow: { color: fieldTheme.colors.primary, fontWeight: '900', fontSize: 11, letterSpacing: 1.35 },
  pickerTitle: { color: fieldTheme.colors.text, fontSize: 25, fontWeight: '800', marginTop: 3 },
  pickerSubtitle: { color: fieldTheme.colors.textMuted, fontSize: 12, marginTop: 3 },
  pickerClose: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: fieldTheme.colors.border, backgroundColor: fieldTheme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  pickerCloseText: { color: fieldTheme.colors.textMuted, fontSize: 25, lineHeight: 26 },
  searchWrap: { minHeight: 50, marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: fieldTheme.colors.borderStrong, borderRadius: fieldTheme.radius.md, backgroundColor: fieldTheme.colors.surface, paddingHorizontal: 13 },
  searchIcon: { color: fieldTheme.colors.textMuted, fontSize: 20 },
  searchInput: { flex: 1, minHeight: 48, color: fieldTheme.colors.text, fontSize: 16 },
  searchClear: { width: 30, height: 30, borderRadius: 15, backgroundColor: fieldTheme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  searchClearText: { color: fieldTheme.colors.textMuted, fontSize: 20, lineHeight: 21 },
  productList: { paddingHorizontal: 20, paddingBottom: 32, gap: 8, flexGrow: 1 },
  productEmpty: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, gap: 7 },
  productEmptyTitle: { color: fieldTheme.colors.text, fontWeight: '800', fontSize: 17, textAlign: 'center' },
  productEmptyText: { color: fieldTheme.colors.textMuted, lineHeight: 20, textAlign: 'center' },
});

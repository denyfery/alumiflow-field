import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveServerAssetUrl } from '@/api/assets';
import { useSession } from '@/auth/session-provider';
import { FieldContactActions } from '@/components/field-contact-actions';
import { FieldActionButton, FieldErrorCard, FieldHeader, LoadingCards, StatusPill, SyncStatusCard } from '@/components/field-ui';
import { getInstallation } from '@/database/repositories/installations';
import { completeInstallationLocal, reportInstallationIssueLocal, startInstallationLocal } from '@/installations/actions';
import { SignaturePad } from '@/installations/signature-pad';
import { captureInstallationPhotoLocal, removeUnsyncedInstallationPhoto } from '@/installations/photos';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { ensureCameraPermission, ensureLocationPermission } from '@/permissions/field-permissions';
import { captureFieldLocation, type FieldLocationEvidence } from '@/surveys/location';
import { useSync } from '@/sync/sync-provider';
import type { MobileInstallation, MobileInstallationIssue, MobileInstallationPhoto, SignatureStroke } from '@/types/api';

export default function InstallationDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const installationId = Number(params.id);
  const { profile } = useSession();
  const { connectivity, syncNow, error: syncError } = useSync();
  const { t, formatDate, formatDateTime, statusLabel, locationLabel, businessLabel } = useFieldI18n();
  const [installation, setInstallation] = useState<MobileInstallation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completionEvidence, setCompletionEvidence] = useState<FieldLocationEvidence | null>(null);
  const [receivedByName, setReceivedByName] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [signatureStatus, setSignatureStatus] = useState<'signed' | 'unavailable'>('signed');
  const [signatureStrokes, setSignatureStrokes] = useState<SignatureStroke[]>([]);
  const [signatureUnavailableReason, setSignatureUnavailableReason] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueCategory, setIssueCategory] = useState<MobileInstallationIssue['category']>('material');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<MobileInstallationIssue['severity']>('medium');
  const [issueCanContinue, setIssueCanContinue] = useState(true);
  const [issueCustomerInformed, setIssueCustomerInformed] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !Number.isFinite(installationId)) return;
    setInstallation(await getInstallation(profile, installationId));
  }, [profile, installationId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  if (!profile || !installation) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loadingWrap}><LoadingCards count={2} /></View></SafeAreaView>;
  }
  const currentProfile = profile;
  const currentInstallation = installation;

  async function afterMutation() {
    await load();
    if (connectivity === 'online') { await syncNow(); await load(); }
  }

  async function startInstallation() {
    setBusy(true); setActionError(null);
    try { await ensureLocationPermission(t); await startInstallationLocal(currentProfile, currentInstallation, await captureFieldLocation()); await afterMutation(); }
    catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to start installation.')); }
    finally { setBusy(false); }
  }

  async function capturePhoto(type: 'before' | 'after' | 'issue', issueMobileUuid: string | null = null) {
    setBusy(true); setActionError(null);
    try { if (!await ensureCameraPermission(t)) return; const captured = await captureInstallationPhotoLocal(currentProfile, currentInstallation, type, issueMobileUuid); if (captured) await afterMutation(); }
    catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to capture installation photo.')); }
    finally { setBusy(false); }
  }

  function removePhoto(photo: MobileInstallationPhoto) {
    if (!photo.mobile_uuid) return;
    Alert.alert(t('Delete photo?'), t('The unsynced photo will be removed from this device and its queue.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: async () => {
        setBusy(true); setActionError(null);
        try { await removeUnsyncedInstallationPhoto(photo.mobile_uuid!); await load(); }
        catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to delete local photo.')); }
        finally { setBusy(false); }
      } },
    ]);
  }

  async function submitIssue() {
    if (!issueTitle.trim()) { setActionError(t('Issue title is required.')); return; }
    setBusy(true); setActionError(null);
    try {
      await reportInstallationIssueLocal(currentProfile, currentInstallation, {
        category: issueCategory,
        title: issueTitle,
        description: issueDescription || null,
        severity: issueSeverity,
        canWorkContinue: issueCanContinue,
        customerInformed: issueCustomerInformed,
      });
      setIssueTitle(''); setIssueDescription(''); setIssueCategory('material'); setIssueSeverity('medium');
      setIssueCanContinue(true); setIssueCustomerInformed(false); setShowIssueForm(false);
      await afterMutation();
    } catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to report issue.')); }
    finally { setBusy(false); }
  }

  async function prepareCompletion() {
    const blocking = currentInstallation.issues.filter((issue) => issue.status === 'open' && issue.blocks_completion);
    if (blocking.length > 0) { setActionError(t('Resolve blocking installation issues before completion.')); return; }
    setBusy(true); setActionError(null);
    try {
      if (!receivedByName.trim()) setReceivedByName(currentInstallation.customer?.name ?? '');
      await ensureLocationPermission(t);
      setCompletionEvidence(await captureFieldLocation());
    }
    catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to prepare installation evidence.')); }
    finally { setBusy(false); }
  }

  async function confirmCompletion() {
    if (!completionEvidence) return;
    if (!receivedByName.trim()) { setActionError(t('Recipient name is required.')); return; }
    const pointCount = signatureStrokes.reduce((sum, stroke) => sum + stroke.length, 0);
    if (signatureStatus === 'signed' && pointCount < 6) { setActionError(t('Please ask the recipient to sign in the signature box.')); return; }
    if (signatureStatus === 'unavailable' && !signatureUnavailableReason.trim()) { setActionError(t('Explain why the recipient signature is unavailable.')); return; }

    setBusy(true); setActionError(null);
    try {
      await completeInstallationLocal(currentProfile, currentInstallation, completionEvidence, {
        receivedByName,
        notes: handoverNotes || null,
        signatureStatus,
        signatureStrokes,
        signatureUnavailableReason: signatureUnavailableReason || null,
      });
      setCompletionEvidence(null);
      await afterMutation();
    }
    catch (error) { setActionError(error instanceof Error ? error.message : t('Failed to complete installation.')); }
    finally { setBusy(false); }
  }

  const before = installation.photos.filter((photo) => photo.type === 'before');
  const after = installation.photos.filter((photo) => photo.type === 'after');
  const legacyIssuePhotos = installation.photos.filter((photo) => photo.type === 'issue' && !photo.issue_mobile_uuid);
  const openIssues = installation.issues.filter((issue) => issue.status === 'open');
  const blockingIssues = openIssues.filter((issue) => issue.blocks_completion);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <FieldHeader
          eyebrow="INSTALLATION"
          title={installation.job_number ?? `#${installation.id}`}
          subtitle={installation.customer?.name ?? '-'}
          onBack={() => router.back()}
          backLabel={t('My Installations')}
          right={<StatusPill status={installation.status} label={statusLabel(installation.status)} />}
        />
        <SyncStatusCard compact onSynced={load} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Schedule & Customer')}</Text>
          <Text style={styles.label}>{t('Date')}</Text><Text style={styles.value}>{formatDate(installation.scheduled_date)}{installation.start_time ? ` · ${installation.start_time}` : ''}</Text>
          <Text style={styles.label}>{t('Address')}</Text><Text style={styles.value}>{installation.customer?.address ?? t('No address')}</Text>
          <FieldContactActions
            address={installation.customer?.address}
            mapsUrl={installation.customer?.maps_url}
            t={t}
          />
          {installation.customer?.phone ? (
            <>
              <Text style={styles.label}>{t('Phone')}</Text><Text style={styles.value}>{installation.customer.phone}</Text>
              <FieldContactActions
                phone={installation.customer.phone}
                whatsapp={installation.customer.whatsapp === installation.customer.phone ? installation.customer.whatsapp : undefined}
                t={t}
              />
            </>
          ) : null}
          {installation.customer?.whatsapp && installation.customer.whatsapp !== installation.customer.phone ? (
            <>
              <Text style={styles.label}>{t('WhatsApp')}</Text><Text style={styles.value}>{installation.customer.whatsapp}</Text>
              <FieldContactActions whatsapp={installation.customer.whatsapp} t={t} />
            </>
          ) : null}
          {installation.notes && <><Text style={styles.label}>{t('Notes')}</Text><Text style={styles.value}>{installation.notes}</Text></>}
          <Text style={styles.label}>{t('Team')}</Text><Text style={styles.value}>{installation.workers.map((worker) => worker.name).join(', ') || '-'}</Text>
        </View>

        <FieldErrorCard error={actionError || syncError} onRetry={connectivity === 'online' ? async () => { await syncNow(); await load(); } : undefined} />
        {installation.status === 'scheduled' && <FieldActionButton disabled={busy} onPress={startInstallation} label={busy ? t('Processing…') : t('Start Installation')} />}

        <View><Text style={styles.sectionTitle}>{t('Work Items')}</Text><Text style={styles.muted}>{t('{count} work items', { count: installation.items.length })}</Text></View>
        {installation.items.length === 0 ? <View style={styles.card}><Text style={styles.muted}>{t('No work items.')}</Text></View> : installation.items.map((item) => (
          <View key={item.id} style={styles.itemCard}><Text style={styles.itemTitle}>{item.product_name}</Text><Text style={styles.muted}>{t('Quantity')} {item.quantity}{item.billing_unit ? ` · ${item.billing_unit}` : ''}</Text>{Object.keys(item.measurements).length > 0 && <Text style={styles.value}>{Object.entries(item.measurements).map(([key,value]) => `${businessLabel(key)}: ${value}`).join(' · ')}</Text>}{item.notes && <Text style={styles.notes}>{item.notes}</Text>}</View>
        ))}

        <PhotoSection title={t('Before Photos')} photos={before} canCapture={installation.status === 'in_progress'} onCapture={() => capturePhoto('before')} onDelete={removePhoto} t={t} busy={busy}/>
        <PhotoSection title={t('After Photos')} photos={after} canCapture={installation.status === 'in_progress'} onCapture={() => capturePhoto('after')} onDelete={removePhoto} t={t} busy={busy}/>

        <View style={{gap:10}}>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>{t('Installation Issues')}</Text><Text style={styles.muted}>{t('{count} open issues', {count: openIssues.length})}</Text></View>
            {installation.status==='in_progress'&&<FieldActionButton compact fullWidth={false} variant="secondary" disabled={busy} onPress={()=>setShowIssueForm(value=>!value)} label={`+ ${t('Report Issue')}`} />}
          </View>
          {showIssueForm&&<View style={styles.issueForm}>
            <Text style={styles.formLabel}>{t('Category')}</Text>
            <View style={styles.chipRow}>{(['measurement','material','damage','site_condition','customer_request','installation','other'] as MobileInstallationIssue['category'][]).map(value=><Pressable key={value} onPress={()=>setIssueCategory(value)} style={[styles.chip,issueCategory===value&&styles.chipActive]}><Text style={[styles.chipText,issueCategory===value&&styles.chipTextActive]}>{t(issueCategoryLabel(value))}</Text></Pressable>)}</View>
            <Text style={styles.formLabel}>{t('Issue title')}</Text><TextInput value={issueTitle} onChangeText={setIssueTitle} placeholder={t('Short description of the issue')} style={styles.input}/>
            <Text style={styles.formLabel}>{t('Description')}</Text><TextInput value={issueDescription} onChangeText={setIssueDescription} multiline placeholder={t('What happened in the field?')} style={[styles.input,styles.textarea]}/>
            <Text style={styles.formLabel}>{t('Severity')}</Text>
            <View style={styles.chipRow}>{(['low','medium','high'] as MobileInstallationIssue['severity'][]).map(value=><Pressable key={value} onPress={()=>setIssueSeverity(value)} style={[styles.chip,issueSeverity===value&&styles.chipActive]}><Text style={[styles.chipText,issueSeverity===value&&styles.chipTextActive]}>{t(value==='low'?'Low':value==='medium'?'Medium':'High')}</Text></Pressable>)}</View>
            <Text style={styles.formLabel}>{t('Can work continue?')}</Text>
            <View style={styles.chipRow}><Pressable onPress={()=>setIssueCanContinue(true)} style={[styles.chip,issueCanContinue&&styles.chipActive]}><Text style={[styles.chipText,issueCanContinue&&styles.chipTextActive]}>{t('Yes')}</Text></Pressable><Pressable onPress={()=>setIssueCanContinue(false)} style={[styles.chip,!issueCanContinue&&styles.blockingChip]}><Text style={[styles.chipText,!issueCanContinue&&styles.blockingChipText]}>{t('No')}</Text></Pressable></View>
            <Pressable onPress={()=>setIssueCustomerInformed(value=>!value)} style={styles.checkRow}><View style={[styles.checkBox,issueCustomerInformed&&styles.checkBoxActive]}><Text style={styles.checkMark}>{issueCustomerInformed?'✓':''}</Text></View><Text style={styles.value}>{t('Customer has been informed')}</Text></Pressable>
            <View style={styles.reviewActions}><FieldActionButton variant="danger" disabled={busy} onPress={()=>setShowIssueForm(false)} label={t('Cancel')} /><FieldActionButton disabled={busy} onPress={submitIssue} label={busy?t('Processing…'):t('Save Issue')} /></View>
          </View>}
          {installation.issues.length===0?<View style={styles.card}><Text style={styles.muted}>{t('No structured issues reported.')}</Text></View>:installation.issues.map(issue=><IssueCard key={issue.mobile_uuid} issue={issue} photos={installation.photos.filter(photo=>photo.issue_mobile_uuid===issue.mobile_uuid)} canCapture={installation.status==='in_progress'&&issue.status==='open'} onCapture={()=>capturePhoto('issue',issue.mobile_uuid)} onDelete={removePhoto} t={t} busy={busy}/>) }
          {legacyIssuePhotos.length>0&&<PhotoSection title={t('Unlinked Issue Photos')} photos={legacyIssuePhotos} canCapture={false} onCapture={()=>undefined} onDelete={removePhoto} t={t} busy={busy}/>}
        </View>

        {installation.field_events.length > 0 && <View style={styles.card}><Text style={styles.cardTitle}>{t('Field Evidence')}</Text><Text style={styles.muted}>{t('Location is only captured at start/completion. There is no continuous tracking.')}</Text>{installation.field_events.map((event) => <View key={event.mobile_uuid} style={styles.evidenceRow}><View style={{flex:1}}><Text style={styles.evidenceTitle}>{event.event_type === 'installation_started' ? t('Installation started') : t('Installation completed')}</Text><Text style={styles.muted}>{formatDateTime(event.captured_at)}</Text></View><View style={{alignItems:'flex-end'}}><Text style={styles.evidenceStatus}>{locationLabel(event.location_status)}</Text>{event.location_status === 'captured' && event.accuracy !== null ? <Text style={styles.muted}>±{Math.round(event.accuracy)} m</Text> : null}{event.sync_status && event.sync_status !== 'uploaded' ? <Text style={styles.pendingText}>{event.sync_status === 'failed' ? t('Sync failed') : t('Pending sync')}</Text> : null}</View></View>)}</View>}

        {installation.status === 'in_progress' && completionEvidence && <View style={styles.reviewCard}>
          <Text style={styles.reviewEyebrow}>{t('Completion Evidence')}</Text>
          <Text style={styles.reviewTitle}>{t('Customer Handover')}</Text>
          <Text style={styles.reviewLine}>{t('{count} work items',{count:installation.items.length})}</Text>
          <Text style={styles.reviewLine}>{t('{count} before photos',{count:before.length})}</Text>
          <Text style={styles.reviewLine}>{t('{count} after photos',{count:after.length})}</Text>
          <Text style={styles.reviewLine}>{t('{count} open issues',{count:openIssues.length})}</Text>{blockingIssues.length>0?<Text style={styles.blockingText}>⚠ {t('{count} blocking issues must be resolved',{count:blockingIssues.length})}</Text>:null}
          <Text style={styles.reviewLine}>{t('Location')}: {locationLabel(completionEvidence.locationStatus)}{completionEvidence.locationStatus === 'captured' && completionEvidence.accuracy !== null ? ` · ±${Math.round(completionEvidence.accuracy)} m` : ''}</Text>
          <Text style={styles.reviewHint}>{t('GPS is not mandatory. If location is unavailable, that status is still recorded as evidence.')}</Text>

          <Text style={styles.formLabel}>{t('Recipient name')}</Text>
          <TextInput value={receivedByName} onChangeText={setReceivedByName} editable={!busy} placeholder={t('Customer or representative name')} style={styles.input}/>
          <Text style={styles.formLabel}>{t('Handover notes')}</Text>
          <TextInput value={handoverNotes} onChangeText={setHandoverNotes} editable={!busy} placeholder={t('Optional notes about the completed work')} multiline style={[styles.input,styles.textarea]}/>

          <View style={styles.signatureModeRow}>
            <Pressable disabled={busy} onPress={() => setSignatureStatus('signed')} style={[styles.modeButton, signatureStatus === 'signed' && styles.modeButtonActive]}><Text style={[styles.modeText, signatureStatus === 'signed' && styles.modeTextActive]}>{t('Recipient signs')}</Text></Pressable>
            <Pressable disabled={busy} onPress={() => setSignatureStatus('unavailable')} style={[styles.modeButton, signatureStatus === 'unavailable' && styles.modeButtonActive]}><Text style={[styles.modeText, signatureStatus === 'unavailable' && styles.modeTextActive]}>{t('Signature unavailable')}</Text></Pressable>
          </View>

          {signatureStatus === 'signed' ? <>
            <Text style={styles.formLabel}>{t('Recipient signature')}</Text>
            <SignaturePad value={signatureStrokes} onChange={setSignatureStrokes} disabled={busy} clearLabel={t('Clear signature')} hint={t('Sign inside this box')}/>
          </> : <>
            <Text style={styles.formLabel}>{t('Reason signature is unavailable')}</Text>
            <TextInput value={signatureUnavailableReason} onChangeText={setSignatureUnavailableReason} editable={!busy} placeholder={t('Example: customer was not on site')} multiline style={[styles.input,styles.textarea]}/>
          </>}

          <Text style={styles.reviewHint}>{t('The signature and handover details are stored local-first and synced with the completion operation.')}</Text>
          <View style={styles.reviewActions}><FieldActionButton variant="secondary" disabled={busy} onPress={() => setCompletionEvidence(null)} label={t('Back')} /><FieldActionButton disabled={busy} onPress={confirmCompletion} label={busy ? t('Processing…') : t('Confirm Handover & Complete')} /></View>
        </View>}
        {installation.status === 'in_progress' && blockingIssues.length > 0 && !completionEvidence ? (
          <View style={styles.blockingBanner}>
            <Text style={styles.blockingBannerTitle}>{t('Work cannot be completed yet')}</Text>
            <Text style={styles.blockingBannerText}>{t('{count} blocking issues are still open. Ask the office to resolve them before completion.', { count: blockingIssues.length })}</Text>
          </View>
        ) : null}
        {installation.status === 'in_progress' && !completionEvidence && <FieldActionButton disabled={busy || blockingIssues.length > 0} onPress={prepareCompletion} label={busy ? t('Capturing evidence…') : t('Review & Complete')} />}
        {installation.status === 'completed' && <View style={styles.doneCard}><Text style={styles.doneTitle}>{t('Installation completed ✓')}</Text><Text style={styles.doneText}>{t('The installation completion evidence is stored local-first and synced to the server.')}</Text>{installation.handover?<View style={styles.handoverSummary}><Text style={styles.formLabel}>{t('Received by')}</Text><Text style={styles.value}>{installation.handover.received_by_name}</Text><Text style={styles.formLabel}>{t('Signature status')}</Text><Text style={styles.value}>{installation.handover.signature_status==='signed'?t('Signed'):t('Signature unavailable')}</Text>{installation.handover.notes?<><Text style={styles.formLabel}>{t('Handover notes')}</Text><Text style={styles.value}>{installation.handover.notes}</Text></>:null}</View>:null}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function issueCategoryLabel(value: MobileInstallationIssue['category']): string {
  const labels: Record<MobileInstallationIssue['category'], string> = {
    measurement: 'Measurement', material: 'Material', damage: 'Damage', site_condition: 'Site Condition',
    customer_request: 'Customer Request', installation: 'Installation', other: 'Other',
  };
  return labels[value];
}

function IssueCard({issue,photos,canCapture,onCapture,onDelete,t,busy}:{issue:MobileInstallationIssue;photos:MobileInstallationPhoto[];canCapture:boolean;onCapture:()=>void;onDelete:(photo:MobileInstallationPhoto)=>void;t:(key:string,vars?:Record<string,string|number>)=>string;busy:boolean}) {
  return <View style={[styles.issueCard, issue.blocks_completion&&issue.status==='open'&&styles.issueCardBlocking]}>
    <View style={styles.chipRow}>
      <View style={[styles.statusPill,issue.severity==='high'?styles.highPill:issue.severity==='medium'?styles.mediumPill:styles.lowPill]}><Text style={styles.statusPillText}>{t(issue.severity==='low'?'Low':issue.severity==='medium'?'Medium':'High')}</Text></View>
      <View style={styles.statusPill}><Text style={styles.statusPillText}>{t(issue.status==='resolved'?'Resolved':'Open')}</Text></View>
      {issue.blocks_completion&&issue.status==='open'?<View style={[styles.statusPill,styles.highPill]}><Text style={styles.statusPillText}>{t('Blocking')}</Text></View>:null}
    </View>
    <Text style={styles.itemTitle}>{issue.title}</Text>
    <Text style={styles.muted}>{t(issueCategoryLabel(issue.category))}</Text>
    {issue.description?<Text style={styles.value}>{issue.description}</Text>:null}
    <Text style={styles.muted}>{t('Customer informed')}: {issue.customer_informed_at?t('Yes'):t('No')}</Text>
    {issue.resolution_notes?<Text style={styles.resolutionText}>{t('Resolution')}: {issue.resolution_notes}</Text>:null}
    {issue.last_error?<Text style={styles.photoError}>{issue.last_error}</Text>:null}
    {photos.length>0?<PhotoSection title={t('Issue Photos')} photos={photos} canCapture={canCapture} onCapture={onCapture} onDelete={onDelete} t={t} busy={busy}/>:canCapture?<FieldActionButton compact fullWidth={false} variant="secondary" disabled={busy} onPress={onCapture} label={`📷 ${t('Add issue photo')}`} />:null}
  </View>;
}

function PhotoSection({title,photos,canCapture,onCapture,onDelete,t,busy}:{title:string;photos:MobileInstallationPhoto[];canCapture:boolean;onCapture:()=>void;onDelete:(photo:MobileInstallationPhoto)=>void;t:(key:string,vars?:Record<string,string|number>)=>string;busy:boolean}) {
  return (
    <View style={{gap:10}}>
      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.muted}>{photos.length} {photos.length===1?t('photo'):t('photos')}</Text></View>
        {canCapture ? <FieldActionButton compact fullWidth={false} variant="secondary" disabled={busy} onPress={onCapture} label={`📷 ${t('Add photo')}`} /> : null}
      </View>
      {photos.length===0 ? (
        <View style={styles.card}><Text style={styles.muted}>{t('No photos yet.')}</Text></View>
      ) : (
        <View style={styles.photoGrid}>
          {photos.map((photo)=>{
            const uri=photo.local_uri??resolveServerAssetUrl(photo.url);
            const status=photo.sync_status??'uploaded';
            return (
              <View key={photo.mobile_uuid??`photo-${photo.id}`} style={styles.photoCard}>
                {uri?<Image source={{uri}} style={styles.photoImage}/>:<View style={styles.photoPlaceholder}><Text>{t('Photo')}</Text></View>}
                <Text style={styles.photoStatus}>{status==='uploaded'?`✓ ${t('Synced')}`:status==='uploading'?t('Uploading…'):status==='failed'?t('Failed · retry on Sync'):t('Waiting for sync')}</Text>
                {photo.last_error?<Text style={styles.photoError}>{photo.last_error}</Text>:null}
                {photo.mobile_uuid&&status!=='uploaded' ? (
                  <View style={styles.photoAction}>
                    <FieldActionButton compact fullWidth={false} variant="danger" disabled={busy||status==='uploading'} onPress={()=>onDelete(photo)} label={t('Delete local')} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#f8fafc'},center:{flex:1,alignItems:'center',justifyContent:'center'},loadingWrap:{flex:1,padding:20,justifyContent:'center'},container:{padding:20,gap:14,paddingBottom:44},topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{color:'#0f766e',fontWeight:'800'},connection:{color:'#64748b',fontSize:11,fontWeight:'800'},eyebrow:{color:'#0f766e',fontWeight:'800',fontSize:12,letterSpacing:1.2},title:{color:'#0f172a',fontSize:29,fontWeight:'800',marginTop:3},customer:{color:'#475569',fontSize:17,marginTop:4},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:16,gap:5},cardTitle:{color:'#0f172a',fontSize:17,fontWeight:'800',marginBottom:4},label:{color:'#94a3b8',fontSize:12,fontWeight:'700',marginTop:5},value:{color:'#334155',lineHeight:21},sectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:4},sectionTitle:{color:'#0f172a',fontSize:19,fontWeight:'800'},muted:{color:'#64748b',lineHeight:20},itemCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:16,gap:6},itemTitle:{color:'#0f172a',fontSize:16,fontWeight:'800'},notes:{color:'#64748b',fontStyle:'italic'},photoGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},photoCard:{width:'48%',borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:'#e2e8f0',backgroundColor:'#fff'},photoImage:{width:'100%',height:130,backgroundColor:'#e2e8f0'},photoPlaceholder:{height:130,alignItems:'center',justifyContent:'center',backgroundColor:'#e2e8f0'},photoStatus:{paddingHorizontal:10,paddingTop:8,paddingBottom:4,fontSize:12,fontWeight:'800',color:'#475569'},photoError:{paddingHorizontal:10,paddingBottom:8,fontSize:11,color:'#b91c1c'},photoAction:{paddingHorizontal:10,paddingBottom:10,paddingTop:4},blockingBanner:{borderRadius:14,padding:14,backgroundColor:'#fef2f2',borderWidth:1,borderColor:'#fecaca',gap:4},blockingBannerTitle:{color:'#b91c1c',fontWeight:'800'},blockingBannerText:{color:'#b91c1c',fontSize:13,lineHeight:19},doneCard:{borderRadius:16,padding:16,backgroundColor:'#f0fdf4',borderWidth:1,borderColor:'#bbf7d0'},doneTitle:{color:'#166534',fontWeight:'800',fontSize:17},doneText:{color:'#166534',marginTop:4,lineHeight:20},evidenceRow:{flexDirection:'row',gap:12,alignItems:'center',paddingTop:12,marginTop:8,borderTopWidth:1,borderTopColor:'#f1f5f9'},evidenceTitle:{color:'#0f172a',fontWeight:'800'},evidenceStatus:{color:'#0f766e',fontSize:12,fontWeight:'800'},pendingText:{color:'#b45309',fontSize:11,fontWeight:'700',marginTop:2},reviewCard:{borderRadius:16,padding:16,backgroundColor:'#eff6ff',borderWidth:1,borderColor:'#bfdbfe',gap:7},reviewEyebrow:{color:'#1d4ed8',fontSize:11,fontWeight:'800',letterSpacing:1},reviewTitle:{color:'#172554',fontSize:18,fontWeight:'800'},reviewLine:{color:'#1e3a8a'},reviewHint:{color:'#64748b',fontSize:12,lineHeight:18,marginTop:3},reviewActions:{gap:8,marginTop:10},formLabel:{color:'#475569',fontSize:12,fontWeight:'800',marginTop:6},input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:11,backgroundColor:'#fff',paddingHorizontal:12,paddingVertical:11,color:'#0f172a'},textarea:{minHeight:76,textAlignVertical:'top'},signatureModeRow:{flexDirection:'row',gap:8,marginTop:5},modeButton:{flex:1,borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,minHeight:42,alignItems:'center',justifyContent:'center',paddingHorizontal:8},modeButtonActive:{borderColor:'#0f766e',backgroundColor:'#f0fdfa'},modeText:{color:'#64748b',fontSize:12,fontWeight:'800',textAlign:'center'},modeTextActive:{color:'#0f766e'},handoverSummary:{marginTop:12,borderTopWidth:1,borderTopColor:'#bbf7d0',paddingTop:10,gap:2},errorCard:{backgroundColor:'#fef2f2',borderColor:'#fecaca',borderWidth:1,borderRadius:12,padding:12},errorText:{color:'#b91c1c',lineHeight:20},issueForm:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dbeafe',borderRadius:16,padding:16,gap:8},chipRow:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:999,paddingHorizontal:10,paddingVertical:7},chipActive:{borderColor:'#0f766e',backgroundColor:'#f0fdfa'},chipText:{color:'#64748b',fontSize:12,fontWeight:'700'},chipTextActive:{color:'#0f766e'},blockingChip:{borderColor:'#ef4444',backgroundColor:'#fef2f2'},blockingChipText:{color:'#b91c1c'},checkRow:{flexDirection:'row',alignItems:'center',gap:9,marginTop:4},checkBox:{width:22,height:22,borderWidth:1,borderColor:'#cbd5e1',borderRadius:6,alignItems:'center',justifyContent:'center'},checkBoxActive:{backgroundColor:'#0f766e',borderColor:'#0f766e'},checkMark:{color:'#fff',fontWeight:'900'},issueCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:16,gap:10},issueCardBlocking:{borderColor:'#fecaca',backgroundColor:'#fffafa'},statusPill:{alignSelf:'flex-start',backgroundColor:'#f1f5f9',borderRadius:999,paddingHorizontal:9,paddingVertical:4},lowPill:{backgroundColor:'#f1f5f9'},mediumPill:{backgroundColor:'#fffbeb'},highPill:{backgroundColor:'#fef2f2'},statusPillText:{color:'#475569',fontSize:10,fontWeight:'800'},resolutionText:{color:'#166534',backgroundColor:'#f0fdf4',padding:8,borderRadius:8,marginTop:4},blockingText:{color:'#b91c1c',fontWeight:'800'}});

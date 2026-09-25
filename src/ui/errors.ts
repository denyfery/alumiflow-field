type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function friendlyFieldError(error: string | null | undefined, t: Translator): string | null {
  if (!error) return null;
  const value = error.toLowerCase();

  if (value.includes('409') || value.includes('conflict') || value.includes('version conflict')) {
    return t('This work was updated from another device. Sync the latest data before continuing.');
  }
  if (value.includes('network') || value.includes('failed to fetch') || value.includes('connection refused')) {
    return t('Connection is unavailable. Your changes remain safe on this device and will sync later.');
  }
  if (value.includes('401') || value.includes('unauthenticated') || value.includes('invalid token')) {
    return t('This device session is no longer active. Sign in again to continue.');
  }
  if (value.includes('402') || value.includes('subscription inactive') || value.includes('module disabled')) {
    return t('AlumiFlow Field access is currently inactive. Contact your company administrator.');
  }
  if (value.includes('403') || value.includes('forbidden')) {
    return t('You no longer have access to this work. Sync the latest assignments.');
  }
  if (value.includes('another cached user has unsynced')) {
    return t('Another user has unsynced field changes on this device. Sign in as that user and sync before continuing.');
  }
  if (
    /sqlstate|sqlite|unique constraint|native(statement)?|finalizeasync|exception|stack trace|http \d{3}|internal server error/i.test(error)
  ) {
    return t('Something went wrong. Your local data is still safe. Try again or sync the latest data.');
  }

  // Local validation/business messages are already written for the field user.
  return error;
}

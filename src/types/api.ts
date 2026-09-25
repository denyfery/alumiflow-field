export type ApiMeta = {
  request_id?: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'surveyor' | 'installer';
  locale: string | null;
};

export type CompanyAppearance = {
  source: 'system' | 'company';
  primary_color: string;
  accent_color: string;
  navbar_color: string;
};

export type CompanyProfile = {
  id: number;
  name: string;
  display_name: string;
  timezone: string | null;
  mobile_field_enabled: boolean;
  appearance?: CompanyAppearance | null;
};

export type DeviceProfile = {
  device_uuid: string;
  device_name: string;
  platform: 'android' | 'ios';
  app_version: string | null;
  last_seen_at: string | null;
  push_enabled?: boolean;
};

export type MobileProfile = {
  user: UserProfile;
  company: CompanyProfile;
  permissions: string[];
  workspaces: Array<'surveys' | 'installations'>;
  device: DeviceProfile | null;
};

export type LoginResponse = MobileProfile & {
  token: string;
  token_type: 'Bearer';
  expires_at: string;
};

export type SyncBootstrapResponse = {
  protocol_version: number;
  server_time: string;
  profile: Omit<MobileProfile, 'device'>;
  capabilities: {
    offline_queue: boolean;
    idempotency: boolean;
    optimistic_versioning: boolean;
    mobile_uuid: boolean;
    survey_sync: boolean;
    installation_sync: boolean;
    push_notifications?: boolean;
  };
};

export type SyncCheckpointResponse = {
  accepted: boolean;
  client_id: string;
  server_time: string;
  next_action: string;
};

export type MeasurementField = {
  key: string;
  label: string;
  type: 'number' | 'text';
  unit: string | null;
  required: boolean;
  role: 'width' | 'height' | 'length' | 'manual' | 'none' | null;
};

export type MobileProduct = {
  id: number;
  code: string | null;
  name: string;
  category: string | null;
  billing_unit: string;
  calculation_type: 'area' | 'length' | 'unit' | 'manual';
  measurement_schema: MeasurementField[];
  updated_at: string | null;
};

export type MobileSurveyCustomer = {
  id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  maps_url: string | null;
};

export type MobileSurveyItem = {
  id: number | null;
  mobile_uuid: string | null;
  product_id: number;
  product_name: string;
  group_code: string | null;
  group_title: string | null;
  measurements: Record<string, string | number>;
  quantity: number;
  notes: string | null;
  sort_order: number;
  billing_unit: string | null;
  volume: number | null;
};


export type MobileSurveyPhoto = {
  id: number | null;
  mobile_uuid: string | null;
  category: string;
  original_name: string | null;
  caption: string | null;
  url: string | null;
  created_at: string | null;
  local_uri?: string | null;
  sync_status?: 'queued' | 'uploading' | 'uploaded' | 'failed';
  last_error?: string | null;
};


export type MobileFieldEvent = {
  id: number | null;
  mobile_uuid: string;
  event_type: 'survey_started' | 'survey_completed' | string;
  location_status: 'captured' | 'permission_denied' | 'unavailable' | 'timeout' | string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  captured_at: string;
  received_at: string | null;
  metadata: Record<string, unknown>;
  user?: { id: number; name: string } | null;
  sync_status?: 'queued' | 'uploaded' | 'failed';
  last_error?: string | null;
};

export type MobileSurvey = {
  id: number;
  public_id: string;
  survey_number: string;
  survey_date: string;
  scheduled_time: string | null;
  address: string | null;
  notes: string | null;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | string;
  version: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  customer: MobileSurveyCustomer | null;
  items: MobileSurveyItem[];
  photos: MobileSurveyPhoto[];
  field_events: MobileFieldEvent[];
};

export type SurveySnapshotResponse = {
  server_time: string;
  surveys: MobileSurvey[];
};

export type ProductSnapshotResponse = {
  server_time: string;
  products: MobileProduct[];
};

export type MobileInstallationCustomer = MobileSurveyCustomer;

export type MobileInstallationItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  description: string | null;
  group_code: string | null;
  group_title: string | null;
  measurements: Record<string, string | number>;
  volume: number | null;
  billing_unit: string | null;
  width_mm: number | null;
  height_mm: number | null;
  quantity: number;
  notes: string | null;
  sort_order: number;
};

export type MobileInstallationWorker = {
  id: number;
  name: string;
  phone: string | null;
  role: string;
};

export type MobileInstallationPhoto = {
  id: number | null;
  mobile_uuid: string | null;
  type: 'before' | 'after' | 'issue';
  original_name: string | null;
  caption: string | null;
  url: string | null;
  created_at: string | null;
  local_uri?: string | null;
  sync_status?: 'queued' | 'uploading' | 'uploaded' | 'failed';
  last_error?: string | null;
  mime?: string | null;
  issue_id?: number | null;
  issue_mobile_uuid?: string | null;
};

export type MobileInstallationIssue = {
  id: number | null;
  public_id: string | null;
  mobile_uuid: string;
  category: 'measurement' | 'material' | 'damage' | 'site_condition' | 'customer_request' | 'installation' | 'other';
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high';
  can_work_continue: boolean;
  blocks_completion: boolean;
  status: 'open' | 'resolved';
  customer_informed_at: string | null;
  reported_at: string;
  received_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  reported_by: { id: number; name: string } | null;
  resolved_by: { id: number; name: string } | null;
  sync_status?: 'queued' | 'uploaded' | 'failed';
  last_error?: string | null;
};

export type SignaturePoint = { x: number; y: number };
export type SignatureStroke = SignaturePoint[];

export type MobileInstallationHandover = {
  id: number | null;
  mobile_uuid: string;
  received_by_name: string;
  notes: string | null;
  signature_status: 'signed' | 'unavailable';
  signature_strokes: SignatureStroke[];
  signature_unavailable_reason: string | null;
  signature_sha256: string | null;
  signed_at: string;
  completed_by_name: string | null;
  received_at: string | null;
};

export type MobileInstallationFieldEvent = {
  id: number | null;
  mobile_uuid: string;
  event_type: 'installation_started' | 'installation_completed' | string;
  location_status: 'captured' | 'permission_denied' | 'unavailable' | 'timeout' | string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  captured_at: string;
  received_at: string | null;
  metadata: Record<string, unknown>;
  user?: { id: number; name: string } | null;
  sync_status?: 'queued' | 'uploaded' | 'failed';
  last_error?: string | null;
};

export type MobileInstallation = {
  id: number;
  public_id: string;
  job_id: number;
  job_public_id?: string | null;
  job_number: string | null;
  job_title: string | null;
  scheduled_date: string;
  estimated_end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | string;
  version: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  customer: MobileInstallationCustomer | null;
  items: MobileInstallationItem[];
  workers: MobileInstallationWorker[];
  photos: MobileInstallationPhoto[];
  issues: MobileInstallationIssue[];
  field_events: MobileInstallationFieldEvent[];
  handover: MobileInstallationHandover | null;
};

export type InstallationSnapshotResponse = {
  server_time: string;
  installations: MobileInstallation[];
};

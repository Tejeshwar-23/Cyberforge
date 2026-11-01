export type UserRole = 'viewer' | 'operator' | 'admin'

export interface CurrentUser {
  id: number
  username: string
  role: UserRole
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in_minutes: number
}

// ==========================================
// Overview API
// ==========================================

export interface OverviewRun {
  run_id: number
  connector: string
  status: string
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  http_status: number | null
  records_received: number
  records_normalized: number
  records_quarantined: number
  page_count: number
  error_type: string | null
}

export interface OverviewResponse {
  generated_at: string

  catalog: {
    sources: number
    connector_templates: number
  }

  configured_connectors: {
    total_files: number
    valid: number
    invalid: number
    enabled: number
    disabled: number
    entity_counts: Record<string, number>
  }

  data: {
    users: number
    devices: number
    events: number
    normalized_total: number
    quarantine: number
  }

  runs: {
    total: number
    healthy: number
    failed: number
    connectors_with_history: number
    latest_health: {
      healthy: number
      failed: number
      other: number
    }
    recent: OverviewRun[]
  }

  self_heal: {
    audit_events: number
    applied: number
    verified: number
    rolled_back: number
    not_applied: number
    latest_event_at: string | null
  }

  intelligence: {
    operational_risk: {
      available: boolean
      endpoint: string
    }

    ml_anomaly: {
      strategy: string
      minimum_samples_per_regime: number
      idle_incremental: {
        available: boolean
        healthy_samples: number
      }
      data_sync: {
        available: boolean
        healthy_samples: number
      }
      fully_available: boolean
      endpoint: string
    }
  }

  links: {
    catalog: string
    health: string
    runs: string
    quarantine: string
    self_heal: string
    risk: string
  }
}

// ==========================================
// Catalog & Connectors API
// ==========================================

export interface ConnectorSummary {
  connector: string
  entity: 'user' | 'device' | 'event'
  description?: string | null
  auth_type: string
  response_format: 'json' | 'xml' | 'yaml'
  pagination_type: string
  schedule_every_minutes: number
  incremental_enabled: boolean
  enabled: boolean
}

export interface CatalogSource {
  source_id: string
  display_name: string
  vendor_style: boolean
  available: boolean
  connector_count: number
  enabled_connector_count: number
  entities: ('user' | 'device' | 'event')[]
  auth_types: string[]
  response_formats: string[]
  pagination_types: string[]
  connectors: ConnectorSummary[]
}

export interface ConfigValidationResult {
  valid: boolean
  saved: boolean
  activated: boolean
  filename: string
  source_id: string
  display_name: string
  connector: string
  description?: string | null
  entity: 'user' | 'device' | 'event'
  enabled: boolean
  auth_type: string
  required_secret_refs: string[]
  endpoint: {
    method: 'GET' | 'POST'
    path: string
  }
  response: {
    format: string
    records_path?: string | null
  }
  pagination: {
    type: string
    page_size?: number | null
    page_param?: string | null
    offset_param?: string | null
    limit_param?: string | null
    has_more_path?: string | null
  }
  schedule: {
    every_minutes: number
  }
  incremental: {
    enabled: boolean
    type: string
    request_param?: string | null
    source_field?: string | null
  }
  mapping: {
    entity: string
    field_count: number
    fields: Record<string, string>
  }
}

export interface InstalledConnectorMetadata {
  connector: string
  entity: 'user' | 'device' | 'event'
  enabled: boolean
  auth_type: string
  response_format: string
  pagination_type: string
  schedule_every_minutes: number
  incremental_enabled: boolean
  config_file: string
}

export interface SaveConfigResponse {
  saved: boolean
  connector: string
  enabled: boolean
  entity: string
  config_file: string
  backup_created: boolean
  message: string
}

export interface ConnectorActivationResponse {
  connector: string
  enabled: boolean
  backup_created: boolean
  manual_run_available: boolean
  scheduler_dynamic_reload: boolean
  scheduler_note: string
}

export interface ConnectorRunResult {
  run_id: number
  connector: string
  status: string
  entity: string
  http_status: number | null
  pagination_type: string | null
  page_count: number
  records_received: number
  records_normalized: number
  records_quarantined: number
  incremental_enabled: boolean
  checkpoint_before: string | null
  checkpoint_after: string | null
  self_heal?: {
    attempted: boolean
    applied: boolean
    target_field?: string
    old_source_path?: string
    new_source_path?: string
    confidence?: number
    risk_level?: string | null
  }
}

export interface TestConnectionResult {
  success: boolean
  connector: string
  http_status: number | null
  response_format?: string
  pagination_type?: string
  sample_records_detected?: number
  sample_records_normalized?: number
  sample_records_quarantined?: number
  message: string
}

export interface ConnectorHealthItem {
  connector: string
  status: string
  last_run: string | null
  completed_at: string | null
  records_pulled: number
  records_normalized: number
  records_quarantined: number
  http_status: number | null
  pagination_type: string | null
  page_count: number
  error_type: string | null
  last_error: string | null
}

// ==========================================
// Run History & Timeline API
// ==========================================

export interface ConnectorRunItem {
  run_id: number
  connector: string
  status: string
  started_at: string | null
  completed_at: string | null
  records_received: number
  records_normalized: number
  records_quarantined: number
  http_status: number | null
  pagination_type: string | null
  page_count: number
  error_type: string | null
  last_error: string | null
}

export interface ConnectorRunEventItem {
  event_id: number
  stage: string
  status: string
  message: string | null
  details: Record<string, unknown> | null
  occurred_at: string
}

export interface ConnectorRunTimelineResponse {
  run: ConnectorRunItem
  events: ConnectorRunEventItem[]
  event_count: number
}

// ==========================================
// Normalized Data API
// ==========================================

export interface NormalizedUserRecord {
  id: string
  name: string
  email: string
  status: string
  source: string
  last_login: string
}

export interface NormalizedDeviceRecord {
  id: string
  hostname: string
  ip: string
  os: string
  owner: string
  source: string
  last_seen: string
}

export interface NormalizedEventRecord {
  id: string
  type: string
  severity: string
  timestamp: string
  description: string
  source: string
}

export interface PaginatedDataResponse<T> {
  items: T[]
  pagination: {
    total: number
    offset: number
    limit: number
    returned: number
  }
  filters: {
    source: string | null
    q: string | null
  }
}

export interface SourceCountItem {
  source: string
  count: number
}

export interface DataSummaryResponse {
  counts: {
    users: number
    devices: number
    events: number
    total: number
  }
  source_breakdown: {
    users: SourceCountItem[]
    devices: SourceCountItem[]
    events: SourceCountItem[]
  }
  common_schema: {
    user: string[]
    device: string[]
    event: string[]
  }
}

// ==========================================
// Reliability & Quarantine API
// ==========================================

export interface QuarantinedRecordItem {
  id: number
  connector: string
  record_index: number
  error: string
  raw_record_preview: string
  quarantined_at: string
}

export interface QuarantineResponse {
  items: QuarantinedRecordItem[]
  pagination: {
    total: number
    offset: number
    limit: number
    returned: number
  }
  filters: {
    connector: string | null
  }
}

export interface QuarantineSummaryResponse {
  total: number
  connectors: {
    connector: string
    count: number
  }[]
}

export interface ReliabilityFixture {
  source_id: string
  fixture: string
  format: string
}

export interface ReliabilityFixturesResponse {
  fixture_count: number
  fixtures: ReliabilityFixture[]
}

export interface BadRecordTestResponse {
  success: boolean
  lab_mode: boolean
  connector: string
  entity: string
  fixture: string
  fixture_format: string
  records_received: number
  records_normalized: number
  records_quarantined: number
  connector_crashed: boolean
  valid_records_persisted: boolean
  quarantine_records_persisted: number
  issues: {
    record_index: number
    error: string
  }[]
}

// ==========================================
// Self-Healing & Drift API
// ==========================================

export interface SchemaDriftScenario {
  scenario_id: string
  source_id: string
  vendor: string
  entity: string
  connector: string
  drift_type: string
  old_path: string
  new_path: string
  expected_risk: string
  live_demo_available: boolean
}

export interface SchemaDriftScenariosResponse {
  scenario_count: number
  live_demo_count: number
  scenarios: SchemaDriftScenario[]
}

export interface SchemaDriftTestResult {
  success: boolean
  lab_mode: boolean
  scenario_id: string
  vendor: string
  entity: string
  drift_type: string
  expected_risk: string
  demo_connector: string
  drift: {
    old_path: string
    new_path: string
  }
  records_received: number
  records_normalized: number
  records_quarantined: number
  self_heal: {
    attempted: boolean
    applied: boolean
    target_field?: string
    old_source_path?: string
    new_source_path?: string
    confidence?: number
    risk_level?: string | null
  }
  final_mapping: {
    timestamp?: string
    incremental_source_field?: string
  }
  full_rerun_verified: boolean
  persisted_to_normalized_tables: boolean
  quarantine_rows_persisted: boolean
  temporary_config_removed: boolean
  timeline: {
    stage: string
    status: string
    message: string
  }[]
}

export interface SelfHealSummaryResponse {
  audit_events: number
  applied: number
  verified: number
  rolled_back: number
  not_applied: number
  latest_event_at: string | null
}

export interface SelfHealAuditItem {
  audit_id: number
  connector: string | null
  outcome: string
  old_source_path: string | null
  new_source_path: string | null
  risk_level: string | null
  message: string
  occurred_at: string
}

export interface SelfHealHistoryResponse {
  items: SelfHealAuditItem[]
  returned: number
  outcome_filter: string | null
}

// ==========================================
// Risk & Machine Learning API
// ==========================================

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type MLClassification = 'NORMAL' | 'ELEVATED' | 'ANOMALOUS'

export interface OperationalRiskSignal {
  signal: string
  weight: number
  message: string
  value?: number | string
}

export interface OperationalRisk {
  score: number
  level: RiskLevel
  signals: OperationalRiskSignal[]
  explainable: boolean
}

export interface MLAnomalyResult {
  available: boolean
  status: string
  model?: string
  regime: string
  training_scope?: string
  training_samples: number
  minimum_required?: number
  score: number | null
  classification: MLClassification | null
  model_flagged_anomaly?: boolean
  observations?: string[]
  interpretation?: string
  reason?: string
}

export interface CombinedRunAnalysis {
  run: {
    run_id: number
    connector: string
    status: string
    behavior_regime: string
    started_at: string | null
    completed_at: string | null
    duration_seconds: number | null
    http_status: number | null
    pagination_type: string | null
    page_count: number
    records_received: number
    records_normalized: number
    records_quarantined: number
    error_type: string | null
  }
  operational_risk: OperationalRisk
  ml_anomaly: MLAnomalyResult
  connector_history_count?: number
}

export interface RiskSummaryResponse {
  total_runs: number
  healthy_runs: number
  failed_runs: number
  connectors: number
  risk_distribution: Record<string, number>
  ml_strategy: string
  ml_methodology: string
  ml_models: Record<string, unknown>
  top_risk_connectors: {
    connector: string
    latest_run_id: number
    behavior_regime: string
    operational_risk: OperationalRisk
    ml_anomaly: MLAnomalyResult
  }[]
}

export interface ConnectorRiskResponse {
  items: CombinedRunAnalysis[]
  returned: number
}

// ==========================================
// Secrets API
// ==========================================

export interface SecretMetadataItem {
  name: string
  version: number
  algorithm: string
  fingerprint: string
  created_at: string
  rotated_at: string | null
}

export interface SecretStatusItem {
  name: string
  configured: boolean
  vault_stored: boolean
  version: number | null
  algorithm: string | null
  fingerprint: string | null
  created_at: string | null
  rotated_at: string | null
}

export interface SecretStatusResponse {
  all_configured: boolean
  required_count: number
  configured_count: number
  missing_count: number
  secrets: SecretStatusItem[]
}

export interface SecretWriteResponse {
  name: string
  version: number
  algorithm: string
  fingerprint: string
  created_at: string
  rotated_at: string | null
  message: string
}


// ==========================================
// Sarvam Connector Copilot
// ==========================================

export interface CopilotGenerateRequest {
  source_name: string
  entity: 'user' | 'device' | 'event'
  api_details: string
  sample_payload?: string | null
  secret_ref_hint?: string | null
}

export interface CopilotGenerateResponse {
  success: boolean
  provider: string
  model: string

  validation: {
    passed: boolean
    schema: string
  }

  safety: {
    persisted: boolean
    activated: boolean
    enabled: boolean
    secret_values_returned: boolean
  }

  connector: Record<string, unknown>

  yaml_preview: string

  usage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

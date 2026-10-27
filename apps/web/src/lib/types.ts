export type Role = 'provider_admin' | 'vendor_dev' | 'demo_admin'

export type User = {
  id: string
  email: string
  name: string
  role: Role
  organization_ids: string[]
  vendor_name: string | null
}

export type Organization = {
  id: string
  slug: string
  name: string
  system_type: string
  fhir_version: string
  simulated: boolean
  resource_types: string[]
  sandbox_available: boolean
  connection?: Connection
}

export type Connection = {
  id: string
  organization_id: string
  status: 'configured' | 'healthy' | 'degraded' | 'down' | 'unknown'
  last_health_check: string | null
  last_latency_ms: number | null
  fault_mode: 'none' | 'timeout' | 'error' | 'malformed'
  success_count: number
  failure_count: number
  last_error: string | null
  capabilities: { fhir_version: string; software: string; resource_types: string[]; checked_at: string; latency_ms: number } | null
}

export type Application = {
  id: string
  name: string
  description: string
  use_case: string
  requested_resource_types: string[]
  purpose: string
  callback_url: string | null
  status: 'active' | 'suspended'
  client_id: string
  vendor_name: string
  simulated: boolean
  created_at: string
}

export type AccessRequestStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revoked'
export type AccessRequest = {
  id: string
  application_id: string
  application_name: string
  vendor_name: string
  organization_id: string
  organization_name: string
  resource_types: string[]
  purpose: string
  status: AccessRequestStatus
  decision_reason: string | null
  created_at: string
  updated_at: string
}

export type PolicyRule = {
  effect: 'deny' | 'allow'
  resource_types?: string[]
  purposes?: string[]
  application_ids?: string[]
  require_active_consent?: boolean
}
export type Policy = {
  id: string
  organization_id: string
  name: string
  description: string
  enabled: boolean
  version: number
  rule: PolicyRule
  updated_at: string
}

export type Decision = {
  organization_id: string
  organization_name: string
  outcome: 'allow' | 'deny' | 'error'
  allowed_resource_types: string[]
  denied_resource_types: string[]
  reasons: string[]
  policy_results: { policy: string; version: number; matched: boolean; effect: string }[]
  audit_event_id: string
}

export type TimelineItem = {
  date: string | null
  resource_type: string
  title: string
  detail: string | null
  source_organization_id: string
  source_organization_name: string
  source_resource_id: string
  valid: boolean
}

export type DataRequestResult = {
  request_id: string
  outcome: 'allow' | 'partial' | 'deny' | 'error'
  decisions: Decision[]
  timeline: TimelineItem[]
  validation: { organization_id: string; resource_type: string; valid: number; invalid: number; errors: string[] }[]
  errors: { organization_id: string; code: string; message: string }[]
  duration_ms: number
}

export type AnchorStatus = 'not_anchored' | 'pending' | 'anchored' | 'failed'
export type AuditEvent = {
  id: string
  request_id: string
  action: string
  outcome: string
  organization_id: string | null
  organization_name: string | null
  application_id: string | null
  application_name: string | null
  actor: string | null
  resource_types: string[]
  purpose: string | null
  reason: string | null
  details: Record<string, unknown>
  created_at: string
  fingerprint: string
  anchor_status: AnchorStatus
  anchor_tx_hash: string | null
  anchor_block: number | null
  anchor_error: string | null
  verification: 'verified' | 'mismatch' | 'not_anchored' | 'unverified' | 'error' | null
  verified_at: string | null
}

export type Verification = {
  audit_event_id: string
  status: 'verified' | 'mismatch' | 'not_anchored' | 'error'
  stored_fingerprint: string
  recomputed_fingerprint: string
  on_chain: boolean
  tx_hash: string | null
  block_number: number | null
  chain_id: number | null
  contract_address: string | null
  message: string
}

export type PatientRecord = {
  organization_id: string
  organization_name: string
  patient_id: string
  mrn: string | null
  name: string
  birth_date: string | null
  gender: string | null
  city: string | null
  phone: string | null
}

export type MatchCandidate = {
  a: PatientRecord
  b: PatientRecord
  score: number
  confidence: 'high' | 'medium' | 'low'
  explanation: { field: string; result: 'match' | 'partial' | 'mismatch' | 'missing'; weight: number; note: string }[]
  link_id: string | null
  link_status: 'confirmed' | 'rejected' | null
}

export type PatientLink = {
  id: string
  label: string
  members: { organization_id: string; organization_name: string; patient_id: string; mrn: string | null }[]
  status: 'confirmed' | 'rejected'
  score: number
  consent_status: 'active' | 'withdrawn'
  reviewed_by: string | null
  created_at: string
}

export type Metrics = {
  window_hours: number
  per_organization: {
    organization_id: string
    organization_name: string
    requests: number
    failures: number
    retries: number
    avg_latency_ms: number | null
    p95_latency_ms: number | null
    success_rate: number | null
  }[]
  series: { bucket: string; organization_id: string; requests: number; failures: number; avg_latency_ms: number | null }[]
}

export type IntegrationJob = {
  id: string
  request_id: string
  organization_id: string
  organization_name: string
  operation: string
  status: 'success' | 'failure'
  attempts: number
  latency_ms: number | null
  error_code: string | null
  error_message: string | null
  created_at: string
}

import axios from 'axios'
import type {
  BadRecordTestResponse,
  CatalogSource,
  ConfigValidationResult,
  CopilotGenerateRequest,
  CopilotGenerateResponse,
  ConnectorActivationResponse,
  ConnectorHealthItem,
  ConnectorRiskResponse,
  ConnectorRunItem,
  ConnectorRunResult,
  ConnectorRunTimelineResponse,
  CurrentUser,
  DataSummaryResponse,
  InstalledConnectorMetadata,
  LoginResponse,
  NormalizedDeviceRecord,
  NormalizedEventRecord,
  NormalizedUserRecord,
  OverviewResponse,
  PaginatedDataResponse,
  QuarantineResponse,
  QuarantineSummaryResponse,
  ReliabilityFixturesResponse,
  RiskSummaryResponse,
  SaveConfigResponse,
  SchemaDriftScenariosResponse,
  SchemaDriftTestResult,
  SecretMetadataItem,
  SecretStatusResponse,
  SecretWriteResponse,
  SelfHealAuditItem,
  SelfHealHistoryResponse,
  SelfHealSummaryResponse,
  TestConnectionResult,
} from '../types/api'

export const TOKEN_KEY = 'cyberforge_access_token'

const baseURL =
  import.meta.env.VITE_API_BASE_URL
  ?? 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

export function readableApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === 'string') {
      return detail
    }

    if (detail && typeof detail === 'object') {
      if ('message' in detail && typeof detail.message === 'string') {
        return detail.message
      }
      if ('errors' in detail && Array.isArray(detail.errors) && detail.errors.length > 0) {
        return detail.errors.map((e: { message?: string }) => e.message || 'Validation error').join('; ')
      }
    }

    if (error.response?.status === 401) {
      return 'Authentication required or invalid credentials.'
    }

    if (error.response?.status === 403) {
      return 'Insufficient permissions for this action.'
    }

    if (error.response?.status === 404) {
      return 'The requested resource was not found.'
    }

    if (error.response?.status === 429) {
      return 'Too many requests. Please wait before trying again.'
    }

    return error.message || 'The CyberForge API request failed.'
  }

  return 'Unexpected application error.'
}

// ====================================================
// Typed CyberForge API Services
// ====================================================

export const CyberForgeApi = {
  // Auth
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>('/api/auth/login', { username, password })
    return res.data
  },
  getMe: async (): Promise<CurrentUser> => {
    const res = await api.get<CurrentUser>('/api/auth/me')
    return res.data
  },

  // Overview
  getOverview: async (): Promise<OverviewResponse> => {
    const res = await api.get<OverviewResponse>('/api/overview')
    return res.data
  },

  // Catalog
  getSources: async (): Promise<CatalogSource[]> => {
    const res = await api.get<CatalogSource[]>('/api/catalog/sources')
    return res.data
  },
  getSource: async (sourceId: string): Promise<CatalogSource> => {
    const res = await api.get<CatalogSource>(`/api/catalog/sources/${encodeURIComponent(sourceId)}`)
    return res.data
  },
  validateUploadedConfig: async (sourceId: string, file: File): Promise<ConfigValidationResult> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ConfigValidationResult>(
      `/api/catalog/sources/${encodeURIComponent(sourceId)}/validate-config`,
      formData,
    )
    return res.data
  },

  // Sarvam Connector Copilot
  generateConnectorConfig: async (
    payload: CopilotGenerateRequest,
  ): Promise<CopilotGenerateResponse> => {
    const res = await api.post<CopilotGenerateResponse>(
      '/api/copilot/generate-config',
      payload,
      {
        // Sarvam generation may legitimately take longer
        // than the normal CyberForge API timeout.
        timeout: 60000,
      },
    )
    return res.data
  },

  // Connectors
  getInstalledConfigs: async (): Promise<InstalledConnectorMetadata[]> => {
    const res = await api.get<InstalledConnectorMetadata[]>('/api/connectors/configs')
    return res.data
  },
  getHealth: async (): Promise<ConnectorHealthItem[]> => {
    const res = await api.get<ConnectorHealthItem[]>('/api/connectors/health')
    return res.data
  },
  getRuns: async (limit = 50): Promise<ConnectorRunItem[]> => {
    const res = await api.get<ConnectorRunItem[]>('/api/connectors/runs', { params: { limit } })
    return res.data
  },
  getRunDetail: async (runId: number): Promise<ConnectorRunItem> => {
    const res = await api.get<ConnectorRunItem>(`/api/connectors/runs/${runId}`)
    return res.data
  },
  getRunTimeline: async (runId: number): Promise<ConnectorRunTimelineResponse> => {
    const res = await api.get<ConnectorRunTimelineResponse>(`/api/connectors/runs/${runId}/timeline`)
    return res.data
  },
  saveConfig: async (connectorName: string, file: File): Promise<SaveConfigResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<SaveConfigResponse>(
      `/api/connectors/${encodeURIComponent(connectorName)}/config`,
      formData,
    )
    return res.data
  },
  setActivation: async (connectorName: string, enabled: boolean): Promise<ConnectorActivationResponse> => {
    const res = await api.patch<ConnectorActivationResponse>(
      `/api/connectors/${encodeURIComponent(connectorName)}/activation`,
      { enabled },
    )
    return res.data
  },
  runNow: async (connectorName: string): Promise<ConnectorRunResult> => {
    const res = await api.post<ConnectorRunResult>(
      `/api/connectors/${encodeURIComponent(connectorName)}/run`,
    )
    return res.data
  },
  testConnection: async (connectorName: string): Promise<TestConnectionResult> => {
    const res = await api.post<TestConnectionResult>(
      `/api/connectors/${encodeURIComponent(connectorName)}/test`,
    )
    return res.data
  },

  // Normalized Data
  getDataSummary: async (): Promise<DataSummaryResponse> => {
    const res = await api.get<DataSummaryResponse>('/api/data/summary')
    return res.data
  },
  getUsers: async (params?: { source?: string; q?: string; offset?: number; limit?: number }): Promise<PaginatedDataResponse<NormalizedUserRecord>> => {
    const res = await api.get<PaginatedDataResponse<NormalizedUserRecord>>('/api/data/users', { params })
    return res.data
  },
  getDevices: async (params?: { source?: string; q?: string; offset?: number; limit?: number }): Promise<PaginatedDataResponse<NormalizedDeviceRecord>> => {
    const res = await api.get<PaginatedDataResponse<NormalizedDeviceRecord>>('/api/data/devices', { params })
    return res.data
  },
  getEvents: async (params?: { source?: string; q?: string; offset?: number; limit?: number }): Promise<PaginatedDataResponse<NormalizedEventRecord>> => {
    const res = await api.get<PaginatedDataResponse<NormalizedEventRecord>>('/api/data/events', { params })
    return res.data
  },

  // Quarantine & Reliability
  getQuarantine: async (params?: { connector?: string; offset?: number; limit?: number }): Promise<QuarantineResponse> => {
    const res = await api.get<QuarantineResponse>('/api/quarantine', { params })
    return res.data
  },
  getQuarantineSummary: async (): Promise<QuarantineSummaryResponse> => {
    const res = await api.get<QuarantineSummaryResponse>('/api/quarantine/summary')
    return res.data
  },
  getFixtures: async (): Promise<ReliabilityFixturesResponse> => {
    const res = await api.get<ReliabilityFixturesResponse>('/api/reliability/fixtures')
    return res.data
  },
  badRecordTest: async (connectorName: string): Promise<BadRecordTestResponse> => {
    const res = await api.post<BadRecordTestResponse>(
      `/api/reliability/bad-record-test/${encodeURIComponent(connectorName)}`,
    )
    return res.data
  },

  // Self-Healing
  getSelfHealSummary: async (): Promise<SelfHealSummaryResponse> => {
    const res = await api.get<SelfHealSummaryResponse>('/api/self-heal/summary')
    return res.data
  },
  getSelfHealHistory: async (params?: { outcome?: string; limit?: number }): Promise<SelfHealHistoryResponse> => {
    const res = await api.get<SelfHealHistoryResponse>('/api/self-heal/history', { params })
    return res.data
  },
  getSelfHealHistoryDetail: async (auditId: number): Promise<SelfHealAuditItem> => {
    const res = await api.get<SelfHealAuditItem>(`/api/self-heal/history/${auditId}`)
    return res.data
  },
  getSchemaDriftScenarios: async (): Promise<SchemaDriftScenariosResponse> => {
    const res = await api.get<SchemaDriftScenariosResponse>('/api/reliability/schema-drift-scenarios')
    return res.data
  },
  runSchemaDriftTest: async (scenarioId: string): Promise<SchemaDriftTestResult> => {
    const res = await api.post<SchemaDriftTestResult>(
      `/api/reliability/schema-drift-test/${encodeURIComponent(scenarioId)}`,
    )
    return res.data
  },

  // Risk & ML
  getRiskSummary: async (): Promise<RiskSummaryResponse> => {
    const res = await api.get<RiskSummaryResponse>('/api/risk/summary')
    return res.data
  },
  getConnectorRisk: async (): Promise<ConnectorRiskResponse> => {
    const res = await api.get<ConnectorRiskResponse>('/api/risk/connectors')
    return res.data
  },
  getRunRisk: async (runId: number): Promise<unknown> => {
    const res = await api.get(`/api/risk/runs/${runId}`)
    return res.data
  },

  // Secrets (Operator / Admin)
  getSecrets: async (): Promise<SecretMetadataItem[]> => {
    const res = await api.get<SecretMetadataItem[]>('/api/secrets')
    return res.data
  },
  checkSecretStatus: async (names: string[]): Promise<SecretStatusResponse> => {
    const res = await api.post<SecretStatusResponse>('/api/secrets/status', { names })
    return res.data
  },
  createOrRotateSecret: async (name: string, value: string): Promise<SecretWriteResponse> => {
    const res = await api.put<SecretWriteResponse>(
      `/api/secrets/${encodeURIComponent(name)}`,
      { value },
    )
    return res.data
  },
}

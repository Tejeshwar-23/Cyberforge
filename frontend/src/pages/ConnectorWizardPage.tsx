import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Wand2,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Play,
  ArrowRight,
  ArrowLeft,
  FileCode,
  Lock,
  RefreshCw,
  Cpu,
  Layers,
  Info,
} from 'lucide-react'
import { CyberForgeApi, readableApiError } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { RoleBadge } from '../components/RoleBadge'
import { TimelineStepper } from '../components/TimelineStepper'
import type {
  CatalogSource,
  CopilotGenerateResponse,
  ConfigValidationResult,
  SecretStatusItem,
  TestConnectionResult,
  ConnectorRunResult,
  ConnectorRunTimelineResponse,
} from '../types/api'

export const ConnectorWizardPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialSource = searchParams.get('source') || ''

  // Wizard state steps:
  // 1: Source & Entity
  // 2: Upload/Paste YAML
  // 3: Validation Preview & Secret Check
  // 4: Save & Test Connection
  // 5: Activation & Live Run
  const [currentStep, setCurrentStep] = useState<number>(1)

  // Step 1
  const [sources, setSources] = useState<CatalogSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>(initialSource)
  const [selectedEntity, setSelectedEntity] = useState<'user' | 'device' | 'event'>('event')
  const [loadingSources, setLoadingSources] = useState<boolean>(true)

  // Step 2
  const [yamlContent, setYamlContent] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [yamlFile, setYamlFile] = useState<File | null>(null)


  // Sarvam Connector Copilot
  const [copilotApiDetails, setCopilotApiDetails] = useState<string>('')
  const [copilotSamplePayload, setCopilotSamplePayload] = useState<string>('')
  const [copilotSecretRefHint, setCopilotSecretRefHint] = useState<string>('')
  const [generatingCopilot, setGeneratingCopilot] = useState<boolean>(false)
  const [copilotError, setCopilotError] = useState<string>('')
  const [copilotResult, setCopilotResult] = useState<CopilotGenerateResponse | null>(null)

  // Step 3
  const [validating, setValidating] = useState<boolean>(false)
  const [validationResult, setValidationResult] = useState<ConfigValidationResult | null>(null)
  const [validationError, setValidationError] = useState<string>('')
  const [secretStatuses, setSecretStatuses] = useState<SecretStatusItem[]>([])
  const [checkingSecrets, setCheckingSecrets] = useState<boolean>(false)

  // Secret Creation Modal / Inline
  const [secretToStore, setSecretToStore] = useState<string>('')
  const [secretValueInput, setSecretValueInput] = useState<string>('')
  const [storingSecret, setStoringSecret] = useState<boolean>(false)
  const [storeSecretMsg, setStoreSecretMsg] = useState<string>('')

  // Step 4
  const [savingConfig, setSavingConfig] = useState<boolean>(false)
  const [configSaved, setConfigSaved] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')
  const [testingConnection, setTestingConnection] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [testError, setTestError] = useState<string>('')

  // Step 5
  const [activating, setActivating] = useState<boolean>(false)
  const [activated, setActivated] = useState<boolean>(false)
  const [activationError, setActivationError] = useState<string>('')
  const [runningNow, setRunningNow] = useState<boolean>(false)
  const [runResult, setRunResult] = useState<ConnectorRunResult | null>(null)
  const [runTimeline, setRunTimeline] = useState<ConnectorRunTimelineResponse | null>(null)
  const [runError, setRunError] = useState<string>('')

  // Load catalog sources
  useEffect(() => {
    async function fetchSources() {
      setLoadingSources(true)
      try {
        const data = await CyberForgeApi.getSources()
        setSources(data)
        setSelectedSourceId((current) => current || (data.length > 0 ? data[0].source_id : ''))
      } catch (err) {
        console.error('Failed to load catalog sources:', err)
      } finally {
        setLoadingSources(false)
      }
    }
    void fetchSources()
  }, [])

  const selectedSource = sources.find((s) => s.source_id === selectedSourceId)

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setYamlFile(file)
      setUploadedFileName(file.name)
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setYamlContent(content)
      }
      reader.readAsText(file)
    }
  }

  const isSophosDemo = selectedSourceId === 'sophos-intercept-x' && selectedEntity === 'event'

  // Generate verified starter demo template for Sophos Intercept X Events
  const generateSophosDemoStarter = () => {
    if (!selectedSource || !isSophosDemo) return
    const connectorName = 'sophos-intercept-x-events'
    const sample = `version: "1.0"
name: ${connectorName}
base_url: http://127.0.0.1:9001
auth:
  type: bearer
  secret_ref: SOPHOS_BEARER_TOKEN
endpoint:
  method: GET
  path: /mock/sophos-intercept-x/events
  query_params: {}
response:
  format: json
  records_path: items
pagination:
  type: page
  page_param: page
  start_page: 1
  limit_param: limit
  page_size: 20
schedule:
  every_minutes: 15
incremental:
  enabled: true
  type: timestamp
  request_param: since
  source_field: raisedAt
mapping:
  entity: event
  fields:
    id: id
    type: type
    severity: severity
    timestamp: raisedAt
    description: description
enabled: false
`
    setYamlContent(sample)
    setUploadedFileName(`${connectorName}.yaml`)
    const file = new File([sample], `${connectorName}.yaml`, { type: 'text/yaml' })
    setYamlFile(file)
  }

  // Generate a disabled, validated draft using Sarvam AI.
  // This does not save or activate the connector.
  const handleGenerateWithSarvam = async () => {
    if (!selectedSource || !copilotApiDetails.trim()) return

    setGeneratingCopilot(true)
    setCopilotError('')
    setCopilotResult(null)
    setValidationError('')

    try {
      const result = await CyberForgeApi.generateConnectorConfig({
        source_name: selectedSource.source_id,
        entity: selectedEntity,
        api_details: copilotApiDetails.trim(),
        sample_payload: copilotSamplePayload.trim() || null,
        secret_ref_hint: copilotSecretRefHint.trim() || null,
      })

      setCopilotResult(result)
      setYamlContent(result.yaml_preview)

      const generatedName =
        typeof result.connector.name === 'string'
          ? result.connector.name
          : `${selectedSource.source_id}-${selectedEntity}s`

      const fileName = `${generatedName}.yaml`

      setUploadedFileName(fileName)

      setYamlFile(
        new File(
          [result.yaml_preview],
          fileName,
          { type: 'text/yaml' },
        ),
      )
    } catch (err) {
      setCopilotError(readableApiError(err))
    } finally {
      setGeneratingCopilot(false)
    }
  }

  // Execute in-memory validation
  const handleValidateConfig = async () => {
    if (!selectedSourceId) return
    setValidating(true)
    setValidationError('')
    setValidationResult(null)
    setSecretStatuses([])

    let fileToValidate = yamlFile
    if (!fileToValidate && yamlContent) {
      fileToValidate = new File([yamlContent], 'connector-config.yaml', { type: 'text/yaml' })
    }

    if (!fileToValidate) {
      setValidationError('Please provide a YAML file or paste connector configuration.')
      setValidating(false)
      return
    }

    try {
      const result = await CyberForgeApi.validateUploadedConfig(selectedSourceId, fileToValidate)
      setValidationResult(result)

      if (result.valid) {
        setCurrentStep(3)
        // Check secret references if user is Operator or Admin
        if (result.required_secret_refs && result.required_secret_refs.length > 0) {
          if (user?.role === 'operator' || user?.role === 'admin') {
            await checkSecretReadiness(result.required_secret_refs)
          }
        }
      }
    } catch (err) {
      setValidationError(readableApiError(err))
    } finally {
      setValidating(false)
    }
  }

  // Check secret readiness
  const checkSecretReadiness = async (refs: string[]) => {
    setCheckingSecrets(true)
    try {
      const cleanNames = refs.map((r) => r.replace(/^secret:\/\//, ''))
      const statusRes = await CyberForgeApi.checkSecretStatus(cleanNames)
      setSecretStatuses(statusRes.secrets)
    } catch (err) {
      console.error('Failed to check secret readiness:', err)
    } finally {
      setCheckingSecrets(false)
    }
  }

  // Admin store secret
  const handleStoreSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secretToStore || !secretValueInput) return
    setStoringSecret(true)
    setStoreSecretMsg('')
    try {
      await CyberForgeApi.createOrRotateSecret(secretToStore, secretValueInput)
      setStoreSecretMsg(`Secret "${secretToStore}" stored successfully in AES-256-GCM vault.`)
      setSecretValueInput('')
      setSecretToStore('')
      if (validationResult?.required_secret_refs) {
        await checkSecretReadiness(validationResult.required_secret_refs)
      }
    } catch (err) {
      setStoreSecretMsg(`Failed: ${readableApiError(err)}`)
    } finally {
      setStoringSecret(false)
    }
  }

  // Step 4: Save config as disabled (Admin only)
  const handleSaveConfig = async () => {
    if (!validationResult?.connector) return
    const connectorName = validationResult.connector
    setSavingConfig(true)
    setSaveError('')

    let fileToSave = yamlFile
    if (!fileToSave && yamlContent) {
      fileToSave = new File([yamlContent], `${connectorName}.yaml`, { type: 'text/yaml' })
    }

    if (!fileToSave) {
      setSaveError('Missing configuration file to save.')
      setSavingConfig(false)
      return
    }

    try {
      await CyberForgeApi.saveConfig(connectorName, fileToSave)
      setConfigSaved(true)
    } catch (err) {
      setSaveError(readableApiError(err))
    } finally {
      setSavingConfig(false)
    }
  }

  // Step 4: Test Connection (Operator or Admin)
  const handleTestConnection = async () => {
    if (!validationResult?.connector) return
    const connectorName = validationResult.connector
    setTestingConnection(true)
    setTestError('')
    setTestResult(null)
    try {
      const result = await CyberForgeApi.testConnection(connectorName)
      setTestResult(result)
    } catch (err) {
      setTestError(readableApiError(err))
    } finally {
      setTestingConnection(false)
    }
  }

  // Step 5: Activate Connector (Admin only)
  const handleActivate = async () => {
    if (!validationResult?.connector) return
    const connectorName = validationResult.connector
    setActivating(true)
    setActivationError('')
    try {
      await CyberForgeApi.setActivation(connectorName, true)
      setActivated(true)
    } catch (err) {
      setActivationError(readableApiError(err))
    } finally {
      setActivating(false)
    }
  }

  // Step 5: Run Now (Operator or Admin)
  const handleRunNow = async () => {
    if (!validationResult?.connector) return
    const connectorName = validationResult.connector
    setRunningNow(true)
    setRunError('')
    setRunResult(null)
    setRunTimeline(null)
    try {
      const result = await CyberForgeApi.runNow(connectorName)
      setRunResult(result)
      if (result.run_id) {
        const timeline = await CyberForgeApi.getRunTimeline(result.run_id)
        setRunTimeline(timeline)
      }
    } catch (err) {
      setRunError(readableApiError(err))
    } finally {
      setRunningNow(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
              Deployment Flow
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
              12-Step Architecture
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            <Wand2 className="h-6 w-6 text-blue-400" />
            <span>Connector Configuration Wizard</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Validate in-memory, verify secret references against AES-256-GCM vault, deploy disabled, dry-run test, and activate safely.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/integrations/catalog"
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800"
          >
            ← Back to Catalog
          </Link>
        </div>
      </div>

      {/* Wizard Progress Bar */}
      <div className="grid grid-cols-5 gap-2 font-mono text-xs">
        {[
          { step: 1, label: '1. Select Source' },
          { step: 2, label: '2. Configure' },
          { step: 3, label: '3. Validate & Secrets' },
          { step: 4, label: '4. Save & Dry-Run' },
          { step: 5, label: '5. Activate & Run' },
        ].map((s) => (
          <div
            key={s.step}
            className={`rounded-lg border p-2.5 text-center transition-all ${
              currentStep === s.step
                ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-bold shadow-md'
                : currentStep > s.step
                ? 'border-emerald-800/80 bg-emerald-950/20 text-emerald-400'
                : 'border-slate-800 bg-slate-900/60 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {currentStep > s.step ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : null}
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Role Reminder Alert */}
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0d131f] p-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-400" />
          <span>Active Role: <RoleBadge role={user?.role || 'viewer'} /></span>
        </div>
        <div className="text-[11px] text-slate-500">
          {user?.role === 'viewer' && 'Viewer: Read-only preview. Cannot test or activate.'}
          {user?.role === 'operator' && 'Operator: Can validate, check secrets, dry-run test, and trigger runs.'}
          {user?.role === 'admin' && 'Admin: Full access including secret vault write, saving configs, and activation.'}
        </div>
      </div>

      {/* STEP 1: Select Source and Entity */}
      {currentStep === 1 && (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Step 1: Choose Security Source & Entity Schema</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Select a catalog vendor source and target entity to load schema specifications.
            </p>
          </div>

          {loadingSources ? (
            <div className="py-8 text-center text-xs font-mono text-slate-500">
              Loading security sources from catalog...
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-2">Security Source:</label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sources.map((src) => (
                    <div
                      key={src.source_id}
                      onClick={() => setSelectedSourceId(src.source_id)}
                      className={`cursor-pointer rounded-lg border p-3 font-mono text-xs transition-all ${
                        selectedSourceId === src.source_id
                          ? 'border-blue-500 bg-blue-950/40 text-white'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold">{src.display_name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{src.source_id}</div>
                      <div className="text-[10px] text-blue-400 mt-2">{src.connector_count} templates available</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-2">Target Entity Schema:</label>
                <div className="flex gap-3">
                  {(['user', 'device', 'event'] as const).map((ent) => (
                    <button
                      key={ent}
                      type="button"
                      onClick={() => setSelectedEntity(ent)}
                      className={`rounded-lg border px-4 py-2 font-mono text-xs capitalize transition-all ${
                        selectedEntity === ent
                          ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-bold'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {ent}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={!selectedSourceId}
              onClick={() => {
                if (isSophosDemo && !yamlContent.trim()) {
                  generateSophosDemoStarter()
                }
                setCurrentStep(2)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all disabled:opacity-50"
            >
              <span>Continue to Configuration</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Upload or Paste YAML */}
      {currentStep === 2 && (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-400" />
                <span>Step 2: Generate, Upload or Paste Connector Configuration</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Generate a draft with Sarvam AI, upload a `.yaml` definition, or paste configuration. All drafts remain in-memory until explicitly saved.
              </p>
            </div>
            {isSophosDemo && (
              <button
                type="button"
                onClick={generateSophosDemoStarter}
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 underline shrink-0"
              >
                Generate Demo Starter YAML
              </button>
            )}
          </div>

          {/* Starter Banner / Fallback Notice */}
          {isSophosDemo ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3.5 font-mono text-xs">
              <div>
                <span className="font-bold text-emerald-400">Sophos Intercept X Demo Starter</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verified starter template for the Sophos Intercept X Events demonstration.
                </p>
              </div>
              <button
                type="button"
                onClick={generateSophosDemoStarter}
                className="rounded-lg border border-emerald-800 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/70 transition-colors shrink-0"
              >
                Generate Demo Starter YAML
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs text-slate-400 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-200 font-semibold">Custom Connector Configuration:</span>{' '}
                No verified starter template is available for {selectedSource?.display_name || selectedSourceId} ({selectedEntity}s). Generate a draft with Sarvam AI, upload YAML, or paste configuration manually.
              </div>
            </div>
          )}

          {/* Sarvam Connector Copilot */}
          <div className="rounded-xl border border-violet-800/60 bg-violet-950/10 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-violet-900/50 bg-violet-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-bold font-mono text-violet-300">
                    SARVAM CONNECTOR COPILOT
                  </span>
                  <span className="rounded border border-violet-800 bg-violet-950/50 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-violet-400">
                    AI Draft
                  </span>
                </div>

                <p className="mt-1 text-[11px] font-mono text-slate-400">
                  Describe the vendor API and optionally provide a sample response.
                  Sarvam drafts YAML; CyberForge performs deterministic safety normalization
                  and Pydantic validation before returning it.
                </p>
              </div>

              <div className="text-[10px] font-mono text-slate-500">
                Never paste API keys or passwords
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-mono font-semibold text-slate-300">
                    API / Integration Details *
                  </label>

                  <textarea
                    rows={8}
                    value={copilotApiDetails}
                    onChange={(e) => setCopilotApiDetails(e.target.value)}
                    placeholder={`Example:
Base URL: https://api.vendor.com
Method: GET
Endpoint: /devices
Authentication: API key in X-API-Key
Records path: data.devices
Pagination: page + limit
Incremental timestamp: last_seen`}
                    className="w-full rounded-lg border border-slate-800 bg-[#070a10] p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-mono font-semibold text-slate-300">
                    Sample API Response
                    <span className="ml-1 font-normal text-slate-500">(optional)</span>
                  </label>

                  <textarea
                    rows={8}
                    value={copilotSamplePayload}
                    onChange={(e) => setCopilotSamplePayload(e.target.value)}
                    placeholder={`{
  "data": [
    {
      "id": "device-001",
      "hostname": "endpoint-01",
      "last_seen": "2026-11-01T10:00:00Z"
    }
  ]
}`}
                    className="w-full rounded-lg border border-slate-800 bg-[#070a10] p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="mb-2 block text-[11px] font-mono font-semibold text-slate-300">
                    Secret Reference Hint
                    <span className="ml-1 font-normal text-slate-500">(optional)</span>
                  </label>

                  <input
                    type="text"
                    value={copilotSecretRefHint}
                    onChange={(e) => setCopilotSecretRefHint(e.target.value)}
                    placeholder="e.g. CORTEX_API_KEY"
                    className="w-full rounded-lg border border-slate-800 bg-[#070a10] px-3 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleGenerateWithSarvam()}
                  disabled={
                    generatingCopilot
                    || !selectedSource
                    || !copilotApiDetails.trim()
                    || user?.role === 'viewer'
                  }
                  className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg border border-violet-700 bg-violet-700/30 px-4 py-2.5 text-xs font-mono font-semibold text-violet-200 transition-all hover:bg-violet-700/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generatingCopilot ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating Draft...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Generate with Sarvam AI</span>
                    </>
                  )}
                </button>
              </div>

              {user?.role === 'viewer' && (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] font-mono text-amber-300">
                  Viewer role is read-only. Operator or Admin access is required to use Connector Copilot.
                </div>
              )}

              {copilotError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{copilotError}</span>
                </div>
              )}

              {copilotResult && (
                <div className="rounded-lg border border-emerald-800/70 bg-emerald-950/20 p-3 font-mono">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>AI draft generated and CyberForge schema validation passed</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-400">
                    <span>
                      Provider: <strong className="text-slate-300">{copilotResult.provider}</strong>
                    </span>
                    <span>
                      Model: <strong className="text-slate-300">{copilotResult.model}</strong>
                    </span>
                    <span>
                      Persisted: <strong className="text-emerald-400">NO</strong>
                    </span>
                    <span>
                      Activated: <strong className="text-emerald-400">NO</strong>
                    </span>
                    {copilotResult.usage.total_tokens !== undefined && (
                      <span>
                        Tokens: <strong className="text-slate-300">{copilotResult.usage.total_tokens}</strong>
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-slate-500">
                    The generated YAML has been loaded into the editor below.
                    Review it, then use the normal CyberForge validation workflow.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Zone */}
          <div className="rounded-lg border-2 border-dashed border-slate-800 bg-slate-900/40 p-5 text-center">
            <input
              type="file"
              id="yaml-file-input"
              accept=".yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="yaml-file-input"
              className="cursor-pointer inline-flex flex-col items-center gap-2"
            >
              <Upload className="h-6 w-6 text-slate-400" />
              <span className="text-xs font-mono text-slate-300">
                {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Click to upload .yaml connector configuration'}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Supports valid YAML with schema mappings</span>
            </label>
          </div>

          {/* YAML Editor */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-2">YAML Editor (In-Memory Buffer):</label>
            <textarea
              rows={14}
              value={yamlContent}
              onChange={(e) => {
                setYamlContent(e.target.value)
                setYamlFile(null)
              }}
              className="w-full rounded-lg border border-slate-800 bg-[#070a10] p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {validationError && (
            <div className="rounded-lg border border-rose-800/80 bg-rose-950/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-400 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={validating || !yamlContent.trim()}
              onClick={() => void handleValidateConfig()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all disabled:opacity-50"
            >
              {validating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Validating In-Memory...</span>
                </>
              ) : (
                <>
                  <span>Validate Configuration</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Safe Validation Preview & Required Secrets */}
      {currentStep === 3 && validationResult && (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Step 3: Validation Preview & Secret Readiness</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Configuration verified against generic connector schema. Inspected secret references against the encrypted vault.
            </p>
          </div>

          {/* Validation Status Badge */}
          <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/20 p-4 font-mono text-xs text-emerald-300">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Validation Passed: In-Memory Syntax and Schema Conformance Verified</span>
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-1">
              No configuration was written to disk. The structure was parsed, validated against the Pydantic schema model, and checked for security sanitization.
            </p>
          </div>

          {/* Safe Preview Table */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs space-y-3">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider text-slate-300">
              Safe Preview (Metadata Extracted)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500">Connector Name:</span>
                <div className="text-slate-200 font-semibold">{validationResult.connector}</div>
              </div>
              <div>
                <span className="text-slate-500">Target Entity:</span>
                <div className="text-blue-400 uppercase font-semibold">{validationResult.entity}</div>
              </div>
              <div>
                <span className="text-slate-500">Auth Type:</span>
                <div className="text-slate-200 font-semibold">{validationResult.auth_type}</div>
              </div>
              <div>
                <span className="text-slate-500">Endpoint Path:</span>
                <div className="text-slate-300 truncate">{validationResult.endpoint?.path}</div>
              </div>
              <div>
                <span className="text-slate-500">Pagination Type:</span>
                <div className="text-slate-200">{validationResult.pagination?.type}</div>
              </div>
              <div>
                <span className="text-slate-500">Response Format:</span>
                <div className="text-slate-200 uppercase">{validationResult.response?.format}</div>
              </div>
            </div>
          </div>

          {/* Required Secret References Section */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-xs flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" />
                <span>Required Secret References (Encrypted Vault: AES-256-GCM)</span>
              </h3>
              {user?.role === 'viewer' ? (
                <span className="text-[10px] text-slate-500">Viewer has no secret status visibility</span>
              ) : (
                <button
                  type="button"
                  disabled={checkingSecrets}
                  onClick={() => checkSecretReadiness(validationResult.required_secret_refs)}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                >
                  <RefreshCw className={`h-3 w-3 ${checkingSecrets ? 'animate-spin' : ''}`} />
                  <span>Re-check Readiness</span>
                </button>
              )}
            </div>

            {validationResult.required_secret_refs.length === 0 ? (
              <p className="text-slate-400 text-[11px]">No external secret references required for this configuration.</p>
            ) : user?.role === 'viewer' ? (
              <div className="space-y-1.5">
                {validationResult.required_secret_refs.map((ref) => (
                  <div key={ref} className="text-slate-400 text-[11px] bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    Secret Reference: <code className="text-amber-300">{ref}</code>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {secretStatuses.map((sec) => (
                  <div
                    key={sec.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded border border-slate-800 bg-[#080c14] p-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold text-slate-200">{sec.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-bold ${
                            sec.configured
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {sec.configured ? 'Ready' : 'Missing'}
                        </span>
                      </div>
                      {sec.fingerprint && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          HMAC Fingerprint: <code className="text-slate-400">{sec.fingerprint.slice(0, 16)}...</code>
                        </div>
                      )}
                    </div>

                    {!sec.configured && user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => setSecretToStore(sec.name)}
                        className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors"
                      >
                        Store Secret
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Admin inline secret store modal/panel */}
            {secretToStore && user?.role === 'admin' && (
              <form onSubmit={handleStoreSecret} className="mt-3 rounded-lg border border-blue-800/80 bg-blue-950/20 p-3 space-y-3">
                <div className="text-xs text-blue-300 font-bold">
                  Store Credential for: <span className="font-mono text-white">{secretToStore}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={secretValueInput}
                    onChange={(e) => setSecretValueInput(e.target.value)}
                    placeholder="Enter raw secret value (never saved in plaintext)..."
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={storingSecret || !secretValueInput}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {storingSecret ? 'Encrypting...' : 'Save to Vault'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSecretToStore('')
                      setSecretValueInput('')
                    }}
                    className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
                {storeSecretMsg && (
                  <div className="text-[11px] text-emerald-400 font-mono">{storeSecretMsg}</div>
                )}
              </form>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-400 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all"
            >
              <span>Proceed to Deployment & Dry-Run</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Save (Disabled) & Test Connection */}
      {currentStep === 4 && validationResult && (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Step 4: Save in Safe Disabled State & Dry-Run Test</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Save connector configuration to disk. By platform policy, newly saved connectors are always created in a safe DISABLED state.
            </p>
          </div>

          {/* Action 1: Save Config (Admin only) */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200">1. Install Configuration File</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Writes `{validationResult.connector}.yaml` to active configs with <code>enabled: false</code>.
                </p>
              </div>

              {configSaved ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Installed (Disabled)</span>
                </span>
              ) : user?.role === 'admin' ? (
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() => void handleSaveConfig()}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingConfig ? 'Saving...' : 'Install Config (Disabled)'}
                </button>
              ) : (
                <span className="text-[11px] text-amber-400 font-mono">Admin role required to install</span>
              )}
            </div>

            {saveError && (
              <div className="rounded border border-rose-800/80 bg-rose-950/20 p-2 text-[11px] text-rose-300">
                {saveError}
              </div>
            )}
          </div>

          {/* Action 2: Dry-run Test Connection (Operator / Admin) */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200">2. Test Connection (Dry-Run)</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Executes single authenticated request to the security source without writing normalized data.
                </p>
              </div>

              {user?.role === 'viewer' ? (
                <span className="text-[11px] text-amber-400 font-mono">Operator/Admin required to test</span>
              ) : (
                <button
                  type="button"
                  disabled={testingConnection || (!configSaved && user?.role === 'admin')}
                  onClick={() => void handleTestConnection()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  <Cpu className={`h-3.5 w-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                </button>
              )}
            </div>

            {testResult && (
              <div
                className={`rounded border p-3 text-[11px] font-mono ${
                  testResult.success
                    ? 'border-emerald-800/80 bg-emerald-950/20 text-emerald-300'
                    : 'border-rose-800/80 bg-rose-950/20 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span>Status: {testResult.success ? 'Success' : 'Failed'}</span>
                  <span>•</span>
                  <span>HTTP Status: {testResult.http_status ?? 'N/A'}</span>
                </div>
                <p className="mt-1 text-slate-300">{testResult.message}</p>
                {testResult.sample_records_detected !== undefined && (
                  <div className="mt-2 text-[10px] text-slate-400">
                    Sample Records Detected: {testResult.sample_records_detected} • Normalized: {testResult.sample_records_normalized ?? 0}
                  </div>
                )}
              </div>
            )}

            {testError && (
              <div className="rounded border border-rose-800/80 bg-rose-950/20 p-2 text-[11px] text-rose-300">
                {testError}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-400 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-mono font-semibold text-white hover:bg-blue-500 shadow-md transition-all"
            >
              <span>Continue to Activation & Run</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Activation & Live Run */}
      {currentStep === 5 && validationResult && (
        <div className="rounded-xl border border-slate-800 bg-[#0d131f] p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-400" />
              <span>Step 5: Activate & Execute Pipeline Run</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Enable the connector in active sync schedule and trigger a manual pipeline run to verify data ingestion.
            </p>
          </div>

          {/* Activation Toggle (Admin only) */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200">1. Connector Activation</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Activation updates the connector configuration state and enables immediate manual Run Now. APScheduler does not dynamically hot-reload jobs; background schedule registration requires service reload.
                </p>
              </div>

              {activated ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Connector Active</span>
                </span>
              ) : user?.role === 'admin' ? (
                <button
                  type="button"
                  disabled={activating}
                  onClick={() => void handleActivate()}
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {activating ? 'Activating...' : 'Activate Connector'}
                </button>
              ) : (
                <span className="text-[11px] text-amber-400 font-mono">Admin role required to activate</span>
              )}
            </div>

            {activationError && (
              <div className="rounded border border-rose-800/80 bg-rose-950/20 p-2 text-[11px] text-rose-300">
                {activationError}
              </div>
            )}
          </div>

          {/* Trigger Run Now (Operator / Admin) */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200">2. Execute Pipeline Run (Run Now)</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Launches execution across generic connector engine: extraction, parsing, mapping, quarantine, and persistence.
                </p>
              </div>

              {user?.role === 'viewer' ? (
                <span className="text-[11px] text-amber-400 font-mono">Operator/Admin required to execute</span>
              ) : !activated ? (
                <span className="text-[11px] text-amber-400/90 font-mono bg-amber-950/40 border border-amber-900/60 px-2.5 py-1.5 rounded">
                  Activation required before Run Now (connector is currently disabled)
                </span>
              ) : (
                <button
                  type="button"
                  disabled={runningNow}
                  onClick={() => void handleRunNow()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shadow-md"
                >
                  <Play className={`h-3.5 w-3.5 ${runningNow ? 'animate-spin' : ''}`} />
                  <span>{runningNow ? 'Executing Run...' : 'Run Now'}</span>
                </button>
              )}
            </div>

            {runResult && (
              <div className="rounded border border-slate-800 bg-[#090d16] p-4 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">Run ID: #{runResult.run_id}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      runResult.status === 'success'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {runResult.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <div>
                    Records Extracted: <strong className="text-white">{runResult.records_received}</strong>
                  </div>
                  <div>
                    Records Ingested: <strong className="text-emerald-400">{runResult.records_normalized}</strong>
                  </div>
                  <div>
                    Quarantined: <strong className="text-amber-400">{runResult.records_quarantined}</strong>
                  </div>
                </div>
              </div>
            )}

            {runError && (
              <div className="rounded border border-rose-800/80 bg-rose-950/20 p-2 text-[11px] text-rose-300">
                {runError}
              </div>
            )}

            {/* Execution Timeline */}
            {runTimeline && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <TimelineStepper
                  timeline={runTimeline}
                  title="Execution Timeline"
                  subtitle="Stage-level milestones verified by generic connector engine"
                />
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-400 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <Link
              to="/integrations/connectors"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-700 shadow-md"
            >
              <span>View Configured Connectors</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

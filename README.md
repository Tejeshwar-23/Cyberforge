# 🛡️ CyberForge

## Config-Driven Security Integration Platform

**CyberForge** is a configurable security-integration platform built for the **Mitigata Cyber Forge Hackathon 2026**.

It is designed to solve one of the biggest problems in security integrations:

> Every security vendor exposes APIs differently.

Different authentication methods, pagination styles, field names, response formats, rate limits, schema changes, and failure conditions normally require separate custom connector code.

CyberForge solves this by moving vendor-specific behavior into **YAML configuration** while keeping the execution logic inside one reusable **Universal Connector Engine**.

> **The configuration contains what is different about each vendor; the engine contains how every integration should behave.**

---

# 🚀 Key Idea

Instead of writing a new integration program for every security vendor:

```text
Vendor API
    ↓
Connector YAML
    ↓
Universal Connector Engine
    ↓
Authentication
    ↓
Pagination
    ↓
Parsing
    ↓
Mapping
    ↓
Validation
    ↓
Common Schema
    ↓
PostgreSQL
```

Invalid records are automatically redirected to **Quarantine** instead of being stored.

---

# ✨ Features

CyberForge supports:

- Config-driven security integrations
- Multiple authentication mechanisms
- Encrypted credential storage
- Page / offset / cursor / next-link pagination
- JSON, XML and YAML responses
- Retry and backoff handling
- HTTP 429 rate-limit handling
- Common-schema normalization
- Incremental synchronization
- Scheduled execution
- Bad-record quarantine
- Connector health monitoring
- Stage-level execution history
- Sarvam AI connector generation
- Schema-drift self-healing
- Automatic rollback
- Deterministic operational-risk analysis
- IsolationForest behavioral anomaly detection
- RBAC
- SSRF protection

---

# 🏗️ Architecture

```text
┌─────────────────────────────┐
│      Security Products      │
│ Cisco / Sophos / Wiz / ...  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│       Connector YAML        │
│                             │
│ Endpoint                    │
│ Authentication              │
│ Pagination                  │
│ Mapping                     │
│ Schedule                    │
│ Incremental Sync            │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Universal Connector Engine  │
│                             │
│ Authentication              │
│ HTTP Requests               │
│ Pagination                  │
│ Retry / Backoff             │
│ Rate Limit Handling         │
│ JSON / XML / YAML Parsing   │
│ Field Mapping               │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   Common Schema Validation  │
└──────────┬─────────┬────────┘
           │         │
      Valid│         │Invalid
           ▼         ▼
   ┌────────────┐ ┌────────────┐
   │ PostgreSQL │ │ Quarantine │
   └─────┬──────┘ └────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Operations & Intelligence   │
│                             │
│ Run History                 │
│ Risk Analysis               │
│ IsolationForest ML          │
│ Self-Healing                │
│ Rollback                    │
│ Audit Timeline              │
└─────────────────────────────┘
```

---

# 🔌 Supported Security Sources

CyberForge currently includes **10 vendor-inspired security sources** with **30 connector templates**.

Each source contains connectors for:

- Users
- Devices
- Events

### Supported Sources

1. Elastic Security
2. Palo Alto Cortex XSIAM
3. Sophos Intercept X
4. Trend Micro Vision One
5. Fortinet FortiGate
6. Cisco Secure Firewall
7. Netskope
8. Wiz
9. Prisma Cloud
10. CrowdStrike Cloud Security

---

# 📦 Common Data Model

CyberForge converts vendor-specific records into a common schema.

## User

```text
id
name
email
status
source
last_login
```

## Device

```text
id
hostname
ip
os
owner
source
last_seen
```

## Event

```text
id
type
severity
timestamp
description
source
```

This allows downstream systems to operate on one predictable schema instead of understanding every vendor's original API response.

---

# ⚙️ Example Connector Configuration

Example Cisco Secure Firewall device connector:

```yaml
version: '1.0'

name: cisco-secure-firewall-devices

base_url: http://127.0.0.1:9001

auth:
  type: custom_headers
  secret_headers:
    X-auth-access-token: CISCO_FMC_TOKEN

endpoint:
  method: GET
  path: /mock/cisco-secure-firewall/devices
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

mapping:
  entity: device

  fields:
    id: deviceId
    hostname: networkNodeName
    ip: ipv4Address
    os: softwarePlatform
    owner: adminContact
    last_seen: heartbeatTimestamp
```

Notice that the real Cisco API credential is **not stored inside the YAML**.

Only the reference is stored:

```text
CISCO_FMC_TOKEN
```

---

# 🔐 Encrypted Secret Vault

CyberForge separates connector configuration from credentials.

```text
Connector YAML
      ↓
Secret Reference
      ↓
Backend Secret Resolver
      ↓
Encrypted Vault
      ↓
Decrypt in Backend Memory
      ↓
Attach Credential to Request
```

The frontend does not retrieve plaintext secrets.

## Vault Security

The credential vault uses:

- **AES-256-GCM** authenticated encryption
- **HKDF-SHA256** key derivation
- Random **96-bit nonces**
- Additional Authenticated Data
- HMAC SHA-256 fingerprints
- Argon2 for user-password hashing

The UI displays:

- Secret name
- Fingerprint
- Encryption algorithm
- Creation / rotation date

The raw secret value is not displayed.

---

# 🔑 Authentication Support

CyberForge supports multiple API authentication methods.

### API Key

```yaml
auth:
  type: api_key
  header: X-API-Key
  secret_ref: VENDOR_API_KEY
```

### Bearer Token

```yaml
auth:
  type: bearer
  secret_ref: VENDOR_BEARER_TOKEN
```

### Basic Authentication

```yaml
auth:
  type: basic
  username_ref: VENDOR_USERNAME
  password_ref: VENDOR_PASSWORD
```

### Custom Headers

```yaml
auth:
  type: custom_headers

  secret_headers:
    X-auth-access-token: CISCO_FMC_TOKEN
```

This allows different vendor authentication mechanisms to be supported without changing the connector engine.

---

# 📄 Pagination

Different vendors use different pagination mechanisms.

CyberForge makes pagination configurable.

## Page-Based Pagination

```yaml
pagination:
  type: page
  page_param: page
  start_page: 1
  limit_param: limit
  page_size: 20
```

The engine can automatically make requests such as:

```text
?page=1&limit=20
?page=2&limit=20
?page=3&limit=20
```

---

## Offset Pagination

```yaml
pagination:
  type: offset
  offset_param: offset
  limit_param: limit
  page_size: 50
```

Requests can become:

```text
?offset=0&limit=50
?offset=50&limit=50
?offset=100&limit=50
```

CyberForge also supports:

- Cursor pagination
- Next-link pagination

---

# 🔄 Reliability & Retry Handling

Security APIs can temporarily fail.

CyberForge includes handling for:

- Network errors
- Timeouts
- HTTP 5xx responses
- Retryable failures
- Exponential backoff
- HTTP 429 rate limits
- `Retry-After`

This helps prevent temporary vendor failures from immediately breaking an integration.

---

# ✅ Validation & Quarantine

Every record is validated before being stored.

```text
Vendor Record
      ↓
Mapping
      ↓
Common Schema Validation
      ↓
 ┌─────────────┐
 │             │
Valid        Invalid
 │             │
 ▼             ▼
Database   Quarantine
```

Example invalid record:

```text
DeviceRecord.owner expected a valid string,
but the vendor returned null.
```

Instead of corrupting normalized storage, CyberForge sends the record to **Quarantine** with the exact validation reason.

---

# 🧪 Safe Connector Deployment

New connector configurations are initially installed in a **DISABLED** state.

```text
Create Connector
      ↓
Validate
      ↓
Install Disabled
      ↓
Test Connection
      ↓
Activate
      ↓
Run Pipeline
```

## Test Connection

The dry-run connection test:

- Resolves authentication
- Performs a real authenticated API call
- Checks the source response
- Does not persist normalized records

This prevents an incorrect connector from immediately writing data.

---

# 🤖 Sarvam AI Connector Copilot

CyberForge includes an AI-assisted connector-generation workflow using **Sarvam AI**.

The operator can provide:

- Vendor API information
- Endpoint
- Authentication mechanism
- Sample response
- Desired entity type

Sarvam generates a connector draft.

```text
API Description
      ↓
Sarvam AI
      ↓
Generated YAML
      ↓
Deterministic Safety Normalization
      ↓
Pydantic Validation
      ↓
In-Memory Draft
      ↓
Explicit Save
```

The AI is not allowed to automatically activate the generated connector.

> **AI generates the draft; CyberForge enforces the rules.**

---

# 🩹 Self-Healing Schema Drift

Vendor APIs can change field names over time.

Example:

```text
Old Field
raisedAt

New Field
createdAt
```

CyberForge includes conservative self-healing for low-risk mapping changes.

## Self-Healing Process

```text
Mapping Failure
      ↓
Detect Schema Drift
      ↓
Generate Candidate Mapping
      ↓
Confidence Check
      ↓
Isolated Validation
      ↓
Backup Existing Config
      ↓
Apply Mapping Change
      ↓
Real Connector Rerun
      ↓
Success?
 ┌────┴────┐
Yes       No
 │         │
Keep    Roll Back
```

Automatic self-healing is restricted to low-risk configuration changes.

CyberForge does **not** automatically modify:

- Credentials
- Authentication type
- Permissions
- HTTP methods
- Base domains
- Security-sensitive settings

> CyberForge can repair a minor vendor schema change without giving automation permission to rewrite security-sensitive connector behavior.

---

# 🧠 Operational Risk & Behavioral ML

CyberForge separates:

```text
Connector Execution Status
```

from:

```text
Operational Risk
```

A connector can technically succeed while still behaving abnormally.

For example:

```text
5 Records Received
5 Records Quarantined
0 Records Normalized
```

The API request succeeded, but the data quality is clearly abnormal.

---

## Deterministic Operational Risk

Signals include:

- High quarantine ratio
- Execution failures
- Abnormal processing outcomes

---

## IsolationForest

CyberForge also includes a regime-aware **IsolationForest** model.

```python
IsolationForest(
    n_estimators=300,
    contamination=0.05,
    random_state=42,
    n_jobs=-1
)
```

Current execution regimes include:

```text
DATA_SYNC
IDLE_INCREMENTAL
```

A DATA_SYNC execution is compared against previous healthy DATA_SYNC executions.

This avoids comparing very different execution patterns.

The ML system identifies **operational anomalies**.

It does not automatically claim that an anomaly is a cybersecurity breach.

---

# 📊 Execution Timeline

Every connector execution stores stage-level milestones.

Example:

```text
RUN_STARTED
CONFIG_VALIDATED
CHECKPOINT_LOADED
FETCH_COMPLETED
RECORDS_PROCESSED
RUN_COMPLETED
```

Each run records:

- Run ID
- Connector
- Status
- Start time
- Duration
- Records extracted
- Records ingested
- Records quarantined
- Timeline stages

This improves debugging and auditability.

---

# 🗃️ Database

CyberForge uses **PostgreSQL** for normalized data and execution metadata.

Normalized entities include:

```text
Users
Devices
Events
```

Operational information includes:

```text
Connector Runs
Run Events
Quarantine Records
Risk Results
Health Information
```

---

# 🧩 Technology Stack

### Backend

- Python 3.11
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis

### Frontend

- React
- TypeScript
- Vite

### Machine Learning

- scikit-learn
- IsolationForest

### Security

- AES-256-GCM
- HKDF-SHA256
- HMAC-SHA256
- Argon2
- RBAC
- SSRF protection

### AI

- Sarvam AI

### Infrastructure

- Docker
- Docker Compose

---

# 📁 Project Structure

```text
Cyberforge/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── connectors/
│   │   ├── copilot/
│   │   ├── db/
│   │   └── main.py
│   │
│   └── alembic/
│
├── configs/
│   └── connectors/
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
├── mock-services/
│   ├── security_api.py
│   ├── generated_mock_router.py
│   │
│   └── generated-integrations/
│       └── cyberforge_mock_security_integrations/
│
├── runtime/
│
├── .gitignore
└── README.md
```

---

# 🖥️ Prerequisites

Install:

- Git
- Python **3.11**
- Node.js
- npm
- Docker Desktop
- PostgreSQL / Docker PostgreSQL
- Redis / Docker Redis

---

# 🚀 Installation

## 1. Clone the Repository

```powershell
git clone <YOUR_REPOSITORY_URL>
```

Enter the project:

```powershell
cd Cyberforge
```

---

# 🐍 Python Environment

Create the virtual environment:

```powershell
py -3.11 -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies using the dependency file included with the project.

For example:

```powershell
pip install -r requirements.txt
```

or, if stored under the backend directory:

```powershell
pip install -r .\backend\requirements.txt
```

---

# 🌐 Frontend Installation

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Return to root:

```powershell
cd ..
```

---

# ⚙️ Environment Configuration

The frontend API base URL for local development is:

```text
http://127.0.0.1:8000
```

If required:

```powershell
Copy-Item ".\frontend\.env.example" ".\frontend\.env.local"
```

Never commit real credentials.

---

# ▶️ How to Run CyberForge

For development, open **four PowerShell terminals**.

---

## Terminal 1 — Start PostgreSQL & Redis

Navigate to:

```powershell
Set-Location "C:\Users\senth\Cyberforge"
```

Start infrastructure:

```powershell
docker compose up -d
```

Check containers:

```powershell
docker ps
```

Typical ports:

```text
PostgreSQL : 5432
Redis      : 6379
```

---

## Terminal 2 — Start Mock Security APIs

```powershell
Set-Location "C:\Users\senth\Cyberforge"
```

Run:

```powershell
& ".\.venv\Scripts\python.exe" -m uvicorn security_api:app `
    --app-dir mock-services `
    --host 127.0.0.1 `
    --port 9001
```

Mock API documentation:

```text
http://127.0.0.1:9001/docs
```

---

## Terminal 3 — Start CyberForge Backend

```powershell
Set-Location "C:\Users\senth\Cyberforge"
```

Run:

```powershell
& ".\.venv\Scripts\python.exe" -m uvicorn backend.app.main:app `
    --host 127.0.0.1 `
    --port 8000
```

Backend documentation:

```text
http://127.0.0.1:8000/docs
```

Test:

```powershell
Invoke-WebRequest "http://127.0.0.1:8000/docs" -UseBasicParsing |
Select-Object StatusCode
```

Expected:

```text
200
```

---

## Terminal 4 — Start Frontend

```powershell
Set-Location "C:\Users\senth\Cyberforge\frontend"
```

Run:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

---

# 🎬 Recommended Demo Flow

A clean CyberForge demonstration follows this flow:

```text
Overview
    ↓
Source Catalog
    ↓
Deploy Wizard
    ↓
Connector YAML
    ↓
Secret Vault
    ↓
Test Connection
    ↓
Activate Connector
    ↓
Run Now
    ↓
Execution Timeline
    ↓
Normalized Data
    ↓
Quarantine
    ↓
Self-Healing
    ↓
Operational Risk / ML
```

---

# 🧪 Example Cisco Run

Example connector:

```text
cisco-secure-firewall-devices
```

The engine performs:

```text
Authentication
      ↓
API Fetch
      ↓
Pagination
      ↓
JSON Parsing
      ↓
Field Mapping
      ↓
Schema Validation
      ↓
Database Persistence
```

A successful execution can produce:

```text
Records Extracted : 100
Records Ingested  : 100
Quarantined       : 0
```

---

# 💥 Failure Simulation

CyberForge contains malformed-record fixtures for controlled testing.

Example:

```text
Vendor sends malformed device
        ↓
Connector retrieves it
        ↓
Mapping succeeds
        ↓
Common-schema validation fails
        ↓
Record is quarantined
        ↓
Normalized database remains clean
```

This demonstrates that unsafe vendor data cannot silently pollute normalized storage.

---

# 🧪 Verification Commands

## Compile Python Source

```powershell
Set-Location "C:\Users\senth\Cyberforge"

& ".\.venv\Scripts\python.exe" -m compileall `
    ".\backend\app" `
    ".\mock-services"
```

---

## Verify FastAPI Application

```powershell
& ".\.venv\Scripts\python.exe" -c "from backend.app.main import app; print('[PASS] FastAPI application imported successfully'); print('Routes:', len(app.routes))"
```

---

## Run Tests

```powershell
& ".\.venv\Scripts\python.exe" -m pytest
```

---

## Build Frontend

```powershell
Set-Location ".\frontend"
```

```powershell
npm run build
```

Return:

```powershell
Set-Location ".."
```

---

# 🛠️ Troubleshooting

## HTTP 401 During Test Connection

A `401` normally means:

- The API endpoint was reached
- Authentication failed

Check:

1. Authentication type
2. Header name
3. Secret reference
4. Whether the secret exists in the vault
5. Whether the stored credential matches the source

Never place the real secret directly into connector YAML.

---

## Required Source Field Not Found

Example:

```text
Required source field not found: data.devices
```

This means CyberForge reached the API, but the configured records path does not match the actual response.

Example:

```yaml
response:
  format: json
  records_path: items
```

---

## Quarantined Records

Open:

```text
Operations → Quarantine
```

Common causes include:

- Missing fields
- Invalid dates
- Null required values
- Invalid field types
- Missing IDs

Quarantine is intentional safety behavior.

---

## Port Already in Use

Example:

```powershell
Get-NetTCPConnection -LocalPort 9001 -State Listen
```

Get the process:

```powershell
Get-Process -Id <PID>
```

The same approach can be used for:

```text
8000
9001
5173
5432
6379
```

---

## Risk Analysis Timeout

If the Risk Analysis page reaches its request timeout, inspect:

- Backend endpoint execution time
- Database query cost
- Historical run count
- IsolationForest retraining behavior
- Frontend request timeout

The backend performance issue should be identified before simply increasing the frontend timeout.

---

# 🔒 Security Notes

Never commit:

```text
.env
.env.local
*.pem
*.key
API keys
passwords
access tokens
```

Connector YAML should contain only symbolic references such as:

```text
CISCO_FMC_TOKEN
SOPHOS_BEARER_TOKEN
SARVAM_API_KEY
```

Do not place real production credentials inside:

- README files
- Git commits
- Screenshots
- Logs
- Test fixtures
- AI prompts

---

# ✅ Challenge Requirements Covered

| Requirement | CyberForge Implementation |
|---|---|
| API Authentication | API key, Bearer, Basic, Custom Headers |
| Configurable Endpoints | YAML |
| Pagination | Page, Offset, Cursor, Next-Link |
| Scheduling | Connector Scheduling |
| Field Mapping | YAML Mapping Engine |
| Credential Security | AES-256-GCM Vault |
| Retry Handling | Retry + Backoff |
| Rate Limits | HTTP 429 / Retry-After |
| Bad Records | Quarantine |
| Health Monitoring | Connector Health |
| Common Storage | PostgreSQL |
| Incremental Sync | Checkpoint-Based Sync |
| Validation | Pydantic |
| Test Connection | Authenticated Non-Persistent Dry Run |

---

# 🌟 Additional CyberForge Features

Beyond the core requirements, CyberForge includes:

- Sarvam AI Connector Copilot
- Encrypted credential vault
- Transactional schema-drift self-healing
- Automatic rollback
- RBAC
- SSRF protection
- Failure simulation
- Stage-level execution timeline
- Deterministic operational-risk analysis
- IsolationForest behavioral anomaly detection
- Common normalized security-data views

---

# 🔮 Future Improvements

Possible future additions:

- Slack alerts
- Email alerts
- Webhook notifications
- Dynamic scheduler hot reload
- Additional production vendor connectors
- Connector versioning
- Approval workflows
- Cached ML scoring
- Background ML model refresh
- Distributed connector workers
- Kubernetes deployment
- Prometheus metrics
- Grafana dashboards
- HashiCorp Vault integration
- Cloud secret-manager integration
- Expanded automated integration tests

---

# 🏁 Final Takeaway

CyberForge is more than an API connector.

It provides a controlled security-integration lifecycle:

```text
Configure
    ↓
Secure
    ↓
Validate
    ↓
Connect
    ↓
Normalize
    ↓
Quarantine
    ↓
Observe
    ↓
Recover
    ↓
Audit
```

## One Engine. Multiple Vendors. Common Schema. Built-In Intelligence.

---

### Built for Mitigata Cyber Forge Hackathon 2026

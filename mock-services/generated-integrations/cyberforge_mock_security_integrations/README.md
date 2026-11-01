# CyberForge — Config-Driven Security Integration Platform Mock Bundle

This repository bundle provides a comprehensive, synthetically generated, and programmatically validated integration test suite for **CyberForge**, a configuration-driven security integration platform.

The primary objective of CyberForge is to demonstrate that heterogeneous security data across diverse vendors, data formats (JSON, YAML, XML), authentication protocols, and pagination strategies can be normalized into unified common schemas **purely through declarative connector configurations**, without requiring custom, vendor-specific connector code.

---

## 1. Synthetic Data Notice & Vendor Payload Disclaimer

- **100% Synthetic Data**: All names, email addresses, IP addresses, credentials references, hostnames, timestamps, and alert logs contained in this bundle are entirely synthetic.
- **Vendor-Inspired Payloads**: Payload structures and field names are inspired by real-world security vendors (Elastic Security, Palo Alto Cortex XSIAM, Sophos Intercept X, Trend Micro Vision One, Fortinet FortiGate, Cisco Secure Firewall, Netskope, Wiz, Prisma Cloud, and CrowdStrike Cloud Security). However, they are **synthetic representations** intended for schema-mapping validation and **MUST NOT** be treated as exact replicas of official production vendor APIs.
- **Zero Real Credentials**: No real API keys, passwords, bearer tokens, or sensitive certificates are included. All connector configurations reference environment secret placeholders (e.g., `secret_ref: FORTIGATE_API_TOKEN`).

---

## 2. CyberForge Universal Common Schemas

All incoming heterogeneous vendor records are normalized into three standard CyberForge schemas:

### User Common Schema
```text
id          (string, unique user identifier)
name        (string, full user display name)
email       (string, primary email address)
status      (string, account state: ACTIVE, SUSPENDED, etc.)
source      (string, source vendor identity)
last_login  (string, ISO-8601 timestamp)
```

### Device Common Schema
```text
id          (string, unique device / endpoint identifier)
hostname    (string, fully qualified or netbios host name)
ip          (string, primary IP address)
os          (string, operating system platform and version)
owner       (string, assigned user or admin contact)
source      (string, source vendor identity)
last_seen   (string, ISO-8601 timestamp)
```

### Event Common Schema
```text
id          (string, unique security event/alert identifier)
type        (string, event type or threat category)
severity    (string, normalized severity: CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL)
timestamp   (string, ISO-8601 timestamp)
description (string, human-readable detection summary)
source      (string, source vendor identity)
```

---

## 3. Directory Structure

```text
cyberforge_mock_security_integrations/
│
├── README.md
├── manifest.json
│
├── mock-services/
│   └── data/
│       ├── elastic-security/
│       │   ├── elastic_users_mock.json
│       │   ├── elastic_devices_mock.json
│       │   └── elastic_events_mock.json
│       ├── cortex-xsiam/
│       │   ├── xsiam_users_mock.json
│       │   ├── xsiam_devices_mock.json
│       │   └── xsiam_events_mock.json
│       ├── sophos-intercept-x/
│       │   ├── sophos_users_mock.yaml
│       │   ├── sophos_devices_mock.json
│       │   └── sophos_events_mock.json
│       ├── trend-micro-vision-one/
│       │   ├── trendmicro_users_mock.yaml
│       │   ├── trendmicro_devices_mock.yaml
│       │   └── trendmicro_events_mock.json
│       ├── fortinet-fortigate/
│       │   ├── fortigate_users_mock.xml
│       │   ├── fortigate_devices_mock.xml
│       │   └── fortigate_events_mock.xml
│       ├── cisco-secure-firewall/
│       │   ├── cisco_users_mock.xml
│       │   ├── cisco_devices_mock.json
│       │   └── cisco_events_mock.xml
│       ├── netskope/
│       │   ├── netskope_users_mock.yaml
│       │   ├── netskope_devices_mock.json
│       │   └── netskope_events_mock.json
│       ├── wiz/
│       │   ├── wiz_users_mock.json
│       │   ├── wiz_devices_mock.yaml
│       │   └── wiz_events_mock.json
│       ├── prisma-cloud/
│       │   ├── prisma_users_mock.yaml
│       │   ├── prisma_devices_mock.json
│       │   └── prisma_events_mock.json
│       └── crowdstrike-cloud-security/
│           ├── crowdstrike_users_mock.json
│           ├── crowdstrike_devices_mock.json
│           └── crowdstrike_events_mock.yaml
│
├── configs/
│   └── connectors/
│       ├── elastic-security-users.yaml
│       ├── elastic-security-devices.yaml
│       ├── elastic-security-events.yaml
│       └── ... (30 connector configuration files)
│
├── tests/
│   └── fixtures/
│       └── bad-records/
│           ├── elastic-security/
│           ├── cortex-xsiam/
│           └── ... (30 quarantine fixture files, 5 bad records each)
│
├── mappings/
│   ├── elastic-security.yaml
│   ├── cortex-xsiam.yaml
│   └── ... (10 vendor mapping summary files)
│
├── schema-drift-tests/
│   ├── elastic-security.yaml
│   ├── cortex-xsiam.yaml
│   └── ... (10 schema drift test scenario definitions)
│
└── validation/
    ├── validation_report.json
    └── validation_summary.md
```

---

## 4. Vendor Summary Table (All 30 Connectors)

| Vendor | Entity | Format | Auth | Pagination | Incremental | Clean Records | Bad Fixtures |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Elastic Security | user | JSON | basic | page | Yes (timestamp) | 100 | 5 |
| Elastic Security | device | JSON | basic | offset | Yes (timestamp) | 100 | 5 |
| Elastic Security | event | JSON | basic | page | Yes (timestamp) | 100 | 5 |
| Palo Alto Cortex XSIAM | user | JSON | api_key | offset | Yes (timestamp) | 100 | 5 |
| Palo Alto Cortex XSIAM | device | JSON | api_key | page | Yes (timestamp) | 100 | 5 |
| Palo Alto Cortex XSIAM | event | JSON | api_key | offset | Yes (timestamp) | 100 | 5 |
| Sophos Intercept X | user | YAML | bearer | page | Yes (timestamp) | 100 | 5 |
| Sophos Intercept X | device | JSON | bearer | offset | Yes (timestamp) | 100 | 5 |
| Sophos Intercept X | event | JSON | bearer | page | Yes (timestamp) | 100 | 5 |
| Trend Micro Vision One | user | YAML | bearer | offset | Yes (timestamp) | 100 | 5 |
| Trend Micro Vision One | device | YAML | bearer | page | Yes (timestamp) | 100 | 5 |
| Trend Micro Vision One | event | JSON | bearer | offset | Yes (timestamp) | 100 | 5 |
| Fortinet FortiGate | user | XML | bearer | page | Yes (timestamp) | 100 | 5 |
| Fortinet FortiGate | device | XML | bearer | offset | Yes (timestamp) | 100 | 5 |
| Fortinet FortiGate | event | XML | bearer | page | Yes (timestamp) | 100 | 5 |
| Cisco Secure Firewall | user | XML | custom_headers | offset | Yes (timestamp) | 100 | 5 |
| Cisco Secure Firewall | device | JSON | custom_headers | page | Yes (timestamp) | 100 | 5 |
| Cisco Secure Firewall | event | XML | custom_headers | offset | Yes (timestamp) | 100 | 5 |
| Netskope | user | YAML | api_key | page | Yes (timestamp) | 100 | 5 |
| Netskope | device | JSON | api_key | offset | Yes (timestamp) | 100 | 5 |
| Netskope | event | JSON | api_key | page | Yes (timestamp) | 100 | 5 |
| Wiz | user | JSON | bearer | offset | Yes (timestamp) | 100 | 5 |
| Wiz | device | YAML | bearer | page | Yes (timestamp) | 100 | 5 |
| Wiz | event | JSON | bearer | offset | Yes (timestamp) | 100 | 5 |
| Prisma Cloud | user | YAML | custom_headers | page | Yes (timestamp) | 100 | 5 |
| Prisma Cloud | device | JSON | custom_headers | offset | Yes (timestamp) | 100 | 5 |
| Prisma Cloud | event | JSON | custom_headers | page | Yes (timestamp) | 100 | 5 |
| CrowdStrike Cloud Security | user | JSON | bearer | offset | Yes (timestamp) | 100 | 5 |
| CrowdStrike Cloud Security | device | JSON | bearer | page | Yes (timestamp) | 100 | 5 |
| CrowdStrike Cloud Security | event | YAML | bearer | offset | Yes (timestamp) | 100 | 5 |

---

## 5. Clean vs. Bad Fixtures vs. Schema Drift Architecture

The CyberForge bundle is architected to test three fundamentally distinct lifecycle scenarios:

### Condition 1 — Normal Ingestion (Clean Data)
```text
100 clean records per connector (3,000 total)
             ↓
CyberForge Universal Generic Engine
             ↓
Parser (JSON / YAML / XML)
             ↓
Declarative Mapping (Connector YAML)
             ↓
100 Normalized Records / 0 Quarantined
```
All 3,000 clean records strictly contain valid syntax, unique identifiers, compliant ISO-8601 timestamps, and exact matching source field paths.

---

### Condition 2 — Bad Record Quarantine (Individual Anomalies)
```text
Stream of Valid Records + Occasional Malformed Record
             ↓
CyberForge Mapper Encountering Defect
             ↓
MappingError / ValidationError
             ↓
Record Sent to Quarantine Store
             ↓
Ingestion Pipeline Continues Without Interruption
```
Each bad fixture contains **exactly 5 records** with **5 distinct intentional failure categories**:
- **User Failures**: Missing ID, Missing Name, Malformed Timestamp, Renamed Email Field, Null Status.
- **Device Failures**: Missing Device ID, Missing Hostname, Malformed Timestamp, Missing IP Field, Null Owner.
- **Event Failures**: Missing Event ID, Missing Severity, Missing Timestamp, Malformed Timestamp, Renamed Event Description.

Bad records **must not halt or fail the integration run**.

---

### Condition 3 — Systematic Schema Drift & Self-Healing
```text
Vendor Introduces Breaking Field Renames Across 100% of Payloads
(e.g., raisedAt → createdAt, or user_state → account_state)
             ↓
High-Volume Mapping Failures Detected Across Ingestion Batch
             ↓
CyberForge Schema Drift Detection Engine Flagging Candidate Drift
             ↓
Automated Safe Repair Proposal Generated (LOW Risk)
             ↓
Validation Against Quarantine / Sample Stream
             ↓
Low-Risk Mapping Auto-Applied & Incremental Sync Resumed
```
The files in `schema-drift-tests/` specify real source field changes that simulate vendor API version upgrades, enabling automated drift detection and self-repair testing.

---

## 6. How Connector YAMLs Drive Integration

CyberForge does **not** rely on vendor-specific code files (`sophos_connector.py`, `elastic_connector.py`, etc.). Instead:
1. `response.format` instructs the engine to load the appropriate parser (JSON, YAML, or XML).
2. `response.records_path` navigates the response payload structure to reach the array or collection of items.
3. `mapping` declaratively maps vendor-specific dot-notated source paths to universal common schema attributes.
4. `incremental.source_field` allows the engine to persist high-watermark timestamps and generate queries with `since` parameters.

---

## 7. Programmatic Verification & Integrity Check

The entire bundle includes an automated validation suite (`validation/`) that confirms:
- 30 Connector YAML configs valid.
- 3,000 Clean records valid, unique, and normalizable.
- 150 Bad records categorized into distinct failure modes.
- 10 Mapping summary files.
- 10 Schema drift test files with real mapped source paths.
- Zero secrets or sensitive data exposure.

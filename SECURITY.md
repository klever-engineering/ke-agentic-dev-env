# Security Policy

## Supported Versions

Security fixes are applied to the latest release line.

## Reporting a Vulnerability

Please do **not** open public issues for security vulnerabilities.

Report vulnerabilities through one of these channels:

1. GitHub Security Advisories (preferred):
   - `Security` tab in this repository -> `Report a vulnerability`
2. Email:
   - `security@klever.engineering`

Include as much detail as possible:

- affected version/commit
- impact and threat model
- reproduction steps or proof of concept
- any mitigation you suggest

## Response Expectations

- Initial acknowledgement target: within 3 business days
- Triage and severity classification after confirmation
- Coordinated disclosure preferred after a fix is available

## Scope

High-priority areas:

- token and credential handling
- context collectors and redaction logic
- addon execution policy and permission boundaries
- MCP/client integration trust boundaries

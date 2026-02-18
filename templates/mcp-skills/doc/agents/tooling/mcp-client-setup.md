# MCP Client Setup

## Supported clients

- Codex
- GitHub Copilot
- Claude

## Setup model

1. Keep credentials in `.env` or secret manager, not config files.
2. Use wrapper scripts (`scripts/mcp/mcp-wrapper.sh`) to inject runtime env safely.
3. Validate connectivity with read-only operations first.

## Validation checklist

- [ ] client can list tools/servers
- [ ] read-only query works
- [ ] no secrets hardcoded in committed files

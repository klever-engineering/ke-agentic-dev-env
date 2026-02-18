# MCP Integration Matrix

| Integration | Owner | Default Scope | Risk Class | Status |
| --- | --- | --- | --- | --- |
| GitHub | engineering | read-only | medium | planned |
| GitLab | engineering | read-only | medium | planned |
| AWS | platform | read-only | high | planned |
| Docker | platform | read-only | medium | planned |
| Grafana | observability | read-only | medium | planned |
| Firebase | mobile/platform | read-only | medium | planned |

## Notes

- Upgrade writes from read-only only with explicit HITL approval.
- Every write-capable integration must document rollback behavior.

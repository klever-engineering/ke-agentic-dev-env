# Generic Agentic Environment Capability Matrix

## Source Repositories Reviewed

- `/media/alian/DATA/Projects/AI-Company`
- `/media/alian/DATA/Projects/AE1.0-GithubPrivate`
- `/media/alian/DATA/Projects/AE1.0-Infrastructure`
- `/media/alian/DATA/Projects/citykleta-agentic-dev-env`
- `/media/alian/DATA/Projects/flexsport/flexsport-agentic-dev-env`
- `/media/alian/DATA/Projects/ie-agentic-dev-env`
- `/media/alian/DATA/Projects/ke`
- `/media/alian/DATA/Projects/wm-agentic-dev-env`
- `/media/alian/DATA/Projects/wm-odoo-enterprise-16`

## Sprint Inputs Included

Sprint umbrellas and child tasks from `ie-agentic-dev-env`:

- `#12` Sprint 1: Agentic Dev Environment Hardening (tasks `#4`-`#11`)
- `#19` Sprint 2: Context Engineering Build + Maintenance (tasks `#13`-`#18`)
- `#27` Sprint 3: MCP + Skills Enablement and Operationalization (tasks `#20`-`#26`)

## Capability Comparison

| Capability | Strongest Source(s) | Maturity | Keep in Generic Template |
| --- | --- | --- | --- |
| Central `AGENTS.md` governance | AI-Company, IE, Citykleta | High | Core |
| Standardized playbooks (bugfix/incidents/refactor/release) | IE | High | Core |
| Multi-agent handoff protocol/template | IE, Flexsport | High | Core |
| Safety boundaries / HITL risk classes | IE | High | Core |
| Deterministic preflight script | IE, WM-Odoo | High | Core |
| Machine-readable workspace contract (`agent-context.json`) | IE | High | Core |
| Context engineering lifecycle (`input` -> `sources` -> `support` -> `snapshots`) | WM-Odoo, IE, Flexsport | High | Core |
| Source catalog with ownership + cadence + TTL | WM-Odoo, IE Sprint 2 | High | Core |
| Context quality/freshness validation gates | IE | Medium/High | Core |
| Scheduled context maintenance workflow | IE | Medium | Core |
| Secret hygiene + secret scan workflow | IE, AI-Company | Medium | Core |
| Issue and PR templates for agent execution | IE | High | Core |
| KPI definitions + sprint reporting templates | IE | Medium/High | Core |
| GitHub project integration via `gh` | IE, Citykleta | Medium | Core |
| Dedicated agent definitions under `.github/agents` | AI-Company, IE, WM | High | Core |
| MCP client setup conventions and wrappers | IE | Medium | Core |
| Trusted MCP/skills policy + governance | Sprint 3 tasks | Planned | Core |
| Skills catalog lifecycle | Sprint 3 tasks | Planned | Core |
| Pilot workflow evidence structure | IE sprint model | Medium | Optional (enable by profile) |
| Large enterprise SOP tree (company-wide playbooks) | AI-Company, KE handbook | High but domain-specific | Optional |
| Product-specific runtime scripts per service | IE, WM-Odoo, Flexsport | High but product-specific | Optional |
| Discord reporting conventions | Citykleta | Domain-specific | Optional |

## Sprint Task to Template Mapping

### Sprint 1 (`#4`-`#11`)

- `#4` Playbooks: generate standardized playbook templates and index.
- `#5` Workspace contract: generate `agent-context.json` + schema + docs.
- `#6` Intake templates: generate issue templates + PR template.
- `#7` Preflight: generate `scripts/ci/preflight.sh` + referenced checks.
- `#8` Handoffs: generate handoff protocol and template.
- `#9` Safety boundaries: generate risk classes, prohibited operations, and HITL requirements.
- `#10` Secret hygiene: generate secret scanning workflow + local secret scan script + docs.
- `#11` KPIs: generate KPI definitions and sprint report template.

### Sprint 2 (`#13`-`#18`)

- `#13` Context inventory: generate inventory + ownership matrix + source catalog.
- `#14` Context schema: generate context contract schema docs.
- `#15` Collection pipeline: generate `scripts/context/*` collectors (including code/environment).
- `#16` Quality gates: generate `scripts/context/validate_context.sh` and preflight wiring.
- `#17` Maintenance schedule: generate `.github/workflows/context-refresh.yml`.
- `#18` Security/redaction: generate context redaction/security policy and checklist.

### Sprint 3 (`#20`-`#26`)

- `#20` Trusted-source policy: generate trust-tier policy doc.
- `#21` Client setup templates: generate Codex/Copilot/Claude MCP setup docs and config templates.
- `#22` Core trusted integrations: generate MCP integration matrix and boundaries doc.
- `#23` Skills catalog lifecycle: generate catalog template + governance checklist.
- `#24` Guardrails/action gates: generate operation class model and escalation runbook.
- `#25` Pilot workflows: generate pilot evidence report template.
- `#26` Google Play strategy: generate design-note template for external integration strategy.

## Final Generic Profiles

- `foundation` (default): Sprint 1 complete baseline + minimal context skeleton.
- `context-ops`: foundation + full Sprint 2 context pipeline scaffolding.
- `full`: foundation + context-ops + Sprint 3 MCP/skills governance scaffolding.

## Design Decisions

- Use a single npm CLI package with two modes:
  - `init`: create a fresh agentic workspace scaffold.
  - `wrap`: add agentic scaffold to an existing project without clobbering existing files.
- Keep generated assets policy-first and template-driven.
- Avoid hard-coding organization/repo IDs; expose them via `.env.example` and placeholders.
- Keep risky automations opt-in; default generated scripts remain read-first and scoped.

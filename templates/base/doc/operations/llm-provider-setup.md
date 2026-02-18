# LLM Provider Setup

Supported hosted providers:

- OpenAI (`OPENAI_API_KEY`)
- Anthropic (`ANTHROPIC_API_KEY`)
- Gemini (`GEMINI_API_KEY` or `GOOGLE_API_KEY`)

## Provider selection

Set `LLM_PROVIDER` to one of:

- `openai`
- `anthropic`
- `gemini`
- `auto`

## Validation

Run:

```bash
./scripts/ai/validate_provider.sh
```

## Security rules

- do not commit real API keys to repository files
- pass keys through environment variables or secret managers
- rotate keys immediately if accidentally exposed

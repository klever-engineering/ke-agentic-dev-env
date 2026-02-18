# Knowledge Layer Source

This folder contains AI-generated knowledge artifacts derived from curated context sources.

Generated artifacts:

- `knowledge-layer.json`
- `knowledge-layer.md`

Build command:

```bash
node scripts/context/build_knowledge_layer.mjs --provider openai
```

Do not commit API tokens or prompt payloads containing secrets.

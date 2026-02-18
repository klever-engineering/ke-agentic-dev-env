# Versioning Policy

This project follows Semantic Versioning (`MAJOR.MINOR.PATCH`).

## Rules

- `MAJOR`: breaking changes to CLI behavior, scaffold structure, or contracts.
- `MINOR`: backward-compatible features (new templates, scripts, commands, docs).
- `PATCH`: backward-compatible fixes (bugs, docs fixes, CI fixes).

## Release Process

1. Ensure CI is green (`npm test`).
2. Update `CHANGELOG.md` with release notes.
3. Update `package.json` version.
4. Commit release changes.
5. Tag release:

```bash
git tag -a vX.Y.Z -m "release: vX.Y.Z"
git push origin main --tags
```

## Stability Expectations

- `0.x`: rapid iteration, may include structural changes between minors.
- `1.0.0+`: stronger compatibility guarantees for CLI and scaffold contracts.

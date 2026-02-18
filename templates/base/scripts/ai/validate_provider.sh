#!/usr/bin/env bash
set -euo pipefail

read_env_var() {
  local key="$1"
  printf '%s' "${!key:-}"
}

provider="$(read_env_var "LLM_PROVIDER")"
provider="${provider:-auto}"

openai_key="$(read_env_var "OPENAI_API_KEY")"
anthropic_key="$(read_env_var "ANTHROPIC_API_KEY")"
gemini_key="$(read_env_var "GEMINI_API_KEY")"
if [ -z "$gemini_key" ]; then
  gemini_key="$(read_env_var "GOOGLE_API_KEY")"
fi

has_openai=false
has_anthropic=false
has_gemini=false
[ -n "$openai_key" ] && has_openai=true
[ -n "$anthropic_key" ] && has_anthropic=true
[ -n "$gemini_key" ] && has_gemini=true

case "$provider" in
  auto)
    if [ "$has_openai" = true ] || [ "$has_anthropic" = true ] || [ "$has_gemini" = true ]; then
      detected=()
      [ "$has_openai" = true ] && detected+=("openai")
      [ "$has_anthropic" = true ] && detected+=("anthropic")
      [ "$has_gemini" = true ] && detected+=("gemini")
      echo "LLM provider check passed (auto): configured -> ${detected[*]}"
      exit 0
    fi
    ;;
  openai)
    if [ "$has_openai" = true ]; then
      echo "LLM provider check passed: openai"
      exit 0
    fi
    ;;
  anthropic)
    if [ "$has_anthropic" = true ]; then
      echo "LLM provider check passed: anthropic"
      exit 0
    fi
    ;;
  gemini)
    if [ "$has_gemini" = true ]; then
      echo "LLM provider check passed: gemini"
      exit 0
    fi
    ;;
  *)
    echo "Unsupported LLM_PROVIDER: $provider"
    echo "Allowed values: auto, openai, anthropic, gemini"
    exit 1
    ;;
esac

echo "No valid major-provider API token configured for LLM_PROVIDER=$provider"
echo "Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY (or GOOGLE_API_KEY for Gemini)"
echo "Provide tokens at runtime via environment variables or secret manager; do not persist real keys in repo files."
exit 1

.PHONY: preflight context-collect context-validate qa

preflight:
	./scripts/ci/preflight.sh

context-collect:
	./scripts/context/collect_all.sh --skip-aws --skip-grafana

context-validate:
	./scripts/context/validate_context.sh

qa:
	./scripts/qa/run_qa.sh

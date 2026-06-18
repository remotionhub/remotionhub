SHELL := /bin/bash
.ONESHELL:
.DEFAULT_GOAL := help

APP_PORT ?= 3000
PREVIEW_PORT ?= 4173
CONVEX_URL ?= http://127.0.0.1:3210
CONVEX_BACKEND_VERSION ?= precompiled-2026-06-09-b6aaa1a
STATIC_CONVEX_URL ?= https://example.invalid
PLAYWRIGHT_USE_SYSTEM_CHROME ?= 1

.PHONY: help install dev local up convex app open validate seed test coverage typecheck build build-local check e2e smoke preview routes clean ensure-convex

help: ## Show available make targets.
	@awk 'BEGIN {FS = ":.*##"; printf "\nRemotionHub make targets:\n\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-14s %s\n", $$1, $$2} END {printf "\nVariables: APP_PORT=%s CONVEX_URL=%s PREVIEW_PORT=%s\n\n", "$(APP_PORT)", "$(CONVEX_URL)", "$(PREVIEW_PORT)"}' $(MAKEFILE_LIST)

install: ## Install npm dependencies.
	npm install

dev: ## Start local Convex if needed, seed fixtures, and serve the app URL.
	set -euo pipefail
	convex_pid=""
	if curl -fsS "$(CONVEX_URL)/version" >/dev/null 2>&1; then
		echo "Using existing Convex at $(CONVEX_URL)"
	else
		echo "Starting Convex at $(CONVEX_URL)"
		npx convex dev --local-backend-version "$(CONVEX_BACKEND_VERSION)" &
		convex_pid=$$!
		trap 'if [ -n "$$convex_pid" ]; then kill "$$convex_pid" >/dev/null 2>&1 || true; fi' EXIT INT TERM
		echo "Waiting for Convex..."
		for _ in $$(seq 1 60); do
			if curl -fsS "$(CONVEX_URL)/version" >/dev/null 2>&1; then
				break
			fi
			sleep 1
		done
		if ! curl -fsS "$(CONVEX_URL)/version" >/dev/null 2>&1; then
			echo "Convex did not become ready at $(CONVEX_URL)" >&2
			exit 1
		fi
	fi
	$(MAKE) seed
	echo "Opening http://localhost:$(APP_PORT)/"
	open "http://localhost:$(APP_PORT)/" >/dev/null 2>&1 || true
	VITE_CONVEX_URL="$(CONVEX_URL)" npx vite dev --host 127.0.0.1 --port "$(APP_PORT)"

local: dev ## Alias for dev.

up: dev ## Alias for dev.

convex: ## Start local Convex only.
	npx convex dev --local-backend-version "$(CONVEX_BACKEND_VERSION)"

app: ## Start the Vite app only, using CONVEX_URL.
	VITE_CONVEX_URL="$(CONVEX_URL)" npx vite dev --host 127.0.0.1 --port "$(APP_PORT)"

open: ## Open the local app URL.
	open "http://localhost:$(APP_PORT)/"

validate: ## Validate local catalog fixture JSON.
	npm run catalog:validate

seed: ## Import fixture catalog into local Convex.
	npm run catalog:import -- --apply --target=dev

test: ## Run Vitest unit and contract tests.
	npm run test

coverage: ## Run test coverage.
	npm run coverage

typecheck: ## Run TypeScript with a stable placeholder Convex URL.
	VITE_CONVEX_URL="$(STATIC_CONVEX_URL)" npx tsc --noEmit

build: ## Build with a stable placeholder Convex URL.
	VITE_CONVEX_URL="$(STATIC_CONVEX_URL)" npm run build

build-local: ## Build against local Convex.
	VITE_CONVEX_URL="$(CONVEX_URL)" npm run build

check: test validate typecheck build ## Run the main local verification gate.

ensure-convex: ## Verify local Convex is reachable.
	@curl -fsS "$(CONVEX_URL)/version" >/dev/null 2>&1 || (echo "Convex is not reachable at $(CONVEX_URL). Start it with 'make convex' or use 'make dev'." >&2; exit 1)

e2e: ensure-convex seed build-local ## Run Playwright smoke tests against local Convex.
	PLAYWRIGHT_USE_SYSTEM_CHROME="$(PLAYWRIGHT_USE_SYSTEM_CHROME)" VITE_CONVEX_URL="$(CONVEX_URL)" npm run test:e2e

smoke: e2e ## Alias for e2e.

preview: build-local ## Build and serve a production preview against local Convex.
	VITE_CONVEX_URL="$(CONVEX_URL)" npm run preview -- --host 127.0.0.1 --port "$(PREVIEW_PORT)"

routes: ## Regenerate TanStack Router route tree.
	npm run generate-routes

clean: ## Remove generated build and Playwright report artifacts.
	rm -rf dist playwright-report test-results

GCP_PROJECT ?= ai-blt
STAGE_BUCKET ?= pair-with
FUNCTION_NAME ?= pairWith
FUNCTION_MEMORY ?= 128MB
CI_WORKDIR ?= $(shell pwd)

deploy: __set-project __ensure-bucket __ensure-bucket __env __deploy-only ## Deploy function to production

test: ## Run function tests
	@docker run -it --rm \
		-v $(CI_WORKDIR):/usr/src/app \
		-w /usr/src/app \
		mhart/alpine-node:6.10 \
		sh -c "npm install --quiet && npm test"

help:
	@echo Public targets:
	@grep -E '^[^_][^_][a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo "Private targets: (use at own risk)"
	@grep -E '^__[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[35m%-20s\033[0m %s\n", $$1, $$2}'

__deploy-only: ## Deploy function
	@gcloud beta functions \
	  deploy $(FUNCTION_NAME) \
		--stage-bucket $(STAGE_BUCKET) \
		--memory $(FUNCTION_MEMORY) \
		--trigger-http

__ensure-bucket: ## Create staging bucket if one does not already exist
	@(gsutil mb gs://$(STAGE_BUCKET) 2>/dev/null && echo "created bucket") || echo "bucket exists"

__set-project: ## Sets gcp project in context
	@gcloud config set project $(GCP_PROJECT)

__env: ## Create env file
	@envtpl < .env.tmpl > .env

.PHONY: test

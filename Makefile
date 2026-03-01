SEED ?= 42
COUNT ?= 2000
MIN_YEAR ?= 2018
MAX_YEAR ?= 2025
DATASET_PATH ?=
DATASET_ID ?= Cornell-University/arxiv

.PHONY: demo arxiv_demo

arxiv_demo:
	python3 engine/arxiv_build.py --seed $(SEED) --count $(COUNT) --dataset-id $(DATASET_ID) --min-year $(MIN_YEAR) --max-year $(MAX_YEAR) $(if $(DATASET_PATH),--dataset-path $(DATASET_PATH),) --output apps/web/public/demo/nodes.json

demo: arxiv_demo

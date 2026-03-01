SEED ?= 42
COUNT ?= 2000

.PHONY: demo

demo:
	python3 engine/build_demo.py --seed $(SEED) --count $(COUNT) --output apps/web/public/demo/nodes.json

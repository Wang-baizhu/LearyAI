# 当前文件职责：为 learyAI 仓库提供本地运行与 Docker 部署入口。

.PHONY: run run-backend run-frontend run-python-backend docker-build docker-up docker-down docker-clean

COMPOSE_FILE := deploy/docker/compose.yml

run:
	bash scripts/run-local.sh

run-backend:
	LEARY_LOCAL_APP_MODE=1 bash backend/startup.sh

run-frontend:
	bash frontend/startup.sh

run-python-backend:
	LEARY_LOCAL_APP_MODE=1 bash python-backend/start_all.sh

clean-local:
	bash scripts/cleanup-local.sh

docker-build:
	docker compose -f $(COMPOSE_FILE) build

docker-up:
	docker compose -f $(COMPOSE_FILE) up -d --build

docker-down:
	docker compose -f $(COMPOSE_FILE) down

docker-clean:
	docker compose -f $(COMPOSE_FILE) down -v

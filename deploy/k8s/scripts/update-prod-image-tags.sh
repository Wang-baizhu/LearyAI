#!/usr/bin/env bash
# 责任：更新 prod 清单的镜像仓库与 tag，供审批通过后的生产发布使用。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ $# -ne 2 ]]; then
  echo "用法: deploy/k8s/scripts/update-prod-image-tags.sh <image-registry> <image-tag>"
  exit 1
fi

IMAGE_REGISTRY="$1"
IMAGE_TAG="$2"

update_file() {
  local file="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v image_registry="$IMAGE_REGISTRY" -v image_tag="$IMAGE_TAG" '
    /^  - name: / {
      image_name = substr($0, 11)
      if (image_name == "leary-plugin-gateway" || image_name == "leary-backend" || image_name == "leary-agent" || image_name == "leary-task") {
        print $0
        getline
        print "    newName: " image_registry "/" image_name
        getline
        print "    newTag: " image_tag
        next
      }
    }

    { print }
  ' "$file" > "$tmp_file"

  mv "$tmp_file" "$file"
}

update_file "$REPO_ROOT/deploy/k8s/overlays/prod-external-kb/kustomization.yaml"
update_file "$REPO_ROOT/deploy/k8s/overlays/prod-internal-kb/kustomization.yaml"

echo "[INFO] Updated prod overlay image tags to ${IMAGE_REGISTRY}/*:${IMAGE_TAG}"

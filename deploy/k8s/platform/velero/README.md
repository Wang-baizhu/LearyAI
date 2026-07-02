# 当前文件职责：说明 learyAI 的 Velero 安装与凭据模板约定。

## 安装
```bash
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm repo update
helm upgrade --install velero vmware-tanzu/velero \
  -n velero --create-namespace \
  -f deploy/k8s/platform/velero/values.yaml
```

## 凭据
- 需要预先创建 `velero-credentials` Secret。
- 推荐只开放备份桶最小权限。
- 若 CSI 支持 VolumeSnapshot，可再开启 `snapshotVolumes=true`。

// 责任：提供管理员模板开发调试安装包三平台版本上传、查看与激活页面。
import React, { useMemo, useState } from 'react';
import { Package, UploadCloud, Sparkles } from 'lucide-react';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import {
  useActivateTemplateDevPackageVersion,
  useTemplateDevPackageVersions,
  useUploadTemplateDevPackageVersion,
} from '@/modules/template-dev-package/hooks/useTemplateDevPackage';
import type { ApiClientError } from '@/shared/api/client';

const PLATFORM_OPTIONS = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
] as const;

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export const TemplateDevPackagePage: React.FC = () => {
  const versionsQuery = useTemplateDevPackageVersions();
  const uploadMutation = useUploadTemplateDevPackageVersion();
  const activateMutation = useActivateTemplateDevPackageVersion();

  const [draftPlatform, setDraftPlatform] = useState<(typeof PLATFORM_OPTIONS)[number]['value']>('windows');
  const [draftVersion, setDraftVersion] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const versionsByPlatform = useMemo(
    () =>
      PLATFORM_OPTIONS.map((platform) => ({
        ...platform,
        items: versionsQuery.versions.filter((item) => item.platform === platform.value),
        active: versionsQuery.versions.find((item) => item.platform === platform.value && item.status === 'ACTIVE') ?? null,
      })),
    [versionsQuery.versions],
  );

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftVersion.trim() || !selectedFile) {
      return;
    }
    try {
      await uploadMutation.mutateAsync({
        platform: draftPlatform,
        version: draftVersion.trim(),
        file: selectedFile,
      });
    } catch {
      return;
    }
    setDraftPlatform('windows');
    setDraftVersion('');
    setSelectedFile(null);
  };

  const uploadError = (uploadMutation.error as ApiClientError | null)?.message;
  const activateError = (activateMutation.error as ApiClientError | null)?.message;
  const listError = (versionsQuery.error as ApiClientError | null)?.message;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">模板开发调试安装包</h1>
          <p className="mt-1 text-sm text-zinc-500">管理 leary workspace 下载的开发模板安装包版本，按 Windows、macOS、Linux 分平台维护最新包。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {versionsByPlatform.map((platform) =>
            platform.active ? (
              <Badge key={platform.value} variant="success">{platform.label} 最新 {platform.active.version}</Badge>
            ) : null,
          )}
        </div>
      </div>

      <Card title="上传新版本" extra={<UploadCloud size={16} className="text-zinc-400" />}>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-[12rem_14rem_minmax(0,1fr)_auto]" onSubmit={handleUpload}>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">平台</span>
            <select
              value={draftPlatform}
              onChange={(event) => setDraftPlatform(event.target.value as (typeof PLATFORM_OPTIONS)[number]['value'])}
              className="w-full rounded-lg border border-black/5 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">版本号</span>
            <input
              type="text"
              value={draftVersion}
              onChange={(event) => setDraftVersion(event.target.value)}
              placeholder="例如 0.3.1"
              className="w-full rounded-lg border border-black/5 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">安装包文件</span>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-black/5 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" isLoading={uploadMutation.isPending} disabled={!draftVersion.trim() || !selectedFile}>
              上传版本
            </Button>
          </div>
        </form>
        {selectedFile ? (
          <p className="mt-3 text-xs text-zinc-500">
            已选择 {selectedFile.name}，目标平台 {PLATFORM_OPTIONS.find((item) => item.value === draftPlatform)?.label}，大小 {formatBytes(selectedFile.size)}
          </p>
        ) : null}
        {uploadError ? <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{uploadError}</p> : null}
      </Card>

      <Card title="版本列表" extra={<Package size={16} className="text-zinc-400" />}>
        {listError ? <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{listError}</p> : null}
        {activateError ? <p className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{activateError}</p> : null}
        {versionsQuery.isLoading ? <p className="text-sm text-zinc-500">版本列表加载中...</p> : null}
        {versionsQuery.versions.length > 0 ? (
          <div className="space-y-6">
            {versionsByPlatform.map((platform) => (
              <section key={platform.value} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900">{platform.label}</h2>
                  {platform.active ? <Badge variant="success">当前最新 {platform.active.version}</Badge> : <Badge variant="neutral">未设置最新</Badge>}
                </div>
                {platform.items.length > 0 ? (
                  <div className="space-y-4">
                    {platform.items.map((item) => {
                      const isActive = item.status === 'ACTIVE';
                      const isActivating = activateMutation.isPending
                        && activateMutation.variables?.platform === item.platform
                        && activateMutation.variables?.version === item.version;
                      return (
                        <div key={`${item.platform}-${item.version}`} className="rounded-xl border border-black/5 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-zinc-900">{item.version}</h3>
                                <Badge variant={isActive ? 'success' : 'neutral'}>{isActive ? '最新' : '历史'}</Badge>
                              </div>
                              <p className="text-sm text-zinc-600">{item.fileName}</p>
                              <p className="text-xs text-zinc-500">
                                类型 {item.contentType} · 大小 {formatBytes(item.sizeBytes)} · 上传时间 {formatDateTime(item.createdAt)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                更新时间 {formatDateTime(item.updatedAt)} · 创建人 {item.createdBy ?? '-'}
                              </p>
                            </div>
                            <Button
                              variant={isActive ? 'secondary' : 'primary'}
                              isLoading={isActivating}
                              disabled={isActive}
                              onClick={() => activateMutation.mutate({ platform: item.platform, version: item.version })}
                            >
                              {isActive ? (
                                <>
                                  <Sparkles size={14} className="mr-2" />
                                  当前最新
                                </>
                              ) : '设为最新'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">该平台暂无安装包版本。</p>
                )}
              </section>
            ))}
          </div>
        ) : null}
        {!versionsQuery.isLoading && versionsQuery.versions.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无安装包版本，请先上传首个版本。</p>
        ) : null}
      </Card>
    </div>
  );
};

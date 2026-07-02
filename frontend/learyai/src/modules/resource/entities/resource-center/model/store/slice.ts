// resourceCenterSlice 负责资源中心页面的 UI 状态管理。
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ResourceCenterTab } from '../types/panel';

export type ResourceFileTypeFilter = 'all' | 'pdf' | 'docx' | 'pptx' | 'md' | 'txt' | 'url';
export type ResourceCenterPageState = Record<ResourceCenterTab, number>;

export interface ReferenceResource {
  id: string;
  docId: string;
  name: string;
  fileType: 'pdf' | 'docx' | 'pptx' | 'md' | 'txt' | 'url' | 'wav' | 'mp3' | 'm4a' | 'aac' | 'flac' | 'ogg' | 'other';
  previewUrl: string | null;
}

export type TemplateTagTab = string;
export interface ReferenceScopeContext {
  projectId?: string;
  kbId?: string;
}

type ReferenceStatePayload = {
  context?: ReferenceScopeContext;
  resources: ReferenceResource[];
};

type ReferenceDocIdPayload = {
  context?: ReferenceScopeContext;
  docId: string;
};

type AddReferencePayload = {
  context?: ReferenceScopeContext;
  reference: ReferenceResource;
};

type ToggleReferencePayload = {
  context?: ReferenceScopeContext;
  reference: ReferenceResource;
  nextIsReference: boolean;
};

type RenameReferencePayload = {
  projectId: string;
  docId: string;
  name: string;
};

interface ResourceCenterState {
  search: string;
  fileType: ResourceFileTypeFilter;
  selectedTemplateTags: Record<string, string | null>;
  selectedTemplateSources: Record<string, string | null>;
  pageByTab: ResourceCenterPageState;
  size: number;
  isImportOpen: boolean;
  isImportUrlOpen: boolean;
  isImportTextOpen: boolean;
  referencedResources: ReferenceResource[];
  referencedResourcesByContext: Record<string, ReferenceResource[]>;
  docNameMapByScope: Record<string, Record<string, string>>;
  docNameMap: Record<string, string>;
  aiPanelOpenToken: number | null;
  citationJump: {
    source: string;
    pageText: string;
    token: number;
    sourceDetailTabKey?: string;
  } | null;
  videoJumpRequest: {
    docId: string;
    startSeconds: number;
    token: number;
  } | null;
  currentContext: {
    projectId?: string;
    kbId?: string;
  };
}

const createInitialPageByTab = (): ResourceCenterPageState => ({
  all: 1,
  kbdoc: 1,
  mindmap: 1,
  question: 1,
  card: 1,
});

const initialState: ResourceCenterState = {
  search: '',
  fileType: 'all',
  selectedTemplateTags: {
    mindmap: null,
    question: null,
    card: null,
  },
  selectedTemplateSources: {
    mindmap: null,
    question: null,
    card: null,
  },
  pageByTab: createInitialPageByTab(),
  size: 12,
  isImportOpen: false,
  isImportUrlOpen: false,
  isImportTextOpen: false,
  referencedResources: [],
  referencedResourcesByContext: {},
  docNameMapByScope: {},
  docNameMap: {},
  aiPanelOpenToken: null,
  citationJump: null,
  videoJumpRequest: null,
  currentContext: {},
};

const normalizeContextId = (value?: string) => (value?.trim() ? value.trim() : undefined);

export const buildReferenceScopeKey = (context?: ReferenceScopeContext) => {
  const projectId = normalizeContextId(context?.projectId);
  const kbId = normalizeContextId(context?.kbId);
  return projectId && kbId ? `${projectId}::${kbId}` : null;
};

const resolveScopeKey = (state: ResourceCenterState, context?: ReferenceScopeContext) =>
  buildReferenceScopeKey(context ?? state.currentContext);

const getScopedDocNameMap = (state: ResourceCenterState, scopeKey: string | null) =>
  (scopeKey ? state.docNameMapByScope[scopeKey] : state.docNameMap) ?? {};

const getScopedReferences = (state: ResourceCenterState, scopeKey: string | null) =>
  (scopeKey ? state.referencedResourcesByContext[scopeKey] : state.referencedResources) ?? [];

const setScopedReferences = (
  state: ResourceCenterState,
  scopeKey: string | null,
  resources: ReferenceResource[]
) => {
  if (!scopeKey) {
    state.referencedResources = resources;
    return;
  }
  state.referencedResourcesByContext[scopeKey] = resources;
  if (buildReferenceScopeKey(state.currentContext) === scopeKey) {
    state.referencedResources = resources;
  }
};

const renameReferenceItems = (
  resources: ReferenceResource[],
  docId: string,
  name: string,
) => resources.map((item) => (item.docId === docId ? { ...item, name } : item));

const upsertScopedDocNameEntries = (
  state: ResourceCenterState,
  scopeKey: string | null,
  items: Array<{ docId: string; name: string }>
) => {
  if (scopeKey) {
    const currentMap = state.docNameMapByScope[scopeKey] ?? {};
    const nextMap = { ...currentMap };
    items.forEach((item) => {
      const docId = item.docId?.trim();
      const name = item.name?.trim();
      if (!docId || !name) {
        return;
      }
      nextMap[docId] = name;
    });
    state.docNameMapByScope[scopeKey] = nextMap;
    if (buildReferenceScopeKey(state.currentContext) === scopeKey) {
      state.docNameMap = { ...nextMap };
    }
    return;
  }

  items.forEach((item) => {
    const docId = item.docId?.trim();
    const name = item.name?.trim();
    if (!docId || !name) {
      return;
    }
    state.docNameMap[docId] = name;
  });
};

const removeScopedDocName = (
  state: ResourceCenterState,
  scopeKey: string | null,
  docId: string
) => {
  const normalizedDocId = docId?.trim();
  if (!normalizedDocId) {
    return;
  }
  if (scopeKey) {
    const currentMap = state.docNameMapByScope[scopeKey];
    if (!currentMap || !(normalizedDocId in currentMap)) {
      return;
    }
    const nextMap = { ...currentMap };
    delete nextMap[normalizedDocId];
    state.docNameMapByScope[scopeKey] = nextMap;
    if (buildReferenceScopeKey(state.currentContext) === scopeKey) {
      state.docNameMap = { ...nextMap };
    }
    return;
  }

  delete state.docNameMap[normalizedDocId];
};

const clearScopedDocNames = (state: ResourceCenterState, scopeKey: string | null) => {
  if (scopeKey) {
    delete state.docNameMapByScope[scopeKey];
    if (buildReferenceScopeKey(state.currentContext) === scopeKey) {
      state.docNameMap = {};
    }
    return;
  }
  state.docNameMap = {};
};

const resourceCenterSlice = createSlice({
  name: 'resourceCenter',
  initialState,
  reducers: {
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.pageByTab = createInitialPageByTab();
    },
    setFileType(state, action: PayloadAction<ResourceFileTypeFilter>) {
      state.fileType = action.payload;
      state.pageByTab = createInitialPageByTab();
    },
    setSelectedTemplateTag(
      state,
      action: PayloadAction<{ tab: TemplateTagTab; tag: string | null }>
    ) {
      state.selectedTemplateTags[action.payload.tab] = action.payload.tag;
      state.pageByTab[action.payload.tab] = 1;
    },
    setSelectedTemplateSource(
      state,
      action: PayloadAction<{ tab: TemplateTagTab; source: string | null }>
    ) {
      state.selectedTemplateSources[action.payload.tab] = action.payload.source;
      state.pageByTab[action.payload.tab] = 1;
    },
    setPage(
      state,
      action: PayloadAction<{ tab: ResourceCenterTab; page: number }>
    ) {
      state.pageByTab[action.payload.tab] = action.payload.page;
    },
    setSize(state, action: PayloadAction<number>) {
      state.size = action.payload;
      state.pageByTab = createInitialPageByTab();
    },
    openImport(state) {
      state.isImportOpen = true;
      state.isImportUrlOpen = false;
      state.isImportTextOpen = false;
    },
    openImportUrl(state) {
      state.isImportUrlOpen = true;
      state.isImportOpen = false;
      state.isImportTextOpen = false;
    },
    openImportText(state) {
      state.isImportTextOpen = true;
      state.isImportOpen = false;
      state.isImportUrlOpen = false;
    },
    closeImport(state) {
      state.isImportOpen = false;
      state.isImportUrlOpen = false;
      state.isImportTextOpen = false;
    },
    setReferencedResources(state, action: PayloadAction<ReferenceStatePayload | ReferenceResource[]>) {
      const payload = Array.isArray(action.payload)
        ? { resources: action.payload }
        : action.payload;
      const scopeKey = resolveScopeKey(state, payload.context);
      setScopedReferences(state, scopeKey, payload.resources);
      upsertScopedDocNameEntries(
        state,
        scopeKey,
        payload.resources.map((item) => ({ docId: item.docId, name: item.name }))
      );
    },
    removeReferenceByDocId(state, action: PayloadAction<ReferenceDocIdPayload | string>) {
      const payload =
        typeof action.payload === 'string' ? { docId: action.payload } : action.payload;
      const scopeKey = resolveScopeKey(state, payload.context);
      const docId = payload.docId;
      const nextResources = getScopedReferences(state, scopeKey).filter(
        (item) => item.docId !== docId
      );
      setScopedReferences(state, scopeKey, nextResources);
      removeScopedDocName(state, scopeKey, payload.docId);
    },
    addReference(state, action: PayloadAction<AddReferencePayload | ReferenceResource>) {
      const payload =
        'reference' in action.payload ? action.payload : { reference: action.payload };
      const scopeKey = resolveScopeKey(state, payload.context);
      const currentResources = getScopedReferences(state, scopeKey);
      const exists = currentResources.some((item) => item.docId === payload.reference.docId);
      const nextResources = exists
        ? currentResources
        : [...currentResources, payload.reference];
      if (!exists) {
        setScopedReferences(state, scopeKey, nextResources);
      }
      upsertScopedDocNameEntries(state, scopeKey, [
        { docId: payload.reference.docId, name: payload.reference.name },
      ]);
    },
    toggleReference(
      state,
      action: PayloadAction<ToggleReferencePayload>
    ) {
      const { context, reference, nextIsReference } = action.payload;
      const scopeKey = resolveScopeKey(state, context);
      const currentResources = getScopedReferences(state, scopeKey);
      if (!nextIsReference) {
        setScopedReferences(
          state,
          scopeKey,
          currentResources.filter(
          (item) => item.docId !== reference.docId
          )
        );
        return;
      }

      const exists = currentResources.some((item) => item.docId === reference.docId);
      if (!exists) {
        setScopedReferences(state, scopeKey, [...currentResources, reference]);
      }
      upsertScopedDocNameEntries(state, scopeKey, [
        { docId: reference.docId, name: reference.name },
      ]);
    },
    upsertDocNames(
      state,
      action: PayloadAction<
        | Array<{ docId: string; name: string }>
        | {
            context?: ReferenceScopeContext;
            items: Array<{ docId: string; name: string }>;
          }
      >
    ) {
      const payload = Array.isArray(action.payload)
        ? { items: action.payload }
        : action.payload;
      upsertScopedDocNameEntries(
        state,
        resolveScopeKey(state, payload.context),
        payload.items
      );
    },
    renameReferenceResource(state, action: PayloadAction<RenameReferencePayload>) {
      const projectId = action.payload.projectId?.trim();
      const docId = action.payload.docId?.trim();
      const name = action.payload.name?.trim();
      if (!projectId || !docId || !name) {
        return;
      }
      Object.entries(state.referencedResourcesByContext).forEach(([scopeKey, resources]) => {
        if (!scopeKey.startsWith(`${projectId}::`)) {
          return;
        }
        state.referencedResourcesByContext[scopeKey] = renameReferenceItems(resources, docId, name);
      });
      if (state.currentContext.projectId === projectId) {
        state.referencedResources = renameReferenceItems(state.referencedResources, docId, name);
      }
      Object.keys(state.docNameMapByScope).forEach((scopeKey) => {
        if (!scopeKey.startsWith(`${projectId}::`)) {
          return;
        }
        upsertScopedDocNameEntries(state, scopeKey, [{ docId, name }]);
      });
      if (Object.keys(state.docNameMapByScope).length === 0) {
        state.docNameMap[docId] = name;
      }
    },
    clearDocNames(state, action: PayloadAction<ReferenceScopeContext | undefined>) {
      clearScopedDocNames(state, resolveScopeKey(state, action.payload));
    },
    clearReferences(state, action: PayloadAction<ReferenceScopeContext | undefined>) {
      const scopeKey = resolveScopeKey(state, action.payload);
      setScopedReferences(state, scopeKey, []);
    },
    requestAiPanelOpen(state) {
      state.aiPanelOpenToken = Date.now();
    },
    requestCitationJump(
      state,
      action: PayloadAction<{
        source: string;
        pageText: string;
        token?: number;
        sourceDetailTabKey?: string;
      }>
    ) {
      state.citationJump = {
        source: action.payload.source,
        pageText: action.payload.pageText,
        token: action.payload.token ?? Date.now(),
        sourceDetailTabKey: action.payload.sourceDetailTabKey,
      };
    },
    clearCitationJump(state) {
      state.citationJump = null;
    },
    requestVideoJump(
      state,
      action: PayloadAction<{
        docId: string;
        startSeconds: number;
        token?: number;
      }>
    ) {
      state.videoJumpRequest = {
        docId: action.payload.docId,
        startSeconds: action.payload.startSeconds,
        token: action.payload.token ?? Date.now(),
      };
    },
    clearVideoJumpRequest(
      state,
      action: PayloadAction<{ token?: number } | undefined>
    ) {
      if (!state.videoJumpRequest) {
        return;
      }
      if (action.payload?.token && state.videoJumpRequest.token !== action.payload.token) {
        return;
      }
      state.videoJumpRequest = null;
    },
    setCurrentContext(
      state,
      action: PayloadAction<{ projectId?: string; kbId?: string }>
    ) {
      state.currentContext = {
        projectId: normalizeContextId(action.payload.projectId),
        kbId: normalizeContextId(action.payload.kbId),
      };
      const scopeKey = buildReferenceScopeKey(state.currentContext);
      state.referencedResources = getScopedReferences(
        state,
        scopeKey
      );
      state.docNameMap = { ...getScopedDocNameMap(state, scopeKey) };
    },
    clearCurrentContext(state) {
      state.currentContext = {};
      state.referencedResources = [];
      state.docNameMap = {};
    },
  },
});

export const {
  setSearch,
  setFileType,
  setSelectedTemplateTag,
  setSelectedTemplateSource,
  setPage,
  setSize,
  openImport,
  openImportUrl,
  openImportText,
  closeImport,
  setReferencedResources,
  removeReferenceByDocId,
  addReference,
  toggleReference,
  upsertDocNames,
  clearDocNames,
  clearReferences,
  requestAiPanelOpen,
  requestCitationJump,
  clearCitationJump,
  requestVideoJump,
  clearVideoJumpRequest,
  setCurrentContext,
  clearCurrentContext,
  renameReferenceResource,
} = resourceCenterSlice.actions;

export default resourceCenterSlice.reducer;

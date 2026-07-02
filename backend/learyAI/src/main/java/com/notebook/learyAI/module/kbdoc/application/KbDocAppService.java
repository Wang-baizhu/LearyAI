// Responsibility: Facade for knowledge base document use cases.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.shared.storage.StsCredentials;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UrlImportResponse;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class KbDocAppService {
    private final KbDocUploadAppService uploadAppService;
    private final KbDocTaskAppService taskAppService;
    private final KbDocQueryAppService queryAppService;
    private final KbDocBindingAppService bindingAppService;
    private final KbDocMetadataAppService metadataAppService;

    public KbDocAppService(KbDocUploadAppService uploadAppService,
                           KbDocTaskAppService taskAppService,
                           KbDocQueryAppService queryAppService,
                           KbDocBindingAppService bindingAppService,
                           KbDocMetadataAppService metadataAppService) {
        this.uploadAppService = uploadAppService;
        this.taskAppService = taskAppService;
        this.queryAppService = queryAppService;
        this.bindingAppService = bindingAppService;
        this.metadataAppService = metadataAppService;
    }

    public UploadPrepareResult prepareUpload(String projectId, String kbId, String docId, String fileType, Long size,
                                             String hash, String purpose) {
        return uploadAppService.prepareUpload(projectId, kbId, docId, fileType, size, hash, purpose);
    }

    public UploadConfirmResult confirmUpload(String projectId, String docId, String objectKey, String etag, Long size,
                                             String name, String kbId) {
        return uploadAppService.confirmUpload(projectId, docId, objectKey, etag, size, name, kbId);
    }

    public UrlImportResponse importUrl(String projectId, String kbId, String url, String name) {
        return uploadAppService.importUrl(projectId, kbId, url, name);
    }

    public UrlImportResponse importText(String projectId, String kbId, String text, String name) {
        return uploadAppService.importText(projectId, kbId, text, name);
    }

    public java.util.List<String> listRecentIds(String projectId, Integer limit) {
        return queryAppService.listRecentIds(projectId, limit);
    }

    public KbDocPage list(String projectId, String search, String fileType, Integer page, Integer size, String kbId) {
        return queryAppService.list(projectId, search, fileType, page, size, kbId);
    }

    public java.util.List<KbDocOption> listDocOptions(String projectId, String search, String kbId) {
        return queryAppService.listDocOptions(projectId, search, kbId);
    }

    public StsCredentials issuePreviewCredentials(String projectId, String docId) {
        return uploadAppService.issuePreviewCredentials(projectId, docId);
    }

    public java.util.Map<String, String> loadLatestDocStatuses(String projectId, java.util.List<String> docIds) {
        return taskAppService.loadLatestDocStatuses(projectId, docIds);
    }

    public KbDoc getByDocId(String projectId, String docId) {
        return queryAppService.getByDocId(projectId, docId);
    }

    public KbDoc updateDetail(String projectId, String docId, String name, String description, Map<String, Object> documentation) {
        return metadataAppService.updateDetail(projectId, docId, name, description, documentation);
    }

    public KbDocTextChunkPage listTextChunks(String projectId, String docId, Integer startChunkSec, Integer size) {
        return queryAppService.listTextChunks(projectId, docId, startChunkSec, size);
    }

    public void deleteByDocId(String projectId, String docId) {
        bindingAppService.deleteByDocId(projectId, docId);
    }

    public void bindDoc(String projectId, String docId, String kbId) {
        bindingAppService.bindDoc(projectId, docId, kbId);
    }

    public void unbindDoc(String projectId, String docId, String kbId) {
        bindingAppService.unbindDoc(projectId, docId, kbId);
    }
}

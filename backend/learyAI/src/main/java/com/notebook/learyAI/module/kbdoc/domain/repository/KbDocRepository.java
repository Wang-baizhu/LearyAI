// Responsibility: Domain repository for knowledge base documents.
package com.notebook.learyAI.module.kbdoc.domain.repository;

import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunk;

import java.util.List;
import java.util.Optional;

public interface KbDocRepository {
    KbDoc save(KbDoc doc);

    Optional<KbDoc> findById(Long id, String projectId);

    Optional<KbDoc> findByDocId(String docId, String projectId);

    Optional<KbDoc> findByDocId(String docId);

    boolean existsByDocId(String docId, String projectId);

    KbDocPage search(String projectId, String search, String fileType, int page, int size, Long kbId);

    List<KbDocOption> findDocOptions(String projectId, String search, Long kbId);

    List<String> findRecentDocIds(String projectId, int limit);

    List<KbDocTextChunk> findTextChunksByDocInternalId(Long docInternalId, int startChunkSec, int limit);

    void deleteById(Long id, String projectId);

    void deleteByDocId(String docId, String projectId);

    void updateStatusByDocId(String projectId, String docId, String status);

    KbDoc updateDetailByDocId(String projectId, String docId, String name, String metadataRaw);
}

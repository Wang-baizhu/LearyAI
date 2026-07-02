// Responsibility: Domain repository for kb-doc relations.
package com.notebook.learyAI.module.kbdoc.domain.repository;

import com.notebook.learyAI.module.kbdoc.domain.model.KbDocRelation;

public interface KbDocRelationRepository {
    KbDocRelation save(KbDocRelation relation);

    boolean exists(String projectId, Long kbId, Long docId);

    long countByDocId(String projectId, Long docId);

    java.util.List<Long> findDocIdsByKbId(String projectId, Long kbId);

    java.util.List<Long> findKbIdsByDocId(String projectId, Long docId);

    void delete(String projectId, Long kbId, Long docId);

    void deleteByKbId(String projectId, Long kbId);

    void deleteByDocId(String projectId, Long docId);
}

// Responsibility: Knowledge base repository abstraction.
package com.notebook.learyAI.module.kb.domain.repository;

import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface KnowledgeBaseRepository {
    KnowledgeBase save(KnowledgeBase knowledgeBase);

    Optional<KnowledgeBase> findById(Long id, String projectId);

    Optional<KnowledgeBase> findByKbId(String kbId, String projectId);

    Optional<KnowledgeBase> findByKbId(String kbId);

    boolean existsByNameAndProjectId(String name, String projectId);

    KnowledgeBasePage search(String projectId, Long userId, boolean isMember, String search, String tag,
                             KnowledgeBaseSort sort, boolean desc, int page, int size);

    List<KnowledgeBase> findRecent(String projectId, Long userId, boolean isMember, int limit);

    KnowledgeBasePage findByOwnerId(Long ownerId, String search, int page, int size);

    List<KnowledgeBase> findByKbIds(String projectId, Long userId, boolean isMember, List<String> kbIds);

    List<Long> findIdsByProjectId(String projectId);

    void deleteById(Long id);

    void updateVisitedAt(Long id, Instant visitedAt);

    void updateCanvas(Long id, Map<String, Object> canvas);
}

// Responsibility: Provide knowledge base summaries for visit aggregation.
package com.notebook.learyAI.module.kb.application;

import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.visit.application.VisitResourceSummary;
import com.notebook.learyAI.module.visit.application.VisitResourceSummaryReader;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class KnowledgeBaseVisitSummaryReader implements VisitResourceSummaryReader {
    private final KnowledgeBaseRepository repository;
    private final KnowledgeBaseAccessSupport accessSupport;

    public KnowledgeBaseVisitSummaryReader(KnowledgeBaseRepository repository,
                                           KnowledgeBaseAccessSupport accessSupport) {
        this.repository = repository;
        this.accessSupport = accessSupport;
    }

    @Override
    public boolean supports(UserResourceType resourceType) {
        return resourceType == UserResourceType.KB;
    }

    @Override
    public Map<String, VisitResourceSummary> loadSummaries(Long userId, List<String> resourceIds) {
        if (resourceIds == null || resourceIds.isEmpty()) {
            return Map.of();
        }
        Map<String, VisitResourceSummary> summaries = new LinkedHashMap<>();
        for (String kbId : resourceIds) {
            repository.findByKbId(kbId).ifPresent(knowledgeBase -> addIfReadable(summaries, userId, knowledgeBase));
        }
        return summaries;
    }

    private void addIfReadable(Map<String, VisitResourceSummary> summaries, Long userId, KnowledgeBase knowledgeBase) {
        try {
            accessSupport.ensureAccess(knowledgeBase, userId);
        } catch (BizException ex) {
            return;
        }
        summaries.put(
                knowledgeBase.getKbId(),
                new VisitResourceSummary(
                        knowledgeBase.getName(),
                        knowledgeBase.getDescription(),
                        knowledgeBase.getProjectId(),
                        knowledgeBase.getKbId()
                )
        );
    }
}

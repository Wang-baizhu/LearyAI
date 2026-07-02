// Responsibility: Centralize knowledge base access rules.
package com.notebook.learyAI.module.kb.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

@Service
public class KnowledgeBaseAccessSupport {
    private final AuthzSdk authzSdk;

    public KnowledgeBaseAccessSupport(AuthzSdk authzSdk) {
        this.authzSdk = authzSdk;
    }

    public void ensureAccess(KnowledgeBase knowledgeBase, Long userId) {
        KnowledgeBaseVisibility visibility = knowledgeBase.getVisibility();
        if (visibility == KnowledgeBaseVisibility.PUBLIC) {
            return;
        }
        if (visibility == KnowledgeBaseVisibility.TEAM
                && authzSdk.isMember(userId, knowledgeBase.getProjectId())) {
            return;
        }
        if (visibility == KnowledgeBaseVisibility.PRIVATE && userId.equals(knowledgeBase.getOwnerId())) {
            return;
        }
        throw new BizException("KB-404", "knowledge base not found");
    }
}

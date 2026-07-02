// Responsibility: Encapsulate knowledge base domain rules and normalization.
package com.notebook.learyAI.module.kb.domain.service;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class KnowledgeBaseDomainService {
    private static final int MAX_NAME_LENGTH = 64;
    private static final int MAX_DESC_LENGTH = 512;

    public String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new BizException("KB-400", "name required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new BizException("KB-400", "name too long");
        }
        return trimmed;
    }

    public String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String trimmed = description.trim();
        if (trimmed.length() > MAX_DESC_LENGTH) {
            throw new BizException("KB-400", "description too long");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    public List<String> normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String tag : tags) {
            if (tag == null) {
                continue;
            }
            String trimmed = tag.trim();
            if (!trimmed.isEmpty()) {
                unique.add(trimmed);
            }
        }
        return new ArrayList<>(unique);
    }

    public void requireAdminOrOwner(ProjectRole role) {
        if (role != ProjectRole.ADMIN && role != ProjectRole.OWNER) {
            throw new BizException("KB-403", "permission denied");
        }
    }

    public void requireOwner(KnowledgeBase knowledgeBase, Long userId) {
        if (!userId.equals(knowledgeBase.getOwnerId())) {
            throw new BizException("KB-403", "permission denied");
        }
    }
}

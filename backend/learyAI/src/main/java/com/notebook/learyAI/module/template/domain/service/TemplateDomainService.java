// Responsibility: Centralize template domain rules and validations.
package com.notebook.learyAI.module.template.domain.service;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class TemplateDomainService {
    private static final int MAX_NAME_LENGTH = 128;

    public String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new BizException("TEMPLATE-400", "name required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new BizException("TEMPLATE-400", "name too long");
        }
        return trimmed;
    }

    public String normalizePluginId(String pluginId) {
        return normalizeUuid(pluginId, "pluginId required", "pluginId invalid");
    }

    public String normalizeOptionalPluginId(String pluginId) {
        String normalized = normalizeOptional(pluginId);
        if (normalized == null) {
            return null;
        }
        return normalizePluginId(normalized);
    }

    public String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            throw new BizException("TEMPLATE-400", "key required");
        }
        return key.trim();
    }

    public String normalizeContent(String content) {
        if (content == null || content.isBlank()) {
            throw new BizException("TEMPLATE-400", "content required");
        }
        return content;
    }

    public String normalizeValue(String value) {
        if (value == null || value.isBlank()) {
            throw new BizException("TEMPLATE-400", "value required");
        }
        return value;
    }

    public String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public String normalizeTemplateId(String templateId) {
        return normalizeUuid(templateId, "templateId required", "templateId invalid");
    }

    public String normalizeKbId(String kbId) {
        return normalizeUuid(kbId, "kbId required", "kbId invalid");
    }

    public void requireAdminOrOwner(ProjectRole role) {
        if (role != ProjectRole.ADMIN && role != ProjectRole.OWNER) {
            throw new BizException("TEMPLATE-403", "permission denied");
        }
    }

    public void requireOwner(ProjectRole role) {
        if (role != ProjectRole.OWNER) {
            throw new BizException("TEMPLATE-403", "permission denied");
        }
    }

    private String normalizeUuid(String value, String requiredMessage, String invalidMessage) {
        if (value == null || value.isBlank()) {
            throw new BizException("TEMPLATE-400", requiredMessage);
        }
        String trimmed = value.trim();
        try {
            return UUID.fromString(trimmed).toString();
        } catch (IllegalArgumentException ex) {
            throw new BizException("TEMPLATE-400", invalidMessage);
        }
    }
}

// Responsibility: Provide SSE endpoint for task status updates.
package com.notebook.learyAI.module.task.interfaces.controller;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.push.TenantPushRegistry;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class TaskSseController {
    private static final long SSE_TIMEOUT_MS = 60000L;

    private final TenantPushRegistry tenantPushRegistry;
    private final AuthzSdk authzSdk;

    public TaskSseController(TenantPushRegistry tenantPushRegistry,
                             AuthzSdk authzSdk) {
        this.tenantPushRegistry = tenantPushRegistry;
        this.authzSdk = authzSdk;
    }

    @GetMapping(value = "/sse/tasks", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@RequestParam String projectId,
                                @RequestParam String kbId,
                                @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        Long userId = authzSdk.requireUserId();
        String normalizedProjectId = authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
        String normalizedKbId = normalizeRequired(kbId, "kbId");
        try {
            authzSdk.requireRole(userId, normalizedProjectId, java.util.Set.of(
                    ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER));
        } catch (BizException ex) {
            if ("PROJECT-403".equals(ex.getCode())) {
                throw new BizException("KB-403", "project access denied");
            }
            throw ex;
        }
        Long lastRevision = parseRevision(lastEventId);
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        tenantPushRegistry.register(normalizedProjectId, normalizedKbId, userId, emitter, lastRevision);
        return emitter;
    }

    private Long parseRevision(String lastEventId) {
        if (lastEventId == null || lastEventId.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(lastEventId.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String normalizeRequired(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", name + " required");
        }
        return value.trim();
    }

}

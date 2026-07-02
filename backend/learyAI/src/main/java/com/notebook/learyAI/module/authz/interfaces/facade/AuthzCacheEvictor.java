// Responsibility: Expose authz cache invalidation operations for write-side modules.
package com.notebook.learyAI.module.authz.interfaces.facade;

import java.util.Collection;

public interface AuthzCacheEvictor {
    void evictProjectExists(String projectId);

    void evictRole(String projectId, Long userId);

    void evictRoles(String projectId, Collection<Long> userIds);

    void evictProjectRoles(String projectId);
}

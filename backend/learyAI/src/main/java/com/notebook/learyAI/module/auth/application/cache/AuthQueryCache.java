// Responsibility: Define cache contract for auth me query.
package com.notebook.learyAI.module.auth.application.cache;

import com.notebook.learyAI.module.auth.application.AuthUserSummary;

public interface AuthQueryCache {
    CachedValue<AuthUserSummary> getMe(long userId);

    void putMe(long userId, AuthUserSummary summary);

    void evictMe(long userId);
}

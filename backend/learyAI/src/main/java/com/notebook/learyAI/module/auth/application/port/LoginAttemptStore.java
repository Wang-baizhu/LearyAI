// Responsibility: Application port for tracking login failures.
package com.notebook.learyAI.module.auth.application.port;

import java.time.Duration;
import java.util.Optional;

public interface LoginAttemptStore {
    int incrementFailures(String key, Duration ttl);

    Optional<Integer> getFailures(String key);

    void resetFailures(String key);
}

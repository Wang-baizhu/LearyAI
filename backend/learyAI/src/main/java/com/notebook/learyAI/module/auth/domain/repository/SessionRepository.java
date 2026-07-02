// Responsibility: Domain repository port for session storage.
package com.notebook.learyAI.module.auth.domain.repository;

import com.notebook.learyAI.module.auth.domain.model.Session;

import java.util.Optional;

public interface SessionRepository {
    void save(Session session, long ttlSeconds);

    Optional<Session> findById(String sessionId);

    void deleteById(String sessionId);
}

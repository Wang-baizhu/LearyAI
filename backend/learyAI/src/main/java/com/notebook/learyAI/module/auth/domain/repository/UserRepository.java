// Responsibility: Domain repository port for user aggregate.
package com.notebook.learyAI.module.auth.domain.repository;

import com.notebook.learyAI.module.auth.domain.model.User;

import java.util.Optional;

public interface UserRepository {
    Optional<User> findByEmail(String email);

    Optional<User> findById(Long id);

    java.util.List<User> findByIds(java.util.List<Long> ids);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    User save(User user);
}

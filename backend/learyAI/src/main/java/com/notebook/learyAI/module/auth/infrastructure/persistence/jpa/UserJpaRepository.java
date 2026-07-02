// Responsibility: Spring Data JPA repository for UserPO.
package com.notebook.learyAI.module.auth.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.auth.infrastructure.persistence.po.UserPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<UserPO, Long> {
    Optional<UserPO> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);
}

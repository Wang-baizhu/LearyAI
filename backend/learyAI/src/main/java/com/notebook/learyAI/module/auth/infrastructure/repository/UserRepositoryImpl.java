// Responsibility: Implement user repository using JPA persistence.
package com.notebook.learyAI.module.auth.infrastructure.repository;

import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.auth.infrastructure.persistence.jpa.UserJpaRepository;
import com.notebook.learyAI.module.auth.infrastructure.persistence.po.UserPO;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserRepositoryImpl implements UserRepository {
    private final UserJpaRepository userJpaRepository;

    public UserRepositoryImpl(UserJpaRepository userJpaRepository) {
        this.userJpaRepository = userJpaRepository;
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return userJpaRepository.findByEmail(email).map(this::toDomain);
    }

    @Override
    public Optional<User> findById(Long id) {
        return userJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public java.util.List<User> findByIds(java.util.List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return java.util.List.of();
        }
        return userJpaRepository.findAllById(ids).stream().map(this::toDomain).toList();
    }

    @Override
    public boolean existsByEmail(String email) {
        return userJpaRepository.existsByEmail(email);
    }

    @Override
    public boolean existsByPhone(String phone) {
        return userJpaRepository.existsByPhone(phone);
    }

    @Override
    public User save(User user) {
        UserPO saved = userJpaRepository.save(toPo(user));
        return toDomain(saved);
    }

    private UserPO toPo(User user) {
        UserPO po = new UserPO();
        po.setId(user.getId());
        po.setName(user.getName());
        po.setEmail(user.getEmail());
        po.setPhone(user.getPhone());
        po.setPasswordHash(user.getPasswordHash());
        po.setStatus(user.getStatus());
        po.setUserMode(user.getUserMode());
        po.setCreatedAt(user.getCreatedAt());
        po.setLastLoginAt(user.getLastLoginAt());
        return po;
    }

    private User toDomain(UserPO po) {
        UserMode mode = po.getUserMode();
        if (mode == null) {
            mode = UserMode.FREE;
        }
        return new User(po.getId(), po.getName(), po.getEmail(), po.getPhone(), po.getPasswordHash(),
                po.getStatus(), mode, po.getCreatedAt(), po.getLastLoginAt());
    }
}

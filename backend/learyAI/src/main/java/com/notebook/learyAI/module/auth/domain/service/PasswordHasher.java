// Responsibility: Domain port for password hashing.
package com.notebook.learyAI.module.auth.domain.service;

public interface PasswordHasher {
    String hash(String rawPassword);

    boolean matches(String rawPassword, String hashedPassword);
}

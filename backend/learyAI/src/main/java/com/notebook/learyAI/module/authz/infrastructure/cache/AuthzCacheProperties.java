// Responsibility: Bind authz cache specific properties.
package com.notebook.learyAI.module.authz.infrastructure.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cache.authz")
public class AuthzCacheProperties {
    private long roleTtlSeconds = 60;
    private long projectExistsTtlSeconds = 120;
    private long roleNullTtlSeconds = 20;
    private long projectExistsNullTtlSeconds = 20;

    public long getRoleTtlSeconds() {
        return roleTtlSeconds;
    }

    public void setRoleTtlSeconds(long roleTtlSeconds) {
        this.roleTtlSeconds = roleTtlSeconds;
    }

    public long getProjectExistsTtlSeconds() {
        return projectExistsTtlSeconds;
    }

    public void setProjectExistsTtlSeconds(long projectExistsTtlSeconds) {
        this.projectExistsTtlSeconds = projectExistsTtlSeconds;
    }

    public long getRoleNullTtlSeconds() {
        return roleNullTtlSeconds;
    }

    public void setRoleNullTtlSeconds(long roleNullTtlSeconds) {
        this.roleNullTtlSeconds = roleNullTtlSeconds;
    }

    public long getProjectExistsNullTtlSeconds() {
        return projectExistsNullTtlSeconds;
    }

    public void setProjectExistsNullTtlSeconds(long projectExistsNullTtlSeconds) {
        this.projectExistsNullTtlSeconds = projectExistsNullTtlSeconds;
    }
}

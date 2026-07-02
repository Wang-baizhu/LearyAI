// Responsibility: Enforce platform admin access based on auth user mode.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

@Component
public class PlatformAdminGuard {

    public void requireAdmin() {
        Long userId = CurrentUserContext.getUserId();
        if (userId == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        if (CurrentUserContext.getUserMode() != UserMode.ADMIN) {
            throw new BizException("ADMIN_FORBIDDEN", "platform admin required");
        }
    }

    public boolean isAdmin() {
        return CurrentUserContext.getUserMode() == UserMode.ADMIN;
    }
}

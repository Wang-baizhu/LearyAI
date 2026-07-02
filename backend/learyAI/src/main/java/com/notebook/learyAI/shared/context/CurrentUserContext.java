// Responsibility: Store current user identity and mode for request scope.
package com.notebook.learyAI.shared.context;

import com.notebook.learyAI.module.auth.domain.model.UserMode;

public final class CurrentUserContext {
    private static final ThreadLocal<Long> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<UserMode> USER_MODE = new ThreadLocal<>();

    private CurrentUserContext() {
    }

    public static void setUserId(Long userId) {
        USER_ID.set(userId);
    }

    public static void setUserMode(UserMode userMode) {
        USER_MODE.set(userMode);
    }

    public static void set(Long userId, UserMode userMode) {
        USER_ID.set(userId);
        USER_MODE.set(userMode);
    }

    public static Long getUserId() {
        return USER_ID.get();
    }

    public static UserMode getUserMode() {
        return USER_MODE.get();
    }

    public static void clear() {
        USER_ID.remove();
        USER_MODE.remove();
    }
}

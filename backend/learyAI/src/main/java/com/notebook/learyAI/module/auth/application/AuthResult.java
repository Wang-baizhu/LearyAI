// Responsibility: Carry auth flow result for API layer.
package com.notebook.learyAI.module.auth.application;

public class AuthResult {
    private final AuthUserSummary user;
    private final SessionResult session;

    public AuthResult(AuthUserSummary user, SessionResult session) {
        this.user = user;
        this.session = session;
    }

    public AuthUserSummary getUser() {
        return user;
    }

    public SessionResult getSession() {
        return session;
    }
}

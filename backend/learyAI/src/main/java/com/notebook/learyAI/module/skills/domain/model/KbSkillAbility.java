// Responsibility: Define supported external kb skill abilities.
package com.notebook.learyAI.module.skills.domain.model;

import com.notebook.learyAI.shared.exception.BizException;

import java.util.Locale;

public enum KbSkillAbility {
    SEARCH("search");

    private final String claimValue;

    KbSkillAbility(String claimValue) {
        this.claimValue = claimValue;
    }

    public String getClaimValue() {
        return claimValue;
    }

    public static KbSkillAbility fromRaw(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BizException("KB_SKILL-400", "ability invalid");
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        for (KbSkillAbility value : values()) {
            if (value.claimValue.equals(normalized)) {
                return value;
            }
        }
        throw new BizException("KB_SKILL-400", "ability invalid");
    }
}

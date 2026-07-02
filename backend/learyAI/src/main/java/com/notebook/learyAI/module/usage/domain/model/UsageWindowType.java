// Responsibility: Enumerate supported rolling usage windows for read queries.
package com.notebook.learyAI.module.usage.domain.model;

import com.notebook.learyAI.shared.exception.BizException;

public enum UsageWindowType {
    LAST_24_HOURS("last_24_hours"),
    LAST_30_DAYS("last_30_days");

    private final String wireValue;

    UsageWindowType(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static UsageWindowType fromWireValue(String value) {
        if (value == null || value.isBlank()) {
            throw new BizException("USAGE-400", "windowType required");
        }
        String normalized = value.trim().toLowerCase();
        for (UsageWindowType item : values()) {
            if (item.wireValue.equals(normalized)) {
                return item;
            }
        }
        throw new BizException("USAGE-400", "windowType invalid");
    }
}

// Responsibility: Enumerate usage metrics/actions for quota checks.
package com.notebook.learyAI.module.usage.domain.model;

public enum UsageAction {
    DOC_UPLOAD_BYTES("doc_upload_bytes"),
    KBDOC_SIZE("kbdoc_size"),
    AI_CHAT_TOKENS("ai_chat_tokens"),
    TEMPLATE_GENERATE_COUNT("template_generate_count");

    private final String metric;

    UsageAction(String metric) {
        this.metric = metric;
    }

    public String metric() {
        return metric;
    }
}

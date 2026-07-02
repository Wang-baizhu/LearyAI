// Responsibility: Knowledge base document text chunk item payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

public class KbDocTextChunkItemResponse {
    private final Integer chunkSec;
    private final String text;

    public KbDocTextChunkItemResponse(Integer chunkSec, String text) {
        this.chunkSec = chunkSec;
        this.text = text;
    }

    public Integer getChunkSec() {
        return chunkSec;
    }

    public String getText() {
        return text;
    }
}

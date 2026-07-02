// Responsibility: Represent a text chunk segment for a knowledge base document.
package com.notebook.learyAI.module.kbdoc.domain.model;

public class KbDocTextChunk {
    private final Integer chunkSec;
    private final String text;

    public KbDocTextChunk(Integer chunkSec, String text) {
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

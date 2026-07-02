// Responsibility: Aggregate lightweight resources for resource center global canvas.
package com.notebook.learyAI.module.resourcecenter.interfaces.dto;

import java.util.List;

public class ResourceCenterOptionsResponse {
    private final List<ResourceCenterDocOptionResponse> docs;

    public ResourceCenterOptionsResponse(List<ResourceCenterDocOptionResponse> docs) {
        this.docs = docs == null ? List.of() : docs;
    }

    public List<ResourceCenterDocOptionResponse> getDocs() {
        return docs;
    }
}

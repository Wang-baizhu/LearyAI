// Responsibility: Compose lightweight resource center document options for the global canvas.
package com.notebook.learyAI.module.resourcecenter.application;

import com.notebook.learyAI.module.kbdoc.application.KbDocAppService;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.resourcecenter.interfaces.dto.ResourceCenterDocOptionResponse;
import com.notebook.learyAI.module.resourcecenter.interfaces.dto.ResourceCenterOptionsResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ResourceCenterOptionsAppService {
    private final KbDocAppService kbDocAppService;

    public ResourceCenterOptionsAppService(KbDocAppService kbDocAppService) {
        this.kbDocAppService = kbDocAppService;
    }

    public ResourceCenterOptionsResponse listOptions(String projectId, String kbId) {
        List<ResourceCenterDocOptionResponse> docs = kbDocAppService.listDocOptions(projectId, null, kbId)
                .stream()
                .map(this::toDocResponse)
                .toList();
        return new ResourceCenterOptionsResponse(docs);
    }

    private ResourceCenterDocOptionResponse toDocResponse(KbDocOption option) {
        return new ResourceCenterDocOptionResponse(option.getDocId(), option.getName(), option.getStatus());
    }

}

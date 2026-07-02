// Responsibility: Verify resource center aggregate controller contract mapping.
package com.notebook.learyAI.module.resourcecenter.interfaces.controller;

import com.notebook.learyAI.module.resourcecenter.application.ResourceCenterOptionsAppService;
import com.notebook.learyAI.module.resourcecenter.interfaces.dto.ResourceCenterDocOptionResponse;
import com.notebook.learyAI.module.resourcecenter.interfaces.dto.ResourceCenterOptionsResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResourceCenterControllerTest {
    @Mock
    private ResourceCenterOptionsAppService optionsAppService;

    @InjectMocks
    private ResourceCenterController controller;

    @Test
    @DisplayName("options 应返回文档轻量全集")
    void options_shouldReturnDocs() {
        ResourceCenterOptionsResponse payload = new ResourceCenterOptionsResponse(
                List.of(new ResourceCenterDocOptionResponse("doc-1", "文档", "DONE"))
        );
        when(optionsAppService.listOptions("project-1", "kb-1")).thenReturn(payload);

        ApiResponse<ResourceCenterOptionsResponse> response = controller.options("project-1", "kb-1");

        assertEquals("OK", response.getCode());
        assertEquals("doc-1", response.getData().getDocs().get(0).getDocId());
    }
}

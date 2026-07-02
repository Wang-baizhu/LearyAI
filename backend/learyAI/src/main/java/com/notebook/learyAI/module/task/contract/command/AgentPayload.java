// Responsibility: Define unified payload contract for task.command.agent.run messages.
package com.notebook.learyAI.module.task.contract.command;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AgentPayload(
        String typeId,
        @JsonProperty(required = true) @NotBlank String agentTaskType,
        String pluginId,
        Map<String, String> promptVars,
        List<@Valid TaskDocRef> docRefs,
        String extraInfo,
        String agentSessionId,
        String modelConfigType
) {
}

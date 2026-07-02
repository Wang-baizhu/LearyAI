// Responsibility: Define unified task.command.agent.run envelope contract.
package com.notebook.learyAI.module.task.contract.command;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AgentRunCommand(
        @JsonProperty(required = true) @NotBlank String messageId,
        @JsonProperty(required = true) @NotBlank String schemaVersion,
        @JsonProperty(required = true) @NotBlank String occurredAt,
        @JsonProperty(required = true) @NotBlank String traceId,
        @JsonProperty(required = true) @NotBlank String producer,
        String projectId,
        String kbId,
        Long userId,
        @JsonProperty(required = true) @NotNull Long taskRecordId,
        @JsonProperty(required = true) @NotBlank String taskType,
        Long parentTaskRecordId,
        @JsonProperty(required = true) @NotBlank String stageRunKey,
        @JsonProperty(required = true) @NotNull @Valid AgentPayload payload
) {
}

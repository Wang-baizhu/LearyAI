// Responsibility: Define reusable task command document reference contract.
package com.notebook.learyAI.module.task.contract.command;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskDocRef(
        @NotBlank String id,
        String name
) {
}

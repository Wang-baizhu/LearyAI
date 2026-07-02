// Responsibility: Keep the checked-in task.command.agent.run schema synchronized with Java contracts.
package com.notebook.learyAI.module.task.contract.command;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskAgentCommandSchemaExporterTest {
    @Test
    @DisplayName("exported schema should keep required fields and string map constraints")
    void exportAgentRunCommandSchema_shouldContainRequiredAndStringMapConstraints() {
        ObjectNode schema = TaskAgentCommandSchemaExporter.exportAgentRunCommandSchema();

        assertEquals(
                java.util.List.of("messageId", "schemaVersion", "occurredAt", "traceId", "producer",
                        "taskRecordId", "taskType", "stageRunKey", "payload"),
                java.util.stream.StreamSupport.stream(schema.withArray("required").spliterator(), false)
                        .map(node -> node.asText())
                        .toList()
        );
        assertEquals(
                "string",
                schema.path("$defs").path("Map(String,String)").path("additionalProperties").path("type").asText()
        );
        assertEquals(
                java.util.List.of("agentTaskType"),
                java.util.stream.StreamSupport.stream(
                                schema.path("$defs").path("AgentPayload").withArray("required").spliterator(),
                                false
                        )
                        .map(node -> node.asText())
                        .toList()
        );
    }

    @Test
    @DisplayName("task.command.agent.run schema snapshot should match exported contract schema")
    void exportAgentRunCommandSchema_shouldMatchSnapshot() throws Exception {
        Path schemaPath = Path.of("..", "..", "schema", "task", "task.command.agent.run.schema.json")
                .normalize()
                .toAbsolutePath();
        String expected = Files.readString(schemaPath);
        String actual = TaskAgentCommandSchemaExporter.exportAgentRunCommandSchemaText();

        assertEquals(expected, actual);
    }
}

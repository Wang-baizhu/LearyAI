// Responsibility: Export task.command.agent.run JSON schema from Java contract types.
package com.notebook.learyAI.module.task.contract.command;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.victools.jsonschema.generator.Option;
import com.github.victools.jsonschema.generator.OptionPreset;
import com.github.victools.jsonschema.generator.SchemaGenerator;
import com.github.victools.jsonschema.generator.SchemaGeneratorConfigBuilder;
import com.github.victools.jsonschema.generator.SchemaVersion;
import com.github.victools.jsonschema.module.jackson.JacksonModule;
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationModule;

public final class TaskAgentCommandSchemaExporter {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private TaskAgentCommandSchemaExporter() {
    }

    public static ObjectNode exportAgentRunCommandSchema() {
        SchemaGenerator generator = new SchemaGenerator(configBuilder().build());
        ObjectNode root = generator.generateSchema(AgentRunCommand.class);
        strengthenContractSchema(root);
        root.put("title", "task.command.agent.run");
        return root;
    }

    public static String exportAgentRunCommandSchemaText() {
        try {
            return OBJECT_MAPPER.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(exportAgentRunCommandSchema()) + System.lineSeparator();
        } catch (Exception ex) {
            throw new IllegalStateException("export task.command.agent.run schema failed", ex);
        }
    }

    public static void main(String[] args) {
        System.out.print(exportAgentRunCommandSchemaText());
    }

    private static SchemaGeneratorConfigBuilder configBuilder() {
        SchemaGeneratorConfigBuilder builder = new SchemaGeneratorConfigBuilder(
                SchemaVersion.DRAFT_2020_12,
                OptionPreset.PLAIN_JSON
        );
        builder.with(Option.DEFINITIONS_FOR_ALL_OBJECTS);
        builder.with(new JacksonModule());
        builder.with(new JakartaValidationModule());
        return builder;
    }

    private static void strengthenContractSchema(ObjectNode root) {
        requireFields(root, "messageId", "schemaVersion", "occurredAt", "traceId", "producer",
                "taskRecordId", "taskType", "stageRunKey", "payload");

        ObjectNode defs = objectNode(root.get("$defs"));
        requireFields(objectNode(defs.get("AgentPayload")), "agentTaskType");
        requireFields(objectNode(defs.get("TaskDocRef")), "id");

        ObjectNode stringMap = objectNode(defs.get("Map(String,String)"));
        stringMap.set("additionalProperties", JsonNodeFactory.instance.objectNode().put("type", "string"));
    }

    private static void requireFields(ObjectNode schema, String... fieldNames) {
        ArrayNode required = schema.putArray("required");
        for (String fieldName : fieldNames) {
            required.add(fieldName);
        }
    }

    private static ObjectNode objectNode(com.fasterxml.jackson.databind.JsonNode node) {
        if (!(node instanceof ObjectNode objectNode)) {
            throw new IllegalStateException("schema node missing or invalid");
        }
        return objectNode;
    }
}

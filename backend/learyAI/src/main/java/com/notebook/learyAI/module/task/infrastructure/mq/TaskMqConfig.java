// Responsibility: Configure RabbitMQ exchange and command/event queues with retry and DLQ bindings.
package com.notebook.learyAI.module.task.infrastructure.mq;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class TaskMqConfig {
    @Bean
    public TopicExchange taskExchange(@Value("${task.mq.exchange:task.exchange}") String exchangeName) {
        return new TopicExchange(exchangeName, true, false);
    }

    @Bean
    public Queue taskDocProcessQueue(@Value("${task.mq.command.doc.queue:task.doc.process.queue}") String queueName,
                                     @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                     @Value("${task.mq.command.doc.dlq-routing-key:task.command.doc.process.dlq}") String dlqRoutingKey) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", dlqRoutingKey);
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskDocProcessRetryQueue(@Value("${task.mq.command.doc.retry-queue:task.doc.process.retry.queue}") String queueName,
                                          @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                          @Value("${task.mq.command.doc.routing-key:task.command.doc.process}") String routingKey,
                                          @Value("${task.mq.command.doc.retry-delay-ms:5000}") long retryDelayMs) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", routingKey);
        arguments.put("x-message-ttl", Math.max(1000L, retryDelayMs));
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskDocProcessDlq(@Value("${task.mq.command.doc.dlq:task.doc.process.dlq}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding taskDocProcessBinding(@Qualifier("taskDocProcessQueue") Queue queue,
                                         TopicExchange taskExchange,
                                         @Value("${task.mq.command.doc.routing-key:task.command.doc.process}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskDocProcessRetryBinding(@Qualifier("taskDocProcessRetryQueue") Queue queue,
                                              TopicExchange taskExchange,
                                              @Value("${task.mq.command.doc.retry-routing-key:task.command.doc.process.retry}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskDocProcessDlqBinding(@Qualifier("taskDocProcessDlq") Queue queue,
                                            TopicExchange taskExchange,
                                            @Value("${task.mq.command.doc.dlq-routing-key:task.command.doc.process.dlq}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Queue taskAgentRunQueue(@Value("${task.mq.command.agent.queue:task.agent.run.queue}") String queueName,
                                   @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                   @Value("${task.mq.command.agent.dlq-routing-key:task.command.agent.run.dlq}") String dlqRoutingKey) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", dlqRoutingKey);
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskAgentRunRetryQueue(@Value("${task.mq.command.agent.retry-queue:task.agent.run.retry.queue}") String queueName,
                                        @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                        @Value("${task.mq.command.agent.routing-key:task.command.agent.run}") String routingKey,
                                        @Value("${task.mq.command.agent.retry-delay-ms:5000}") long retryDelayMs) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", routingKey);
        arguments.put("x-message-ttl", Math.max(1000L, retryDelayMs));
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskAgentRunDlq(@Value("${task.mq.command.agent.dlq:task.agent.run.dlq}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding taskAgentRunBinding(@Qualifier("taskAgentRunQueue") Queue queue,
                                       TopicExchange taskExchange,
                                       @Value("${task.mq.command.agent.routing-key:task.command.agent.run}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskAgentRunRetryBinding(@Qualifier("taskAgentRunRetryQueue") Queue queue,
                                            TopicExchange taskExchange,
                                            @Value("${task.mq.command.agent.retry-routing-key:task.command.agent.run.retry}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskAgentRunDlqBinding(@Qualifier("taskAgentRunDlq") Queue queue,
                                          TopicExchange taskExchange,
                                          @Value("${task.mq.command.agent.dlq-routing-key:task.command.agent.run.dlq}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Queue taskTemplatePluginPublishQueue(
            @Value("${task.mq.command.template-plugin.queue:task.template-plugin.publish.queue}") String queueName,
            @Value("${task.mq.exchange:task.exchange}") String exchangeName,
            @Value("${task.mq.command.template-plugin.dlq-routing-key:task.command.template-plugin.publish.dlq}") String dlqRoutingKey) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", dlqRoutingKey);
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskTemplatePluginPublishRetryQueue(
            @Value("${task.mq.command.template-plugin.retry-queue:task.template-plugin.publish.retry.queue}") String queueName,
            @Value("${task.mq.exchange:task.exchange}") String exchangeName,
            @Value("${task.mq.command.template-plugin.routing-key:task.command.template-plugin.publish}") String routingKey,
            @Value("${task.mq.command.template-plugin.retry-delay-ms:5000}") long retryDelayMs) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", routingKey);
        arguments.put("x-message-ttl", Math.max(1000L, retryDelayMs));
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskTemplatePluginPublishDlq(
            @Value("${task.mq.command.template-plugin.dlq:task.template-plugin.publish.dlq.queue}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding taskTemplatePluginPublishBinding(@Qualifier("taskTemplatePluginPublishQueue") Queue queue,
                                                    TopicExchange taskExchange,
                                                    @Value("${task.mq.command.template-plugin.routing-key:task.command.template-plugin.publish}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskTemplatePluginPublishRetryBinding(@Qualifier("taskTemplatePluginPublishRetryQueue") Queue queue,
                                                         TopicExchange taskExchange,
                                                         @Value("${task.mq.command.template-plugin.retry-routing-key:task.command.template-plugin.publish.retry}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskTemplatePluginPublishDlqBinding(@Qualifier("taskTemplatePluginPublishDlq") Queue queue,
                                                       TopicExchange taskExchange,
                                                       @Value("${task.mq.command.template-plugin.dlq-routing-key:task.command.template-plugin.publish.dlq}") String routingKey) {
        return BindingBuilder.bind(queue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Queue taskStatusQueue(@Value("${task.mq.event.status.queue:task.status.changed.queue}") String queueName,
                                 @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                 @Value("${task.mq.event.status.dlq-routing-key:task.event.status.changed.dlq}") String dlqRoutingKey) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", dlqRoutingKey);
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskStatusRetryQueue(@Value("${task.mq.event.status.retry-queue:task.status.changed.retry.queue}") String queueName,
                                      @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                      @Value("${task.mq.event.status.routing-key:task.event.status.changed}") String statusRoutingKey,
                                      @Value("${task.mq.event.status.retry-delay-ms:5000}") long retryDelayMs) {
        Map<String, Object> arguments = new HashMap<>();
        arguments.put("x-dead-letter-exchange", exchangeName);
        arguments.put("x-dead-letter-routing-key", statusRoutingKey);
        arguments.put("x-message-ttl", Math.max(1000L, retryDelayMs));
        return new Queue(queueName, true, false, false, arguments);
    }

    @Bean
    public Queue taskStatusDlq(@Value("${task.mq.event.status.dlq:task.status.changed.dlq}") String queueName) {
        return new Queue(queueName, true);
    }

    @Bean
    public Binding taskStatusBinding(@Qualifier("taskStatusQueue") Queue taskStatusQueue,
                                     TopicExchange taskExchange,
                                     @Value("${task.mq.event.status.routing-key:task.event.status.changed}") String routingKey) {
        return BindingBuilder.bind(taskStatusQueue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskStatusRetryBinding(@Qualifier("taskStatusRetryQueue") Queue taskStatusRetryQueue,
                                          TopicExchange taskExchange,
                                          @Value("${task.mq.event.status.retry-routing-key:task.event.status.changed.retry}") String routingKey) {
        return BindingBuilder.bind(taskStatusRetryQueue).to(taskExchange).with(routingKey);
    }

    @Bean
    public Binding taskStatusDlqBinding(@Qualifier("taskStatusDlq") Queue taskStatusDlq,
                                        TopicExchange taskExchange,
                                        @Value("${task.mq.event.status.dlq-routing-key:task.event.status.changed.dlq}") String routingKey) {
        return BindingBuilder.bind(taskStatusDlq).to(taskExchange).with(routingKey);
    }
}

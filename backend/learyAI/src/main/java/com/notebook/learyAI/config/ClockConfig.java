// Responsibility: Provide a shared UTC clock for time-sensitive business logic.
package com.notebook.learyAI.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    @Bean
    public Clock systemClock() {
        return Clock.systemUTC();
    }
}

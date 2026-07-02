// Responsibility: Application entry point and Spring Boot bootstrap.
package com.notebook.learyAI;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LearyAiApplication {

	public static void main(String[] args) {
		SpringApplication.run(LearyAiApplication.class, args);
	}

} 

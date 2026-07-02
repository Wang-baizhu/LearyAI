// Responsibility: Bind CORS-related configuration properties.
package com.notebook.learyAI.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "cors")
public class CorsProperties {
    private List<String> allowedOriginPatterns = new ArrayList<>();

    public List<String> getAllowedOriginPatterns() {
        return allowedOriginPatterns;
    }

    public void setAllowedOriginPatterns(List<String> allowedOriginPatterns) {
        this.allowedOriginPatterns = allowedOriginPatterns;
    }

    public String[] allowedOriginPatternsArray() {
        return allowedOriginPatterns.toArray(new String[0]);
    }

    public List<String> allowedMethods() {
        return List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
    }
}

// Responsibility: Map exceptions to ApiResponse consistently.
package com.notebook.learyAI.shared.exception;

import com.notebook.learyAI.shared.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BizException.class)
    public ResponseEntity<ApiResponse<Void>> handleBizException(BizException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        if ("UNAUTHORIZED".equals(ex.getCode())) {
            status = HttpStatus.UNAUTHORIZED;
        }
        if ("SESSION_INVALID".equals(ex.getCode())) {
            status = HttpStatus.FORBIDDEN;
        }
        if ("ADMIN_FORBIDDEN".equals(ex.getCode())) {
            status = HttpStatus.FORBIDDEN;
        }
        if (isSseRequest(request)) {
            LOGGER.warn("SSE request failed: {}", ex.getMessage(), ex);
            return ResponseEntity.status(status).build();
        }
        return ResponseEntity.status(status)
                .body(ApiResponse.error(ex.getCode(), ex.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<ApiResponse<Void>> handleValidation(Exception ex, HttpServletRequest request) {
        if (isSseRequest(request)) {
            LOGGER.warn("SSE validation failed: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION_ERROR", "invalid request"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex, HttpServletRequest request) {
        if (isSseRequest(request)) {
            if (ex instanceof AsyncRequestTimeoutException) {
                LOGGER.debug("SSE request timeout: {}", ex.getMessage());
            } else {
                LOGGER.error("SSE request error: {}", ex.getMessage(), ex);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        LOGGER.error("Request error: {} {}", request == null ? "" : request.getMethod(),
                request == null ? "" : request.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "internal error"));
    }

    private boolean isSseRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String accept = request.getHeader("Accept");
        if (accept != null && accept.contains("text/event-stream")) {
            return true;
        }
        String uri = request.getRequestURI();
        return uri != null && uri.startsWith("/sse/");
    }
}

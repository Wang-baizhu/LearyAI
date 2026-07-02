// Responsibility: Provide stubbed MinIO storage behaviors for local testing.
package com.notebook.learyAI.shared.storage;

import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(prefix = "kb.storage", name = "provider", havingValue = "minio-stub", matchIfMissing = true)
public class MinioStubStorageClient implements StorageClient {
    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    private final String uploadUrl;
    private final String publicBaseUrl;

    public MinioStubStorageClient(
            @Value("${kb.storage.upload-url:http://localhost:9000/upload}") String uploadUrl,
            @Value("${kb.storage.public-base-url:http://localhost:9000}") String publicBaseUrl) {
        this.uploadUrl = uploadUrl;
        this.publicBaseUrl = publicBaseUrl;
    }

    @Override
    public UploadPolicy createUploadPolicy(String objectKey, long size, String contentType) {
        return new UploadPolicy(
                "minio-stub",
                uploadUrl,
                "PUT",
                Collections.emptyMap(),
                Collections.emptyMap(),
                Instant.now().plusSeconds(3600)
        );
    }

    @Override
    public void verifyObject(String objectKey, Long size, String etag) {
        byte[] bytes = objects.get(normalizeObjectKey(objectKey));
        if (bytes == null) {
            throw new BizException("KB-404", "object not found");
        }
        if (size != null && size > 0 && bytes.length != size) {
            throw new BizException("KB-400", "object size mismatch");
        }
        if (etag != null && !etag.isBlank()) {
            String actual = normalizeEtag(md5Hex(bytes));
            String expected = normalizeEtag(etag);
            if (actual != null && !actual.equals(expected)) {
                throw new BizException("KB-400", "object etag mismatch");
            }
        }
    }

    @Override
    public void uploadObject(String objectKey, InputStream inputStream, long size, String contentType) {
        try {
            objects.put(normalizeObjectKey(objectKey), inputStream.readAllBytes());
        } catch (IOException ex) {
            throw new IllegalStateException("stub object upload failed", ex);
        }
    }

    @Override
    public byte[] readObject(String objectKey) {
        byte[] bytes = objects.get(normalizeObjectKey(objectKey));
        if (bytes == null) {
            throw new com.notebook.learyAI.shared.exception.BizException("KB-404", "object not found");
        }
        return bytes;
    }

    @Override
    public String buildObjectUrl(String objectKey) {
        String trimmed = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;
        if (objectKey == null || objectKey.isBlank()) {
            return trimmed;
        }
        if (objectKey.startsWith("/")) {
            return trimmed + objectKey;
        }
        return trimmed + "/" + objectKey;
    }

    @Override
    public TemporaryUrl createTemporaryUrl(String objectKey, TemporaryUrlPurpose purpose) {
        Instant expiresAt = Instant.now().plusSeconds(3600);
        String baseUrl;
        if (purpose == TemporaryUrlPurpose.UPLOAD) {
            baseUrl = uploadUrl;
        } else {
            baseUrl = buildObjectUrl(objectKey);
        }
        String url = baseUrl + (baseUrl.contains("?") ? "&" : "?") + "temp=true";
        return new TemporaryUrl(url, expiresAt);
    }

    @Override
    public StsCredentials issueStsCredentials(String prefix, long durationSeconds) {
        String normalizedPrefix = normalizePrefix(prefix);
        long safeDuration = durationSeconds <= 0 ? 3600 : durationSeconds;
        Instant expiresAt = Instant.now().plusSeconds(safeDuration);
        return new StsCredentials(
                "minio-stub",
                "stub-access-key",
                "stub-secret-key",
                "stub-session-token",
                expiresAt,
                publicBaseUrl,
                "kb-docs",
                normalizedPrefix
        );
    }

    @Override
    public void deletePrefix(String prefix) {
        String normalizedPrefix = normalizePrefix(prefix);
        objects.keySet().removeIf(key -> key.startsWith(normalizedPrefix));
    }

    private String normalizeObjectKey(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new IllegalArgumentException("objectKey required");
        }
        return objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
    }

    private String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return "kb/docs/";
        }
        String trimmed = prefix.trim();
        if (trimmed.startsWith("/")) {
            trimmed = trimmed.substring(1);
        }
        if (!trimmed.endsWith("/")) {
            trimmed = trimmed + "/";
        }
        return trimmed;
    }

    private String normalizeEtag(String etag) {
        if (etag == null || etag.isBlank()) {
            return null;
        }
        String normalized = etag.trim();
        if (normalized.startsWith("\"") && normalized.endsWith("\"") && normalized.length() > 1) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return normalized;
    }

    private String md5Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(bytes);
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte value : hash) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("md5 unavailable", ex);
        }
    }
}

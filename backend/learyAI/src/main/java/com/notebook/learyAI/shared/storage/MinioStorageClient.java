// Responsibility: Provide MinIO storage behaviors with presigned URL support.
package com.notebook.learyAI.shared.storage;

import com.notebook.learyAI.shared.exception.BizException;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
import io.minio.credentials.AssumeRoleProvider;
import io.minio.credentials.Credentials;
import io.minio.http.Method;
import io.minio.messages.Item;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Instant;
import java.util.Collections;

@Component
@ConditionalOnProperty(prefix = "kb.storage", name = "provider", havingValue = "minio")
public class MinioStorageClient implements StorageClient {
    private static final Logger log = LoggerFactory.getLogger(MinioStorageClient.class);

    private final MinioClient minioClient;
    private final String bucket;
    private final long presignExpireSeconds;
    private final String endpoint;
    private final String accessKey;
    private final String secretKey;
    private final String region;
    private final String roleArn;
    private final String roleSessionName;
    private final String externalId;

    public MinioStorageClient(
            @Value("${kb.storage.minio.endpoint:http://localhost:9000}") String endpoint,
            @Value("${kb.storage.minio.access-key:minioadmin}") String accessKey,
            @Value("${kb.storage.minio.secret-key:minioadmin}") String secretKey,
            @Value("${kb.storage.minio.bucket:kb-docs}") String bucket,
            @Value("${kb.storage.minio.presign-expire-seconds:3600}") long presignExpireSeconds,
            @Value("${kb.storage.minio.region:}") String region,
            @Value("${kb.storage.minio.sts-role-arn:}") String roleArn,
            @Value("${kb.storage.minio.sts-role-session-name:kb-docs}") String roleSessionName,
            @Value("${kb.storage.minio.sts-external-id:}") String externalId) {
        this.endpoint = endpoint;
        this.bucket = bucket;
        this.presignExpireSeconds = presignExpireSeconds;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.region = normalizeOptional(region);
        this.roleArn = normalizeOptional(roleArn);
        this.roleSessionName = normalizeOptional(roleSessionName);
        this.externalId = normalizeOptional(externalId);
        this.minioClient = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    @Override
    public UploadPolicy createUploadPolicy(String objectKey, long size, String contentType) {
        String url = presignUrl(objectKey, Method.PUT, TemporaryUrlPurpose.UPLOAD);
        Instant expiresAt = Instant.now().plusSeconds(presignExpireSeconds);
        return new UploadPolicy(
                "minio",
                url,
                "PUT",
                Collections.emptyMap(),
                Collections.emptyMap(),
                expiresAt
        );
    }

    @Override
    public void verifyObject(String objectKey, Long size, String etag) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder().bucket(bucket).object(objectKey).build());
            if (size != null && stat.size() != size) {
                log.warn("KB size mismatch: objectKey={}, expectedSize={}, actualSize={}",
                        objectKey, size, stat.size());
                throw new BizException("KB-400", "object size mismatch");
            }
            if (etag != null && !etag.isBlank()) {
                String expected = normalizeEtag(etag);
                String actual = normalizeEtag(stat.etag());
                if (actual != null && !actual.equals(expected)) {
                    log.warn("KB etag mismatch: objectKey={}, expectedEtag={}, actualEtag={}",
                            objectKey, expected, actual);
                    throw new BizException("KB-400", "object etag mismatch");
                }
            }
        } catch (BizException ex) {
            throw ex;
        } catch (ErrorResponseException ex) {
            if (ex.errorResponse() != null && "NoSuchKey".equalsIgnoreCase(ex.errorResponse().code())) {
                throw new BizException("KB-404", "object not found");
            }
            log.error("MinIO object verify failed: bucket={}, objectKey={}, expectedSize={}, etagPresent={}",
                    bucket, objectKey, size, etag != null && !etag.isBlank(), ex);
            throw new BizException("KB-500", "object verify failed");
        } catch (Exception ex) {
            log.error("MinIO object verify failed: bucket={}, objectKey={}, expectedSize={}, etagPresent={}",
                    bucket, objectKey, size, etag != null && !etag.isBlank(), ex);
            throw new BizException("KB-500", "object verify failed");
        }
    }

    @Override
    public void uploadObject(String objectKey, InputStream inputStream, long size, String contentType) {
        try {
            io.minio.PutObjectArgs.Builder builder = io.minio.PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(inputStream, size, -1);
            if (contentType != null && !contentType.isBlank()) {
                builder.contentType(contentType.trim());
            }
            minioClient.putObject(builder.build());
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("MinIO object upload failed: bucket={}, objectKey={}, size={}", bucket, objectKey, size, ex);
            throw new BizException("KB-500", "object upload failed");
        }
    }

    @Override
    public byte[] readObject(String objectKey) {
        try (InputStream inputStream = minioClient.getObject(
                io.minio.GetObjectArgs.builder().bucket(bucket).object(objectKey).build())) {
            return inputStream.readAllBytes();
        } catch (BizException ex) {
            throw ex;
        } catch (io.minio.errors.ErrorResponseException ex) {
            if (ex.errorResponse() != null && "NoSuchKey".equalsIgnoreCase(ex.errorResponse().code())) {
                throw new BizException("KB-404", "object not found");
            }
            throw new BizException("KB-500", "object read failed");
        } catch (Exception ex) {
            log.error("MinIO object read failed: bucket={}, objectKey={}", bucket, objectKey, ex);
            throw new BizException("KB-500", "object read failed");
        }
    }

    @Override
    public String buildObjectUrl(String objectKey) {
        String trimmed = endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
        String prefix = trimmed + "/" + bucket;
        if (objectKey == null || objectKey.isBlank()) {
            return prefix;
        }
        if (objectKey.startsWith("/")) {
            return prefix + objectKey;
        }
        return prefix + "/" + objectKey;
    }

    @Override
    public TemporaryUrl createTemporaryUrl(String objectKey, TemporaryUrlPurpose purpose) {
        Method method = purpose == TemporaryUrlPurpose.UPLOAD ? Method.PUT : Method.GET;
        String url = presignUrl(objectKey, method, purpose);
        return new TemporaryUrl(url, Instant.now().plusSeconds(presignExpireSeconds));
    }

    @Override
    public StsCredentials issueStsCredentials(String prefix, long durationSeconds) {
        String normalizedPrefix = normalizePrefix(prefix);
        int safeDuration = resolveDurationSeconds(durationSeconds);
        String policy = buildReadOnlyPolicy(normalizedPrefix);
        try {
            AssumeRoleProvider provider = new AssumeRoleProvider(
                    endpoint,
                    accessKey,
                    secretKey,
                    safeDuration,
                    policy,
                    region,
                    roleArn,
                    roleSessionName,
                    externalId,
                    null
            );
            Credentials credentials = provider.fetch();
            Instant expiresAt = Instant.now().plusSeconds(safeDuration);
            return new StsCredentials("minio", credentials.accessKey(), credentials.secretKey(),
                    credentials.sessionToken(), expiresAt, endpoint, bucket, normalizedPrefix);
        } catch (Exception ex) {
            throw new BizException("KB-500", "sts credentials issue failed");
        }
    }

    @Override
    public void deletePrefix(String prefix) {
        String normalizedPrefix = normalizePrefix(prefix);
        try {
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(bucket)
                            .prefix(normalizedPrefix)
                            .recursive(true)
                            .build());
            for (Result<Item> result : results) {
                Item item = result.get();
                minioClient.removeObject(RemoveObjectArgs.builder()
                        .bucket(bucket)
                        .object(item.objectName())
                        .build());
            }
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException("KB-500", "object delete failed");
        }
    }

    private String presignUrl(String objectKey, Method method, TemporaryUrlPurpose purpose) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new BizException("KB-400", "objectKey required");
        }
        try {
            GetPresignedObjectUrlArgs.Builder builder = GetPresignedObjectUrlArgs.builder()
                    .method(method)
                    .bucket(bucket)
                    .object(objectKey)
                    .expiry((int) presignExpireSeconds);
            if (method == Method.GET && purpose != TemporaryUrlPurpose.UPLOAD) {
                builder.extraQueryParams(responseQueryParams(objectKey, purpose));
            }
            return minioClient.getPresignedObjectUrl(builder.build());
        } catch (Exception ex) {
            throw new BizException("KB-500", "presign url failed");
        }
    }

    private java.util.Map<String, String> responseQueryParams(String objectKey, TemporaryUrlPurpose purpose) {
        java.util.Map<String, String> params = new java.util.HashMap<>();
        params.put("response-content-disposition", contentDisposition(objectKey, purpose));
        String contentType = guessContentType(objectKey);
        if (contentType != null) {
            params.put("response-content-type", contentType);
        }
        return params;
    }

    private String contentDisposition(String objectKey, TemporaryUrlPurpose purpose) {
        if (purpose == TemporaryUrlPurpose.PREVIEW) {
            return "inline";
        }
        if (purpose == TemporaryUrlPurpose.DOWNLOAD) {
            return "attachment; filename=\"" + extractFileName(objectKey) + "\"";
        }
        throw new BizException("KB-400", "temporary url purpose invalid");
    }

    private String extractFileName(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return "download.bin";
        }
        int separator = objectKey.lastIndexOf('/');
        if (separator < 0 || separator == objectKey.length() - 1) {
            return objectKey;
        }
        return objectKey.substring(separator + 1);
    }

    private String guessContentType(String objectKey) {
        if (objectKey == null) {
            return null;
        }
        String lower = objectKey.toLowerCase();
        if (lower.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        return null;
    }

    private String normalizeEtag(String etag) {
        if (etag == null) {
            return null;
        }
        String trimmed = etag.trim();
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() >= 2) {
            return trimmed.substring(1, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            throw new BizException("KB-400", "prefix required");
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

    private int resolveDurationSeconds(long durationSeconds) {
        if (durationSeconds <= 0) {
            return 3600;
        }
        if (durationSeconds > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) durationSeconds;
    }

    private String buildReadOnlyPolicy(String prefix) {
        String resource = "arn:aws:s3:::" + bucket + "/" + prefix + "*";
        return "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\"],"
                + "\"Resource\":[\"" + resource + "\"]}]}";
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

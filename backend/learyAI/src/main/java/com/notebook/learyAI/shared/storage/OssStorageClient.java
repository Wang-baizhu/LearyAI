// Responsibility: Provide Aliyun OSS storage behaviors with presigned URL and STS support.
package com.notebook.learyAI.shared.storage;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.ListObjectsRequest;
import com.aliyun.oss.model.ObjectListing;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.OSSObjectSummary;
import com.aliyun.oss.model.ResponseHeaderOverrides;
import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.profile.DefaultProfile;
import com.aliyuncs.profile.IClientProfile;
import com.aliyuncs.sts.model.v20150401.AssumeRoleRequest;
import com.aliyuncs.sts.model.v20150401.AssumeRoleResponse;
import com.notebook.learyAI.shared.exception.BizException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
@ConditionalOnProperty(prefix = "kb.storage", name = "provider", havingValue = "oss")
public class OssStorageClient implements StorageClient {
    private static final Logger log = LoggerFactory.getLogger(OssStorageClient.class);

    private final OSS ossClient;
    private final String endpoint;
    private final String accessKeyId;
    private final String accessKeySecret;
    private final String bucket;
    private final String region;
    private final long presignExpireSeconds;
    private final String roleArn;
    private final String roleSessionName;
    private final String externalId;
    private final String stsEndpoint;

    public OssStorageClient(
            @Value("${kb.storage.oss.endpoint:}") String endpoint,
            @Value("${kb.storage.oss.access-key-id:}") String accessKeyId,
            @Value("${kb.storage.oss.access-key-secret:}") String accessKeySecret,
            @Value("${kb.storage.oss.bucket:}") String bucket,
            @Value("${kb.storage.oss.region:cn-hangzhou}") String region,
            @Value("${kb.storage.oss.presign-expire-seconds:3600}") long presignExpireSeconds,
            @Value("${kb.storage.oss.role-arn:}") String roleArn,
            @Value("${kb.storage.oss.role-session-name:kb-docs}") String roleSessionName,
            @Value("${kb.storage.oss.external-id:}") String externalId,
            @Value("${kb.storage.oss.sts-endpoint:sts.aliyuncs.com}") String stsEndpoint) {
        this.endpoint = normalizeRequired(endpoint, "kb.storage.oss.endpoint");
        this.accessKeyId = normalizeRequired(accessKeyId, "kb.storage.oss.access-key-id");
        this.accessKeySecret = normalizeRequired(accessKeySecret, "kb.storage.oss.access-key-secret");
        this.bucket = normalizeRequired(bucket, "kb.storage.oss.bucket");
        this.region = normalizeOptional(region) == null ? "cn-hangzhou" : normalizeOptional(region);
        this.presignExpireSeconds = presignExpireSeconds <= 0 ? 3600 : presignExpireSeconds;
        this.roleArn = normalizeOptional(roleArn);
        this.roleSessionName = normalizeOptional(roleSessionName) == null ? "kb-docs" : normalizeOptional(roleSessionName);
        this.externalId = normalizeOptional(externalId);
        this.stsEndpoint = normalizeOptional(stsEndpoint) == null ? "sts.aliyuncs.com" : normalizeOptional(stsEndpoint);
        this.ossClient = new OSSClientBuilder().build(this.endpoint, this.accessKeyId, this.accessKeySecret);
    }

    @Override
    public UploadPolicy createUploadPolicy(String objectKey, long size, String contentType) {
        String normalizedKey = normalizeObjectKey(objectKey);
        String resolvedContentType = normalizeOptional(contentType);
        Instant expiresAt = Instant.now().plusSeconds(presignExpireSeconds);
        GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucket, normalizedKey, HttpMethod.PUT);
        request.setExpiration(Date.from(expiresAt));
        if (resolvedContentType != null) {
            request.setContentType(resolvedContentType);
        }
        URL url;
        try {
            url = ossClient.generatePresignedUrl(request);
        } catch (OSSException | ClientException ex) {
            throw new BizException("KB-500", "presign url failed");
        }
        Map<String, String> headers = new HashMap<>();
        if (resolvedContentType != null) {
            headers.put("Content-Type", resolvedContentType);
        }
        return new UploadPolicy("oss", url.toString(), "PUT", headers, Collections.emptyMap(), expiresAt);
    }

    @Override
    public void verifyObject(String objectKey, Long size, String etag) {
        String normalizedKey = normalizeObjectKey(objectKey);
        try {
            ObjectMetadata metadata = ossClient.getObjectMetadata(bucket, normalizedKey);
            if (size != null && size > 0 && metadata.getContentLength() != size) {
                log.warn("OSS object size mismatch: bucket={}, objectKey={}, expectedSize={}, actualSize={}",
                        bucket, normalizedKey, size, metadata.getContentLength());
                throw new BizException("KB-400", "object size mismatch");
            }
            if (etag != null && !etag.isBlank()) {
                String actual = normalizeEtag(metadata.getETag());
                String expected = normalizeEtag(etag);
                if (actual != null && !actual.equals(expected)) {
                    log.warn("OSS object etag mismatch: bucket={}, objectKey={}, expectedEtag={}, actualEtag={}",
                            bucket, normalizedKey, expected, actual);
                    throw new BizException("KB-400", "object etag mismatch");
                }
            }
        } catch (BizException ex) {
            throw ex;
        } catch (OSSException ex) {
            if ("NoSuchKey".equalsIgnoreCase(ex.getErrorCode())
                    || "NoSuchBucket".equalsIgnoreCase(ex.getErrorCode())) {
                throw new BizException("KB-404", "object not found");
            }
            log.error("OSS object verify failed: endpoint={}, bucket={}, objectKey={}, expectedSize={}, etagPresent={}",
                    endpoint, bucket, normalizedKey, size, etag != null && !etag.isBlank(), ex);
            throw new BizException("KB-500", "object verify failed");
        } catch (ClientException ex) {
            log.error("OSS object verify failed: endpoint={}, bucket={}, objectKey={}, expectedSize={}, etagPresent={}",
                    endpoint, bucket, normalizedKey, size, etag != null && !etag.isBlank(), ex);
            throw new BizException("KB-500", "object verify failed");
        }
    }

    @Override
    public void uploadObject(String objectKey, InputStream inputStream, long size, String contentType) {
        String normalizedKey = normalizeObjectKey(objectKey);
        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(size);
            String resolvedContentType = normalizeOptional(contentType);
            if (resolvedContentType != null) {
                metadata.setContentType(resolvedContentType);
            }
            ossClient.putObject(bucket, normalizedKey, inputStream, metadata);
        } catch (OSSException | ClientException ex) {
            throw new BizException("KB-500", "object upload failed");
        }
    }

    @Override
    public byte[] readObject(String objectKey) {
        String normalizedKey = normalizeObjectKey(objectKey);
        try (InputStream inputStream = ossClient.getObject(bucket, normalizedKey).getObjectContent()) {
            return inputStream.readAllBytes();
        } catch (BizException ex) {
            throw ex;
        } catch (OSSException ex) {
            if ("NoSuchKey".equalsIgnoreCase(ex.getErrorCode())) {
                throw new BizException("KB-404", "object not found");
            }
            throw new BizException("KB-500", "object read failed");
        } catch (ClientException ex) {
            throw new BizException("KB-500", "object read failed");
        } catch (Exception ex) {
            throw new BizException("KB-500", "object read failed");
        }
    }

    @Override
    public String buildObjectUrl(String objectKey) {
        String baseUrl = buildBucketBaseUrl();
        if (objectKey == null || objectKey.isBlank()) {
            return baseUrl;
        }
        String normalized = normalizeObjectKey(objectKey);
        return baseUrl + "/" + normalized;
    }

    @Override
    public TemporaryUrl createTemporaryUrl(String objectKey, TemporaryUrlPurpose purpose) {
        String normalizedKey = normalizeObjectKey(objectKey);
        HttpMethod method = purpose == TemporaryUrlPurpose.UPLOAD ? HttpMethod.PUT : HttpMethod.GET;
        Instant expiresAt = Instant.now().plusSeconds(presignExpireSeconds);
        GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(bucket, normalizedKey, method);
        request.setExpiration(Date.from(expiresAt));
        String contentType = guessContentType(normalizedKey);
        if (purpose == TemporaryUrlPurpose.UPLOAD && contentType != null) {
            request.setContentType(contentType);
        }
        if (method == HttpMethod.GET && purpose != TemporaryUrlPurpose.UPLOAD) {
            ResponseHeaderOverrides headers = new ResponseHeaderOverrides();
            headers.setContentDisposition(contentDisposition(normalizedKey, purpose));
            if (contentType != null) {
                headers.setContentType(contentType);
            }
            request.setResponseHeaders(headers);
        }
        try {
            URL url = ossClient.generatePresignedUrl(request);
            return new TemporaryUrl(url.toString(), expiresAt);
        } catch (OSSException | ClientException ex) {
            throw new BizException("KB-500", "temporary url create failed");
        }
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
        int separator = objectKey.lastIndexOf('/');
        if (separator < 0 || separator == objectKey.length() - 1) {
            return objectKey;
        }
        return objectKey.substring(separator + 1);
    }

    @Override
    public StsCredentials issueStsCredentials(String prefix, long durationSeconds) {
        if (roleArn == null) {
            throw new BizException("KB-500", "oss roleArn not configured");
        }
        String normalizedPrefix = normalizePrefix(prefix);
        long safeDuration = resolveDurationSeconds(durationSeconds);
        String policy = buildReadOnlyPolicy(normalizedPrefix);
        try {
            try {
                DefaultProfile.addEndpoint("", region, "Sts", stsEndpoint);
            } catch (Exception ignore) {
                // Endpoint may have been registered by another caller in the same JVM.
            }
            IClientProfile profile = DefaultProfile.getProfile(region, accessKeyId, accessKeySecret);
            DefaultAcsClient client = new DefaultAcsClient(profile);
            AssumeRoleRequest request = new AssumeRoleRequest();
            request.setRoleArn(roleArn);
            request.setRoleSessionName(roleSessionName);
            request.setDurationSeconds(safeDuration);
            request.setPolicy(policy);
            if (externalId != null) {
                request.setExternalId(externalId);
            }
            AssumeRoleResponse response = client.getAcsResponse(request);
            AssumeRoleResponse.Credentials credentials = response.getCredentials();
            Instant expiresAt = Instant.parse(credentials.getExpiration());
            return new StsCredentials(
                    "oss",
                    credentials.getAccessKeyId(),
                    credentials.getAccessKeySecret(),
                    credentials.getSecurityToken(),
                    expiresAt,
                    endpoint,
                    bucket,
                    normalizedPrefix
            );
        } catch (Exception ex) {
            log.warn("OSS STS issue failed: endpoint={}, region={}, roleArn={}, stsEndpoint={}, error={}",
                    endpoint, region, roleArn, stsEndpoint, ex.toString());
            throw new BizException("KB-500", "sts credentials issue failed");
        }
    }

    @Override
    public void deletePrefix(String prefix) {
        String normalizedPrefix = normalizePrefix(prefix);
        try {
            String marker = null;
            do {
                ListObjectsRequest request = new ListObjectsRequest(bucket);
                request.setPrefix(normalizedPrefix);
                request.setMaxKeys(1000);
                if (marker != null) {
                    request.setMarker(marker);
                }
                ObjectListing listing = ossClient.listObjects(request);
                for (OSSObjectSummary summary : listing.getObjectSummaries()) {
                    ossClient.deleteObject(bucket, summary.getKey());
                }
                marker = listing.isTruncated() ? listing.getNextMarker() : null;
            } while (marker != null);
        } catch (OSSException | ClientException ex) {
            throw new BizException("KB-500", "object delete failed");
        }
    }

    private String buildReadOnlyPolicy(String prefix) {
        String resource = "acs:oss:*:*:" + bucket + "/" + prefix + "*";
        return "{\"Version\":\"1\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"oss:GetObject\"],"
                + "\"Resource\":[\"" + resource + "\"]}]}";
    }

    private String buildBucketBaseUrl() {
        String endpointValue = endpoint.trim();
        if (!endpointValue.startsWith("http://") && !endpointValue.startsWith("https://")) {
            endpointValue = "https://" + endpointValue;
        }
        try {
            URI endpointUri = URI.create(endpointValue);
            String scheme = endpointUri.getScheme() == null ? "https" : endpointUri.getScheme();
            String host = endpointUri.getHost();
            int port = endpointUri.getPort();
            if (host == null || host.isBlank()) {
                throw new IllegalArgumentException("invalid endpoint");
            }
            String bucketHost = host.startsWith(bucket + ".") ? host : bucket + "." + host;
            return scheme + "://" + bucketHost + (port < 0 ? "" : ":" + port);
        } catch (Exception ex) {
            String normalized = endpointValue.replaceAll("/+$", "");
            return normalized + "/" + bucket;
        }
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-500", fieldName + " required");
        }
        return value.trim();
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeObjectKey(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new BizException("KB-400", "objectKey required");
        }
        String trimmed = objectKey.trim();
        return trimmed.startsWith("/") ? trimmed.substring(1) : trimmed;
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

    private long resolveDurationSeconds(long durationSeconds) {
        if (durationSeconds <= 0) {
            return 3600;
        }
        if (durationSeconds > 43200) {
            return 43200;
        }
        return durationSeconds;
    }

    private String normalizeEtag(String etag) {
        if (etag == null) {
            return null;
        }
        String trimmed = etag.trim();
        if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length() > 1) {
            return trimmed.substring(1, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String guessContentType(String objectKey) {
        String lower = objectKey.toLowerCase();
        if (lower.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (lower.endsWith(".docx")) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
        if (lower.endsWith(".pptx")) {
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        }
        if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
            return "text/markdown";
        }
        if (lower.endsWith(".txt")) {
            return "text/plain";
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
}

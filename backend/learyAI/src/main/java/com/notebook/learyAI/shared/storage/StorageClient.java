// Responsibility: Define shared object storage operations used across modules.
package com.notebook.learyAI.shared.storage;

import java.io.InputStream;

public interface StorageClient {
    UploadPolicy createUploadPolicy(String objectKey, long size, String contentType);

    void verifyObject(String objectKey, Long size, String etag);

    void uploadObject(String objectKey, InputStream inputStream, long size, String contentType);

    byte[] readObject(String objectKey);

    String buildObjectUrl(String objectKey);

    TemporaryUrl createTemporaryUrl(String objectKey, TemporaryUrlPurpose purpose);

    StsCredentials issueStsCredentials(String prefix, long durationSeconds);

    void deletePrefix(String prefix);
}

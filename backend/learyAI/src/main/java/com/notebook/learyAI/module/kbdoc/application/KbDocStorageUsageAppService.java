// Responsibility: Record kb doc object storage usage deltas and host future reconciliation entrypoints.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageFactRecorder;
import com.notebook.learyAI.shared.exception.BizException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class KbDocStorageUsageAppService {
    private static final Logger log = LoggerFactory.getLogger(KbDocStorageUsageAppService.class);
    private static final String METRIC_KBDOC_SIZE = "kbdoc_size";
    private static final String USAGE_SOURCE_KBDOC_CONFIRM = "kbdoc_confirm_upload";
    private static final String USAGE_SOURCE_KBDOC_DELETE = "kbdoc_delete";

    private final UsageFactRecorder usageFactRecorder;

    public KbDocStorageUsageAppService(UsageFactRecorder usageFactRecorder) {
        this.usageFactRecorder = usageFactRecorder;
    }

    public void recordUploadConfirmed(Long userId,
                                      String projectId,
                                      String docId,
                                      String objectKey,
                                      long uploadedSize,
                                      Long taskRecordId) {
        long normalizedSize = requirePositiveSize(uploadedSize);
        Map<String, String> usageMetadata = new HashMap<>();
        usageMetadata.put("source", USAGE_SOURCE_KBDOC_CONFIRM);
        usageMetadata.put("docId", docId);
        usageMetadata.put("objectKey", objectKey);
        usageMetadata.put("taskRecordId", taskRecordId == null ? "" : String.valueOf(taskRecordId));
        String idempotencyKey = "kbdoc:upload:confirm:size:" + (taskRecordId == null ? docId : taskRecordId);
        usageFactRecorder.enqueueCommit(new CommitUsageRequestDTO(
                userId,
                projectId,
                METRIC_KBDOC_SIZE,
                idempotencyKey,
                idempotencyKey,
                normalizedSize,
                normalizedSize,
                idempotencyKey,
                USAGE_SOURCE_KBDOC_CONFIRM,
                docId,
                usageMetadata,
                Instant.now()
        ));
    }

    public void recordDocDeleted(Long userId,
                                 String projectId,
                                 String docId,
                                 String objectKey,
                                 long deletedSize,
                                 String deleteReason) {
        long normalizedSize = requirePositiveSize(deletedSize);
        String normalizedReason = normalizeRequired(deleteReason, "deleteReason");
        Map<String, String> usageMetadata = new HashMap<>();
        usageMetadata.put("source", USAGE_SOURCE_KBDOC_DELETE);
        usageMetadata.put("docId", docId);
        usageMetadata.put("objectKey", objectKey);
        usageMetadata.put("deleteReason", normalizedReason);
        // WARN: This idempotency key is keyed by projectId + docId + deleteReason, so a recreated doc reusing the same
        // docId can collide with an earlier delete record and suppress the later negative delta.
        String idempotencyKey = "kbdoc:delete:size:" + projectId + ":" + docId + ":" + normalizedReason;
        usageFactRecorder.enqueueCommit(new CommitUsageRequestDTO(
                userId,
                projectId,
                METRIC_KBDOC_SIZE,
                idempotencyKey,
                idempotencyKey,
                normalizedSize,
                -normalizedSize,
                idempotencyKey,
                USAGE_SOURCE_KBDOC_DELETE,
                docId,
                usageMetadata,
                Instant.now()
        ));
    }

    public void runDailyCorrectionPlaceholder() {
        log.info("kbdoc storage usage daily correction placeholder triggered; reconciliation not implemented yet");
    }

    private long requirePositiveSize(long size) {
        if (size <= 0) {
            throw new BizException("KB-400", "size invalid");
        }
        return size;
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", fieldName + " required");
        }
        return value.trim();
    }
}

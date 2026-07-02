// Responsibility: Verify kb doc storage usage records are emitted with the expected deltas and metadata.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageFactRecorder;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class KbDocStorageUsageAppServiceTest {
    @Mock
    private UsageFactRecorder usageFactRecorder;

    @InjectMocks
    private KbDocStorageUsageAppService appService;

    @Test
    @DisplayName("recordUploadConfirmed: 应记录正向 kbdoc_size")
    void recordUploadConfirmed_shouldRecordPositiveDelta() {
        ArgumentCaptor<CommitUsageRequestDTO> requestCaptor = ArgumentCaptor.forClass(CommitUsageRequestDTO.class);

        appService.recordUploadConfirmed(1L, "project-1", "doc-1", "obj/doc-1/file.txt", 256L, 11L);

        verify(usageFactRecorder).enqueueCommit(requestCaptor.capture());
        assertEquals("kbdoc:upload:confirm:size:11", requestCaptor.getValue().idempotencyKey());
        assertEquals(256L, requestCaptor.getValue().actualAmount());
        assertEquals("kbdoc_confirm_upload", requestCaptor.getValue().metadata().get("source"));
        assertEquals("doc-1", requestCaptor.getValue().metadata().get("docId"));
    }

    @Test
    @DisplayName("recordDocDeleted: 应记录负向 kbdoc_size")
    void recordDocDeleted_shouldRecordNegativeDelta() {
        ArgumentCaptor<CommitUsageRequestDTO> requestCaptor = ArgumentCaptor.forClass(CommitUsageRequestDTO.class);

        appService.recordDocDeleted(2L, "project-2", "doc-2", "obj/doc-2/file.txt", 512L, "delete_by_doc_id");

        verify(usageFactRecorder).enqueueCommit(requestCaptor.capture());
        assertEquals("kbdoc:delete:size:project-2:doc-2:delete_by_doc_id", requestCaptor.getValue().idempotencyKey());
        assertEquals(-512L, requestCaptor.getValue().actualAmount());
        assertEquals("kbdoc_delete", requestCaptor.getValue().metadata().get("source"));
        assertEquals("delete_by_doc_id", requestCaptor.getValue().metadata().get("deleteReason"));
    }

    @Test
    @DisplayName("recordDocDeleted: 非正数 size 应拒绝")
    void recordDocDeleted_shouldRejectNonPositiveSize() {
        BizException ex = assertThrows(
                BizException.class,
                () -> appService.recordDocDeleted(2L, "project-2", "doc-2", "obj/doc-2/file.txt", 0L, "delete_by_doc_id")
        );
        assertEquals("KB-400", ex.getCode());
        assertEquals("size invalid", ex.getMessage());
    }
}

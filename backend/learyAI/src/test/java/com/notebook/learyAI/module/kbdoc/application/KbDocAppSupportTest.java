// Responsibility: Verify kb doc URL import naming rules for supported media links.
package com.notebook.learyAI.module.kbdoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAccessSupport;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.exception.BizException;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.storage.TemporaryUrlPurpose;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class KbDocAppSupportTest {
    private final KbDocAppSupport support = new KbDocAppSupport(
            mock(KbDocRepository.class),
            mock(KbDocRelationRepository.class),
            mock(KnowledgeBaseRepository.class),
            mock(KnowledgeBaseAccessSupport.class),
            mock(StorageClient.class),
            new ObjectMapper(),
            mock(AuthzSdk.class),
            "minio"
    );

    @Test
    @DisplayName("buildSupportedMediaDocName: 未传名称时应生成 Bili_BV号_p页码")
    void buildSupportedMediaDocName_shouldBuildNameFromBilibiliUrl() {
        String result = support.buildSupportedMediaDocName(
                "https://www.bilibili.com/video/BV1ubofBoE1Z?p=3",
                null
        );

        assertEquals("Bili_BV1ubofBoE1Z_p3", result);
    }

    @Test
    @DisplayName("buildSupportedMediaDocName: 分享链接未携带 p 时应默认 p1")
    void buildSupportedMediaDocName_shouldDefaultToPageOne() {
        String result = support.buildSupportedMediaDocName(
                "https://www.bilibili.com/video/BV1ubofBoE1Z/?share_source=COPY&spmid=main.ugc-video-detail-vertical.0.0",
                null
        );

        assertEquals("Bili_BV1ubofBoE1Z_p1", result);
    }

    @Test
    @DisplayName("buildSupportedMediaDocName: 显式名称应优先保留")
    void buildSupportedMediaDocName_shouldKeepExplicitName() {
        String result = support.buildSupportedMediaDocName(
                "https://www.bilibili.com/video/BV1ubofBoE1Z?p=2",
                "自定义标题"
        );

        assertEquals("自定义标题", result);
    }

    @Test
    @DisplayName("resolvePurpose: upload prepare 场景仍应拒绝 download")
    void resolvePurpose_shouldRejectDownloadWhenPurposeNotAllowed() {
        BizException exception = assertThrows(
                BizException.class,
                () -> support.resolvePurpose(
                        "download",
                        EnumSet.of(TemporaryUrlPurpose.UPLOAD, TemporaryUrlPurpose.PREVIEW)
                )
        );

        assertEquals("KB-400", exception.getCode());
        assertEquals("purpose invalid", exception.getMessage());
    }
}

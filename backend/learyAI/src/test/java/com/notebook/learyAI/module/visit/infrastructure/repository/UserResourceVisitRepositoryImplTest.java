// Responsibility: Verify UserResourceVisitRepositoryImpl query wiring and domain mapping.
package com.notebook.learyAI.module.visit.infrastructure.repository;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.infrastructure.persistence.po.UserResourceVisitPO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserResourceVisitRepositoryImplTest {
    @Mock
    private EntityManager entityManager;
    @Mock
    private Query nativeQuery;
    @Mock
    private Query deleteQuery;
    @Mock
    private TypedQuery<UserResourceVisitPO> typedQuery;

    @Test
    @DisplayName("upsert: 应写入 native query 并执行更新")
    void upsert_shouldExecuteNativeQuery() {
        UserResourceVisitRepositoryImpl repository = new UserResourceVisitRepositoryImpl(entityManager);
        when(entityManager.createNativeQuery(anyString())).thenReturn(nativeQuery);
        when(nativeQuery.setParameter(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(nativeQuery);

        repository.upsert(1L, UserResourceType.KB, "kb-1", Instant.parse("2026-03-05T00:00:00Z"));

        verify(nativeQuery).setParameter("userId", 1L);
        verify(nativeQuery).setParameter("resourceType", "KB");
        verify(nativeQuery).setParameter("resourceId", "kb-1");
        verify(nativeQuery).executeUpdate();
    }

    @Test
    @DisplayName("findRecentByUserAndType: 应按结果映射到领域对象")
    void findRecentByUserAndType_shouldMapToDomain() {
        UserResourceVisitRepositoryImpl repository = new UserResourceVisitRepositoryImpl(entityManager);
        when(entityManager.createQuery(anyString(), eq(UserResourceVisitPO.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(typedQuery);
        when(typedQuery.setMaxResults(2)).thenReturn(typedQuery);

        Instant now = Instant.parse("2026-03-05T01:00:00Z");
        UserResourceVisitPO po = new UserResourceVisitPO();
        po.setId(7L);
        po.setUserId(1L);
        po.setResourceType("KB");
        po.setResourceId("kb-1");
        po.setLastVisitedAt(now);
        po.setCreatedAt(now);
        po.setUpdatedAt(now);
        when(typedQuery.getResultList()).thenReturn(List.of(po));

        List<UserResourceVisit> result = repository.findRecentByUserAndType(1L, UserResourceType.KB, 2);

        verify(typedQuery).setParameter("userId", 1L);
        verify(typedQuery).setParameter("resourceType", "KB");
        verify(typedQuery).setMaxResults(2);
        assertEquals(1, result.size());
        assertEquals("kb-1", result.get(0).getResourceId());
        assertEquals(UserResourceType.KB, result.get(0).getResourceType());
    }

    @Test
    @DisplayName("deleteByResource: 应执行删除查询")
    void deleteByResource_shouldExecuteDeleteQuery() {
        UserResourceVisitRepositoryImpl repository = new UserResourceVisitRepositoryImpl(entityManager);
        when(entityManager.createQuery(anyString())).thenReturn(deleteQuery);
        when(deleteQuery.setParameter(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(deleteQuery);

        repository.deleteByResource(UserResourceType.KB, "kb-1");

        verify(deleteQuery).setParameter("resourceType", "KB");
        verify(deleteQuery).setParameter("resourceId", "kb-1");
        verify(deleteQuery).executeUpdate();
    }
}


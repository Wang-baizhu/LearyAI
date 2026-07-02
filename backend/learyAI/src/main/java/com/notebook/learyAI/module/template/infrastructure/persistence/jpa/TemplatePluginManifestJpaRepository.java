// Responsibility: Spring Data JPA repository for TemplatePluginManifestPO.
package com.notebook.learyAI.module.template.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.template.infrastructure.persistence.po.TemplatePluginManifestPO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface TemplatePluginManifestJpaRepository extends JpaRepository<TemplatePluginManifestPO, Long> {
    @Query(value = """
            select *
            from template_plugin_manifest
            where lower(status) = lower(:status)
              and lower(upload_state) = lower(:uploadState)
              and plugin_id = :pluginId
              and (project_id = :projectId or project_id is null)
            order by case when project_id = :projectId then 0 else 1 end, updated_at desc
            limit 1
            """, nativeQuery = true)
    Optional<TemplatePluginManifestPO> findFirstActiveByProjectIdOrGlobal(@Param("status") String status,
                                                                          @Param("uploadState") String uploadState,
                                                                          @Param("pluginId") UUID pluginId,
                                                                          @Param("projectId") UUID projectId);

    @Query(value = """
            select *
            from template_plugin_manifest
            where lower(status) = lower(:status)
              and lower(upload_state) = lower(:uploadState)
              and name = :name
              and (project_id = :projectId or project_id is null)
            order by case when project_id = :projectId then 0 else 1 end, updated_at desc
            limit 1
            """, nativeQuery = true)
    Optional<TemplatePluginManifestPO> findFirstActiveByProjectIdOrGlobalByName(@Param("status") String status,
                                                                                 @Param("uploadState") String uploadState,
                                                                                 @Param("name") String name,
                                                                          @Param("projectId") UUID projectId);

    @Query(value = """
            select distinct on (plugin_id) *
            from template_plugin_manifest
            where lower(status) = lower(:status)
              and lower(upload_state) = lower(:uploadState)
              and (project_id = :projectId or project_id is null)
            order by plugin_id, case when project_id = :projectId then 0 else 1 end, updated_at desc
            """, nativeQuery = true)
    List<TemplatePluginManifestPO> findActiveByProjectIdOrGlobal(@Param("status") String status,
                                                                 @Param("uploadState") String uploadState,
                                                                 @Param("projectId") UUID projectId);

    Optional<TemplatePluginManifestPO> findByPluginId(UUID pluginId);

    Optional<TemplatePluginManifestPO> findFirstByPluginIdOrderByUpdatedAtDesc(UUID pluginId);

    List<TemplatePluginManifestPO> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    void deleteByPluginId(UUID pluginId);
}

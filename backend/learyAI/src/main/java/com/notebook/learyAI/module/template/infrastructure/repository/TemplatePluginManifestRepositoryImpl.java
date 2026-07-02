// Responsibility: Load template plugin manifests from the persisted registry table.
package com.notebook.learyAI.module.template.infrastructure.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifestPage;
import com.notebook.learyAI.module.template.domain.repository.TemplatePluginManifestRepository;
import com.notebook.learyAI.module.template.infrastructure.persistence.jpa.TemplatePluginManifestJpaRepository;
import com.notebook.learyAI.module.template.infrastructure.persistence.po.TemplatePluginManifestPO;
import org.springframework.stereotype.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

@Repository
public class TemplatePluginManifestRepositoryImpl implements TemplatePluginManifestRepository {
    private static final String ACTIVE = "active";
    private static final String VALIDATED = "validated";
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };

    private final TemplatePluginManifestJpaRepository jpaRepository;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    public TemplatePluginManifestRepositoryImpl(TemplatePluginManifestJpaRepository jpaRepository,
                                                ObjectMapper objectMapper,
                                                EntityManager entityManager) {
        this.jpaRepository = jpaRepository;
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
    }

    @Override
    public Optional<TemplatePluginManifest> findActiveByProjectIdOrGlobalByPluginId(String projectId, String pluginId) {
        if (pluginId == null || pluginId.isBlank()) {
            return Optional.empty();
        }
        UUID pluginUuid = parseUuid(pluginId);
        if (pluginUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findFirstActiveByProjectIdOrGlobal(ACTIVE, VALIDATED, pluginUuid, parseUuid(projectId))
                .map(this::toDomain);
    }

    @Override
    public Optional<TemplatePluginManifest> findActiveByProjectIdOrGlobalByName(String projectId, String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findFirstActiveByProjectIdOrGlobalByName(ACTIVE, VALIDATED, name.trim(), parseUuid(projectId))
                .map(this::toDomain);
    }

    @Override
    public List<TemplatePluginManifest> findActiveByProjectIdOrGlobal(String projectId) {
        return jpaRepository.findActiveByProjectIdOrGlobal(ACTIVE, VALIDATED, parseUuid(projectId)).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Optional<TemplatePluginManifest> findByPluginId(String pluginId) {
        UUID pluginUuid = parseUuid(pluginId);
        if (pluginUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByPluginId(pluginUuid).map(this::toDomain);
    }

    @Override
    public Optional<TemplatePluginManifest> findLatestByPluginId(String pluginId) {
        UUID pluginUuid = parseUuid(pluginId);
        if (pluginUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findFirstByPluginIdOrderByUpdatedAtDesc(pluginUuid).map(this::toDomain);
    }

    @Override
    public List<TemplatePluginManifest> findByOwnerId(Long ownerId) {
        if (ownerId == null) {
            return List.of();
        }
        return jpaRepository.findByOwnerIdOrderByUpdatedAtDesc(ownerId).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public TemplatePluginManifestPage findByOwnerId(Long ownerId, String search, int page, int size) {
        if (ownerId == null) {
            return new TemplatePluginManifestPage(List.of(), 0, page, size);
        }
        int safePage = Math.max(page, 1);
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase();
        StringBuilder base = new StringBuilder(" from TemplatePluginManifestPO manifest where manifest.ownerId = :ownerId");
        if (normalizedSearch != null) {
            base.append(" and (lower(manifest.name) like :search or lower(manifest.displayName) like :search)");
        }
        Query query = entityManager.createQuery(
                "select manifest" + base + " order by manifest.updatedAt desc",
                TemplatePluginManifestPO.class);
        query.setParameter("ownerId", ownerId);
        if (normalizedSearch != null) {
            query.setParameter("search", "%" + normalizedSearch + "%");
        }
        query.setFirstResult((safePage - 1) * size);
        query.setMaxResults(size);

        Query countQuery = entityManager.createQuery("select count(manifest.id)" + base);
        countQuery.setParameter("ownerId", ownerId);
        if (normalizedSearch != null) {
            countQuery.setParameter("search", "%" + normalizedSearch + "%");
        }

        @SuppressWarnings("unchecked")
        List<TemplatePluginManifestPO> rows = query.getResultList();
        List<TemplatePluginManifest> items = rows.stream().map(this::toDomain).toList();
        long total = ((Number) countQuery.getSingleResult()).longValue();
        return new TemplatePluginManifestPage(items, total, safePage, size);
    }

    @Override
    public TemplatePluginManifest save(TemplatePluginManifest manifest) {
        TemplatePluginManifestPO po = findExistingPo(manifest);
        if (po == null) {
            po = new TemplatePluginManifestPO();
            po.setCreatedAt(manifest.getCreatedAt() == null ? Instant.now() : manifest.getCreatedAt());
        }
        po.setPluginId(parseUuid(manifest.getPluginId()));
        po.setName(manifest.getName());
        po.setProjectId(parseUuid(manifest.getProjectId()));
        po.setOwnerId(manifest.getOwnerId());
        po.setDisplayName(manifest.getDisplayName());
        po.setEntryUri(manifest.getEntryUri());
        po.setAssetBaseUri(manifest.getAssetBaseUri());
        po.setSdkVersion(manifest.getSdkVersion());
        po.setCapabilitiesJson(writeJsonMap(manifest.getCapabilities()));
        po.setPromptSchemaJson(writeJsonMap(manifest.getPromptSchema()));
        po.setDataBindingsJson(writeJsonMap(manifest.getDataBindings()));
        po.setStatus(manifest.getStatus());
        po.setScope(manifest.getScope());
        po.setVisibility(manifest.getVisibility());
        po.setUploadState(manifest.getUploadState());
        po.setSourceManifestJson(writeJsonMap(manifest.getSourceManifest()));
        po.setValidationResultJson(writeJsonMap(manifest.getValidationResult()));
        po.setUpdatedAt(manifest.getUpdatedAt() == null ? Instant.now() : manifest.getUpdatedAt());
        return toDomain(jpaRepository.save(po));
    }

    @Override
    public void deleteByPluginId(String pluginId) {
        UUID pluginUuid = parseUuid(pluginId);
        if (pluginUuid == null) {
            return;
        }
        jpaRepository.deleteByPluginId(pluginUuid);
    }

    private TemplatePluginManifest toDomain(TemplatePluginManifestPO po) {
        return new TemplatePluginManifest(
                po.getPluginId() == null ? null : po.getPluginId().toString(),
                po.getName(),
                po.getProjectId() == null ? null : po.getProjectId().toString(),
                po.getOwnerId(),
                po.getDisplayName(),
                po.getEntryUri(),
                po.getAssetBaseUri(),
                po.getSdkVersion(),
                readJsonMap(po.getCapabilitiesJson()),
                readJsonMap(po.getPromptSchemaJson()),
                readJsonMap(po.getDataBindingsJson()),
                po.getStatus(),
                po.getScope(),
                po.getVisibility(),
                po.getUploadState(),
                readJsonMap(po.getSourceManifestJson()),
                readJsonMap(po.getValidationResultJson()),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private TemplatePluginManifestPO findExistingPo(TemplatePluginManifest manifest) {
        UUID pluginUuid = parseUuid(manifest.getPluginId());
        if (pluginUuid == null) {
            return null;
        }
        return jpaRepository.findByPluginId(pluginUuid).orElse(null);
    }

    private Map<String, Object> readJsonMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(raw, MAP_TYPE);
        } catch (IOException ex) {
            throw new IllegalStateException("template plugin manifest json invalid", ex);
        }
    }

    private String writeJsonMap(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (IOException ex) {
            throw new IllegalStateException("template plugin manifest json invalid", ex);
        }
    }

    private UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return UUID.fromString(value.trim());
    }
}

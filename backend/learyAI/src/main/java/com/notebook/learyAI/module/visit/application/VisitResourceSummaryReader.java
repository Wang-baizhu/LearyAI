// Responsibility: Provide resource summaries for recent visit aggregation.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;

import java.util.List;
import java.util.Map;

public interface VisitResourceSummaryReader {
    boolean supports(UserResourceType resourceType);

    Map<String, VisitResourceSummary> loadSummaries(Long userId, List<String> resourceIds);
}

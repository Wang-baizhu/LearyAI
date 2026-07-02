// Responsibility: Await search task completion without blocking request threads and return the minimal skill result.
package com.notebook.learyAI.module.skills.application;

import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillSearchResponse;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.status.TaskStatusListener;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.async.DeferredResult;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class KbSkillSearchWaitService implements TaskStatusListener {
    private static final long WAIT_TIMEOUT_MS = 60000L;

    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<DeferredResult<ApiResponse<KbSkillSearchResponse>>>> waiters;
    private final TaskAppService taskAppService;
    private final KbSkillSearchResponseAssembler responseAssembler;

    public KbSkillSearchWaitService(TaskAppService taskAppService,
                                    KbSkillSearchResponseAssembler responseAssembler) {
        this.waiters = new ConcurrentHashMap<>();
        this.taskAppService = taskAppService;
        this.responseAssembler = responseAssembler;
    }

    public DeferredResult<ApiResponse<KbSkillSearchResponse>> waitForResult(Task createdTask) {
        DeferredResult<ApiResponse<KbSkillSearchResponse>> deferred = new DeferredResult<>(WAIT_TIMEOUT_MS);
        Long taskRecordId = createdTask.getTaskRecordId();
        waiters.computeIfAbsent(taskRecordId, ignored -> new CopyOnWriteArrayList<>()).add(deferred);
        deferred.onCompletion(() -> removeWaiter(taskRecordId, deferred));
        deferred.onTimeout(() -> {
            Task latest = loadLatestTask(createdTask);
            if (isTerminal(latest)) {
                deferred.setResult(ApiResponse.ok(toCompletedResponse(latest)));
                return;
            }
            deferred.setResult(ApiResponse.ok(toPendingResponse(latest == null ? createdTask : latest)));
        });
        Task latest = loadLatestTask(createdTask);
        if (isTerminal(latest)) {
            deferred.setResult(ApiResponse.ok(toCompletedResponse(latest)));
        }
        return deferred;
    }

    @Override
    public void onStatusChanged(Task task, TaskStatus prevStatus, String changeType) {
        if (!isTerminal(task) || task.getTaskRecordId() == null) {
            return;
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    completeWaiters(task);
                }
            });
            return;
        }
        completeWaiters(task);
    }

    private void completeWaiters(Task task) {
        List<DeferredResult<ApiResponse<KbSkillSearchResponse>>> pending = waiters.remove(task.getTaskRecordId());
        if (pending == null || pending.isEmpty()) {
            return;
        }
        ApiResponse<KbSkillSearchResponse> payload = ApiResponse.ok(toCompletedResponse(task));
        for (DeferredResult<ApiResponse<KbSkillSearchResponse>> deferred : pending) {
            deferred.setResult(payload);
        }
    }

    private void removeWaiter(Long taskRecordId, DeferredResult<ApiResponse<KbSkillSearchResponse>> deferred) {
        if (taskRecordId == null) {
            return;
        }
        waiters.computeIfPresent(taskRecordId, (ignored, pending) -> {
            pending.remove(deferred);
            return pending.isEmpty() ? null : pending;
        });
    }

    private Task loadLatestTask(Task task) {
        if (task == null || task.getTaskRecordId() == null || task.getProjectId() == null || task.getProjectId().isBlank()) {
            return task;
        }
        return taskAppService.findById(task.getTaskRecordId(), task.getProjectId()).orElse(task);
    }

    private boolean isTerminal(Task task) {
        if (task == null || task.getStatus() == null) {
            return false;
        }
        return task.getStatus() == TaskStatus.DONE || task.getStatus() == TaskStatus.FAILED;
    }

    private KbSkillSearchResponse toCompletedResponse(Task task) {
        return responseAssembler.toCompletedResponse(task);
    }

    private KbSkillSearchResponse toPendingResponse(Task task) {
        return responseAssembler.toPendingResponse(task);
    }
}

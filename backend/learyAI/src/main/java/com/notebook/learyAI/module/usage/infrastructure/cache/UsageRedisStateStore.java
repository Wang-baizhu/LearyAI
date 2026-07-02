// Responsibility: Maintain current-cycle reservation state and rolling buckets in Redis.
package com.notebook.learyAI.module.usage.infrastructure.cache;

import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.SubscriptionCycle;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.domain.model.UsageReservation;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class UsageRedisStateStore {
    private static final DateTimeFormatter HOUR_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHH").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter DAY_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    private static final DefaultRedisScript<Long> RESERVE_SCRIPT = new DefaultRedisScript<>(
            """
                    local cycleKey = KEYS[1]
                    local reservationKey = KEYS[2]
                    local initialUsed = tonumber(ARGV[1])
                    local quota = tonumber(ARGV[2])
                    local requested = tonumber(ARGV[3])
                    local requestId = ARGV[4]
                    local userId = ARGV[5]
                    local projectId = ARGV[6]
                    local metric = ARGV[7]
                    local cycleId = ARGV[8]
                    local expiresAt = ARGV[9]
                    local updatedAt = ARGV[10]
                    local cycleTtlMs = tonumber(ARGV[11])
                    local reservationTtlMs = tonumber(ARGV[12])
                    local existingRequestId = redis.call('HGET', reservationKey, 'requestId')
                    if existingRequestId then
                      if existingRequestId == requestId then
                        return 2
                      end
                      return -1
                    end
                    local storedCycleId = redis.call('HGET', cycleKey, 'cycleId')
                    local used = tonumber(redis.call('HGET', cycleKey, 'used'))
                    if not used or storedCycleId ~= cycleId then
                      used = initialUsed
                    end
                    local reserved = tonumber(redis.call('HGET', cycleKey, 'reserved'))
                    if not reserved or storedCycleId ~= cycleId then
                      reserved = 0
                    end
                    if used + reserved + requested > quota then
                      return 0
                    end
                    redis.call('HSET', cycleKey,
                      'cycleId', cycleId,
                      'used', tostring(used),
                      'reserved', tostring(reserved + requested),
                      'quota', tostring(quota),
                      'updatedAt', updatedAt)
                    redis.call('PEXPIRE', cycleKey, cycleTtlMs)
                    redis.call('HSET', reservationKey,
                      'requestId', requestId,
                      'userId', userId,
                      'projectId', projectId,
                      'metric', metric,
                      'reservedAmount', tostring(requested),
                      'status', 'RESERVED',
                      'expiresAt', expiresAt,
                      'updatedAt', updatedAt)
                    redis.call('PEXPIRE', reservationKey, reservationTtlMs)
                    return 1
                    """,
            Long.class
    );

    private static final DefaultRedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
            """
                    local cycleKey = KEYS[1]
                    local reservationKey = KEYS[2]
                    local requestId = ARGV[1]
                    local updatedAt = ARGV[2]
                    local existingRequestId = redis.call('HGET', reservationKey, 'requestId')
                    if not existingRequestId then
                      return 0
                    end
                    if existingRequestId ~= requestId then
                      return -1
                    end
                    local status = redis.call('HGET', reservationKey, 'status')
                    if status == 'RELEASED' or status == 'COMMITTED' then
                      return 2
                    end
                    local reservedAmount = tonumber(redis.call('HGET', reservationKey, 'reservedAmount'))
                    local reserved = tonumber(redis.call('HGET', cycleKey, 'reserved'))
                    if not reserved then
                      reserved = 0
                    end
                    redis.call('HSET', cycleKey, 'reserved', tostring(math.max(0, reserved - reservedAmount)), 'updatedAt', updatedAt)
                    redis.call('HSET', reservationKey, 'status', 'RELEASED', 'updatedAt', updatedAt)
                    return 1
                    """,
            Long.class
    );

    private static final DefaultRedisScript<Long> COMMIT_SCRIPT = new DefaultRedisScript<>(
            """
                    local cycleKey = KEYS[1]
                    local reservationKey = KEYS[2]
                    local actualAmount = tonumber(ARGV[1])
                    local requestId = ARGV[2]
                    local updatedAt = ARGV[3]
                    local quota = tonumber(ARGV[4])
                    local initialUsed = tonumber(ARGV[5])
                    local cycleTtlMs = tonumber(ARGV[6])
                    local cycleId = ARGV[7]
                    local existingRequestId = redis.call('HGET', reservationKey, 'requestId')
                    local reservedAmount = 0
                    if existingRequestId then
                      if existingRequestId ~= requestId then
                        return -1
                      end
                      local status = redis.call('HGET', reservationKey, 'status')
                      if status == 'COMMITTED' then
                        return 2
                      end
                      reservedAmount = tonumber(redis.call('HGET', reservationKey, 'reservedAmount'))
                    end
                    local storedCycleId = redis.call('HGET', cycleKey, 'cycleId')
                    local used = tonumber(redis.call('HGET', cycleKey, 'used'))
                    if not used or storedCycleId ~= cycleId then
                      used = initialUsed
                    end
                    local reserved = tonumber(redis.call('HGET', cycleKey, 'reserved'))
                    if not reserved or storedCycleId ~= cycleId then
                      reserved = 0
                    end
                    redis.call('HSET', cycleKey,
                      'cycleId', cycleId,
                      'used', tostring(used + actualAmount),
                      'reserved', tostring(math.max(0, reserved - reservedAmount)),
                      'quota', tostring(quota),
                      'updatedAt', updatedAt)
                    redis.call('PEXPIRE', cycleKey, cycleTtlMs)
                    if existingRequestId then
                      redis.call('HSET', reservationKey, 'status', 'COMMITTED', 'updatedAt', updatedAt)
                    end
                    return 1
                    """,
            Long.class
    );

    private static final DefaultRedisScript<Long> OPEN_TURN_LEASE_SCRIPT = new DefaultRedisScript<>(
            """
                    local cycleKey = KEYS[1]
                    local leaseKey = KEYS[2]
                    local turnKey = KEYS[3]
                    local userLeaseKey = KEYS[4]
                    local initialUsed = tonumber(ARGV[1])
                    local initialReserved = tonumber(ARGV[2])
                    local quota = tonumber(ARGV[3])
                    local cycleId = ARGV[4]
                    local leaseId = ARGV[5]
                    local userId = ARGV[6]
                    local projectId = ARGV[7]
                    local metric = ARGV[8]
                    local turnId = ARGV[9]
                    local planId = ARGV[10]
                    local createdAt = ARGV[11]
                    local updatedAt = ARGV[12]
                    local expiresAt = ARGV[13]
                    local cycleTtlMs = tonumber(ARGV[14])
                    local leaseTtlMs = tonumber(ARGV[15])
                    local existingLeaseId = redis.call('GET', turnKey)
                    if existingLeaseId then
                      if existingLeaseId == leaseId then
                        return 2
                      end
                      return -1
                    end
                    local storedCycleId = redis.call('HGET', cycleKey, 'cycleId')
                    local used = tonumber(redis.call('HGET', cycleKey, 'used'))
                    if not used or storedCycleId ~= cycleId then
                      used = initialUsed
                    end
                    local reserved = tonumber(redis.call('HGET', cycleKey, 'reserved'))
                    if not reserved or storedCycleId ~= cycleId then
                      reserved = initialReserved
                    end
                    if used + reserved >= quota then
                      return 0
                    end
                    redis.call('HSET', cycleKey,
                      'cycleId', cycleId,
                      'used', tostring(used),
                      'reserved', tostring(reserved),
                      'quota', tostring(quota),
                      'updatedAt', updatedAt)
                    redis.call('PEXPIRE', cycleKey, cycleTtlMs)
                    redis.call('HSET', leaseKey,
                      'leaseId', leaseId,
                      'userId', userId,
                      'projectId', projectId,
                      'metric', metric,
                      'turnId', turnId,
                      'planId', planId,
                      'status', 'OPEN',
                      'createdAt', createdAt,
                      'updatedAt', updatedAt,
                      'expiresAt', expiresAt)
                    redis.call('PEXPIRE', leaseKey, leaseTtlMs)
                    redis.call('SET', turnKey, leaseId, 'PX', leaseTtlMs)
                    redis.call('SADD', userLeaseKey, leaseId)
                    redis.call('PEXPIRE', userLeaseKey, leaseTtlMs)
                    return 1
                    """,
            Long.class
    );

    private static final DefaultRedisScript<Long> COMMIT_TURN_CALL_SCRIPT = new DefaultRedisScript<>(
            """
                    local cycleKey = KEYS[1]
                    local leaseKey = KEYS[2]
                    local callsKey = KEYS[3]
                    local actualAmount = tonumber(ARGV[1])
                    local callId = ARGV[2]
                    local initialUsed = tonumber(ARGV[3])
                    local quota = tonumber(ARGV[4])
                    local updatedAt = ARGV[5]
                    local cycleTtlMs = tonumber(ARGV[6])
                    local leaseTtlMs = tonumber(ARGV[7])
                    local cycleId = ARGV[8]
                    if redis.call('HEXISTS', leaseKey, 'leaseId') == 0 then
                      return -2
                    end
                    local status = redis.call('HGET', leaseKey, 'status')
                    if status ~= 'OPEN' then
                      return -1
                    end
                    if redis.call('HEXISTS', callsKey, callId) == 1 then
                      return 2
                    end
                    local storedCycleId = redis.call('HGET', cycleKey, 'cycleId')
                    local used = tonumber(redis.call('HGET', cycleKey, 'used'))
                    if not used or storedCycleId ~= cycleId then
                      used = initialUsed
                    end
                    local reserved = tonumber(redis.call('HGET', cycleKey, 'reserved'))
                    if not reserved or storedCycleId ~= cycleId then
                      reserved = 0
                    end
                    if used + reserved + actualAmount > quota then
                      return 0
                    end
                    redis.call('HSET', cycleKey,
                      'cycleId', cycleId,
                      'used', tostring(used + actualAmount),
                      'reserved', tostring(reserved),
                      'quota', tostring(quota),
                      'updatedAt', updatedAt)
                    redis.call('PEXPIRE', cycleKey, cycleTtlMs)
                    redis.call('HSET', leaseKey, 'updatedAt', updatedAt)
                    redis.call('PEXPIRE', leaseKey, leaseTtlMs)
                    redis.call('HSET', callsKey, callId, tostring(actualAmount))
                    redis.call('PEXPIRE', callsKey, leaseTtlMs)
                    return 1
                    """,
            Long.class
    );

    private static final DefaultRedisScript<Long> CLOSE_TURN_LEASE_SCRIPT = new DefaultRedisScript<>(
            """
                    local leaseKey = KEYS[1]
                    local turnKey = KEYS[2]
                    local userLeaseKey = KEYS[3]
                    local leaseId = ARGV[1]
                    local finalStatus = ARGV[2]
                    local updatedAt = ARGV[3]
                    if redis.call('HEXISTS', leaseKey, 'leaseId') == 0 then
                      return 0
                    end
                    local status = redis.call('HGET', leaseKey, 'status')
                    if status == finalStatus then
                      return 2
                    end
                    if status ~= 'OPEN' then
                      return -1
                    end
                    redis.call('HSET', leaseKey, 'status', finalStatus, 'updatedAt', updatedAt)
                    redis.call('DEL', turnKey)
                    redis.call('SREM', userLeaseKey, leaseId)
                    return 1
                    """,
            Long.class
    );

    private final StringRedisTemplate redisTemplate;

    public UsageRedisStateStore(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public ReserveResult reserve(SubscriptionCycle cycle,
                                 long userId,
                                 String projectId,
                                 String metric,
                                 String reservationId,
                                 String requestId,
                                 long requestedAmount,
                                 long initialUsed,
                                 Instant now,
                                 Duration reservationTtl) {
        String cycleKey = cycleKey(userId, metric);
        String reservationKey = reservationKey(reservationId);
        Duration cycleTtl = cycleTtl(cycle, now);
        Instant expiresAt = now.plus(reservationTtl);
        Long result = redisTemplate.execute(
                RESERVE_SCRIPT,
                List.of(cycleKey, reservationKey),
                String.valueOf(initialUsed),
                String.valueOf(cycle.quota()),
                String.valueOf(requestedAmount),
                requestId,
                String.valueOf(userId),
                projectId,
                metric,
                String.valueOf(cycle.id()),
                expiresAt.toString(),
                now.toString(),
                String.valueOf(cycleTtl.toMillis()),
                String.valueOf(reservationTtl.toMillis())
        );
        if (result == null) {
            return ReserveResult.error();
        }
        return new ReserveResult(result);
    }

    public long release(String reservationId, long userId, String metric, String requestId, Instant now) {
        String cycleKey = cycleKey(userId, metric);
        String reservationKey = reservationKey(reservationId);
        Long result = redisTemplate.execute(RELEASE_SCRIPT, List.of(cycleKey, reservationKey), requestId, now.toString());
        return result == null ? -2L : result;
    }

    public long commit(SubscriptionCycle cycle,
                       String reservationId,
                       String requestId,
                       long actualAmount,
                       long initialUsed,
                       Instant now) {
        String cycleKey = cycleKey(cycle.userId(), cycle.metric());
        String reservationKey = reservationKey(reservationId);
        Long result = redisTemplate.execute(
                COMMIT_SCRIPT,
                List.of(cycleKey, reservationKey),
                String.valueOf(actualAmount),
                requestId,
                now.toString(),
                String.valueOf(cycle.quota()),
                String.valueOf(initialUsed),
                String.valueOf(cycleTtl(cycle, now).toMillis()),
                String.valueOf(cycle.id())
        );
        return result == null ? -2L : result;
    }

    public OpenTurnLeaseResult openTurnLease(SubscriptionCycle cycle,
                                             String projectId,
                                             String turnId,
                                             String leaseId,
                                             String idempotencyKey,
                                             long leaseTtlSeconds,
                                             long initialUsed,
                                             long initialReserved,
                                             Instant now,
                                             Map<String, String> metadata) {
        String cycleKey = cycleKey(cycle.userId(), cycle.metric());
        String leaseKey = turnLeaseKey(leaseId);
        String turnKey = turnLeaseTurnKey(turnId);
        String userLeaseKey = turnLeaseUserKey(cycle.userId());
        Duration cycleTtl = cycleTtl(cycle, now);
        Duration leaseTtl = Duration.ofSeconds(Math.max(60L, leaseTtlSeconds));
        Long result = redisTemplate.execute(
                OPEN_TURN_LEASE_SCRIPT,
                List.of(cycleKey, leaseKey, turnKey, userLeaseKey),
                String.valueOf(initialUsed),
                String.valueOf(initialReserved),
                String.valueOf(cycle.quota()),
                String.valueOf(cycle.id()),
                leaseId,
                String.valueOf(cycle.userId()),
                projectId,
                cycle.metric(),
                turnId,
                cycle.planId(),
                now.toString(),
                now.toString(),
                now.plus(leaseTtl).toString(),
                String.valueOf(cycleTtl.toMillis()),
                String.valueOf(leaseTtl.toMillis())
        );
        return result == null ? OpenTurnLeaseResult.error() : new OpenTurnLeaseResult(result);
    }

    public CommitTurnCallResult commitTurnCallUsage(SubscriptionCycle cycle,
                                                    String leaseId,
                                                    String turnId,
                                                    String callId,
                                                    long actualAmount,
                                                    long initialUsed,
                                                    Instant now) {
        String cycleKey = cycleKey(cycle.userId(), cycle.metric());
        String leaseKey = turnLeaseKey(leaseId);
        String callsKey = turnLeaseCallsKey(leaseId);
        Duration cycleTtl = cycleTtl(cycle, now);
        Duration leaseTtl = Duration.between(now, cycle.validTo()).plus(Duration.ofDays(1));
        Long result = redisTemplate.execute(
                COMMIT_TURN_CALL_SCRIPT,
                List.of(cycleKey, leaseKey, callsKey),
                String.valueOf(actualAmount),
                callId,
                String.valueOf(initialUsed),
                String.valueOf(cycle.quota()),
                now.toString(),
                String.valueOf(cycleTtl.toMillis()),
                String.valueOf(Math.max(Duration.ofMinutes(1).toMillis(), leaseTtl.toMillis())),
                String.valueOf(cycle.id())
        );
        return result == null ? CommitTurnCallResult.error() : new CommitTurnCallResult(result);
    }

    public CloseTurnLeaseResult closeTurnLease(long userId,
                                               String leaseId,
                                               String turnId,
                                               String idempotencyKey,
                                               String finalStatus,
                                               Instant now) {
        Long result = redisTemplate.execute(
                CLOSE_TURN_LEASE_SCRIPT,
                List.of(turnLeaseKey(leaseId), turnLeaseTurnKey(turnId), turnLeaseUserKey(userId)),
                leaseId,
                finalStatus,
                now.toString()
        );
        return result == null ? CloseTurnLeaseResult.error() : new CloseTurnLeaseResult(result);
    }

    public Optional<CurrentCycleUsage> getCurrentCycleUsage(SubscriptionCycle cycle,
                                                            long userId,
                                                            String projectId,
                                                            String metric) {
        String cycleKey = cycleKey(userId, metric);
        Map<Object, Object> fields = redisTemplate.opsForHash().entries(cycleKey);
        if (fields == null || fields.isEmpty()) {
            return Optional.empty();
        }
        if (parseLong(fields.get("cycleId")) != cycle.id()) {
            return Optional.empty();
        }
        long used = parseLong(fields.get("used"));
        long reserved = parseLong(fields.get("reserved"));
        long quota = parseLong(fields.get("quota"));
        Instant updatedAt = Instant.parse(String.valueOf(fields.getOrDefault("updatedAt", Instant.now().toString())));
        return Optional.of(toCurrentCycleUsage(cycle, projectId, used, reserved, quota, updatedAt));
    }

    public void writeCurrentCycleUsage(SubscriptionCycle cycle,
                                       long userId,
                                       String projectId,
                                       String metric,
                                       long used,
                                       long reserved,
                                       Instant now) {
        String cycleKey = cycleKey(userId, metric);
        redisTemplate.opsForHash().putAll(cycleKey, Map.of(
                "cycleId", String.valueOf(cycle.id()),
                "used", String.valueOf(used),
                "reserved", String.valueOf(reserved),
                "quota", String.valueOf(cycle.quota()),
                "updatedAt", now.toString()
        ));
        redisTemplate.expire(cycleKey, cycleTtl(cycle, now));
    }

    public CurrentCycleUsage toCurrentCycleUsage(SubscriptionCycle cycle,
                                                 String projectId,
                                                 long used,
                                                 long reserved,
                                                 long quota,
                                                 Instant updatedAt) {
        long available = Math.max(0L, quota - used - reserved);
        return new CurrentCycleUsage(
                cycle.userId(),
                projectId,
                cycle.metric(),
                cycle.id(),
                used,
                reserved,
                quota,
                available,
                cycle.validFrom(),
                cycle.validTo(),
                updatedAt
        );
    }

    public UsageReservation getReservation(String reservationId,
                                           long userId,
                                           String projectId,
                                           String metric) {
        String key = reservationKey(reservationId);
        Map<Object, Object> fields = redisTemplate.opsForHash().entries(key);
        if (fields == null || fields.isEmpty()) {
            return null;
        }
        return new UsageReservation(
                reservationId,
                String.valueOf(fields.get("requestId")),
                userId,
                projectId,
                metric,
                parseLong(fields.get("reservedAmount")),
                String.valueOf(fields.get("status")),
                Instant.parse(String.valueOf(fields.get("expiresAt"))),
                Instant.parse(String.valueOf(fields.get("updatedAt")))
        );
    }

    public void incrementRollingBuckets(long userId,
                                        String metric,
                                        long actualAmount,
                                        Instant occurredAt) {
        redisTemplate.opsForValue().increment(hourKey(userId, metric, occurredAt), actualAmount);
        redisTemplate.expire(hourKey(userId, metric, occurredAt), Duration.ofHours(72));
        redisTemplate.opsForValue().increment(dayKey(userId, metric, occurredAt), actualAmount);
        redisTemplate.expire(dayKey(userId, metric, occurredAt), Duration.ofDays(45));
    }

    public long sumRollingBuckets(long userId, String metric, List<String> keys) {
        long total = 0L;
        for (String key : keys) {
            String value = redisTemplate.opsForValue().get(key);
            if (value == null) {
                return Long.MIN_VALUE;
            }
            total += Long.parseLong(value);
        }
        return total;
    }

    public List<String> hourKeys(long userId, String metric, Instant fromInclusive, Instant toExclusive) {
        java.util.ArrayList<String> keys = new java.util.ArrayList<>();
        Instant cursor = fromInclusive;
        while (cursor.isBefore(toExclusive)) {
            keys.add(hourKey(userId, metric, cursor));
            cursor = cursor.plus(Duration.ofHours(1));
        }
        return keys;
    }

    public List<String> dayKeys(long userId, String metric, Instant fromInclusive, Instant toExclusive) {
        java.util.ArrayList<String> keys = new java.util.ArrayList<>();
        Instant cursor = fromInclusive;
        while (cursor.isBefore(toExclusive)) {
            keys.add(dayKey(userId, metric, cursor));
            cursor = cursor.plus(Duration.ofDays(1));
        }
        return keys;
    }

    private String cycleKey(long userId, String metric) {
        return "usage:cycle:" + userId + ":" + metric;
    }

    private String reservationKey(String reservationId) {
        return "usage:reservation:" + reservationId;
    }

    private String turnLeaseKey(String leaseId) {
        return "usage:turnlease:" + leaseId;
    }

    private String turnLeaseCallsKey(String leaseId) {
        return "usage:turnlease:" + leaseId + ":calls";
    }

    private String turnLeaseTurnKey(String turnId) {
        return "usage:turnlease:turn:" + turnId;
    }

    private String turnLeaseUserKey(long userId) {
        return "usage:turnlease:user:" + userId;
    }

    private String hourKey(long userId, String metric, Instant occurredAt) {
        return "usage:hour:" + userId + ":" + metric + ":" + HOUR_FORMATTER.format(occurredAt);
    }

    private String dayKey(long userId, String metric, Instant occurredAt) {
        return "usage:day:" + userId + ":" + metric + ":" + DAY_FORMATTER.format(occurredAt);
    }

    private long parseLong(Object value) {
        if (value == null) {
            return 0L;
        }
        return Long.parseLong(String.valueOf(value));
    }

    private Duration cycleTtl(SubscriptionCycle cycle, Instant now) {
        Duration base = Duration.between(now, cycle.validTo());
        if (base.isNegative()) {
            return Duration.ofDays(1);
        }
        return base.plus(Duration.ofDays(3));
    }

    public record ReserveResult(long code) {
        public boolean success() {
            return code == 1L || code == 2L;
        }

        public boolean idempotentReplay() {
            return code == 2L;
        }

        public boolean quotaExceeded() {
            return code == 0L;
        }

        public boolean conflict() {
            return code == -1L;
        }

        public static ReserveResult error() {
            return new ReserveResult(-2L);
        }
    }

    public TurnLease getTurnLease(String leaseId) {
        Map<Object, Object> fields = redisTemplate.opsForHash().entries(turnLeaseKey(leaseId));
        if (fields == null || fields.isEmpty()) {
            return null;
        }
        return new TurnLease(
                String.valueOf(fields.get("leaseId")),
                parseLong(fields.get("userId")),
                String.valueOf(fields.get("projectId")),
                String.valueOf(fields.get("metric")),
                String.valueOf(fields.get("turnId")),
                String.valueOf(fields.get("planId")),
                String.valueOf(fields.get("status")),
                Instant.parse(String.valueOf(fields.get("createdAt"))),
                Instant.parse(String.valueOf(fields.get("updatedAt"))),
                Instant.parse(String.valueOf(fields.get("expiresAt")))
        );
    }

    public record OpenTurnLeaseResult(long code) {
        public boolean success() {
            return code == 1L || code == 2L;
        }

        public boolean idempotentReplay() {
            return code == 2L;
        }

        public boolean conflict() {
            return code == -1L;
        }

        public static OpenTurnLeaseResult error() {
            return new OpenTurnLeaseResult(-2L);
        }
    }

    public record CommitTurnCallResult(long code) {
        public boolean success() {
            return code == 1L || code == 2L;
        }

        public boolean idempotentReplay() {
            return code == 2L;
        }

        public boolean conflict() {
            return code < 0L;
        }

        public static CommitTurnCallResult error() {
            return new CommitTurnCallResult(-3L);
        }
    }

    public record CloseTurnLeaseResult(long code) {
        public boolean changed() {
            return code == 1L;
        }

        public boolean conflict() {
            return code == -1L;
        }

        public static CloseTurnLeaseResult error() {
            return new CloseTurnLeaseResult(-2L);
        }
    }
}

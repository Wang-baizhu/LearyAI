// Responsibility: Represent cache hit/miss result for auth query cache.
package com.notebook.learyAI.module.auth.application.cache;

public class CachedValue<T> {
    private final boolean hit;
    private final T value;

    private CachedValue(boolean hit, T value) {
        this.hit = hit;
        this.value = value;
    }

    public static <T> CachedValue<T> hit(T value) {
        return new CachedValue<>(true, value);
    }

    public static <T> CachedValue<T> miss() {
        return new CachedValue<>(false, null);
    }

    public boolean isHit() {
        return hit;
    }

    public T getValue() {
        return value;
    }
}

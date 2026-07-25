package lk.gov.health.govcare.security;

import java.util.Optional;

public final class AuthContext {
  private static final ThreadLocal<RequestUser> CURRENT = new ThreadLocal<>();

  private AuthContext() {}

  public static void set(RequestUser user) {
    CURRENT.set(user);
  }

  public static Optional<RequestUser> get() {
    return Optional.ofNullable(CURRENT.get());
  }

  public static RequestUser requireUser() {
    return get().orElseThrow(() -> new IllegalStateException("Authenticated user context is missing."));
  }

  public static void clear() {
    CURRENT.remove();
  }
}


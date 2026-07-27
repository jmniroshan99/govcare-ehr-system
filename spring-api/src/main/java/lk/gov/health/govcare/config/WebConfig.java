package lk.gov.health.govcare.config;

import java.util.Arrays;
import java.util.List;
import lk.gov.health.govcare.security.AuthInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final AuthInterceptor authInterceptor;
  private final List<String> allowedOrigins;

  public WebConfig(AuthInterceptor authInterceptor, @Value("${govcare.cors.allowed-origins}") String allowedOrigins) {
    this.authInterceptor = authInterceptor;
    this.allowedOrigins = Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList();
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
      .allowedOrigins(allowedOrigins.toArray(String[]::new))
      .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
      .allowedHeaders("*")
      .exposedHeaders("Content-Disposition")
      .allowCredentials(true);
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(authInterceptor)
      .addPathPatterns("/api/**")
      .excludePathPatterns("/api/health");
  }
}


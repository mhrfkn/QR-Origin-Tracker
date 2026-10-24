package com.traceability.origintracker.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    /** Comma-separated list of allowed CORS origins, e.g. http://localhost:4200 */
    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CSRF is disabled because we use stateless JWT — no session cookies
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Serve Angular static assets and SPA routes without auth
                        .requestMatchers("/", "/index.html", "/*.js", "/*.css", "/*.ico",
                                "/assets/**", "/media/**", "/chunk-*.js", "/main-*.js",
                                "/polyfills-*.js", "/styles-*.css").permitAll()
                        // Non-API paths are SPA routes — forwarded to index.html by SpaController
                        .requestMatchers(request -> !request.getRequestURI().startsWith("/api/")).permitAll()
                        .anyRequest().authenticated()
                )
                .headers(headers -> headers
                        // Prevent MIME-type sniffing
                        .contentTypeOptions(Customizer.withDefaults())
                        // Deny embedding in iframes from foreign origins
                        .frameOptions(frame -> frame.deny())
                        // Force HTTPS for 1 year (only effective in production with real HTTPS)
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000)
                        )
                        // Restrict referrer info
                        .referrerPolicy(rp ->
                                rp.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                        )
                        // CSP: allows the Angular SPA to load its own scripts/styles
                        .contentSecurityPolicy(csp ->
                                csp.policyDirectives(
                                        "default-src 'self'; " +
                                        "script-src 'self' 'unsafe-inline'; " +
                                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
                                        "font-src 'self' https://fonts.gstatic.com; " +
                                        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com; " +
                                        "connect-src 'self'; " +
                                        "frame-ancestors 'none'"
                                )
                        )
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        // BCrypt with cost factor 12 (stronger than default 10)
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Only allow explicitly configured origins — no wildcard in production
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L); // cache preflight for 1 hour
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

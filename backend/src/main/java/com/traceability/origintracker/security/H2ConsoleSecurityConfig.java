package com.traceability.origintracker.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Permits the H2 console ONLY when the "h2" Spring profile is active.
 * In production (PostgreSQL profile), this bean is not loaded, so /h2-console
 * is blocked by the default security chain.
 */
@Configuration
@Profile("h2")
public class H2ConsoleSecurityConfig {

    @Bean
    @Order(1) // evaluate before the main SecurityFilterChain
    SecurityFilterChain h2ConsoleFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/h2-console/**")
                .csrf(csrf -> csrf.disable())
                // H2 console uses iframes, so allow same-origin framing for this path only
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/h2-console/**").permitAll()
                );
        return http.build();
    }
}

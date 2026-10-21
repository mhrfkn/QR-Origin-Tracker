package com.traceability.origintracker.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Minimal health check endpoint used by Railway to verify the service is up.
 * Already covered by the /api/public/** permit-all rule in SecurityConfig.
 */
@RestController
@RequestMapping("/api/public")
public class PublicHealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}

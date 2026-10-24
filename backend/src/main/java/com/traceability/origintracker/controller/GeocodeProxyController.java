package com.traceability.origintracker.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Proxies geocoding requests to Nominatim (OpenStreetMap).
 *
 * Browsers cannot set a custom User-Agent header (it is a "forbidden header name"),
 * but Nominatim's usage policy requires one. This proxy makes the call server-side
 * with a proper User-Agent, then forwards the result back to the Angular frontend.
 *
 * Endpoint is under /api/public/** so it requires no authentication.
 */
@RestController
@RequestMapping("/api/public/geocode")
public class GeocodeProxyController {

    private static final Logger log = LoggerFactory.getLogger(GeocodeProxyController.class);

    private static final String USER_AGENT =
            "QROriginTracker/1.0 (https://github.com/qr-origin-tracker; contact@qrorigintracker.com)";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam("q") String query) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "query param 'q' is required"));
        }

        // Build list of query candidates to try in order:
        // 1. Exact query
        // 2. Query + ", India" (if India not already in the string)
        // 3. First two comma-segments only (broader fallback)
        List<String> candidates = buildCandidates(query.trim());

        for (String candidate : candidates) {
            try {
                String encodedQuery = java.net.URLEncoder.encode(candidate, java.nio.charset.StandardCharsets.UTF_8);
                String url = "https://nominatim.openstreetmap.org/search"
                        + "?q=" + encodedQuery
                        + "&format=json&limit=1&addressdetails=1&accept-language=en";

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .header("User-Agent", USER_AGENT)
                        .header("Accept", "application/json")
                        .header("Accept-Language", "en")
                        .timeout(Duration.ofSeconds(6))
                        .GET()
                        .build();

                HttpResponse<String> response = httpClient.send(request,
                        HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() == 200) {
                    JsonNode arr = objectMapper.readTree(response.body());
                    if (arr.isArray() && arr.size() > 0) {
                        // Return raw JSON string to avoid Jackson re-serializing JsonNode metadata
                        String json = arr.get(0).toString();
                        return ResponseEntity.ok()
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(json);
                    }
                }

            } catch (Exception e) {
                log.warn("Geocode attempt failed for query '{}': {}", candidate, e.getMessage());
            }
        }

        // All candidates exhausted — return empty body with 204 so frontend shows fallback
        return ResponseEntity.noContent().build();
    }

    /** Builds ordered list of geocoding query candidates to try. */
    private List<String> buildCandidates(String raw) {
        java.util.List<String> list = new java.util.ArrayList<>();
        list.add(raw);

        boolean hasIndia = raw.toLowerCase().contains("india");
        if (!hasIndia) {
            list.add(raw + ", India");
        }

        // Broader fallback: first two comma-separated tokens
        if (raw.contains(",")) {
            String broader = java.util.Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .limit(2)
                    .collect(java.util.stream.Collectors.joining(", "));
            if (!broader.equals(raw)) {
                list.add(broader);
                if (!hasIndia) {
                    list.add(broader + ", India");
                }
            }
        }

        return list;
    }
}

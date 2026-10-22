package com.traceability.origintracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.traceability.origintracker.dto.ScanAnalyticsResponse;
import com.traceability.origintracker.dto.ScanAnalyticsResponse.CountryCount;
import com.traceability.origintracker.dto.ScanAnalyticsResponse.HourlyCount;
import com.traceability.origintracker.entity.CropBatch;
import com.traceability.origintracker.entity.ScanEvent;
import com.traceability.origintracker.repository.CropBatchRepository;
import com.traceability.origintracker.repository.ScanEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ScanService {

    private static final Logger log = LoggerFactory.getLogger(ScanService.class);

    private final ScanEventRepository scanEventRepository;
    private final CropBatchRepository cropBatchRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    public ScanService(ScanEventRepository scanEventRepository,
                       CropBatchRepository cropBatchRepository) {
        this.scanEventRepository = scanEventRepository;
        this.cropBatchRepository = cropBatchRepository;
    }

    /**
     * Records a scan asynchronously so the public QR page loads instantly.
     * IP geolocation is done via the free ip-api.com service (no key needed,
     * 45 req/min limit — sufficient for most farms at launch).
     */
    @Async
    @Transactional
    public void recordScan(UUID batchId, String rawIp) {
        CropBatch batch = cropBatchRepository.findById(batchId).orElse(null);
        if (batch == null) return;

        ScanEvent event = new ScanEvent();
        event.setBatch(batch);
        event.setScannedAt(Instant.now());

        // Normalise IP (strip IPv6 prefix, handle null)
        String ip = normaliseIp(rawIp);
        event.setIpAddress(ip);

        if (ip != null && !isPrivateIp(ip)) {
            try {
                // ip-api.com: free, no key, returns JSON
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("http://ip-api.com/json/" + ip + "?fields=country,city,status"))
                        .timeout(Duration.ofSeconds(4))
                        .GET()
                        .build();
                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    JsonNode node = objectMapper.readTree(resp.body());
                    if ("success".equals(node.path("status").asText())) {
                        event.setCountry(node.path("country").asText(null));
                        event.setCity(node.path("city").asText(null));
                    }
                }
            } catch (Exception e) {
                // Geolocation is best-effort — don't fail the scan record
                log.warn("Geolocation lookup failed for IP {}: {}", ip, e.getMessage());
            }
        }

        scanEventRepository.save(event);
    }

    /** Returns analytics summary for a batch (producer-protected — caller must verify ownership). */
    @Transactional(readOnly = true)
    public ScanAnalyticsResponse getAnalytics(UUID batchId) {
        CropBatch batch = cropBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));

        long total = scanEventRepository.countByBatchId(batchId);

        List<CountryCount> countries = scanEventRepository
                .countByCountryForBatch(batchId)
                .stream()
                .map(row -> new CountryCount((String) row[0], ((Number) row[1]).longValue()))
                .toList();

        // Compute hourly buckets in Java — works on both H2 and PostgreSQL
        Instant cutoff = Instant.now().minus(Duration.ofDays(7));
        List<ScanEvent> recentScans = scanEventRepository
                .findByBatchIdOrderByScannedAtDesc(batchId)
                .stream()
                .filter(e -> e.getScannedAt().isAfter(cutoff))
                .toList();

        // Group by truncated hour
        java.util.Map<Instant, Long> hourBuckets = new java.util.TreeMap<>();
        for (ScanEvent e : recentScans) {
            // Truncate to the start of the hour
            Instant hour = e.getScannedAt()
                    .truncatedTo(java.time.temporal.ChronoUnit.HOURS);
            hourBuckets.merge(hour, 1L, Long::sum);
        }

        List<HourlyCount> hourly = hourBuckets.entrySet().stream()
                .map(entry -> new HourlyCount(entry.getKey(), entry.getValue()))
                .toList();

        return new ScanAnalyticsResponse(
                batch.getId(),
                batch.getCropName(),
                total,
                countries,
                hourly
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String normaliseIp(String raw) {
        if (raw == null || raw.isBlank()) return null;
        // Strip IPv6-mapped IPv4 prefix ::ffff:
        if (raw.startsWith("::ffff:")) return raw.substring(7);
        return raw.trim();
    }

    private static boolean isPrivateIp(String ip) {
        return ip.startsWith("127.")
                || ip.startsWith("10.")
                || ip.startsWith("192.168.")
                || ip.startsWith("172.")
                || ip.equals("0:0:0:0:0:0:0:1")
                || ip.equals("::1")
                || ip.equals("localhost");
    }
}

package com.traceability.origintracker.controller;

import com.traceability.origintracker.dto.PublicOriginResponse;
import com.traceability.origintracker.service.BatchService;
import com.traceability.origintracker.service.ScanService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/public/batches")
public class PublicBatchController {

    private final BatchService batchService;
    private final ScanService scanService;

    public PublicBatchController(BatchService batchService, ScanService scanService) {
        this.batchService = batchService;
        this.scanService = scanService;
    }

    @GetMapping("/{batchId}")
    public PublicOriginResponse origin(@PathVariable UUID batchId, HttpServletRequest request) {
        // Record the scan asynchronously (non-blocking — won't slow down the response)
        String ip = extractClientIp(request);
        scanService.recordScan(batchId, ip);
        return batchService.publicOrigin(batchId);
    }

    /** Respect X-Forwarded-For when behind a proxy / load balancer. */
    private static String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // May contain a comma-separated list; take the first (client) IP
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

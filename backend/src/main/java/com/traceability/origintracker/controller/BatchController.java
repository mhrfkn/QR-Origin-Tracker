package com.traceability.origintracker.controller;

import com.traceability.origintracker.dto.BatchSummaryResponse;
import com.traceability.origintracker.dto.CreateBatchRequest;
import com.traceability.origintracker.service.BatchService;
import com.traceability.origintracker.service.QrCodeService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/batches")
public class BatchController {

    private final BatchService batchService;
    private final QrCodeService qrCodeService;

    public BatchController(BatchService batchService, QrCodeService qrCodeService) {
        this.batchService = batchService;
        this.qrCodeService = qrCodeService;
    }

    @PostMapping
    public BatchSummaryResponse create(Authentication authentication, @Valid @RequestBody CreateBatchRequest request) {
        return batchService.create(authentication.getName(), request);
    }

    @GetMapping
    public List<BatchSummaryResponse> mine(Authentication authentication) {
        return batchService.listMine(authentication.getName());
    }

    @GetMapping(value = "/{batchId}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] qr(Authentication authentication, @PathVariable UUID batchId) {
        var batch = batchService.requireOwned(authentication.getName(), batchId);
        return qrCodeService.pngForUrl(batchService.trackingUrl(batch.getId()));
    }
}

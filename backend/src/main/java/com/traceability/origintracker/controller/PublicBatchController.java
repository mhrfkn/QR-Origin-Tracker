package com.traceability.origintracker.controller;

import com.traceability.origintracker.dto.PublicOriginResponse;
import com.traceability.origintracker.service.BatchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/public/batches")
public class PublicBatchController {

    private final BatchService batchService;

    public PublicBatchController(BatchService batchService) {
        this.batchService = batchService;
    }

    @GetMapping("/{batchId}")
    public PublicOriginResponse origin(@PathVariable UUID batchId) {
        return batchService.publicOrigin(batchId);
    }
}

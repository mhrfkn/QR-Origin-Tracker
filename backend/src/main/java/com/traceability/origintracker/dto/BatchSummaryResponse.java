package com.traceability.origintracker.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BatchSummaryResponse(
        UUID id,
        String cropName,
        String variety,
        BigDecimal quantityKg,
        LocalDate harvestDate,
        boolean organic,
        String trackingUrl
) {
}

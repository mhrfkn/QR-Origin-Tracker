package com.traceability.origintracker.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PublicOriginResponse(
        UUID batchId,
        String cropName,
        String variety,
        BigDecimal quantityKg,
        LocalDate harvestDate,
        boolean organic,
        String originStory,
        String farmName,
        String farmLocation,
        String producerName
) {
}

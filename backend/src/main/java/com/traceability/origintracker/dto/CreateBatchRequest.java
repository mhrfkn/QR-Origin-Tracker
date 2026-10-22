package com.traceability.origintracker.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateBatchRequest(
        @NotBlank @Size(max = 120) String cropName,
        @Size(max = 120) String variety,
        @NotNull @DecimalMin("0.01") BigDecimal quantityKg,
        @NotNull LocalDate harvestDate,
        boolean organic,
        @NotBlank @Size(max = 2000) String originStory,
        @Size(max = 200) String grownIn
) {
}

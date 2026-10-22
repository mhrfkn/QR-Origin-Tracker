package com.traceability.origintracker.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ScanAnalyticsResponse(
        UUID batchId,
        String cropName,
        long totalScans,
        List<CountryCount> topCountries,
        List<HourlyCount> hourlySeries
) {

    public record CountryCount(String country, long count) {}

    public record HourlyCount(Instant hour, long count) {}
}

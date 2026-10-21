package com.traceability.origintracker.dto;

public record AuthResponse(
        String token,
        String name,
        String email,
        String farmName
) {
}

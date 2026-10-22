package com.traceability.origintracker.service;

import com.traceability.origintracker.dto.AuthResponse;
import com.traceability.origintracker.dto.LoginRequest;
import com.traceability.origintracker.dto.RegisterRequest;
import com.traceability.origintracker.entity.Producer;
import com.traceability.origintracker.repository.ProducerRepository;
import com.traceability.origintracker.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final ProducerRepository producerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            ProducerRepository producerRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.producerRepository = producerRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (producerRepository.existsByEmailIgnoreCase(request.email())) {
            // Return generic message to prevent user enumeration
            // (an attacker should not be able to discover which emails are registered)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }
        Producer producer = new Producer();
        producer.setName(request.name().trim());
        producer.setEmail(request.email().trim().toLowerCase());
        producer.setPasswordHash(passwordEncoder.encode(request.password()));
        producer.setFarmName(request.farmName().trim());
        producer.setFarmLocation(request.farmLocation().trim());
        producerRepository.save(producer);
        return toAuth(producer);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Producer producer = producerRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (!passwordEncoder.matches(request.password(), producer.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return toAuth(producer);
    }

    private AuthResponse toAuth(Producer producer) {
        return new AuthResponse(
                jwtService.generateToken(producer.getEmail()),
                producer.getName(),
                producer.getEmail(),
                producer.getFarmName()
        );
    }
}

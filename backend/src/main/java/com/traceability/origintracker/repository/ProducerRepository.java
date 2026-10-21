package com.traceability.origintracker.repository;

import com.traceability.origintracker.entity.Producer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProducerRepository extends JpaRepository<Producer, Long> {
    Optional<Producer> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);
}

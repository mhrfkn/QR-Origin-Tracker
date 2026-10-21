package com.traceability.origintracker.repository;

import com.traceability.origintracker.entity.CropBatch;
import com.traceability.origintracker.entity.Producer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CropBatchRepository extends JpaRepository<CropBatch, UUID> {
    List<CropBatch> findByProducerOrderByCreatedAtDesc(Producer producer);

    @Query("select b from CropBatch b join fetch b.producer where b.id = :id")
    Optional<CropBatch> findWithProducerById(UUID id);
}

package com.traceability.origintracker.repository;

import com.traceability.origintracker.entity.ScanEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ScanEventRepository extends JpaRepository<ScanEvent, Long> {

    /** Total scan count for a batch. */
    long countByBatchId(UUID batchId);

    /** All scan events for a batch, newest first. */
    List<ScanEvent> findByBatchIdOrderByScannedAtDesc(UUID batchId);

    /** Country breakdown for a batch. */
    @Query("""
            select coalesce(s.country, 'Unknown') as country, count(s) as cnt
            from ScanEvent s
            where s.batch.id = :batchId
            group by coalesce(s.country, 'Unknown')
            order by cnt desc
            """)
    List<Object[]> countByCountryForBatch(@Param("batchId") UUID batchId);

    /** Scan count per batch for a given producer (for the batches list). */
    @Query("""
            select s.batch.id, count(s)
            from ScanEvent s
            where s.batch.producer.email = :producerEmail
            group by s.batch.id
            """)
    List<Object[]> scanCountsForProducer(@Param("producerEmail") String producerEmail);
}

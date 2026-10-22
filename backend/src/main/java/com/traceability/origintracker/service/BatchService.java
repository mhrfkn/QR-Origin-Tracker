package com.traceability.origintracker.service;

import com.traceability.origintracker.dto.BatchSummaryResponse;
import com.traceability.origintracker.dto.CreateBatchRequest;
import com.traceability.origintracker.dto.PublicOriginResponse;
import com.traceability.origintracker.dto.UpdateBatchRequest;
import com.traceability.origintracker.entity.CropBatch;
import com.traceability.origintracker.entity.Producer;
import com.traceability.origintracker.repository.CropBatchRepository;
import com.traceability.origintracker.repository.ProducerRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class BatchService {

    private final CropBatchRepository cropBatchRepository;
    private final ProducerRepository producerRepository;
    private final String frontendBaseUrl;

    public BatchService(
            CropBatchRepository cropBatchRepository,
            ProducerRepository producerRepository,
            @Value("${app.frontend-base-url}") String frontendBaseUrl
    ) {
        this.cropBatchRepository = cropBatchRepository;
        this.producerRepository = producerRepository;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    @Transactional
    public BatchSummaryResponse create(String producerEmail, CreateBatchRequest request) {
        Producer producer = requireProducer(producerEmail);
        CropBatch batch = new CropBatch();
        batch.setCropName(request.cropName().trim());
        batch.setVariety(blankToNull(request.variety()));
        batch.setQuantityKg(request.quantityKg());
        batch.setHarvestDate(request.harvestDate());
        batch.setOrganic(request.organic());
        batch.setOriginStory(request.originStory().trim());
        batch.setGrownIn(blankToNull(request.grownIn()));
        batch.setProducer(producer);
        cropBatchRepository.save(batch);
        return toSummary(batch);
    }

    @Transactional(readOnly = true)
    public List<BatchSummaryResponse> listMine(String producerEmail) {
        Producer producer = requireProducer(producerEmail);
        return cropBatchRepository.findByProducerOrderByCreatedAtDesc(producer).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public CropBatch requireOwned(String producerEmail, UUID batchId) {
        Producer producer = requireProducer(producerEmail);
        CropBatch batch = cropBatchRepository.findWithProducerById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));
        if (!batch.getProducer().getId().equals(producer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this batch");
        }
        return batch;
    }

    @Transactional(readOnly = true)
    public PublicOriginResponse publicOrigin(UUID batchId) {
        CropBatch batch = cropBatchRepository.findWithProducerById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));
        Producer producer = batch.getProducer();
        return new PublicOriginResponse(
                batch.getId(),
                batch.getCropName(),
                batch.getVariety(),
                batch.getQuantityKg(),
                batch.getHarvestDate(),
                batch.isOrganic(),
                batch.getOriginStory(),
                producer.getFarmName(),
                producer.getFarmLocation(),
                producer.getName(),
                batch.getGrownIn() != null ? batch.getGrownIn() : producer.getFarmLocation()
        );
    }

    @Transactional
    public BatchSummaryResponse update(String producerEmail, UUID batchId, UpdateBatchRequest request) {
        CropBatch batch = requireOwned(producerEmail, batchId);
        batch.setCropName(request.cropName().trim());
        batch.setVariety(blankToNull(request.variety()));
        batch.setQuantityKg(request.quantityKg());
        batch.setHarvestDate(request.harvestDate());
        batch.setOrganic(request.organic());
        batch.setOriginStory(request.originStory().trim());
        batch.setGrownIn(blankToNull(request.grownIn()));
        cropBatchRepository.save(batch);
        return toSummary(batch);
    }

    @Transactional
    public void delete(String producerEmail, UUID batchId) {
        CropBatch batch = requireOwned(producerEmail, batchId);
        cropBatchRepository.delete(batch);
    }

    public String trackingUrl(UUID batchId) {
        return frontendBaseUrl + "/track/" + batchId;
    }

    private BatchSummaryResponse toSummary(CropBatch batch) {
        return new BatchSummaryResponse(
                batch.getId(),
                batch.getCropName(),
                batch.getVariety(),
                batch.getQuantityKg(),
                batch.getHarvestDate(),
                batch.isOrganic(),
                trackingUrl(batch.getId())
        );
    }

    private Producer requireProducer(String email) {
        return producerRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Producer not found"));
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}

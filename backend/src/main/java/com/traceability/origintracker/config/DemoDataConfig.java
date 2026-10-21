package com.traceability.origintracker.config;

import com.traceability.origintracker.dto.CreateBatchRequest;
import com.traceability.origintracker.entity.Producer;
import com.traceability.origintracker.repository.ProducerRepository;
import com.traceability.origintracker.service.BatchService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDate;

@Configuration
public class DemoDataConfig {

    @Bean
    CommandLineRunner seedDemoProducer(
            ProducerRepository producerRepository,
            PasswordEncoder passwordEncoder,
            BatchService batchService
    ) {
        return args -> {
            if (producerRepository.existsByEmailIgnoreCase("producer@harvest.local")) {
                return;
            }
            Producer producer = new Producer();
            producer.setName("Meharoof Farms");
            producer.setEmail("producer@harvest.local");
            producer.setPasswordHash(passwordEncoder.encode("harvest123"));
            producer.setFarmName("Green Valley Organics");
            producer.setFarmLocation("Nashik, Maharashtra");
            producerRepository.save(producer);

            batchService.create("producer@harvest.local", new CreateBatchRequest(
                    "Organic Tomatoes",
                    "Heirloom",
                    new BigDecimal("50.00"),
                    LocalDate.now().minusDays(1),
                    true,
                    "Picked at sunrise from open-field beds watered with drip irrigation. No synthetic pesticides. Packed the same morning so the crate you scan is still close to the soil it came from."
            ));
        };
    }
}

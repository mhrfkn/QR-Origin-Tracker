package com.traceability.origintracker.security;

import com.traceability.origintracker.entity.Producer;
import com.traceability.origintracker.repository.ProducerRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProducerUserDetailsService implements UserDetailsService {

    private final ProducerRepository producerRepository;

    public ProducerUserDetailsService(ProducerRepository producerRepository) {
        this.producerRepository = producerRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        Producer producer = producerRepository.findByEmailIgnoreCase(username)
                .orElseThrow(() -> new UsernameNotFoundException("Producer not found"));
        return User.withUsername(producer.getEmail())
                .password(producer.getPasswordHash())
                .authorities(List.of())
                .build();
    }
}

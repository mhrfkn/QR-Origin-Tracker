# ── Stage 1: Build Angular frontend ──────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
# Copy dependency manifests first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# Copy source and build for production
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Spring Boot JAR ───────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS backend-build
WORKDIR /app/backend
# Copy Maven wrapper and pom first for dependency caching
COPY backend/.mvn .mvn
COPY backend/mvnw backend/mvnw.cmd backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline -Dskip.frontend=true

# Copy Angular dist into Spring Boot static resources
COPY --from=frontend-build /app/frontend/dist/frontend/browser src/main/resources/static/

# Copy backend source and build (skip Angular build — we already copied it above)
COPY backend/src src
RUN ./mvnw -B package -DskipTests -Dskip.frontend=true

# ── Stage 3: Minimal runtime image ───────────────────────────────────────────
FROM eclipse-temurin:21-jre
WORKDIR /app
# Create upload directory
RUN mkdir -p /tmp/uploads
COPY --from=backend-build /app/backend/target/origin-tracker-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=render"]

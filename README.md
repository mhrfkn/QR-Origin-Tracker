# QR Code Origin Tracker

## Project Title
**QR Code Origin Tracker** — Web Application for Verifiable Crop Batch Traceability

## Abstract
The **QR Code Origin Tracker** is a full-stack web application designed to bring transparent, verifiable traceability to agricultural supply chains. A registered farm producer logs into a secure portal, creates a crop batch record capturing crop details, variety, harvest date, organic status, origin story, and farm location. The backend generates a universally unique identifier (UUID) for each batch and encodes a public-facing tracking URL into a downloadable QR code image (PNG).

When a consumer, retailer, or inspector scans the QR code with any smartphone camera, they are directed to a publicly accessible Origin Story page displaying full farm and batch details without requiring any login. Each scan is logged with geolocation lookup, enabling producers to view real-time scan analytics and distribution reach.

## Student and Guide
- **Student**: Muhammed Meharoof K N
- **Register Number**: VAS25MCA-2042 (Roll No: 42)
- **Course**: 20MCA245 Mini Project
- **Class**: S3 MCA (2025 Admissions)
- **Department**: Department of Computer Applications
- **Institution**: Vidya Academy of Science & Technology, Thrissur
- **Project Guide**: Ms. Salkala K S
- **Head of Department**: Dr. Reji C Joy

## Tech Stack
- **Backend**: Java 21, Spring Boot 4, Spring Data JPA, Spring Security (Stateless JWT), ZXing (QR Code generation)
- **Database**: H2 in-memory (Development), PostgreSQL (Production)
- **Frontend**: Angular 20, TypeScript, Standalone Components, Angular Signals, RxJS, Vanilla CSS
- **Deployment & Cloud**: Render, Railway

## Setup Instructions

### Prerequisites
- Java 21+ (`$env:JAVA_HOME = "$env:USERPROFILE\.jdks\openjdk-25.0.2"`)
- Node.js 18+ and npm

### 1. Backend (Spring Boot API)
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
- API Base URL: `http://localhost:8080`
- H2 Console: `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:origindb`)

### 2. Frontend (Angular App)
```powershell
cd frontend
npm install
npm start
```
- App URL: `http://localhost:4200` (proxies `/api` requests to backend)

### Demo Producer Credentials
- **Email**: `producer@harvest.local`
- **Password**: `harvest123`

## Screenshots / Demo
- **Producer Portal**: Batch creation, QR code generator, and real-time scan analytics.
- **Consumer Origin Page**: Accessible at `/track/{uuid}` via mobile QR scan.

## Problem Statement
Traditional agricultural supply chains lack transparency. Consumers and retailers have no verifiable way to confirm the authenticity, harvest date, and geographical origin of produce. Producers also lack direct visibility into where and when their harvested goods reach end consumers.

## Outcome
A secure, responsive, full-stack application enabling:
1. Producer crop batch registration with automated cryptographic UUID and QR code generation.
2. Frictionless public verification via smartphone scan without app download or login.
3. Producer analytics dashboard tracking scan frequency and geographic reach.

## API Endpoints Summary

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new producer account |
| `POST` | `/api/auth/login` | Public | Producer login & JWT generation |
| `GET` | `/api/public/batches/{uuid}` | Public | Public batch origin details |
| `POST` | `/api/batches` | JWT Protected | Create new crop batch |
| `GET` | `/api/batches` | JWT Protected | List all producer batches |
| `GET` | `/api/batches/{uuid}/qr` | JWT Protected | Download QR code (PNG) |

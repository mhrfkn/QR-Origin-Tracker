# QR Code Origin Tracker

Web app for crop batch traceability: a producer registers a harvest, the API assigns a UUID and generates a QR code, and a phone scan opens a public origin story.

## Layout

- `backend` — Spring Boot 4 API (JWT for producers, public read for scanners)
- `frontend` — Angular 20 app (`/track/:batchId` origin page)

## Run

You need Java 21+ and Node.js. This machine has OpenJDK under `%USERPROFILE%\.jdks\openjdk-25.0.2`.

### API

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\openjdk-25.0.2"
cd backend
.\mvnw.cmd spring-boot:run
```

API: http://localhost:8080  
H2 console: http://localhost:8080/h2-console (JDBC URL `jdbc:h2:mem:origindb`)

### UI

```powershell
cd frontend
npm start
```

UI: http://localhost:4200 (proxies `/api` to the backend)

## Demo producer

- Email: `producer@harvest.local`
- Password: `harvest123`

Log in, open **Print QR**, then visit `/track/{uuid}` (or scan the code on a phone on the same network after pointing `app.frontend-base-url` at that host).

## API map

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/public/batches/{uuid}` | public |
| POST | `/api/batches` | JWT |
| GET | `/api/batches` | JWT |
| GET | `/api/batches/{uuid}/qr` | JWT (PNG) |

# ---------- Build frontend ----------
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Build backend ----------
FROM golang:1.24-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum* ./
RUN go mod download
COPY backend/ ./
RUN go mod tidy && CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

# ---------- Runtime ----------
FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=api /server /app/server
COPY --from=web /web/dist /app/web
ENV STATIC_DIR=/app/web PORT=8080 TRUST_PROXY=true
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/app/server"]

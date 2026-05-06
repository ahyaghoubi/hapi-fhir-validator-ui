# Build from repository root: docker build -f ui-server/Dockerfile .
FROM node:22-alpine AS build

# Path grpcClient resolves from dist/server: ../../../hapi-fhir-validator/... → /app/hapi-fhir-validator/...
COPY hapi-fhir-validator/src/main/proto/fhir-validator.proto /app/hapi-fhir-validator/src/main/proto/fhir-validator.proto

WORKDIR /app/ui-server
COPY ui-server/package.json ui-server/package-lock.json ./
RUN npm ci
COPY ui-server/ ./
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/ui-server
ENV NODE_ENV=production

COPY --from=build /app/hapi-fhir-validator/src/main/proto/fhir-validator.proto /app/hapi-fhir-validator/src/main/proto/fhir-validator.proto
COPY --from=build /app/ui-server/package.json /app/ui-server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/ui-server/dist ./dist
COPY --from=build /app/ui-server/web/dist ./web/dist

EXPOSE 8080
ENV BFF_HOST=0.0.0.0
ENV BFF_PORT=8080
# Default for “validator on Docker host”; override for in-network services (e.g. -e FHIR_VALIDATOR_GRPC_HOST=other-service).
ENV FHIR_VALIDATOR_GRPC_HOST=host.docker.internal
ENV FHIR_VALIDATOR_GRPC_PORT=50051

CMD ["node", "dist/server/index.js"]

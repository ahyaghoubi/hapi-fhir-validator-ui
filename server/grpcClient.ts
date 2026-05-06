import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROTO_REL = "hapi-fhir-validator/src/main/proto/fhir-validator.proto";

/**
 * Default proto path: sibling `hapi-fhir-validator` under the monorepo root (`devenv/`).
 * `tsx server/...` runs from `server/`; `node dist/server/...` runs one level deeper, so we try both.
 */
export function resolveProtoPath(): string {
  if (process.env.FHIR_VALIDATOR_PROTO_PATH) {
    return path.resolve(process.env.FHIR_VALIDATOR_PROTO_PATH);
  }
  const fromSourceTree = path.resolve(__dirname, "..", "..", PROTO_REL);
  const fromCompiledTree = path.resolve(__dirname, "..", "..", "..", PROTO_REL);
  if (fs.existsSync(fromSourceTree)) return fromSourceTree;
  if (fs.existsSync(fromCompiledTree)) return fromCompiledTree;
  return fromCompiledTree;
}

/** Typed loosely; methods are invoked by name via {@link promisifyUnary}. */
export type FhirValidatorClient = grpc.Client;

export function createClient(): FhirValidatorClient {
  const protoPath = resolveProtoPath();
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: Number,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(packageDefinition) as {
    fhir_validator: { FhirValidatorService: grpc.ServiceClientConstructor };
  };
  const host = process.env.FHIR_VALIDATOR_GRPC_HOST ?? "127.0.0.1";
  const port = process.env.FHIR_VALIDATOR_GRPC_PORT ?? "50051";
  const target = `${host}:${port}`;
  const Ctor = loaded.fhir_validator.FhirValidatorService;
  return new Ctor(target, grpc.credentials.createInsecure());
}

export function grpcErrorMessage(err: grpc.ServiceError): string {
  return err.details || err.message || String(err.code);
}

export function promisifyUnary<TReq, TRes>(
  client: FhirValidatorClient,
  method: string,
  request: TReq
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const fn = (client as unknown as Record<string, (req: TReq, cb: grpc.requestCallback<TRes>) => void>)[
      method
    ];
    if (typeof fn !== "function") {
      reject(new Error(`Unknown gRPC method: ${method}`));
      return;
    }
    fn.call(client, request, (error: grpc.ServiceError | null, response: TRes | undefined) => {
      if (error) reject(error);
      else if (response === undefined) reject(new Error("gRPC empty response"));
      else resolve(response);
    });
  });
}

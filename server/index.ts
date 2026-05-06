import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import {
  createClient,
  grpcErrorMessage,
  promisifyUnary,
  resolveProtoPath,
} from "./grpcClient.js";
import { buffersToBase64, requestBytes } from "./serialize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32mb" }));

const client = createClient();

function grpcStatus(err: unknown): number {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as grpc.ServiceError).code;
    if (c === grpc.status.INVALID_ARGUMENT) return 400;
    if (c === grpc.status.NOT_FOUND) return 404;
  }
  return 502;
}

app.get("/api/v1/health", async (_req, res) => {
  try {
    const r = await promisifyUnary(client, "health", {});
    res.json(buffersToBase64(r));
  } catch (e) {
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/validate", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const resource_content = requestBytes(b);
    const rawProfiles = b.profile_urls;
    if (
      rawProfiles != null &&
      rawProfiles !== "" &&
      !Array.isArray(rawProfiles)
    ) {
      console.warn(
        "[BFF /validate] profile_urls must be a JSON array of strings; got %s — sending empty list to gRPC (bundle_focus rules will not apply).",
        typeof rawProfiles,
      );
    }
    const request = {
      resource_content,
      format: Number(b.format ?? 0),
      fhir_version: Number(b.fhir_version ?? 0),
      profile_urls: Array.isArray(b.profile_urls) ? b.profile_urls : [],
      engine_config: (b.engine_config as object) ?? {},
      instance_config: (b.instance_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
      bundle_focus: String(b.bundle_focus ?? ""),
    };
    const r = await promisifyUnary(client, "validate", request);
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/engine/init", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "initEngine", {
      engine_config: (b.engine_config as object) ?? {},
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/engine/load-ig", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "loadImplementationGuide", {
      session_id: String(b.session_id ?? ""),
      ig_source: String(b.ig_source ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.get("/api/v1/engine/capabilities", async (req, res) => {
  try {
    const session_id = String(req.query.session_id ?? "");
    const r = await promisifyUnary(client, "getEngineCapabilities", { session_id });
    res.json(buffersToBase64(r));
  } catch (e) {
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/convert-version", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "convertVersion", {
      resource_content: requestBytes(b),
      format: Number(b.format ?? 0),
      target_version: String(b.target_version ?? ""),
      engine_config: (b.engine_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/transform", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "transform", {
      resource_content: requestBytes(b),
      input_format: Number(b.input_format ?? 0),
      map_uri: String(b.map_uri ?? ""),
      output_format: Number(b.output_format ?? 0),
      engine_config: (b.engine_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/generate-snapshot", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const structure_definition_content = requestBytes(b, {
      b64Key: "structure_definition_content_b64",
      textKey: "structure_definition_text",
    });
    const r = await promisifyUnary(client, "generateSnapshot", {
      structure_definition_content,
      format: Number(b.format ?? 0),
      engine_config: (b.engine_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/evaluate-fhirpath", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "evaluateFhirPath", {
      resource_content: requestBytes(b),
      format: Number(b.format ?? 0),
      expression: String(b.expression ?? ""),
      engine_config: (b.engine_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/generate-narrative", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "generateNarrative", {
      resource_content: requestBytes(b),
      format: Number(b.format ?? 0),
      engine_config: (b.engine_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

app.post("/api/v1/convert-format", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const r = await promisifyUnary(client, "convertFormat", {
      resource_content: requestBytes(b),
      input_format: Number(b.input_format ?? 0),
      output_format: Number(b.output_format ?? 0),
      engine_config: (b.engine_config as object) ?? {},
      session_id: String(b.session_id ?? ""),
    });
    res.json(buffersToBase64(r));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Provide resource")) {
      res.status(400).json({ message: e.message });
      return;
    }
    res.status(grpcStatus(e)).json({ message: grpcErrorMessage(e as grpc.ServiceError) });
  }
});

/** Proto path check for operators */
app.get("/api/v1/meta/proto", (_req, res) => {
  const p = resolveProtoPath();
  res.json({ path: p, exists: fs.existsSync(p) });
});

const BFF_PORT = Number(process.env.BFF_PORT ?? "8080");
const BFF_HOST = process.env.BFF_HOST ?? "0.0.0.0";
const webDist = path.resolve(__dirname, "../../web/dist");

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    const index = path.join(webDist, "index.html");
    if (fs.existsSync(index)) res.sendFile(index);
    else next();
  });
}

app.listen(BFF_PORT, BFF_HOST, () => {
  console.log(`BFF listening on http://${BFF_HOST}:${BFF_PORT} (all interfaces if host is 0.0.0.0)`);
  console.log(`Proto: ${resolveProtoPath()} (exists: ${fs.existsSync(resolveProtoPath())})`);
  if (!fs.existsSync(webDist)) {
    console.log("Note: web/dist missing — run `npm run build` for production static files; dev UI uses Vite on :5173");
  }
});

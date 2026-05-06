# FHIR Validator UI (`ui-server`)

Browser UI for [`FhirValidatorService`](../hapi-fhir-validator/src/main/proto/fhir-validator.proto) backed by a small **Node BFF** (Express + `@grpc/grpc-js`). The Java validator speaks gRPC on HTTP/2; the BFF translates JSON/REST to gRPC so the React app can run in a normal browser.

## Layout

| Path | Purpose |
|------|---------|
| [`server/`](server/) | Express on `BFF_HOST`:`BFF_PORT` (default **0.0.0.0:8080**), REST under `/api/v1/*` |
| [`web/`](web/) | Vite + React + TypeScript; dev **5173** / preview **4173** on **0.0.0.0**; dev proxies `/api` → BFF on localhost |

## Prerequisites

- **Node.js 20+** and npm (Node 24 LTS works; if you use **nvm**, ensure `node` is on `PATH` in the shell where you run npm—e.g. `source ~/.nvm/nvm.sh` or use the full path under `~/.nvm/versions/node/.../bin`)
- **FHIR validator** running with gRPC (e.g. [`hapi-fhir-validator`](../hapi-fhir-validator) on `127.0.0.1:50051`)

If `npm install` fails with **EACCES** under `node_modules`, fix ownership of `ui-server/` (e.g. `chown -R "$(whoami)" .` from this directory) so your user can write there.

## Proto path

By default the BFF looks for the proto next to the `ui-server` folder (sibling `hapi-fhir-validator` under the repo root). That works for both **`tsx server/...`** (paths from `server/`) and **`node dist/server/...`** (paths from `dist/server/`). Override with:

```bash
export FHIR_VALIDATOR_PROTO_PATH=/absolute/path/to/fhir-validator.proto
```

Check resolution: open **Overview → Proto path** in the UI or `GET /api/v1/meta/proto`.

## Environment (BFF)

| Variable | Default | Purpose |
|----------|---------|---------|
| `FHIR_VALIDATOR_GRPC_HOST` | `127.0.0.1` | Validator host |
| `FHIR_VALIDATOR_GRPC_PORT` | `50051` | Validator gRPC port |
| `FHIR_VALIDATOR_PROTO_PATH` | *(see above)* | Path to `fhir-validator.proto` |
| `BFF_HOST` | `0.0.0.0` | Express bind address (`127.0.0.1` to restrict to loopback) |
| `BFF_PORT` | `8080` | Express listen port |
| `VITE_DEV_HOST` | `0.0.0.0` | Vite `server` / `preview` bind address (dev UI and `npm run preview`) |

## Development

From this directory (`ui-server/`):

```bash
npm install
npm run dev
```

- UI: http://localhost:5173 (or `http://<machine-ip>:5173` from another host on the LAN)  
- BFF: http://localhost:8080 (or `http://<machine-ip>:8080` for direct API use)  

`npm run dev` runs the BFF (watch) and Vite together. Both listen on **0.0.0.0** by default so the UI and API are reachable from other machines (subject to firewall rules). The Vite proxy still targets the BFF at `127.0.0.1:8080` on the same host.

## Production build

```bash
npm run build
npm start
```

Builds TypeScript to `dist/server/` and the SPA to `web/dist/`. `npm start` runs Node and serves the static UI from `web/dist` when present (BFF on `0.0.0.0` by default). For a static preview without the BFF, `npm run preview` serves the built SPA on **0.0.0.0:4173** (API calls need the BFF running separately).

## Docker Compose

Runs **only** the UI BFF in a container. Start [`hapi-fhir-validator`](../hapi-fhir-validator) (or any compatible gRPC service) **on the host** on **50051** first, then from `ui-server/`:

```bash
docker compose up --build
```

Open **http://localhost:8080**. Compose sets `FHIR_VALIDATOR_GRPC_HOST=host.docker.internal` and `extra_hosts: host.docker.internal:host-gateway` so the container can reach the host on Linux; change `FHIR_VALIDATOR_GRPC_PORT` if your validator listens elsewhere.

[`docker-compose.yml`](docker-compose.yml) sets a **512 MiB** memory limit (and a small reservation) on the `ui` service so it cannot exhaust the host; increase `deploy.resources.limits.memory` if the BFF needs more headroom for very large requests or responses.

The image is built with the repo root as context (`dockerfile: ui-server/Dockerfile`) so `fhir-validator.proto` is copied to the path the BFF expects inside the container.

## REST API (BFF)

- `GET /api/v1/health` — gRPC `Health`
- `GET /api/v1/meta/proto` — proto file path and existence
- `POST /api/v1/validate` — body mirrors `ValidateRequest`; use `resource_text` (UTF-8) or `resource_content_b64`; optional **`bundle_focus`** (e.g. `DiagnosticReport:0`) matches validator_cli **`-bundle`**. **`profile_urls` must be a JSON array** (e.g. `["https://…/StructureDefinition/X"]`); if you send a single string, the BFF logs a **warning** to stderr and forwards an **empty** list, so bundle-focus profile rules never apply.
- `POST /api/v1/engine/init`, `POST /api/v1/engine/load-ig`, `GET /api/v1/engine/capabilities?session_id=`
- `POST /api/v1/convert-version`, `POST /api/v1/convert-format`, `POST /api/v1/transform`, `POST /api/v1/generate-snapshot`, `POST /api/v1/evaluate-fhirpath`, `POST /api/v1/generate-narrative`

Byte fields in responses are returned as **base64** strings in JSON.

## Jupyter notebooks vs FHIR resources

A **`.ipynb` file** (nbformat JSON with `cells`, `metadata`, etc.) is **not** a FHIR resource. The **Validate** tab expects the **same payload you pass to `validator_cli.jar`**: e.g. the **Message `Bundle` JSON** (`LRI-GeneVariant-3.txt.json` in your notebook), not the notebook itself.

## Example: message bundle + implementation guide (validator_cli–style)

Rough equivalent of:

`validator_cli.jar …/LRI-GeneVariant-3.txt.json -version 4.0.1 -ig package.tgz -bundle DiagnosticReport:0 https://fhir.nwgenomics.nhs.uk/StructureDefinition/DiagnosticReport -tx n/a`

1. Start [`hapi-fhir-validator`](../hapi-fhir-validator) so gRPC is reachable from the BFF.
2. **Engine** → **Init engine** with `engine_config` JSON (field names match the proto; proto-loader uses **snake_case**):

```json
{
  "fhir_version": "4.0.1",
  "implementation_guides": ["https://nw-gmsa.github.io/package.tgz"],
  "tx_server": "n/a"
}
```

Use a **filesystem path** instead of the URL if the validator host cannot download the package (e.g. `"/path/to/package.tgz"`). If you prefer a two-step flow, init with `{}` or minimal config, then **Load IG** with the same URL/path and reuse the returned **session id**.

3. **Validate** → paste the **Bundle JSON** into **Resource**, set **Format** to **JSON**, **FHIR version hint** to **R4**.
4. **Bundle focus** (optional): enter `DiagnosticReport:0` — same as **`-bundle DiagnosticReport:0`** on validator_cli (0-based index among `Bundle.entry` resources of that type).

5. **Profile URLs**: one line:

`https://fhir.nwgenomics.nhs.uk/StructureDefinition/DiagnosticReport`

6. **Session ID**: paste the `session_id` from **Init engine** (or from Load IG if you used that path) so validation uses the engine that already loaded the IG.

7. In the JSON result, use **`operation_outcome_json`** (and the structured `issues` list) for machine-readable output similar to the CLI’s `-output-style json` **OperationOutcome** file.

REST example with bundle focus:

```json
{
  "resource_text": "{ ... Bundle JSON ... }",
  "format": 1,
  "fhir_version": 4,
  "profile_urls": ["https://fhir.nwgenomics.nhs.uk/StructureDefinition/DiagnosticReport"],
  "session_id": "<from init>",
  "bundle_focus": "DiagnosticReport:0",
  "engine_config": { "fhir_version": "4.0.1", "implementation_guides": ["https://nw-gmsa.github.io/package.tgz"], "tx_server": "n/a" }
}
```

## Changelog

- **BFF**: If `profile_urls` is present but not a JSON array, the server logs `[BFF /validate] profile_urls must be a JSON array…` to stderr and forwards `[]` to gRPC.

## Related

- Validator service: [../hapi-fhir-validator/README.md](../hapi-fhir-validator/README.md)
# hapi-fhir-validator-ui

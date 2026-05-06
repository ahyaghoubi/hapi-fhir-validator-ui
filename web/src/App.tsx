import { useCallback, useState } from "react";
import { api } from "./api";

type Tab =
  | "overview"
  | "validate"
  | "engine"
  | "convert"
  | "transform"
  | "snapshot"
  | "fhirpath"
  | "narrative";

const FORMATS: { v: number; label: string }[] = [
  { v: 0, label: "UNSPECIFIED" },
  { v: 1, label: "JSON" },
  { v: 2, label: "XML" },
  { v: 3, label: "TURTLE" },
  { v: 4, label: "SHC" },
  { v: 5, label: "TEXT" },
  { v: 6, label: "VBAR" },
];

const VERSIONS: { v: number; label: string }[] = [
  { v: 0, label: "UNSPECIFIED" },
  { v: 1, label: "DSTU2" },
  { v: 2, label: "DSTU2016MAY" },
  { v: 3, label: "DSTU3" },
  { v: 4, label: "R4" },
  { v: 5, label: "R4B" },
  { v: 6, label: "R5" },
];

function stringifyPreview(data: Record<string, unknown>): string {
  const clone = { ...data };
  for (const k of Object.keys(clone)) {
    const val = clone[k];
    if (typeof val === "string" && val.length > 80 && /^[A-Za-z0-9+/=]+$/.test(val.slice(0, 64))) {
      try {
        const dec = atob(val);
        if (/^[\x20-\x7E\n\r\t]+$/.test(dec.slice(0, 200))) {
          clone[`${k}_decoded_preview`] = dec.slice(0, 2000) + (dec.length > 2000 ? "…" : "");
        }
      } catch {
        /* ignore */
      }
    }
  }
  return JSON.stringify(clone, null, 2);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<string>("");

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setOut("");
    try {
      const r = await fn();
      setOut(typeof r === "object" && r !== null ? stringifyPreview(r as Record<string, unknown>) : String(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="app">
      <nav className="nav">
        <h1>FHIR Validator</h1>
        {(
          [
            ["overview", "Overview"],
            ["validate", "Validate"],
            ["engine", "Engine"],
            ["convert", "Convert & format"],
            ["transform", "Transform"],
            ["snapshot", "Snapshot"],
            ["fhirpath", "FHIRPath"],
            ["narrative", "Narrative"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "overview" && (
          <OverviewPanel run={run} loading={loading} error={error} out={out} />
        )}
        {tab === "validate" && (
          <ValidatePanel run={run} loading={loading} error={error} out={out} />
        )}
        {tab === "engine" && <EnginePanel run={run} loading={loading} error={error} out={out} />}
        {tab === "convert" && (
          <ConvertPanel run={run} loading={loading} error={error} out={out} />
        )}
        {tab === "transform" && (
          <TransformPanel run={run} loading={loading} error={error} out={out} />
        )}
        {tab === "snapshot" && (
          <SnapshotPanel run={run} loading={loading} error={error} out={out} />
        )}
        {tab === "fhirpath" && (
          <FhirPathPanel run={run} loading={loading} error={error} out={out} />
        )}
        {tab === "narrative" && (
          <NarrativePanel run={run} loading={loading} error={error} out={out} />
        )}
      </main>
    </div>
  );
}

function OutBlock({ error, out }: { error: string | null; out: string }) {
  return (
    <>
      {error && <div className="error">{error}</div>}
      {out && <pre className="out">{out}</pre>}
    </>
  );
}

function OverviewPanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  return (
    <div className="panel">
      <h2>Overview</h2>
      <p className="hint">Calls gRPC Health and shows proto file resolution used by the BFF.</p>
      <div className="row">
        <button type="button" className="primary" disabled={loading} onClick={() => run(() => api.health())}>
          Health
        </button>
        <button type="button" className="primary" disabled={loading} onClick={() => run(() => api.metaProto())}>
          Proto path
        </button>
      </div>
      <OutBlock error={error} out={out} />
    </div>
  );
}

function ValidatePanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [resourceText, setResourceText] = useState('{"resourceType":"Patient","id":"example"}');
  const [format, setFormat] = useState(1);
  const [fhirVersion, setFhirVersion] = useState(4);
  const [profiles, setProfiles] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [bundleFocus, setBundleFocus] = useState("");
  const [engineJson, setEngineJson] = useState("");
  const [instanceJson, setInstanceJson] = useState("");
  const [adv, setAdv] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = () => {
    setLocalErr(null);
    const body: Record<string, unknown> = {
      resource_text: resourceText,
      format,
      fhir_version: fhirVersion,
      profile_urls: profiles
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      session_id: sessionId,
      ...(bundleFocus.trim() ? { bundle_focus: bundleFocus.trim() } : {}),
    };
    if (engineJson.trim()) {
      try {
        body.engine_config = JSON.parse(engineJson);
      } catch {
        setLocalErr("engine_config JSON invalid");
        return;
      }
    }
    if (instanceJson.trim()) {
      try {
        body.instance_config = JSON.parse(instanceJson);
      } catch {
        setLocalErr("instance_config JSON invalid");
        return;
      }
    }
    run(() => api.validate(body));
  };

  return (
    <div className="panel">
      <h2>Validate</h2>
      <p className="hint">
        Resource as UTF-8 text (JSON/XML). Optional profiles (one URL per line). Use{" "}
        <strong>Bundle focus</strong> for the same behaviour as validator_cli{" "}
        <code>-bundle ResourceType:index</code> (e.g. <code>DiagnosticReport:0</code>).
      </p>
      <div className="field">
        <label>Resource</label>
        <textarea className="wide" value={resourceText} onChange={(e) => setResourceText(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>FHIR version hint</label>
          <select value={fhirVersion} onChange={(e) => setFhirVersion(Number(e.target.value))}>
            {VERSIONS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: "200px" }}>
          <label>Session ID (optional)</label>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Bundle focus (optional, e.g. DiagnosticReport:0)</label>
        <input
          className="wide"
          placeholder="validator_cli -bundle …"
          value={bundleFocus}
          onChange={(e) => setBundleFocus(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Profile URLs (one per line)</label>
        <textarea value={profiles} onChange={(e) => setProfiles(e.target.value)} rows={3} />
      </div>
      <button type="button" className="primary" onClick={() => setAdv(!adv)}>
        {adv ? "Hide" : "Show"} advanced Engine / Instance JSON
      </button>
      {adv && (
        <>
          <div className="field">
            <label>engine_config (JSON object)</label>
            <textarea value={engineJson} onChange={(e) => setEngineJson(e.target.value)} rows={6} />
          </div>
          <div className="field">
            <label>instance_config (JSON object)</label>
            <textarea value={instanceJson} onChange={(e) => setInstanceJson(e.target.value)} rows={6} />
          </div>
        </>
      )}
      <div className="row" style={{ marginTop: "1rem" }}>
        <button type="button" className="primary" disabled={loading} onClick={submit}>
          Validate
        </button>
      </div>
      <OutBlock error={localErr || error} out={out} />
    </div>
  );
}

function EnginePanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [engineJson, setEngineJson] = useState("{}");
  const [sessionId, setSessionId] = useState("");
  const [igSource, setIgSource] = useState("");

  return (
    <div className="panel">
      <h2>Engine</h2>
      <div className="field">
        <label>engine_config (JSON)</label>
        <textarea value={engineJson} onChange={(e) => setEngineJson(e.target.value)} rows={8} />
      </div>
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={loading}
          onClick={() => {
            try {
              run(() => api.engineInit({ engine_config: JSON.parse(engineJson || "{}") }));
            } catch {
              alert("Invalid JSON");
            }
          }}
        >
          Init engine
        </button>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "1.25rem 0" }} />
      <div className="field">
        <label>Session ID</label>
        <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
      </div>
      <div className="field">
        <label>IG source (path or URL)</label>
        <input value={igSource} onChange={(e) => setIgSource(e.target.value)} />
      </div>
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={loading}
          onClick={() => run(() => api.engineLoadIg({ session_id: sessionId, ig_source: igSource }))}
        >
          Load IG
        </button>
        <button
          type="button"
          className="primary"
          disabled={loading}
          onClick={() => run(() => api.engineCapabilities(sessionId))}
        >
          Capabilities
        </button>
      </div>
      <OutBlock error={error} out={out} />
    </div>
  );
}

function ConvertPanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [resourceText, setResourceText] = useState('{"resourceType":"Patient","id":"x"}');
  const [format, setFormat] = useState(1);
  const [targetVersion, setTargetVersion] = useState("5.0.0");
  const [inputFormat, setInputFormat] = useState(1);
  const [outputFormat, setOutputFormat] = useState(2);
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="panel">
      <h2>Convert version</h2>
      <div className="field">
        <label>Resource text</label>
        <textarea className="wide" value={resourceText} onChange={(e) => setResourceText(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Target version (e.g. 5.0.0)</label>
          <input value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)} />
        </div>
        <div className="field">
          <label>Session ID</label>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() =>
          run(() =>
            api.convertVersion({
              resource_text: resourceText,
              format,
              target_version: targetVersion,
              session_id: sessionId,
              engine_config: {},
            })
          )
        }
      >
        Convert version
      </button>

      <h2 style={{ marginTop: "2rem" }}>Convert format</h2>
      <div className="row">
        <div className="field">
          <label>Input format</label>
          <select value={inputFormat} onChange={(e) => setInputFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Output format</label>
          <select value={outputFormat} onChange={(e) => setOutputFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() =>
          run(() =>
            api.convertFormat({
              resource_text: resourceText,
              input_format: inputFormat,
              output_format: outputFormat,
              session_id: sessionId,
              engine_config: {},
            })
          )
        }
      >
        Convert format
      </button>
      <OutBlock error={error} out={out} />
    </div>
  );
}

function TransformPanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [resourceText, setResourceText] = useState("{}");
  const [inputFormat, setInputFormat] = useState(1);
  const [outputFormat, setOutputFormat] = useState(1);
  const [mapUri, setMapUri] = useState("");
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="panel">
      <h2>Transform (StructureMap)</h2>
      <div className="field">
        <label>Resource text</label>
        <textarea className="wide" value={resourceText} onChange={(e) => setResourceText(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Input format</label>
          <select value={inputFormat} onChange={(e) => setInputFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Output format</label>
          <select value={outputFormat} onChange={(e) => setOutputFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>map_uri</label>
          <input value={mapUri} onChange={(e) => setMapUri(e.target.value)} />
        </div>
        <div className="field">
          <label>Session ID</label>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() =>
          run(() =>
            api.transform({
              resource_text: resourceText,
              input_format: inputFormat,
              output_format: outputFormat,
              map_uri: mapUri,
              session_id: sessionId,
              engine_config: {},
            })
          )
        }
      >
        Transform
      </button>
      <OutBlock error={error} out={out} />
    </div>
  );
}

function SnapshotPanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [text, setText] = useState("{}");
  const [format, setFormat] = useState(1);
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="panel">
      <h2>Generate snapshot</h2>
      <p className="hint">StructureDefinition as JSON/XML text.</p>
      <div className="field">
        <label>structure_definition_text</label>
        <textarea className="wide" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Session ID</label>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() =>
          run(() =>
            api.generateSnapshot({
              structure_definition_text: text,
              format,
              session_id: sessionId,
              engine_config: {},
            })
          )
        }
      >
        Generate snapshot
      </button>
      <OutBlock error={error} out={out} />
    </div>
  );
}

function FhirPathPanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [resourceText, setResourceText] = useState('{"resourceType":"Patient","id":"x"}');
  const [format, setFormat] = useState(1);
  const [expression, setExpression] = useState("id");
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="panel">
      <h2>Evaluate FHIRPath</h2>
      <div className="field">
        <label>Resource text</label>
        <textarea className="wide" value={resourceText} onChange={(e) => setResourceText(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Expression</label>
          <input value={expression} onChange={(e) => setExpression(e.target.value)} />
        </div>
        <div className="field">
          <label>Session ID</label>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() =>
          run(() =>
            api.evaluateFhirPath({
              resource_text: resourceText,
              format,
              expression,
              session_id: sessionId,
              engine_config: {},
            })
          )
        }
      >
        Evaluate
      </button>
      <OutBlock error={error} out={out} />
    </div>
  );
}

function NarrativePanel({
  run,
  loading,
  error,
  out,
}: {
  run: (fn: () => Promise<unknown>) => void;
  loading: boolean;
  error: string | null;
  out: string;
}) {
  const [resourceText, setResourceText] = useState('{"resourceType":"Patient","id":"x"}');
  const [format, setFormat] = useState(1);
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="panel">
      <h2>Generate narrative</h2>
      <div className="field">
        <label>Resource text</label>
        <textarea className="wide" value={resourceText} onChange={(e) => setResourceText(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(Number(e.target.value))}>
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Session ID</label>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="primary"
        disabled={loading}
        onClick={() =>
          run(() =>
            api.generateNarrative({
              resource_text: resourceText,
              format,
              session_id: sessionId,
              engine_config: {},
            })
          )
        }
      >
        Generate narrative
      </button>
      <OutBlock error={error} out={out} />
    </div>
  );
}

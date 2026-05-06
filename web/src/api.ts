const base = "/api/v1";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!r.ok) {
    const msg =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: string }).message)
        : text || r.statusText;
    throw new Error(msg);
  }
  return body as T;
}

export const api = {
  health: () => json<Record<string, unknown>>("/health"),
  metaProto: () => json<{ path: string; exists: boolean }>("/meta/proto"),
  validate: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/validate", { method: "POST", body: JSON.stringify(body) }),
  engineInit: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/engine/init", { method: "POST", body: JSON.stringify(body) }),
  engineLoadIg: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/engine/load-ig", { method: "POST", body: JSON.stringify(body) }),
  engineCapabilities: (sessionId: string) =>
    json<Record<string, unknown>>(`/engine/capabilities?session_id=${encodeURIComponent(sessionId)}`),
  convertVersion: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/convert-version", { method: "POST", body: JSON.stringify(body) }),
  transform: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/transform", { method: "POST", body: JSON.stringify(body) }),
  generateSnapshot: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/generate-snapshot", { method: "POST", body: JSON.stringify(body) }),
  evaluateFhirPath: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/evaluate-fhirpath", { method: "POST", body: JSON.stringify(body) }),
  generateNarrative: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/generate-narrative", { method: "POST", body: JSON.stringify(body) }),
  convertFormat: (body: Record<string, unknown>) =>
    json<Record<string, unknown>>("/convert-format", { method: "POST", body: JSON.stringify(body) }),
};

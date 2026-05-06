/**
 * Recursively turn Buffers in gRPC responses into base64 strings for JSON.
 */
export function buffersToBase64(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(buffersToBase64);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = buffersToBase64(v);
    }
    return out;
  }
  return value;
}

export function requestBytes(
  body: Record<string, unknown>,
  keys: { b64Key?: string; textKey?: string } = {}
): Buffer {
  const b64Key = keys.b64Key ?? "resource_content_b64";
  const textKey = keys.textKey ?? "resource_text";
  const b64 = body[b64Key];
  if (typeof b64 === "string" && b64.length > 0) {
    return Buffer.from(b64, "base64");
  }
  const text = body[textKey];
  if (typeof text === "string") {
    return Buffer.from(text, "utf8");
  }
  throw new Error(`Provide ${b64Key} or ${textKey}`);
}

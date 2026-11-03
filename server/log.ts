/** One JSON object per line, so `fly logs` can be grepped and parsed. */
export function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

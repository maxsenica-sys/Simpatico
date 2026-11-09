import type { ServerResponse } from "node:http";

/** Answer a Messages API request the way the API does: plain JSON, or SSE when `stream` is set. */
export function reply(res: ServerResponse, body: { model?: string; stream?: boolean }, id: string, text: string) {
  const message = { id, type: "message", role: "assistant", model: body.model, content: [] as unknown[], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } };
  if (!body.stream) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...message, content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 } }));
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const ev = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  ev("message_start", { message });
  ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  // Two chunks, so partial replies are exercised.
  const cut = Math.ceil(text.length / 2);
  for (const part of [text.slice(0, cut), text.slice(cut)]) if (part) ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: part } });
  ev("content_block_stop", { index: 0 });
  ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 10 } });
  ev("message_stop", {});
  res.end();
}

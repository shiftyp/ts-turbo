// This file defines the StreamSource type for TypeScript compatibility

/**
 * A StreamSource is any object that can be used as a source for Turbo Streams.
 * This includes WebSocket and EventSource objects.
 */
export type StreamSource = WebSocket | EventSource;

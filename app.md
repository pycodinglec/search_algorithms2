# Simulator UI and tutor snapshot bridge

`app.js` renders the recorded Python execution and supports forward, reverse,
seek, input selection, and resizable map/code panes. Original Python and trace
sources are unchanged by the tutor integration.

## Tutor protocol

Only an embedding parent at `https://duri.sehwa.hs.kr` or an HTTP localhost /
127.0.0.1 origin with an explicit port may request context. Standalone pages and
messages from sibling frames are ignored. Requests have `type: sehwa-search:request`,
`version: 1`, and an ASCII alphanumeric / underscore / hyphen `requestId` of 1–80
characters. Responses target the exact requesting origin, never `*`.

The response type is `sehwa-search:snapshot`, with the same version and request ID.
Its `snapshot` is null while loading, when hashing is unavailable, or if context
cannot be serialized safely. Otherwise it contains version, algorithm, example,
noCost, zero-based eventIndex, line (0 at completion), functionName,
sourceSha256 (SHA-256 of exact trace.source), variablesJson, and stateJson.
A line event identifies the next line to execute; variable/state values are from
before its execution. JSON fields are complete valid JSON, each at most 16,000
UTF-8 bytes; oversized content yields null instead of truncation. A stale load
or digest never replaces a newer selection. No unsolicited events, chat text,
identity, browser storage, or full source are sent. The host matches the digest
to its separately pinned source before teaching line-specific content.

Run `node tests/tutor_bridge.test.cjs` for protocol and load-race regression tests.

Numeric UI values round to at most two decimal places; trailing zeros are omitted. Trace values and Python calculations retain their original precision.

Trusted parent theme messages (`sehwa-search:theme`, version 1, light/dark only) set `data-host-theme` without resetting playback. The same origin and parent-window checks protect snapshots and themes. Standalone pages keep their own palette.

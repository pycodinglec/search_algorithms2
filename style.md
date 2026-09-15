# Simulator stylesheet

`style.css` styles the algorithm controls, execution timeline, map states, code,
variables, and responsive map/code splitter. It preserves the layout and
interaction sizes of the standalone simulator.

## Embedded Sehwa theme

Only `document.documentElement.dataset.hostTheme` set to `light` or `dark`
activates a Sehwa palette. The JavaScript bridge owns validation of host messages;
CSS never detects a referrer, persists a preference, or changes simulator state.
Pages without this attribute retain the original standalone palette.

The embedded light theme shares Sehwa cream, espresso, brown, and sand tokens.
The dark theme uses its charcoal, cocoa, ivory, and honey tokens. Theme variables
also cover controls, code syntax, highlighted execution line, splitter, focus
rings, native select color scheme, walls, and all previously fixed light surfaces.
Current nodes remain amber with a stronger border, queued nodes muted sage,
visited nodes muted blue, and the final path uses the primary accent. Wall
hatching and the selected-node outline retain their independent meanings.
Both themes set readable foreground colors for primary buttons and path cells.
These changes affect presentation only, never algorithm values or trace data.

## Verification

Check light/dark host switching while stepping and resizing, plus standalone
rendering without the attribute. Inspect current/queued/visited/path/wall states,
active code syntax, native controls, and keyboard focus in desktop and mobile
browser E2E. Integration tests and screenshots are owned by the release task.

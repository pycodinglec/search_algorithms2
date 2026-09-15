# Tutor bridge regression tests

Run `node tests/tutor_bridge.test.cjs` without third-party dependencies.
The test evaluates the protocol and asynchronous load functions from actual
app.js with controlled DOM and parent-message stubs, using a real trace fixture.
It checks source digest, complete variable/state JSON, forward/rewind state,
completion, UTF-8 size bounds, request IDs, origin/source rejection, unavailable
loading state, and stale load protection. Browser integration separately checks
the real iframe and controls; this test does not claim to validate layout.

# Simulator page shell

`index.html` provides the Korean algorithm selector, example and cost controls,
playback toolbar, map pane, code pane, and accessible resize separator. `app.js`
updates these elements using recorded Python execution; `style.css` defines the
responsive presentation. Preserve element IDs used by the script.

The script URL uses `app.js?v=tutor-20260915` so newly opened embedded pages
request the tutor snapshot bridge instead of reusing an older cached script.
The version query does not change the simulator source, routing, or execution.

The precision2-20260915 script version refreshes cached clients for two-decimal display.

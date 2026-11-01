import React from 'react'

// Rules real sites ship that break a naively mounted overlay: global resets
// with !important, `div:empty` hiding, cookie-banner killers aimed at fixed
// elements, and typography that every child inherits. The overlay has to look
// and behave the same on this page as on any other.
const HOSTILE_CSS = `
* { box-sizing: content-box !important; border: 0 !important; pointer-events: auto !important; }
div:empty { display: none !important; }
[style*="position:fixed"], [style*="position: fixed"] { position: static !important; }
body { text-transform: uppercase; letter-spacing: 0.3em; line-height: 3; font-size: 22px; }
`

/** Rendered on pages whose slug starts with `hostile-css` (see `client-mode/[slug]`). */
export const HostileCss: React.FC = () => <style>{HOSTILE_CSS}</style>

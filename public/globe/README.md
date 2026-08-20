# Globe textures — served locally, on purpose

`earth-night.jpg` and `earth-dark.jpg`, copied verbatim from
`three-globe@2.45.2/example/img/` — the version already installed in this
repo, so they match the library rather than whatever a CDN currently serves.

## Why they are here

The three globe surfaces used to load these from `https://unpkg.com/...` at
RUNTIME. That made the sphere's first paint depend on a third-party CDN being
reachable: with unpkg slow, blocked by a network policy, or down, the globe
rendered as an untextured ball with no indication why. A visualization whose
appearance depends on someone else's uptime is not a dependency worth having
for a 715KB image that ships in `node_modules` already.

## Updating

If `three-globe` is upgraded and the textures change, re-copy them:

    cp node_modules/three-globe/example/img/earth-{night,dark}.jpg public/globe/

Nothing fetches them over the network any more, so a stale copy stays stale
silently — that is the tradeoff taken deliberately in exchange for not
depending on a CDN at paint time.

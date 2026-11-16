# Sakuga VFX in Eureka

Source: https://github.com/finktheartist/sakuga-vfx
Gallery: https://sakuga-vfx.vercel.app/gallery/

`button.js`, `checkbox.js`, and `progress.js` are upstream standalone web
components, vendored locally so production does not depend on a third-party CDN.
The MIT license and copyright notice are retained in `LICENSE`.

React adapters and Eureka theme overrides live in `components/ui/sakuga/`.
They are used for study feedback actions, study checklists, and real note-job
progress. Native controls remain available when scripts cannot load. The
upstream components honor reduced-motion preferences.

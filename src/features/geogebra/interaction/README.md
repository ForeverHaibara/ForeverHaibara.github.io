# Linked object interaction

`ObjectLinkController` owns only transient selection and preview state. Its React
hook uses an external store; no construction, preference or autosave events are
emitted by hovering a graph node.

- Native GeoGebra `select` / `deselect` client events update Analysis.
- Graph nodes and object chips select native objects using `SelectObjects`.
- Hover and keyboard focus temporarily select the previewed object. Leaving the
  target restores the saved selection, including multiple selected objects.
- Programmatic selection suppresses its own client-event and undo notifications,
  avoiding feedback loops and unnecessary analysis or draft saves.
- Explicit native selection, deselection and document changes cancel stale queued
  previews. Deleted/renamed objects cannot leave a stale linked graph selection.
- No object colors, sizes, visibility or other document properties are changed.

GeoGebra's documented client API does not expose object mouse-over events. Native
canvas-to-Analysis linking therefore uses selection; Analysis-to-canvas previews
support both hover and keyboard focus. Keep this boundary explicit rather than
depending on GeoGebra's private DOM or changing construction scripts.

See the official [client events](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)
and [SelectObjects](https://geogebra.github.io/docs/manual/en/commands/SelectObjects/) documentation.

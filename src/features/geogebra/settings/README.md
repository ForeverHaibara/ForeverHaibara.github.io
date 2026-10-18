# Studio preferences

`defaults.ts` is the site-owned configuration entry point. `preferenceStore.ts`
validates browser-local preferences independently of document and layout storage.
The panel only edits typed preferences; `PreferenceController` translates them to
the public GeoGebra API. Keep engine behavior out of UI controls.

## Lifecycle and priority

- Fresh documents and imported .ggb files receive the current studio defaults.
  A new embedding is used for **Reset initial**, removing imported macros while
  preserving preferences. Never use GeoGebra `reset()` for this action.
- The default **preserve** policy compares each object's current label visibility,
  color and size/thickness with the last value the studio applied. Differences
  belong to the user and survive subsequent preference changes. This is per
  property: a custom color does not prevent a size change.
- Drafts persist this ownership baseline alongside their construction. Restoring
  the baseline before applying preferences preserves custom edits across reloads.
  A separately imported file has no baseline and receives the current defaults.
- **Prefer studio defaults** reapplies styles when preferences change. **Apply to
  all objects** explicitly replaces custom styles, with GeoGebra undo boundaries.
- New objects receive defaults once; ordinary update events never restyle them.
  File loads suspend add processing, then reapply after `setBase64` completes.
  The native GeoGebra Open path is handled by debouncing clear/add events.
- Views, axes, grid and rounding apply on document load. Individual view toggles
  use incremental perspectives, preserving the other native view arrangements.

To add a preference, extend the type, defaults and storage validation, add its
engine mapping and a panel control, and cover its lifecycle where needed. If the
preference controls an object property, add a getter/setter ownership mapping too.

API references: [Apps API](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)
and [perspectives](https://geogebra.github.io/docs/manual/en/commands/SetPerspective/).

## Point colors

`pointRoles.ts` classifies points using independence and the target construction
algorithm. A `Point` on a path or `PointIn` a region is constrained; intersections,
midpoints and other dependent constructions use the dependent color. Manually
locking a free or path point does not change its construction role. Coordinate
points built from lists are not mistaken for points on a path.

The default `by-role` mode has separate free, constrained and dependent colors.
`uniform` uses `pointColor` for all three. Graphite is a uniform preset; the other
palettes distinguish roles. Individual object color overrides retain the same
ownership rules as other styles.

Existing v1 preferences acquire the new fields from their chosen palette. Old
draft ownership baselines let formerly studio-colored points adopt role colors,
while preserving objects whose colors the user changed individually.

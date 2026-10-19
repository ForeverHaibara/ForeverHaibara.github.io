# AlphaGeometry2 DDAR

Source: https://github.com/google-deepmind/alphageometry2

Pinned commit: `251e7e16f0bba8ac7c83cdea789fccc195d0c0c7` (2026-01-07).

`parse.py`, `ddar.py`, `elimination.py`, `numericals.py`, `test.py`, and
`LICENSE` are copied without changes. Runtime loads only the first four files.
`test.py` supplies upstream examples for the native benchmark.

Copyright Google LLC. Code is licensed under Apache-2.0; see LICENSE and the
copyright headers. Site integration and bridge code live outside this directory.

The engine uses numerical witnesses and does not return a proof certificate.
Its result must retain the selected assumptions and coordinate snapshot.

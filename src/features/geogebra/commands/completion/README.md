# Command completion

Completion only edits input text. The command pipeline and the API console remain responsible for execution.

## Layers

- `types.ts`: editor-neutral context, item, provider and edit contracts.
- `completionContext.ts`: finds the identifier at the caret, excludes strings/comments, distinguishes commands from `!` API calls, and computes a replacement without changing surrounding text.
- `completionRegistry.ts`: registers providers, merges case-insensitive prefix matches, resolves duplicates by priority, and notifies live editors when providers are added or removed. Providers may return arrays or promises. Results stream in as providers finish; a slow or failing provider does not block local results. An `AbortSignal` cancels obsolete requests.
- `studioCompletionRegistry.ts`: composes the offline GeoGebra catalog and the existing API allowlist. The UI does not own either source.
- `useCommandCompletion.ts`: connects a registry to textarea selection, IME composition, keyboard navigation and cancellation. `GeoGebraCommandBar` also accepts a separate registry through its `completionRegistry` prop.
- `GeoGebraCompletionMenu.tsx`: renders candidates and optional help in a portal, positioned above or below the input. It remains usable inside the fullscreen workspace and scrollable command dock.

## Register custom commands

Register metadata when the corresponding tool or command module loads. No change to the command bar is required:

```ts
import { studioCompletionRegistry } from '../../features/geogebra';

const unregister = studioCompletionRegistry.registerCommands('my-geometry-tools', [
  {
    label: 'MyCenter',
    kind: 'custom',
    description: 'Construct the center used by my geometry tools.',
    signatures: ['MyCenter(A, B, C)'],
    aliases: ['mycenter', '我的圆心'],
    priority: 10,
  },
]);

// Call when unloading the module or replacing its command definitions.
unregister();
```

The label is inserted with `()` and the caret moves inside. Existing `(` or `[` is reused. Set `callable: false` for plain symbols, or supply `insertText` for an exact text insertion (caret at its end). Signatures are help text, not executable placeholders. Higher priority overrides an identically named suggestion; duplicate provider IDs are rejected. Keep the disposer to unregister safely.

Registration adds completion metadata, not an execution handler. A custom GeoGebra tool still runs through GeoGebra; application-defined commands need their own handler in the command pipeline. Share command definitions with that handler module instead of duplicating names in the UI. Avoid executing commands or mutating the construction from a completion provider.

For a dynamic source, register a provider instead:

```ts
studioCompletionRegistry.register({
  id: 'dynamic-tools',
  async provide(context, signal) {
    if (context.mode !== 'command') return [];
    const tools = await loadToolMetadata({ prefix: context.prefix, signal });
    return tools.map((tool) => ({ label: tool.name, kind: 'custom' as const }));
  },
});
```

`loadToolMetadata` represents the extension's own data source. Honor the signal to release resources; cancelled results are discarded even if a provider cannot stop its work. The provider receives the full input and token range for contextual filtering. Prefix filtering and sorting are shared by all sources, and aliases match case-insensitively.

## Catalog updates

`geogebraCommandNames.ts` contains names from the [official command index](https://geogebra.github.io/docs/manual/en/commands/All_Commands/). Update it deliberately with `node scripts/update_geogebra_commands.mjs`; no network request is made while typing. Availability of an indexed command still depends on the loaded GeoGebra app and view. Add optional descriptions and illustrative signatures in `commandHelp.ts`.

## Keyboard behavior

- With candidates open: Up/Down changes selection; Tab or Enter accepts; Esc dismisses without leaving fullscreen.
- Ctrl+Space explicitly opens suggestions, including at an empty input.
- Ctrl+Enter (Cmd+Enter on macOS) executes directly. Shift+Enter inserts a newline.
- With candidates closed: Enter executes, and Up/Down recalls single-line command history.
- Tab without candidates and Shift+Tab retain normal focus navigation. IME confirmation keys do not accept or execute commands.

## Construction objects and spelling review

The command bar injects an engine-scoped `createObjectCompletionProvider` rather than putting construction data in the shared registry. It reads current object names on each request and refreshes an open list after add/remove/clear events. Objects are inserted as plain names and always appear before commands. Within objects, case-sensitive prefix matches come first, followed by exact and other case-insensitive matches. Distinct labels such as `A` and `a`, and an object and command with the same name, remain separate entries. The default selection follows that ordering as asynchronous results arrive, unless the user has already navigated the list.

`CompletionRegistry.complete` and `useCommandCompletion` accept additional local providers; this keeps separate engines from leaking objects into one another. Local providers can expose `subscribe` to notify their editor when data changes.

Only a failed execution triggers spelling review. `commandTokens.ts` scans function names followed by `()` or `[]`, excluding strings, comments, member calls and inline function declarations. `spellingSuggestions.ts` compares against callable entries from the same completion registry, so custom registrations also participate; known objects and valid mathematical functions are protected. API review checks only the outer method name and retains failed input.

Matching uses bounded Damerau-Levenshtein distance (including adjacent transpositions): names of up to three characters allow case correction only; lengths 4–7 allow one edit; longer names allow two. Names over 64 characters are not guessed. Only the best-distance candidates are offered, with at most four alternatives per occurrence. Correctly spelled function names never receive spelling suggestions merely because their arguments failed.

The review panel lets the user choose ambiguous alternatives and apply names with Tab or a button. Acceptance replaces function-name spans only, highlights the first replacement, and never executes automatically. Esc dismisses; edits discard stale suggestions. The review uses the original input offsets, including whitespace and newlines.

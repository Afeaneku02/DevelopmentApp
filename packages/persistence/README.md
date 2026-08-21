# packages/persistence

Shared low-level primitives for file-backed repository adapters: `readJsonArray`/`writeJsonArrayAtomic` (atomic write-via-temp-file-then-rename, so a crash mid-write can't corrupt the data file). No domain knowledge lives here - each domain's `File*Repository` (in `services/*`) uses these to load on construction and persist after mutations, while keeping its own filtering/sorting semantics identical to its `InMemory*Repository` counterpart.

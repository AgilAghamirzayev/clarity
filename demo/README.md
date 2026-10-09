# Demo catalog

`scenarios.json` contains eight authored, fictional support conversations. Generated customer and advisor voices are placed on separate channels. There is no private customer audio in this catalog.

The API's `server/src/main/resources/demo/` directory contains the audio and the exported results of the real local pipeline: transcription, privacy masking, Qwen analysis, Nomic embeddings, issue clustering and support reports. The deployment serves these prepared artifacts to isolated guest tenants automatically. They remain available when model setup is still in progress.

To regenerate on macOS with the local API, worker, database, storage and models running:

```sh
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python scripts/build-demo-catalog.py
```

This development command uses the built-in Samantha and Daniel voices. The deployed application reads the exported assets and needs no macOS tools. Existing source imports are reused. For a revised catalog, give the builder a new version and regenerate deliberately rather than modifying private recordings.

The guest's three decision histories are illustrative team reviews. Approval and completion do not send external messages and do not prove business impact. New uploads are processed normally and remain private to that guest. Prepared samples do not consume the guest upload allowance.

`labels.json` supplies concise editorial titles for issue groups and recommendations. Original model findings remain in the call analysis. Updating these display titles preserves guest decisions and uploads.

`corrections.json` records reviewed corrections to generic terms that an earlier ID pattern masked accidentally. These corrections apply only to this authored fictional catalog, whose source dialogue is available for verification. They never restore redacted text in user uploads. Privacy regression tests cover both actual identifiers and ordinary words.

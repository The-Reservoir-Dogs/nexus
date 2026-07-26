# PULSE — the synthetic signal dataset

We have no real Pocket FM behavioural data, so we manufacture it. But not
randomly: we **plant known weaknesses** in specific scenes, then simulate how 10
listener personas behave against them. That gives us free ground truth — we
already know which scene is broken and why, so we can prove the detector found
the right one instead of just proving it can draw a chart.

Everything in `out/` is **simulated** and labelled as such. The arithmetic that
consumes it is real: pure counting over the event log. No model, no ML, no fit.

## Run order

```bash
psql < schema.sql            # existing NEXUS schema
psql < seed.sql              # existing "The Hollow Crown" seed
psql < data/schema_pulse.sql # scenes + engagement views  (this folder)
psql < data/out/seed_pulse.sql
```

Regenerate the data (stdlib only, no pip install):

```bash
python data/generate_pulse_data.py
```

Deterministic — the same seed always produces the same dataset. The script
**fails loudly** if the generated data no longer reproduces its own plants.

## Files

| File | What it is |
|---|---|
| `schema_pulse.sql` | Additive DDL: `scenes`, `scene_characters`, `scene_threads`, plus the engagement/investment/revamp **views**. Nothing destructive. |
| `generate_pulse_data.py` | Single source of truth: scene prose, planted craft attributes, personas, the behaviour simulation, and all emitters. |
| `out/seed_pulse.sql` | Loadable seed: 24 scenes, links, 7 new users, Maester Ord, and ~31k playback events in 1000-row batches. |
| `out/playback_events.csv` | The raw event log, for pandas / Excel / a whiteboard. |
| `out/scene_engagement.json` | The derived engagement map. Should match the `scene_engagement` SQL view exactly. |
| `out/investment.json` | Per-character and per-thread audience investment. |
| `out/GROUND_TRUTH.md` | **Read this one.** What we planted, and whether the data reproduced it. |

## The shape of the data

24 scenes across the 4 canonical episodes of *The Hollow Crown*. Each scene has
real prose (so the LLM has something to actually critique and rewrite) plus
planted craft attributes — quality, tension, emotional weight, thread investment,
end hook, characters present.

The simulator turns those attributes into behaviour. It **never writes a metric
directly**: it decides whether a given persona skips, rewinds, speeds up, pauses
or quits, and the metrics fall out of counting the resulting events. That
separation is what makes the dataset a real test rather than a lookup table.

Retention across the series: **0.86 → 0.78 → 0.86 → 0.54**. Episode 4 falls off
a cliff, and the scene-level data says exactly where and why.

## Two things worth knowing

**On the 10 users.** The 10 named listeners (users 2–11) are the panel we show in
the UI and can point at individually. They are not enough to *measure* with —
only ~6 survive to episode 4, so every rate there sits on a denominator of 6
where 0.00 vs 0.33 is one person having a bad evening. `ANON_SESSIONS = 140` in
the generator adds anonymous listeners (`user_id NULL`, which the schema already
allows) drawn from the same persona mix, purely to give the arithmetic a
denominator worth trusting. Set it to 0 for the strict 10-user-only dataset.

**On `reached`.** A session that skips straight out of a scene still counts as
having reached it. This looks like a detail and is not: exclude skippers and the
denominator shrinks on exactly the scenes people skip, so the worst scene in the
show scores as the healthiest. We hit this bug and it inverted the whole ranking.
The comment in `schema_pulse.sql` says the same thing — please leave it there.

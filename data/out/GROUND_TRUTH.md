# PULSE — Ground Truth for the simulated dataset

**This data is SIMULATED.** No real listener produced it. It exists so we can
prove the detector finds a weakness we deliberately planted, rather than
prove it can draw a chart.

- seed: `20260725` (deterministic — reruns produce identical data)
- named panel: 10 listeners (users 2-11)
- anonymous sessions: 140 (user_id NULL, same persona mix)
- sessions total: 481
- raw events: 31092
- scenes: 24 across 4 episodes

> **On sample size.** The 10 named listeners are the panel we point at by
> name in the UI and on stage. They are *not* enough to measure with: only
> ~6 survive to episode 4, so every rate there would sit on a denominator of
> 6, where 0.00 vs 0.33 is one person. The anonymous sessions exist purely to
> give the arithmetic a denominator worth trusting. Set `ANON_SESSIONS = 0`
> in the generator for the strict 10-user-only dataset.

## What we planted

| # | Plant | Where | Expected signature |
|---|---|---|---|
| 1 | **Dominant weak scene** | Ep 1004 sc.2 `The Council of Grain` (id 3042) | rank 1 by weakness: highest skip, high drop-off, avg speed > 1 |
| 2 | **The ep-1004 slump** | sc.2 + sc.3 `Border Surveys` (3043) + weak close sc.6 (3046) | episode 4 should own most of the top of the weakness table |
| 3 | **Secondary weak scene, different episode** | Ep 1002 sc.5 `The Butcher's Ledger` (id 3025) | clearly weak but *inside a strong episode* — forces ranking, not flagging |
| 4 | **Secretly-loved side character** | Sera (id 702) | top investment score, ~zero skip, never appears in a weak scene |
| 5 | **The drag character** | Maester Ord (id 703) | bottom investment; leads every weak scene |
| 6 | **Least-invested thread** | 401 `northern shadow` bottom; 400 `Corvin's fate` high | ep 1004 sags exactly where it swaps 400 for 401 |
| 7 | **Recovery kink** | Ep 1004 sc.5 `Sera Comes Back Muddy` (id 3045) | retention ticks UP mid-slump, on a Sera scene |

**Pass condition:** scene 3042 ranks #1 by weakness, Sera ranks #1 by
investment, Ord ranks last, thread 401 ranks last, and episode 1004 holds at
least 3 of the top 6 weakest scenes. If any of those flip, the pipeline is
wrong and we know it without asking a human.

## The causal story the LLM should recover

> Episode 4 loses its audience at *The Council of Grain*. It abandons the thread
> listeners are most invested in (Lady Corvin's fate), hands the scene to the
> character they skip most (Ord), runs the longest of any scene in the series,
> and ends without a hook. Retention only recovers when Sera appears — the
> character with the highest investment score in the show, who has never
> carried a scene of her own.

If the pipeline outputs approximately that, it works. If it names a different
scene, it is wrong, and we know it is wrong without needing a human to judge.

## Measured result (derived from the generated events — no model)

### Weakest scenes, ranked

| rank | scene | episode | drop-off | skip | replay | avg speed | weakness |
|---|---|---|---|---|---|---|---|
| 1 | The Council of Grain  ⟵ **PLANT #1** | 1004 | 0.217 | 0.457 | 0.098 | 1.23 | 37.1 |
| 2 | Border Surveys  ⟵ plant #2 (slump) | 1004 | 0.153 | 0.389 | 0.097 | 1.38 | 34.5 |
| 3 | The Butcher's Ledger  ⟵ **PLANT #3** | 1002 | 0.153 | 0.378 | 0.117 | 1.24 | 31.8 |
| 4 | Mercy, and the Price of It  ⟵ plant #2 (slump) | 1004 | 0.102 | 0.271 | 0.136 | 1.24 | 25.8 |
| 5 | The Long Table | 1001 | 0.062 | 0.274 | 0.199 | 1.16 | 22.5 |
| 6 | Precedent | 1003 | 0.099 | 0.162 | 0.351 | 1.16 | 18.5 |
| 7 | Ink and Wax | 1004 | 0.061 | 0.194 | 0.276 | 1.12 | 18.3 |
| 8 | A Rider from the North | 1004 | 0.033 | 0.033 | 0.59 | 1.29 | 10.9 |

### Character investment (the silent vote)

| character | role | scenes | replay | skip | drop-off | investment |
|---|---|---|---|---|---|---|
| Sera | side | 7 | 0.619 | 0.0 | 0.01 | **56.8** |
| Lady Corvin | antagonist | 5 | 0.574 | 0.046 | 0.022 | **52.5** |
| Prince Aldric | protagonist | 24 | 0.49 | 0.092 | 0.045 | **45.5** |
| Maester Ord | side | 6 | 0.19 | 0.309 | 0.124 | **19.3** |

### Thread investment

| thread | scenes | replay | skip | drop-off | investment |
|---|---|---|---|---|---|
| The war between Greymoor and House Corvin. | 13 | 0.551 | 0.051 | 0.029 | **50.7** |
| The fate of the captured Lady Corvin. | 11 | 0.546 | 0.061 | 0.035 | **50.0** |
| A shadow threat stirring beyond the northern border. | 6 | 0.339 | 0.192 | 0.087 | **32.5** |

### Per-episode retention

| episode | title | sessions | completed | completion rate |
|---|---|---|---|---|
| 1001 | The Gathering Storm | 151 | 130 | 0.86 |
| 1002 | Blood on the Snow | 119 | 93 | 0.78 |
| 1003 | The Spared Blade | 113 | 97 | 0.86 |
| 1004 | Uneasy Peace | 98 | 53 | 0.54 |

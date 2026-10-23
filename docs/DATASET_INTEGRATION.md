# Early Literacy Screening dataset integration gate

Referenced dataset: `roynjuguna/early-literacy-screening` on Kaggle.

Kaggle did not expose the dataset metadata through the available research connection, so this repository intentionally contains no fabricated schema or copied records.

Before import:
1. Confirm the dataset licence permits product research and derived models.
2. Document collection country, languages, ages, consent and intended use.
3. Inspect columns, label definitions, class balance, missing values and duplicates.
4. Split by child/site where relevant to avoid leakage.
5. Evaluate calibration and subgroup error; do not turn a screening score into diagnosis.
6. Map source columns to the five internal literacy dimensions through a versioned adapter.
7. Keep clinician/teacher/parent interpretation and escalation paths visible.

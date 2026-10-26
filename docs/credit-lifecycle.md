# Credit lifecycle

Project: draft -> submitted -> under_review -> approved | rejected | requires_more_evidence.

Credits (`credit_batches`): `proposed_qty >= approved_qty >= issued_qty >= retired_qty` (DB check constraints).
A batch references a project, crediting period, methodology and verification reference. One batch per project+period.
Retired quantity is permanent. 1 credit = 1 tCO2e only where the chosen methodology/crediting program says so.
Ten-year stewardship: tracked via `projects.stewardship_*` and `maintenance_reports`; responsibility of NGO, buyer and landholder is recorded separately. No automatic penalties.

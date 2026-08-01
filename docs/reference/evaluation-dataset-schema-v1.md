# Evaluation dataset schema version 1

Semantix accepts one bounded JSON schema for session-local semantic-cache
evaluation datasets. Imported documents are treated as untrusted and are held
only for the validation or run request that carries them. The frontend keeps
the selected document in React memory only; neither side stores it in browser
storage, a database, a server catalog, logs, or run history.

## Document

```json
{
  "schema_version": 1,
  "name": "Domain safety set",
  "description": "Optional bounded description",
  "cases": [
    {
      "case_id": "seed",
      "prompt": "How do I reset my password?",
      "expected_cache_hit": false,
      "category": "account"
    },
    {
      "case_id": "repeat",
      "prompt": "Help me change a forgotten password.",
      "expected_cache_hit": true,
      "expected_match_case_id": "seed",
      "category": "account",
      "note": "Optional human-readable evidence"
    }
  ]
}
```

All objects are strict: unknown fields are rejected. Required dataset fields
are `schema_version`, `name`, and `cases`. Required case fields are `case_id`,
`prompt`, and `expected_cache_hit`.

| Field | Contract |
|---|---|
| `schema_version` | Integer literal `1` |
| `name` | Non-empty string, at most 100 characters |
| `description` | Optional non-empty string, at most 300 characters |
| `cases` | Ordered non-empty array, at most the configured case limit |
| `case_id` | Unique 1–100 character identifier matching `[A-Za-z0-9][A-Za-z0-9._:-]*` |
| `prompt` | Non-empty string, at most 2,000 characters |
| `expected_cache_hit` | Boolean semantic-cache decision |
| `expected_match_case_id` | Optional ID of an earlier case; allowed only for an expected hit |
| `category` | Optional non-empty string, at most 100 characters |
| `note` | Optional non-empty plain-text string, at most 500 characters |

Omitted categories normalize to `uncategorized`. Notes, descriptions, and
categories are rendered as escaped plain text, not Markdown or HTML.

## Identity and digest

Validation derives a request-local ID in the form `custom:<digest-prefix>`.
The SHA-256 digest covers ordered execution semantics: case ID, normalized
category, prompt, expected decision, and an expected-match reference when
present. Display name, description, and note do not affect the digest.
Reordering cases or changing execution semantics changes it.

The transient ID is evidence, not a lookup key. It cannot retrieve or share an
import after the request.

## Validation and limits

Submit a parsed document to `POST /api/v1/evaluations/datasets/validate`:

```json
{
  "dataset": {
    "schema_version": 1,
    "name": "Minimum set",
    "cases": [
      {
        "case_id": "only-case",
        "prompt": "Synthetic prompt",
        "expected_cache_hit": false
      }
    ]
  },
  "repetitions": 1,
  "threshold_count": 2
}
```

Validation makes zero embedding or generation calls. It reports normalized
counts, decoded bytes, warnings, `cases × repetitions` query executions,
threshold-projection evaluations, and the maximum possible generation calls.

Four independent server limits apply:

- `MAX_REQUEST_BODY_BYTES` limits the complete HTTP request before JSON
  parsing;
- `EVALUATION_DATASET_MAX_DECODED_BYTES` limits the UTF-8 bytes of the
  canonical decoded dataset object;
- `EVALUATION_DATASET_MAX_CASES` limits case count;
- `EVALUATION_MAX_WORKLOAD_QUERIES` limits `cases × repetitions`.

Defaults are 65,536 request bytes, 49,152 decoded dataset bytes, 50 cases, and
250 query executions. The decoded-content default intentionally leaves room
for the validation/run envelope beneath the existing 64 KiB request boundary.
Threshold projections do not replay provider work.

## Stable dataset validation errors

Invalid imported content returns HTTP `422`,
`error="evaluation_dataset_invalid"`, a generic safe detail, and bounded
`issues`. Each issue includes `code`, `detail`, and a JSON `pointer`; safe
`case_id` and zero-based `case_index` context may also appear.

| Code | Meaning |
|---|---|
| `unsupported_schema_version` | The document is not schema version 1 |
| `required_field` | A required field is absent |
| `unknown_field` | A strict object contains an unsupported field |
| `empty_string` | A required or supplied string is empty |
| `value_too_long` | A bounded string exceeds its limit |
| `invalid_identifier` | An identifier contains unsupported characters |
| `cases_required` | The case array is empty |
| `invalid_value` | A field has the wrong JSON type or value |
| `invalid_document` | The decoded value cannot be represented as a JSON object |
| `duplicate_case_id` | A case ID occurs more than once |
| `contradictory_expected_match` | An expected miss supplies a match reference |
| `self_expected_match` | A case references itself |
| `ambiguous_expected_match` | A reference targets a duplicated ID |
| `missing_expected_match` | A referenced case does not exist |
| `forward_expected_match` | A reference does not point to an earlier case |
| `case_limit_exceeded` | The configured case cap is exceeded |
| `decoded_size_exceeded` | The decoded-content cap is exceeded |
| `workload_limit_exceeded` | Cases multiplied by repetitions exceed the cap |

Malformed request JSON follows the normal API `validation_error` path.
Prompts are never copied into dataset-validation issue details.

## Execution and compatibility

`POST /api/v1/evaluations/runs` accepts either a built-in reference or the
complete inline definition. The server always revalidates inline content at
execution; a preview is not authorization or an integrity token. The run then
uses the same fresh, isolated, bounded cache as built-in Evaluations.

The legacy `/api/v1/benchmarks/datasets` and `/api/v1/benchmarks/run`
contracts remain available for built-in clients. No database migration or
stored-data migration is required because schema version 1 is request-local.

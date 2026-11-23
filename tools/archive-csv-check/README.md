# Reddit Archive CSV acceptance checker

A standalone Node.js command-line tool that accepts or rejects a Reddit Archive
CSV export. It uses only Node.js built-in modules: there is no install step, no
network access and no effect on the rest of the repository.

## Requirements

- Node.js 20 or newer

## Usage

From the repository root:

```sh
node tools/archive-csv-check/index.js export.csv --subreddit programming,learnprogramming
```

From this directory:

```sh
node index.js export.csv --subreddit programming
```

The expected subreddit scope is required. Pass a comma-separated list, repeat
the option, or both:

```sh
node index.js export.csv -s programming -s learnprogramming
node index.js export.csv --subreddit=programming,learnprogramming
```

Matching is case-insensitive and a leading `r/` is ignored, so
`r/Programming` in the CSV matches the expected `programming`. Expected scope
values may also be written with the prefix.

The website's current export format is accepted directly:

```sh
node tools/archive-csv-check/index.js export.csv \
  --subreddit r/mossy_circuits,r/paper_tides,r/quiet_orbit
```

Its subreddit values are `r/`-prefixed, times use `created_at` ISO 8601 UTC
strings, and comment counts use `comments`.

### Options

| Option | Description |
| --- | --- |
| `-s <names>`, `--subreddit <names>` | Expected subreddit scope. Comma-separated and/or repeatable; required. |
| `-h`, `--help` | Print usage and exit with code 0. |

## Validation rules

The header must contain each of these columns exactly once, in any order:

```text
subreddit, title, score, upvote_ratio
```

For the comment count and creation time, either the canonical column or the
website alias is accepted:

| Canonical | Website alias | Meaning |
| --- | --- | --- |
| `num_comments` | `comments` | Non-negative integer comment count. |
| `created_utc` | `created_at` | `created_utc` is a non-negative Unix timestamp in seconds; `created_at` is an ISO 8601 UTC timestamp ending in `Z`, e.g. `2026-08-14T09:30:00.000Z`. |

At least one column from each pair must be present. If both are present, both
are validated. Extra columns are allowed. Header problems are always reported
on line 1.

Every data row is checked for:

| Field | Rule |
| --- | --- |
| `subreddit` | Non-empty and inside the expected scope. A leading `r/` is accepted and ignored for comparison; matching is case-insensitive. |
| `title` | Non-empty. |
| `score` | Integer; negative values are valid. |
| `upvote_ratio` | Number from 0 to 1 inclusive. |
| `comments` / `num_comments` | Non-negative integer. |
| `created_at` / `created_utc` | A valid timestamp in the format described above. Impossible dates and timestamps without a `Z` suffix are rejected. |

A row must have the same number of fields as the header.

### CSV compatibility

- UTF-8 input with an optional BOM.
- LF, CRLF and lone CR record separators.
- Quoted fields containing commas, doubled quotes (`""`) and line breaks.
- A record containing an embedded newline is reported at the line where the
  record starts, which is the line to look at in an editor.
- Malformed CSV (an unterminated quoted field, a stray quote, or text after a
  closing quote) is rejected with its line number.

A file containing only a valid header passes with a warning and a row count of
zero. An empty file is invalid.

## Output and exit codes

```text
Reddit Archive CSV acceptance check
File: export.csv
Expected subreddit scope: programming, learnprogramming

Header: OK
Rows: 4 total, 3 passed, 1 failed
  line 3: subreddit "news" is outside the expected scope (programming, learnprogramming)

Result: INVALID
```

| Exit code | Meaning |
| --- | --- |
| `0` | The file is valid. |
| `1` | The file is invalid: bad header, bad row or malformed CSV. |
| `2` | The command line is invalid, or the file could not be read. |

## Tests

The tests use `node:test` and synthetic fixtures; no dependencies are installed.

```sh
cd tools/archive-csv-check
npm test
# equivalent to:
node --test
```

Fixtures and tests cover a correct BOM/CRLF export with Chinese punctuation,
commas and quoted newlines; the website's `created_at`/`comments`/`r/` format;
invalid numeric values and timestamps; cross-subreddit mixing; and malformed
quoted CSV.

## Limitations

- Only local UTF-8 files are read; stdin, URLs and other encodings are not
  supported.
- The tool validates the export's structure and field ranges. It does not query
  Reddit, deduplicate posts or verify permalinks.
- The expected subreddit scope must be supplied by the caller; it is not inferred
  from the CSV.

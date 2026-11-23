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

Matching is case-insensitive, so `Programming` in the CSV matches the expected
`programming`.

### Options

| Option | Description |
| --- | --- |
| `-s <names>`, `--subreddit <names>` | Expected subreddit scope. Comma-separated and/or repeatable; required. |
| `-h`, `--help` | Print usage and exit with code 0. |

## Validation rules

The header must contain each of these columns exactly once, in any order:

```text
subreddit, title, score, upvote_ratio, num_comments, created_utc
```

Extra columns are allowed. Header problems are always reported on line 1.

Every data row is checked for:

| Field | Rule |
| --- | --- |
| `subreddit` | Non-empty and inside the expected scope. |
| `title` | Non-empty. |
| `score` | Integer; negative values are valid. |
| `upvote_ratio` | Number from 0 to 1 inclusive. |
| `num_comments` | Non-negative integer. |
| `created_utc` | Non-negative number; fractional seconds are accepted. |

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
commas and quoted newlines, invalid numeric values, cross-subreddit mixing and
malformed quoted CSV.

## Limitations

- Only local UTF-8 files are read; stdin, URLs and other encodings are not
  supported.
- The tool validates the export's structure and field ranges. It does not query
  Reddit, deduplicate posts or verify permalinks.
- The expected subreddit scope must be supplied by the caller; it is not inferred
  from the CSV.

# Content format (schema 1)

One JSON file = one chapter. The in-app importer validates it and lists errors with paths, e.g. `quiz[3].a: must be an integer index into "o"`.
The authoritative, AI-ready description (with an example) is [`content/ai-prompt.txt`](../content/ai-prompt.txt); a minimal valid file is [`content/template.json`](../content/template.json).

## Conventions

- **Bilingual text** is an object `{"en": "...", "ms": "..."}`. If `ms` (or `en`) is omitted, the other language is shown in both modes. `**bold**` is supported.
- **ids** (`subject.id`, chapter `id`, section `id`, flow `id`): lowercase letters, digits, hyphen; 1–24 chars. Card/quiz/essay ids are free-form strings, unique within the chapter.
- The app namespaces everything internally as `<subject>.<chapter>:<id>`, so ids may repeat across chapters; progress is stored per item.
- Subjects are created automatically from `subject` in the first imported chapter. Built-in subjects (from `content/index.json`) can receive imported chapters but a built-in chapter id cannot be overwritten.

## Top level

| Field | Required | Notes |
|---|---|---|
| `subject` | yes | `{id, code, name:{en,ms}}` |
| `id`, `title` | yes | chapter id, `{en,ms}` |
| `num` | no | ordering; chapters without it sort last |
| `standard` | no | label shown on Home (e.g. `MFRS 140`) |
| `outcomes` | no | `{en:[..], ms:[..]}` |
| `sections` | yes | notes (see below) |
| `cards`, `quiz`, `essay` | no | each item has `t` = a section id |
| `glossary` | no | `[["English","Malay"], ...]` |
| `flows` | no | yes/no decision flowcharts |
| `tools` | no | default = every flow + glossary. FAR2-only extras: `calc`, `calc5`, `transfer` (need `tools-far2.js`) |

## Section blocks

`p`, `h`, `tip`, `note`, `ex`, `calc` (bilingual string) · `ul`, `flow` (bilingual string arrays of equal length) · `je` (`title`, `lines: [["Dr"|"Cr","Account","Amount"]]`) · `table` (`head`, `rows`; every row has as many cells as `head`, cells may be empty).

## Quiz / cards / essay

- `quiz`: `{id,t,q,o:[2–6 strings],a:<index of correct option>,e:{explanation}}`. Options are English-only plain strings (the exam is in English).
- `cards`: `{id,t,q,a}`
- `essay`: `{id,t,marks,q,pts:{en:[..],ms:[..]}}`; each point ends with its mark like `(2)`.

## Flows

`{id, icon, title, sub, start, nodes:{n1:{q,y,n}}, results:{r1:{c:"good|warn|info", t, d}}}` where every `y`/`n` is a node or result id.

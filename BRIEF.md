# BRIEF: mdtoc — Markdown Table of Contents Generator

## What Are We Building?

A small Node.js CLI tool called `mdtoc` that reads a Markdown file and generates a table of contents from its headings. Pipe-friendly, zero dependencies, installable via npm.

## Core Behavior

```bash
# Print TOC to stdout
mdtoc README.md

# Insert/update TOC in-place (between <!-- toc --> markers)
mdtoc --inject README.md

# Watch mode: re-inject on file change
mdtoc --watch README.md
```

## Requirements

- Parse `#`, `##`, `###`+ headings from any markdown file
- Generate GitHub-compatible anchor links (lowercase, spaces→dashes, strip punctuation)
- `--inject` mode: insert/replace TOC between `<!-- toc -->` and `<!-- tocstop -->` comment markers
- `--watch` mode: re-run on file save
- Works as a CLI tool (`bin` entry in package.json)
- Zero runtime dependencies
- Node.js >= 18

## Stack

- Node.js, ESM
- Node's built-in `fs` and `path` — no external packages
- `node:fs/promises` for async file ops
- `node:readline` for streaming large files (optional optimization)

## Quality Bar

- Unit tests for: heading parser, anchor generator, TOC formatter, inject logic
- Edge cases: duplicate headings (de-dupe with `-1`, `-2` suffix), headings with code/links/bold, empty files
- README with usage examples

## What Success Looks Like

Running `mdtoc README.md` on this project's own README produces a correct, well-formatted table of contents. Running `mdtoc --inject README.md` updates the file in-place without corrupting it.

## Out of Scope

- HTML files
- ATX vs setext heading detection (ATX `#` only)
- Config files
- Plugins

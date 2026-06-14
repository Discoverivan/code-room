# Contributing

Thanks for helping improve `code room`.

## Before opening an issue

- Search existing issues first.
- Keep feature requests aligned with the project's minimal scope.
- Never include private room links, document contents, or secrets.

## Development

Requires Node.js 22.

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Pull requests

- Keep changes focused and avoid unrelated refactors.
- Add or update tests when behavior changes.
- Explain user-visible changes and any deployment impact.
- Use conventional commit messages when possible, for example
  `feat: add room sharing` or `fix: persist room state`.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

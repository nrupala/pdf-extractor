<!--
SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.

SPDX-License-Identifier: MIT
-->

# Contributing

Thank you for considering a contribution. This project is maintained by AIMLDS
(2351485 ALBERTA INC.) and contributions are welcome under the project's licence.

## How to contribute

1. Open an issue first for anything beyond a trivial fix, so the change can be discussed.
2. Fork the repository and make your change on a branch.
3. Keep changes focused; unrelated refactors belong in their own pull request.
4. Open a pull request describing what changed and why. A maintainer reviews every PR;
   expect a first response within two weeks.

## Tests are part of the change

- New functionality must come with tests, and bug fixes with a regression test where practical.
- The full test suite must pass before a PR is merged. Run it with `pytest -q`
  (after `pip install -e ".[api]" pytest httpx`); CI runs the same suite on every
  push and pull request.

## Conduct and licensing

Be civil and specific in issues and reviews. By contributing you agree your contribution
is provided under the project's licence.

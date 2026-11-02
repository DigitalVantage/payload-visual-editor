# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.1.x | Yes |
| < 1.1 | No — upgrade to the latest 1.x |

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub: **Security → Report a vulnerability** on [this repository](https://github.com/DigitalVantage/payload-visual-editor/security/advisories/new).

Include the affected version, your Payload and Next versions, and steps to reproduce. We aim to acknowledge a report within 5 working days and will keep you updated until it is fixed and released.

## What is in scope

The editor bridges two windows — the Payload admin and the site in the Live Preview iframe — over `postMessage`. Reports we especially care about:

- a page or a third-party frame driving the editor (bypassing the origin, `event.source` or session checks);
- edits or block operations that get past Payload's access control;
- document data leaking over the editor's own message channel (it should carry paths and row ids only);
- script injection through overlay labels or translated strings.

The guarantees the editor relies on are listed in the README under [Security model](./README.md#security-model).

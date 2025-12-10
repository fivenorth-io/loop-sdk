# Changelog

## 0.6.4 (2025-12-10)

Full Changelog: [v0.6.3...v0.6.4](https://github.com/fivenorth-io/loop-sdk/compare/v0.6.3...v0.6.4)

### Improvements

* **sdk:** allow per-transfer request timeout via `TransferOptions.requestTimeout`; export `DEFAULT_REQUEST_TIMEOUT_MS` and demo UI input.

## 0.6.3 (2025-12-09)

Full Changelog: [v0.6.2...v0.6.3](https://github.com/fivenorth-io/loop-sdk/compare/v0.6.2...v0.6.3)

### Documentation

* **docs:** add embedded CodePen demo to the Loop SDK demo section for interactive examples.

## 0.6.2 (2025-12-08)

Full Changelog: [v0.6.1...v0.6.2](https://github.com/fivenorth-io/loop-sdk/compare/v0.6.1...v0.6.2)

### Improvements

* **sdk:** version bump release; package metadata updated to 0.6.2.

## 0.6.1 (2025-12-04)

Full Changelog: [v0.6.0...v0.6.1](https://github.com/fivenorth-io/loop-sdk/compare/v0.6.0...v0.6.1)

### Improvements

* **sdk:** increase wallet request/transaction timeout to 5 minutes.
* **sdk:** display instrument admin info when fetching holdings.
* **docs:** moved Loop SDK docs under the `loop-sdk` package directory (previously under `docs/`).

## 0.6.0 (2025-12-03)

Full Changelog: [v0.5.0...v0.6.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.5.0...v0.6.0)

### Features

* **sdk:** add `loop.wallet.transfer` helper that prepares and runs transfers via Wallet Connect, with optional instrument admin/id overrides.

## 0.5.0 (2025-12-02)

Full Changelog: [v0.4.0...v0.4.1](https://github.com/fivenorth-io/loop-sdk/compare/v0.4.0...v0.4.1)

### Features

* **sdk:** add `id`/`class` attributes to the overlay container and wrap QR/link in a content div for easier styling/hooks.

## 0.4.0 (2025-12-01)

### BREAKING CHANGES
* **sdk:** `openMode` has been moved into the `options` object of `loop.init()`.
  - Old:
    ```ts
    loop.init({ openMode: 'popup' });
    ```
  - New:
    ```ts
    loop.init({ options: { openMode: 'popup' } });
    ```
* **sdk:** `redirectUrl` is now also expected inside the `options` field.

These changes require integrators to update how they call `loop.init()` to prevent breaking behavior.

### Features

* **sdk:** expose `email` in `verifySession()` response by adding `email` to the `Account` return type and forwarding the backend value. 
* **sdk:** add UUID polyfill fallback for environments where `crypto.randomUUID` is unavailable (older browsers or non-HTTPS contexts).

## 0.3.0 (2025-11-26)

Full Changelog: [v0.2.1...v0.3.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.2.1...v0.3.0)

### Features

* **sdk:** add popup-based wallet connect flow and auto-close popup on accept ([aeee657](https://github.com/fivenorth-io/loop-sdk/commit/aeee657))

## 0.2.0 (2025-11-24)

Full Changelog: [v0.1.3...v0.2.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.1.3...v0.2.0)

### Features

* **sdk:** include `email` in `handshake_accept` payload and expose `provider.email` to dApps ([041c22f](https://github.com/fivenorth-io/loop-sdk/commit/041c22f))

## 0.2.1 (2025-11-25)

Full Changelog: [v0.2.0...v0.2.1](https://github.com/fivenorth-io/loop-sdk/compare/v0.2.0...v0.2.1)

### Bug Fixes

* **sdk:** clear invalid cached `loop_connect` session when ticket is missing/expired to prevent stale reconnect errors 
([548abe8](https://github.com/fivenorth-io/loop-sdk/commit/548abe8))

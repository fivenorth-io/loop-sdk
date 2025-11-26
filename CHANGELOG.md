# Changelog

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

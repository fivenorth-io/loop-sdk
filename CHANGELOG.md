# Changelog

## 0.12.4 (2026-04-20)
Full Changelog: [v0.12.3...v0.12.4](https://github.com/fivenorth-io/loop-sdk/compare/v0.12.3...v0.12.4)

### Improvements

- **sdk:** broadcast a reject message over the websocket when the wallet popup/tab is closed so the backend can invalidate the pending request.

## 0.12.3 (2026-04-20)
Full Changelog: [v0.12.2...v0.12.3](https://github.com/fivenorth-io/loop-sdk/compare/v0.12.2...v0.12.3)

### Improvements

- **sdk:** detect when the wallet popup/tab is closed during a pending request and reject locally with `PopupClosedError` instead of waiting only for timeout.

## 0.12.2 (2026-03-17)
Full Changelog: [v0.12.1...v0.12.2](https://github.com/fivenorth-io/loop-sdk/compare/v0.12.1...v0.12.2)

### Improvements

- **browser-sdk:** add `provider.estimateGas(payload)` so browser / WalletConnect dApps can inspect expected network gas before submission.
- **sdk:** allow `submitTransaction`, `submitAndWaitForTransaction`, and `transfer` to pass an optional `deduplicationPeriod`.
- **sdk:** keep `commandId` on the transaction payload for integrators that want to retry the same logical command within the Canton deduplication window.

### Bug Fixes

- **server-sdk:** fix the `node-forge` import path used by the server signer.

## 0.12.1 (2026-03-17)
Full Changelog: [v0.12.0...v0.12.1](https://github.com/fivenorth-io/loop-sdk/compare/v0.12.0...v0.12.1)

### Features

- **server-sdk:** add `estimateGas(payload)` so integrators can inspect expected network gas before submitting a transaction.

## 0.12.0 (2026-03-16)
Full Changelog: [v0.11.2...v0.12.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.11.2...v0.12.0)

### Important

- **Upgrade required for Server SDK gas handling:** integrators must update to `@fivenorth/loop-sdk@0.12.0` or later to use Server SDK with the new post-execution network gas flow. Older SDK versions do not support `PaymentRequiredError`, `checkDueGas(...)`, or `payGas(...)`.

### Features

- **server-sdk:** add `checkDueGas(trackingId?)` and `payGas(trackingId)` helpers for post-execution network gas collection.
- **server-sdk:** surface `402 Payment Required` as `PaymentRequiredError` with `tracking_id`, `gas_amount`, `status`, and `expires_at`.

### Backend Compatibility

- **wallet-backend:** allow pending network gas prepare/lookups to target a specific `tracking_id`.
- **wallet-backend:** record pending network gas after Server SDK transaction execution and block new Server SDK submissions while gas remains unpaid.

## 0.11.2 (2026-03-06)
Full Changelog: [v0.11.1...v0.11.2](https://github.com/fivenorth-io/loop-sdk/compare/v0.11.1...v0.11.2)

### Improvements

- **sdk:** stop auto-closing request-signing popup/tab on request completion; wallet UI now controls close behavior.
- **sdk:** propagate wallet reject `message` and `code` through `RejectRequestError`.

## 0.11.1 (2026-02-13)
Full Changelog: [v0.11.0...v0.11.1](https://github.com/fivenorth-io/loop-sdk/compare/v0.11.0...v0.11.1)

### Bug

- Fix build process to not bundling server sdk


## 0.11.0 (2026-02-13)
Full Changelog: [v0.10.0...v0.11.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.10.0...v0.11.0)

### Features

- **sdk:** add server-side signing entrypoint: backend authenticates with the user's private key, prepares a transaction, signs the returned hash, and submits without a wallet popup (headless flow).
- **demo:** add server demo showing end-to-end headless signing.

### Breaking Changes

- **types:** `TransactionPayload` no longer includes `execution_mode` or `estimate_traffic`. These are now provided via `submitTransaction` options (`executionMode`, `estimateTraffic`).

### Documentation

- **docs:** clarify server SDK custody requirements and add headless usage examples.

## 0.10.0 (2026-01-20)
Full Changelog: [v0.9.0...v0.10.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.9.0...v0.10.0)

### Improvements

- **sdk:** add `memo` to transfer helper payload and metadata.
- **sdk:** add `estimateTraffic` option to return estimated traffic in submit responses.
- **docs:** add installed DAR versions list for Canton nodes.

## 0.9.0 (2026-01-20)
Full Changelog: [v0.8.0...v0.9.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.8.0...v0.9.0)

### Features

- **sdk:** add execute-and-wait connect execution path (selectable via options) that returns transaction results or failures immediately for dapp integrations.

## 0.8.0 (2026-01-02)
Full Changelog: [v0.7.6...v0.8.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.6...v0.8.0)

### Documentation

- **sdk** `onTransactionUpdate` now returns `update_id` and `update_data` in the update payload (`update_data` is the transaction tree).

## 0.7.6 (2025-12-30)
Full Changelog: [v0.7.5...v0.7.6](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.5...v0.7.6)

### Improvements

- **sdk** Add a new method `getConnectUrl` to allow dapp build their own connection modal instead

## 0.7.5 (2025-12-29)
Full Changelog: [v0.7.4...v0.7.5](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.4...v0.7.5)

### Bug Fixes

- improve connection reliability when aborting the connection half way.

## 0.7.4 (2025-12-29)
Full Changelog: [v0.7.3...v0.7.4](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.3...v0.7.4)

### Improvements

* **sdk:** styled wallet connect modal

### Bug Fixes

* **sdk:** fix wallet connect modal will not show up again after being remove from clicking outside of the modal

## 0.7.3 (2025-12-24)
Full Changelog: [v0.7.2...v0.7.3](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.2...v0.7.3)

### Features

* **sdk:** add `autoConnect` and `logout` method on `loop` object to auto login on page load and support log out properly
* **demo:** add auto login and a log out button


## 0.7.2 (2025-12-21)
Full Changelog: [v0.7.1...v0.7.2](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.1...v0.7.2)

### Features

* **sdk:** add a new `getAccount` method on provider to retreive preapproval, utxo merge delegation, and usdc bridge access to dapp
* **demo:** add a button to retrieive these account info data

## 0.7.1 (2025-12-19)

Full Changelog: [v0.7.0...v0.7.1](https://github.com/fivenorth-io/loop-sdk/compare/v0.7.0...v0.7.1)

### Features

* **sdk:** allow passing a custom ticket message when submitting transactions so the wallet prompt can display dApp-provided context.
* **sdk:** add optional `requestSigningMode` (default `'popup'`) to auto-open the wallet dashboard (popup/tab) for signing/transaction requests and auto-close the popup when the wallet responds.
* **sdk:** add internal request lifecycle hooks on `Provider` to allow the SDK core to react to signing and transaction requests.

* **demo:** add optional “Custom message” inputs to transfer and USDC withdraw helpers.

## 0.7.0 (2025-12-11)

Full Changelog: [v0.6.5...v0.7.0](https://github.com/fivenorth-io/loop-sdk/compare/v0.6.5...v0.7.0)

### Improvements

* **sdk:** automatically reconnect the websocket before sending requests if it timed out.

### Features

* **usdc:** add `wallet.extension.usdcBridge.withdrawalUSDCxToEthereum` helper and move USDC types/logic under the extension namespace; demo updated to use the new helper.

## 0.6.5 (2025-12-10)

Full Changelog: [v0.6.4...v0.6.5](https://github.com/fivenorth-io/loop-sdk/compare/v0.6.4...v0.6.5)

### Improvements

* **sdk:** adjust `HANDSHAKE_REJECT` behavior so popup closing is fully controlled by the Wallet Connect UI.

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

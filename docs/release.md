# Loop SDK – Release Notes

## Release Resources

- **NPM Package:** [`@fivenorth/loop-sdk`](https://www.npmjs.com/package/@fivenorth/loop-sdk)
- **Full Changelog:** [`CHANGELOG`](https://www.github.com/fivenorth-io/loop-sdk/blob/main/CHANGELOG.md)

The release notes below highlight only the major updates. Refer to the links above for the complete changelog.

## v0.12.4
- SDK: broadcast a reject message over the websocket when the wallet popup/tab is closed so the backend can invalidate the pending request.

## v0.12.3
- SDK: detect when the wallet popup/tab is closed during a pending request and reject with `PopupClosedError` instead of waiting only for timeout.

## v0.12.2
- Browser SDK: add `provider.estimateGas(payload)` so browser / WalletConnect dApps can inspect expected network gas before submission.
- SDK: add optional `deduplicationPeriod` support to `submitTransaction`, `submitAndWaitForTransaction`, and `transfer`.
- SDK: continue accepting caller-provided `commandId` on the transaction payload so integrators can safely retry the same logical command.
- Server SDK: fix the `node-forge` import path used by the server signer.

## v0.12.1
- Server SDK: add `estimateGas(payload)` so integrators can inspect expected network gas before submitting a transaction.

## v0.12.0
- Upgrade required for Server SDK: integrators should update to `@fivenorth/loop-sdk@0.12.0` or later to support the new after-execution network gas flow.
- Server SDK transactions now use an after-execution network gas model. If a previous transaction created unpaid network gas, the next transaction attempt may fail with `PaymentRequiredError`.
- Add `checkDueGas(trackingId?)` and `payGas(trackingId)` helpers so integrators can check for pending network gas before submitting a transaction and pay it first if present.
- Surface `402 Payment Required` as `PaymentRequiredError` as a fallback when unpaid network gas is detected during submission.

## v0.11.2
- SDK: stop auto-closing request-signing popup/tab on request completion (wallet UI controls close behavior).
- SDK: include wallet reject `message` and `code` in `RejectRequestError`.

## v0.11.1
- SDK: fix server-side SDK to not bundling and just compile TS -> JS

## v0.11.0
- SDK: add server-side signing entrypoint. Backend authenticates with the user's private key, prepares a transaction, signs the returned hash, and submits without a wallet popup (headless flow).
- Demo: add server demo (`demo/server.ts`) showing end-to-end headless signing.
- Breaking: `TransactionPayload` no longer includes `execution_mode` or `estimate_traffic`. Use `submitTransaction` options (`executionMode`, `estimateTraffic`) instead.
- Docs: clarify server SDK custody requirements and add headless usage examples.

## v0.10.0
- Add `memo` to the transfer helper payload and store it as transfer metadata.
- Add `estimateTraffic` option to return estimated traffic in submit responses.
- Docs: add installed DAR versions list for Canton nodes.

## v0.9.0
- Add execute-and-wait connect execution path (selectable via options) that returns transaction results or failures immediately for dapp integrations.

## v0.8.0
- `onTransactionUpdate` now returns `update_id` and `update_data` in the update payload.
  `update_data` is the ledger transaction tree (includes `eventsById`, `workflowId`, `effectiveAt`, etc.).

## v0.7.6
- Add `getConnectUrl` method to get link to wallet connect.

## v0.7.5
- Fix not able to re-connect when aborting a connection half way without complete the handshake.

## v0.7.4
- Improve style of the Loop connect modal.
- Fix bug connect modal not showing up when calling `connect` again after hiding it and resume the connect flow.

## v0.7.3
- Add `autoConnect` and `logout` methods to enhance user experience on auto login on page load and control wallet logout flow

## v0.7.2
- Expose `has_preapproval`, `has_merge_delegation` and `usdc_bridge_access` to account object for dapp to check and ensure an account is setup to avoid UTXO size growing up.
- Add a new method `getAccount` on provider to allow dapp to refresh these status.

## v0.7.1
- Custom wallet prompt message: pass `message` to transactions to show dApp-provided text in the wallet UI.
- Add optional `requestSigningMode` (defaults to `'popup'`) to auto-open wallet dashboard (popup/tab) for signing/transaction requests and auto-close the popup when the wallet responds.
- Add internal request lifecycle hooks on `Provider` to allow the SDK core to react to signing and transaction requests.

## v0.7.0
- Auto-reconnect websocket before sending requests to reduce `Not connected` errors after idle timeouts.
- Add USDC withdraw helper: `wallet.extension.usdcBridge.withdrawalUSDCxToEthereum` (with `withdraw` alias), move USDC types/logic under the extension, and update the demo helper UI.

## v0.6.5
- Adjust `HANDSHAKE_REJECT` behavior so popup closing is fully controlled by the Wallet Connect UI.

## v0.6.4
- Added per-transfer `requestTimeout` option (defaults to 5 minutes), exported `DEFAULT_REQUEST_TIMEOUT_MS`, and updated demo UI to accept a timeout value.

## v0.6.3
- Added embedded CodePen demo to the docs under the Demo section for interactive examples.

## v0.6.2
- Version bump release; package metadata updated to 0.6.2.

## v0.6.1
- Increased wallet request/transaction timeout to 5 minutes.
- Display instrument admin info when fetching holdings.
- Docs moved under the `loop-sdk` package directory.

## v0.6.0
- Added `loop.wallet.transfer` helper that builds and submits transfers (optional instrument admin/id overrides).
- Demo updated with transfer UI fields.

## v0.5.0
- Added `id`/`class` to the overlay container and wrapped QR/link in a content div for easier styling/hooks.

## v0.4.0
- BREAKING: `openMode` and `redirectUrl` now live under the `options` object in `loop.init()`.
- Added `email` to `verifySession()` response by extending the `Account` return type.
- Added UUID polyfill fallback for environments without `crypto.randomUUID`.

## v0.3.0
- Added popup-based wallet connect flow and auto-close after acceptance.

## v0.2.1
- Cleared invalid cached `loop_connect` session when ticket is missing/expired to prevent stale reconnect errors.

## v0.2.0
- Added `email` to `handshake_accept` payload and exposed `provider.email` to dApps.

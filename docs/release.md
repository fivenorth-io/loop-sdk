# Loop SDK – Release Notes

## Release Resources

- **NPM Package:** [`@fivenorth/loop-sdk`](https://www.npmjs.com/package/@fivenorth/loop-sdk)
- **Full Changelog:** [`CHANGELOG`](https://www.github.com/fivenorth-io/loop-sdk/blob/main/CHANGELOG.md)

The release notes below highlight only the major updates. Refer to the links above for the complete changelog.

## v0.8.1
- Demo page now shows `update_data` for finalized transaction updates.

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

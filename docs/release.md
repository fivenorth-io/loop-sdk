# Loop SDK – Release Notes

## Release Resources

- **NPM Package:** [`@fivenorth/loop-sdk`](https://www.npmjs.com/package/@fivenorth/loop-sdk)
- **Full Changelog:** [`CHANGELOG`](https://www.github.com/fivenorth-io/loop-sdk/blob/main/CHANGELOG.md)

The release notes below highlight only the major updates. Refer to the links above for the complete changelog.
## v0.7.1
- Custom wallet prompt message: pass `message` to transactions to show dApp-provided text in the wallet UI.
- Add optional `requestOpenMode` (defaults to `'popup'`) to auto-open wallet dashboard (popup/tab) for signing/transaction requests and auto-close the popup when the wallet responds.

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

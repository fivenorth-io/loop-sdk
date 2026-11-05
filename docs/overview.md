# Loop SDK

Loop SDK allows dApps to connect to a [Loop](https://cantonloop.com) account.

## Links

- GitHub: [fivenorth-io/loop-sdk](https://github.com/fivenorth-io/loop-sdk)
- npm: [`@fivenorth/loop-sdk`](https://www.npmjs.com/package/@fivenorth/loop-sdk)

## What is Loop SDK?

Loop SDK is a lightweight JavaScript client that allows dApps to securely connect to the Loop wallet.
It handles the connection flow, performs session validation, and provides a Provider object so your
application can fetch holdings, query DAML contracts, submit transactions, and sign messages.

The SDK also includes a **server-side signing flow** for integrators who want to sign and submit transactions without a wallet popup. This server flow requires access to the user's private key.

## Supported contracts

Loop SDK can sign and submit any DAML transaction whose packages are installed on the Loop validator. Today that includes:

- **Splice packages**, including Canton Coin and the token standard interfaces (transfer and allocation instructions).
- **Digital Asset Utility packages** (registry, credential and related apps). See the [Utility DAR releases](https://docs.digitalasset.com/registry/releases/daml-models) for package names and versions.
- **Third-party packages that have passed Five North's DAR review** and been deployed to the Loop validator.

If a command references a template that isn't installed, the transaction is rejected with `TEMPLATES_OR_INTERFACES_NOT_FOUND`.

Need your own DAML templates on the Loop validator? See [Custom contracts](custom-contracts.md).

---

## Security Considerations

Browser dApps should never handle private keys directly.
For best security:

- Do not request or store private keys.
- Avoid persisting sensitive fields (e.g., `authToken`, `party_id`, email) outside memory.
- Always use HTTPS.
- Verify user identity on your backend before performing sensitive actions.

---

## Server SDK (No Popup)

The server SDK lets your backend sign and submit transactions programmatically. This removes the wallet popup but requires key custody.

- Use `@fivenorth/loop-sdk/server`
- Initialize with `privateKey` + `partyId`
- Authenticate, then prepare → sign → execute

If you do not control the private key, you must use the normal wallet popup flow instead.

Example ideas:
- List pending transfers
- Accept a pending transfer

## Next steps

- See **Usage Guide** for installation and basic examples.
- See **API Reference** for full method and type documentation.
- See **Custom contracts** if your dApp needs its own DAML templates.
- See **Changelog** for release history.

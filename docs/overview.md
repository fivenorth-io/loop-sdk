# Loop SDK

Loop SDK allows dApps to connect to a [Loop](https://cantonloop.com) account.  

## Links

- GitHub: [fivenorth-io/loop-sdk](https://github.com/fivenorth-io/loop-sdk)
- npm: [`@fivenorth/loop-sdk`](https://www.npmjs.com/package/@fivenorth/loop-sdk)
- Demo: [Loop SDK CodePen Example](https://codepen.io/kureikain/pen/KwVGgLX)

## What is Loop SDK?

Loop SDK is a lightweight JavaScript client that allows dApps to securely connect to the Loop wallet.  
It handles the connection flow, performs session validation, and provides a Provider object so your
application can fetch holdings, query DAML contracts, submit transactions, and sign messages.

The SDK also includes a **server-side signing flow** for integrators who want to sign and submit transactions without a wallet popup. This server flow requires access to the user's private key.

## Limitation

Currently, the SDK only supports DAML transactions from the built-in Splice DAR files and Utility app DAR files.

There is no plan to upload or support third-party DAR files at this time.

## Installed DAR versions

The following Utility DAR packages are supported by Loop Wallet and can be used when submitting DAML transactions through the SDK.

Latest installed DARs:

| Package name | Version | Package ID |
| --- | --- | --- |
| utility-collateral-app-v1 | 1.0.0 | 6bb2a795fd783646676705085d6548175783a5e63dd9084a6792cb25b32769d0 |
| utility-commercials-v0 | 0.3.0 | 2c9bf120ccbf831f4512536f984359bdd4d548a211858096d30ecdd7d704da0a |
| utility-bridge-app-v0 | 0.1.2 | 41ddf3ff2a744a5fdf941d7a3efa62555956f6f55737ac102e18fba43d6bf7f5 |
| utility-bridge-v0 | 0.1.2 | f0e9f1a078dd39a26b71292afff290a7be09f7eadca3e6de12e3461fc5e9b0c7 |
| utility-credential-app-v0 | 0.3.0 | dd204b26bc3c7907f9e12d117d8290728fc9b5daa7669a405d4d87d8db53c7c5 |
| utility-credential-v0 | 0.0.4 | 0207e2ca0b52468fc03dd81c69f13cfb54f57eb59bee5f75582ebe45dce63f3a |
| utility-hosted-app-v0 | 0.0.1 | 26082d4be3618b18d04fbfb7e0755a3b5859917b76be667d2a7c435b74835f66 |
| utility-registry-app-v0 | 0.5.0 | 2717412f011584c6001ef2229949661da69bbe49790c9fc2c2b7d35a479311ff |
| utility-registry-holding-v0 | 0.1.2 | dd3a9f2d51cc4c52d9ec2e1d7ff235298dcfb3afd1d50ab44328b1aaa9a18587 |
| utility-registry-operator-v0 | 0.0.5 | 730b93328be1fbacee42aa57bc10a2acdc526c8fbe193334cb96966934256048 |
| utility-registry-v0 | 0.4.1 | fc7214ab1078eb1e0d6ce670f203423c54882bd043234364f3cb181c831d7dbd |
| utility-settlement-app-v1 | 1.1.0 | 34ab886ee88b045637ff416f558734309f5650fec81a603cb5db76bbd863b950 |
| utility-version-v0 | 0.0.1 | 42e902610f593c6fb5516d7a7401ad0892dc44507a777ace0a468a5f6c9d3381 |

Reference: https://docs.digitalasset.com/utilities/devnet/index.html

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

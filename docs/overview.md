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

## Limitation

Currently, the SDK only supports DAML transactions from the built-in Splice DAR files and Utility app DAR files.

There is no plan to upload or support third-party DAR files at this time.

---

## Security Considerations

The Loop SDK is designed so your dApp never handles private keys directly.  
For best security:

- Do not request or store private keys.
- Avoid persisting sensitive fields (e.g., `authToken`, `party_id`, email) outside memory.
- Always use HTTPS.
- Verify user identity on your backend before performing sensitive actions.

---

## Next steps

- See **Usage Guide** for installation and basic examples.
- See **API Reference** for full method and type documentation.
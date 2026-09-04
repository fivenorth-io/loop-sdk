# API Reference

This section lists all publicly available SDK APIs to dApps.

---

## `loop` Object API

The main entry point of the SDK.

### `loop.init(config)`

Initializes the SDK. Must be called once during the app startup.

#### Parameters

```ts
loop.init({
    appName: string,
    network: 'local' | 'devnet' | 'mainnet',
    walletUrl?: string,
    apiUrl?: string,
    options?: {
        openMode?: 'popup' | 'tab';
        requestSigningMode?: 'popup' | 'tab'; // default: 'popup'
        redirectUrl?: string;
    },
    onAccept: (provider: Provider) => void,
    onReject: () => void,
    onTransactionUpdate?: (payload: RunTransactionResponse, message: any) => void,
});
```

#### Notes
- `onAccept(provider)` is called when user approves via wallet.
- `onReject()` is called when user rejects.
- `onTransactionUpdate(payload)` is called once per transaction with a single payload. It always includes `command_id` and `submission_id`. On success it also includes `update_id` and `update_data` (ledger transaction tree); on failure it includes `status: "failed"` and `error.error_message`.
- `openMode` and `redirectUrl` configure connection UI behavior.
- `requestSigningMode` controls whether signing/transaction requests open the wallet dashboard automatically after you are connected (`'popup'` default or `'tab'`).

---

### `loop.connect()`

Starts the Loop Connect flow.

This will:
1. Validate or clear cached session.
2. Request a connection ticket from backend. 
3. Open the wallet UI (popup/tab).
4. Open a websocket waiting for approval or rejection.
5. Trigger `onAccept(provider)` or `onReject()`.

---

### `loop.autoConnect()`

Automatically connect to the wallet and sign user in if an previous sessionis still valid. This flow will happen sitenly and won't show the QR code if user has not login yet. Therefore, this is ideal to run on pageload without disruping the dapp UI/UX.

---

### `loop.logout()`

Disconnects the active Connect ticket when possible, clears cached session (localStorage), and resets internal state.

---

### `loop.verifySession()`

Verifies the current cached session with the Loop backend and returns the latest account information.

```ts
const session = await loop.verifySession();
// session is either null or an object with the current account info
```

---

## Provider API

When the user approves, the SDK returns a Provider instance.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `party_id` | `string` | The user's Canton party ID |
| `public_key` | `string` | Public key of the wallet |
| `email` | `string` | User email |

---

### Methods

#### `provider.getAuthToken(): string`

Returns the auth token used for authenticated backend calls.

---

#### `provider.getAccount(): Promise<Account>`

Fetches the latest account status for the connected wallet, including utility preapproval admin IDs, merge delegation, and USDC bridge access.

---

#### `provider.getHolding(): Promise<Holding[]>`

Fetches the user's token holdings.

---

#### `provider.getActiveContracts({ templateId?, interfaceId? }): Promise<ActiveContract[]>`

```ts
provider.getActiveContracts({
    templateId?: string;
    interfaceId?: string;
});
```

Fetches DAML active contracts filtered by template or interface.

---

#### `provider.estimateGas(payload): Promise<EstimatedGasResponse>`

Returns the existing browser / WalletConnect network fee estimate before submission. Server SDK Fee Balance estimates are returned from `loop.prepareSubmission(...)`.

---

#### `provider.submitTransaction(command, options?): Promise<any>`

Submits a DAML ExcerciseCommand or multi-command transaction. This is the default async path (no `execution_mode`). It returns the submission result first (including `command_id` and `submission_id`), then the ledger update arrives later via `onTransactionUpdate` with `update_id` and `update_data`. Use `estimateTraffic: true` in the options to return estimated traffic in the submission response. Use `deduplicationPeriod` to override the default 1800 second deduplication window.

---

#### `provider.submitAndWaitForTransaction(command, options?): Promise<any>`

Submits a DAML ExcerciseCommand or multi-command transaction and waits for the result. This is opt-in and sends `execution_mode: "wait"` so the wallet uses the execute-and-wait endpoint. The final result arrives as a single `onTransactionUpdate` payload (command/submission IDs plus update data or failure status). Use `deduplicationPeriod` to override the default 1800 second deduplication window.

Note: errors from the wait endpoint do not always mean the transaction failed. A 4xx error (e.g., 400) is a definite failure. A 5xx/timeout can mean the ledger is slow; the transaction may still be committed later, so clients should keep listening for updates rather than assume failure.

Deduplication: both async execute and execute-and-wait use a 30 minute deduplication window by default. For ambiguous outcomes (for example timeout, disconnect, or 5xx where the previous submission may already have reached Canton), retry within that window with the same payload `commandId` so the request is idempotent. You can override the window with `deduplicationPeriod`.

---

#### `provider.transfer(recipient, amount, instrument?, options?): Promise<any>`

Prepares and submits a token transfer transaction to be signed by the wallet.

```ts
await provider.transfer(
  recipient: string,
  amount: string | number,
  instrument?: {
    instrument_admin?: string;
    instrument_id?: string; // default: 'Amulet'
  },
  options?: {
    requestedAt?: string | Date;
    executeBefore?: string | Date;
    requestTimeout?: number;
    memo?: string;
    message?: string;
    executionMode?: 'async' | 'wait';
    estimateTraffic?: boolean;
    deduplicationPeriod?: { seconds: number; nanos?: number } | { empty: true };
  }
);
```

If the wallet popup or tab opened for the request is closed before the wallet responds, the promise rejects with `PopupClosedError`. Otherwise the existing `requestTimeout` behavior still applies.

---

## Server SDK API

These methods are available from `import { loop } from '@fivenorth/loop-sdk/server'`.

### Fee Balance Methods

Loop supports two server SDK fee flows: Fee Balance, where users maintain a prepaid balance and Canton deducts transaction costs from that balance, and pending network fees, where a transaction can create a separate fee payment that must be paid before the next transaction.

Existing server SDK integrations can keep using `loop.executeTransaction(...)` for the simple `prepare -> sign -> execute` path. Use `prepareSubmission -> ensureFeeBalance -> sign -> executeSubmission` when you want to check and top up Fee Balance before execution.

Browser / WalletConnect dApps do not manage Fee Balance directly. Users maintain their Fee Balance in the Loop wallet, and the wallet handles Fee Balance prompts during browser signing/submission flows.

#### `loop.prepareSubmission(payload): Promise<PreparedSubmissionResponse>`

Prepares a server-side transaction for signing and returns Fee Balance estimate fields in the same response when Canton returns traffic estimation.

Fee Balance fields:
- `estimated_traffic_units`
- `estimated_traffic`
- `estimated_network_fee_amount`
- `estimated_network_fee_asset`

The `estimated_network_fee_*` fields are the Fee Balance cost converted to CC for display and balance checks.

#### `loop.getFeeBalance(): Promise<FeeBalanceResponse>`

Returns the current Fee Balance for the authenticated party.

#### `loop.topUpFeeBalance(amountCC): Promise<FeeBalanceTopUpExecuteResponse>`

Tops up the authenticated party's Fee Balance by preparing a CC payment, signing it with the server signer, and executing the top-up. This only credits the authenticated party; it does not top up arbitrary accounts.

The response includes `amount_cc` for the CC-equivalent Fee Balance credited and `payment_amount_cc` for the CC paid after any Loop service charge.

#### `loop.ensureFeeBalance(options): Promise<EnsureFeeBalanceResponse>`

Checks the authenticated party's Fee Balance and tops up only when the current balance is below `requiredCC + reserveCC`.

Required option:
- `requiredCC`: expected Fee Balance cost in CC, usually from `prepared.estimated_network_fee_amount`

Optional options:
- `reserveCC`: extra Fee Balance to keep available after the transaction; defaults to `10`
- `topUpAmountCC`: minimum amount to top up when the balance is too low; defaults to `25`. Larger shortfalls are topped up with an extra reserve cushion for the network fee for the top-up transaction.

### Pending Network Fee Methods

These methods support the pending network fee flow.

#### `loop.estimateGas(payload): Promise<EstimatedGasResponse>`

Returns the server-side network fee estimate before submission. For Server SDK Fee Balance handling, use `loop.prepareSubmission(...)`.

#### `loop.checkDueGas(trackingId?): Promise<PendingGasResponse>`

Returns the current pending network fee for the authenticated party. Pass `trackingId` to inspect a specific pending charge.

#### `loop.payGas(trackingId): Promise<any>`

Prepares, signs, and executes the pending network fee payment for the specified tracking ID.

`PaymentRequiredError` can represent either a pending network fee or a Fee Balance failure. Only call `checkDueGas(...)` / `payGas(...)` when the error includes `trackingId`; otherwise inspect `message` / `code`, top up Fee Balance if needed, and retry the original transaction.

---

#### `provider.signMessage(message: string): Promise<any>`

Requests the wallet to sign an arbitrary message.

---

## Request lifecycle hooks

Internal request lifecycle hooks allow the SDK core to react to signing and transaction requests. These hooks are internal and not exposed to dApps.

### `ProviderHooks`

```ts
type ProviderHooks = {
  onRequestStart?: (messageType: MessageType, requestLabel?: string) => unknown;
  onRequestFinish?: (args: {
    status: 'success' | 'rejected' | 'timeout' | 'error';
    messageType: MessageType;
    requestLabel?: string;
    requestContext?: unknown;
  }) => void;
  onTransactionUpdate?: (payload: RunTransactionResponse, message: any) => void;
  onSessionInvalid?: () => void;
};
```

`onSessionInvalid` is used internally to clear cached Connect state when a WebSocket session can no longer be reconnected or the backend invalidates the ticket. It is not passed through `loop.init()`.

---

## Public Types

### Network

```ts
type Network =
    | 'local'
    | 'devnet'
    | 'mainnet';
```

### Account

```ts
type Account = {
    party_id: string;
    auth_token: string;
    public_key: string;
    email?: string;
    has_preapproval?: boolean;
    utility_preapproval_admins?: string[];
    has_merge_delegation?: boolean;
    usdc_bridge_access?: 'not_requested' | 'pending' | 'granted';
};
```

### InstrumentId

```ts
type InstrumentId = {
    admin: string;
    id: string;
};
```

### Holding

```ts
type Holding = {
    instrument_id: InstrumentId;
    decimals: number;
    symbol: string;
    org_name: string;
    total_unlocked_coin: string;
    total_locked_coin: string;
    image: string;
};
```

### ActiveContract

```ts
type ActiveContract = {
    template_id: string;
    contract_id: string;
    [key: string]: any;
};
```

---

## Internal Code Path 

### 1. Init

- Saves config
- Resolves wallet/api URL from network or overrides
- Set up session cache

### 2. Connect Flow

1. Validates or clears cached session
2. Requests a ticket (`POST /api/v1/.connect/ticket`)
3. Opens wallet using:
    ```
    /api/v1/.connect/?ticketId=xxxx
    ```
4. Opens websocket:
    ```
    ws://.../.connect/pair/ws/:ticketId
    ```

### 3. Approval / Rejection

- On approve -> backend sends a `handshake_accept` event
  Provider is constructed.

### 4. Session Validation

Before reconnecting, SDK verifies session via:

```
GET /api/v1/profile
```

If invalid, -> session cache is cleared automatically.

---

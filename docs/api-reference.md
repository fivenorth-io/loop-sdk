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
        redirectUrl?: string;
    },
    onAccept: (provider: Provider) => void,
    onReject: () => void,
});
```

#### Notes
- `onAccept(provider)` is called when user approves via wallet.
- `onReject()` is called when user rejects.
- `openMode` and `redirectUrl` configure connection UI behavior.

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

### `loop.disconnect()`

Clears cached session (localStorage) and resets internal state.

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
| `auth_token` | `string` | Token for authenticated backend calls |

---

### Methods

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

#### `provider.submitTransaction(command): Promise<any>`

Submits a DAML ExcerciseCommand or multi-command transaction.

---

#### `provider.signMessage(message: string): Promise<any>`

Requests the wallet to sign an arbitrary message.

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
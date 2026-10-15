export type Cip103Null = null;
export type Cip103ProviderInfo = {
    "id": string;
    "version"?: string;
    "providerType": "browser" | "desktop" | "mobile" | "remote";
    "url"?: string;
    "userUrl"?: Cip103UserUrl;
};
export type Cip103LedgerApiResult = {
    [key: string]: unknown;
};
export type Cip103UserUrl = string;
export type Cip103JsPrepareSubmissionRequest = {
    "commandId"?: Cip103CommandId;
    "commands": Cip103Commands;
    "actAs"?: Array<string>;
    "readAs"?: Array<string>;
    "disclosedContracts"?: Array<Cip103DisclosedContract>;
    "synchronizerId"?: string;
    "packageIdSelectionPreference"?: Array<string>;
};
export type Cip103DisclosedContract = {
    "templateId"?: string;
    "contractId"?: string;
    "createdEventBlob": string;
    "synchronizerId"?: string;
};
export type Cip103CreateCommand = {
    "CreateCommand": {
        [key: string]: unknown;
    };
};
export type Cip103ExerciseCommand = {
    "ExerciseCommand": {
        [key: string]: unknown;
    };
};
export type Cip103CreateAndExerciseCommand = {
    "CreateAndExerciseCommand": {
        [key: string]: unknown;
    };
};
export type Cip103ExerciseByKeyCommand = {
    "ExerciseByKeyCommand": {
        [key: string]: unknown;
    };
};
export type Cip103Command = Cip103CreateCommand | Cip103ExerciseCommand | Cip103CreateAndExerciseCommand | Cip103ExerciseByKeyCommand;
export type Cip103Commands = Array<Cip103Command>;
export type Cip103JsPrepareSubmissionResponse = {
    "preparedTransaction"?: string;
    "preparedTransactionHash"?: string;
};
export type Cip103LedgerApiRequest = {
    "requestMethod": "get" | "post" | "patch" | "put" | "delete";
    "resource": string;
    "body"?: {
        [key: string]: unknown;
    };
    "query"?: {
        [key: string]: unknown;
    };
    "path"?: {
        [key: string]: unknown;
    };
};
export type Cip103AccountsChangedEvent = Array<Cip103Wallet>;
export type Cip103ListAccountsResult = Array<Cip103Wallet>;
export type Cip103CommandId = string;
export type Cip103MessageId = string;
export type Cip103TxChangedPendingEvent = {
    "status": "pending";
    "commandId": Cip103CommandId;
};
export type Cip103TxChangedSignedPayload = {
    "signature": string;
    "signedBy": string;
    "party": string;
};
export type Cip103TxChangedSignedEvent = {
    "status": "signed";
    "commandId": Cip103CommandId;
    "payload": Cip103TxChangedSignedPayload;
};
export type Cip103TxChangedExecutedPayload = {
    "updateId": string;
    "completionOffset": number;
};
export type Cip103TxChangedExecutedEvent = {
    "status": "executed";
    "commandId": Cip103CommandId;
    "payload": Cip103TxChangedExecutedPayload;
};
export type Cip103TxChangedFailedEvent = {
    "status": "failed";
    "commandId": Cip103CommandId;
};
export type Cip103TxChangedEvent = Cip103TxChangedPendingEvent | Cip103TxChangedSignedEvent | Cip103TxChangedExecutedEvent | Cip103TxChangedFailedEvent;
export type Cip103MessageSignaturePendingEvent = {
    "status": "pending";
    "messageId": Cip103MessageId;
};
export type Cip103MessageSignatureSignedEvent = {
    "status": "signed";
    "messageId": Cip103MessageId;
    "signature": string;
};
export type Cip103MessageSignatureFailedEvent = {
    "status": "failed";
    "messageId": Cip103MessageId;
};
export type Cip103MessageSignatureEvent = Cip103MessageSignaturePendingEvent | Cip103MessageSignatureSignedEvent | Cip103MessageSignatureFailedEvent;
export type Cip103ConnectResult = {
    "isConnected": boolean;
    "reason"?: string;
    "isNetworkConnected": boolean;
    "networkReason"?: string;
    "userUrl"?: Cip103UserUrl;
};
export type Cip103StatusEvent = {
    "provider": Cip103ProviderInfo;
    "connection": Cip103ConnectResult;
    "network"?: Cip103Network;
    "session"?: Cip103Session;
};
export type Cip103SignMessageRequest = {
    "message": string;
};
export type Cip103SignMessageResult = {
    "signature": string;
};
export type Cip103Network = {
    "networkId": string;
    "ledgerApi"?: string;
    "accessToken"?: Cip103AccessToken;
};
export type Cip103AccessToken = string;
export type Cip103Session = {
    "accessToken": Cip103AccessToken;
    "userId": string;
};
export type Cip103Wallet = {
    "primary": boolean;
    "partyId": string;
    "status": "initialized" | "allocated" | "removed";
    "hint": string;
    "publicKey": string;
    "namespace": string;
    "networkId": string;
    "signingProviderId": string;
    "externalTxId"?: string;
    "topologyTransactions"?: string;
    "disabled"?: boolean;
    "reason"?: string;
};
export interface Cip103MethodMap {
    status: {
        params: undefined;
        result: Cip103StatusEvent;
    };
    connect: {
        params: undefined;
        result: Cip103ConnectResult;
    };
    disconnect: {
        params: undefined;
        result: Cip103Null;
    };
    isConnected: {
        params: undefined;
        result: Cip103ConnectResult;
    };
    getActiveNetwork: {
        params: undefined;
        result: Cip103Network;
    };
    prepareExecute: {
        params: Cip103JsPrepareSubmissionRequest;
        result: Cip103Null;
    };
    prepareExecuteAndWait: {
        params: Cip103JsPrepareSubmissionRequest;
        result: {
            "tx": Cip103TxChangedExecutedEvent;
        };
    };
    signMessage: {
        params: Cip103SignMessageRequest;
        result: Cip103SignMessageResult;
    };
    ledgerApi: {
        params: Cip103LedgerApiRequest;
        result: Cip103LedgerApiResult;
    };
    getPrimaryAccount: {
        params: undefined;
        result: Cip103Wallet;
    };
    listAccounts: {
        params: undefined;
        result: Cip103ListAccountsResult;
    };
}
export interface Cip103EventMap {
    accountsChanged: Cip103AccountsChangedEvent;
    txChanged: Cip103TxChangedEvent;
    messageSignature: Cip103MessageSignatureEvent;
    statusChanged: Cip103StatusEvent;
}

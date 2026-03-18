import type { UsdcBridgeExtension } from './extensions/usdc/types';

export type Network = 'devnet' | 'testnet' | 'mainnet' | 'local' | 'dev' | 'test' | 'main';

export type UsdcBridgeAccessType = 'not_requested' | 'pending' | 'granted';
export type Account = {
  party_id: string;
  auth_token: string;
  public_key: string;
  email?: string;

  has_preapproval?: boolean;
  has_merge_delegation?: boolean;
  usdc_bridge_access?: UsdcBridgeAccessType;
};

export enum MessageType {
  HANDSHAKE_ACCEPT = 'handshake_accept',
  HANDSHAKE_REJECT = 'handshake_reject',

  RUN_TRANSACTION = 'run_transaction',
  TRANSACTION_COMPLETED = 'transaction_completed',

  SIGN_RAW_MESSAGE = 'sign_raw_message',
  SIGN_RAW_MESSAGE_RESPONSE = 'sign_raw_message_response',
  REJECT_REQUEST = 'reject_request',
}

export type InstrumentId = {
  admin: string;
  id: string;
};

export type Holding = {
  instrument_id: InstrumentId;
  decimals: number;
  symbol: string;
  org_name: string;
  total_unlocked_coin: string;
  total_locked_coin: string;
  image: string;
};

export type ActiveContract = {
  template_id: string;
  contract_id: string;
  // Place other known properties here...
  [key: string]: any; // Allow other properties
};

export type Instrument = {
  instrument_admin?: string;
  instrument_id: string;
};

export type TransferRequest = {
  recipient: string;
  amount: string;
  instrument?: Instrument;
  requested_at?: string;
  execute_before?: string;
  memo?: string;
};

export type TransactionPayload = {
  commands: any[];
  disclosedContracts: any[];
  packageIdSelectionPreference?: string[];
  actAs?: string[];
  readAs?: string[];
  synchronizerId?: string;
  deduplicationPeriod?: DeduplicationPeriodInput;
};

export type DeduplicationPeriodInput =
  | { empty: true }
  | {
      seconds: number;
      nanos?: number;
    };

export type PreparedTransferPayload = {
  actAs: string[];
  readAs: string[];
  synchronizerId: string;
  commands: any[];
  disclosedContracts: any[];
  packageIdSelectionPreference: string[];
};

export type ConnectTransferResponse = {
  payload: PreparedTransferPayload;
};

export type RunTransactionResponse = {
  command_id: string;
  submission_id?: string;
  estimated_traffic?: unknown;
  update_data?: unknown;
  update_id?: string;
  status?: 'succeeded' | 'failed';
  error?: SubmissionError;
};

export type SubmissionError = {
  error_message: string;
};

export type TransferOptions = {
  requestedAt?: string | Date;
  executeBefore?: string | Date;
  requestTimeout?: number;
  memo?: string;
  message?: string; // custom message to include in the request ticket
  executionMode?: 'async' | 'wait';
  estimateTraffic?: boolean;
  deduplicationPeriod?: DeduplicationPeriodInput;
};

export type InstrumentSpec = Instrument;

export interface Wallet {
  transfer(recipient: string, amount: string | number, instrument?: InstrumentSpec, options?: TransferOptions): Promise<any>;
  extension: {
    usdcBridge: UsdcBridgeExtension;
  };
}

export type ExchangeApiKeyResponse = {
  // api key is the jwt token to send request similar to how front-end send 
  api_key: string;
  // auth token is the token to send request and authenticate through the connect ticket system
  auth_token: string;
  email?: string;
  ticket_id: string;
  session_id: string;
};

export type PreparedSubmissionResponse = {
  command_id: string;
  transaction_hash: string;
  transaction_data: string;
};

export type ExecuteSubmissionResquest = {
  command_id: string;
  transaction_data: string;
  signature: string;
  deduplication_period?: DeduplicationPeriodInput;
}

export type PendingGasResponse = {
  pending: boolean;
  tracking_id?: string;
  gas_amount?: string;
  status?: string;
  origin?: string;
  expires_at?: string;
  request_id?: string;
};

export type EstimatedGasResponse = {
  requires_gas: boolean;
  can_execute: boolean;
  estimated_gas_amount?: string;
  estimated_gas_asset?: string;
};

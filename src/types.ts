export type Network = 'devnet' | 'testnet' | 'mainnet' | 'local' | 'dev' | 'test' | 'main';

export type Account = {
  party_id: string;
  auth_token: string;
  public_key: string;
  email?: string;
};

export enum MessageType {
  HANDSHAKE_ACCEPT = 'handshake_accept',
  HANDSHAKE_REJECT = 'handshake_reject',

  RUN_TRANSACTION = 'run_transaction',
  RUN_TRANSACTION_RESPONSE = 'run_transaction_response',

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
export type WithdrawUsdcRequest = {
  recipient: string;
  amount: string;
  reference?: string;
};

export type PreparedWithdrawPayload = {
  actAs: string[];
  readAs: string[];
  synchronizerId: string;
  commands: any[];
  disclosedContracts: any[];
  packageIdSelectionPreference: string[];
};

export type ConnectWithdrawResponse = {
  payload: PreparedWithdrawPayload;
};

export type WithdrawOptions = {
  reference?: string;
  requestTimeout?: number;
  message?: string; // custom message to include in the request ticket
};

export interface UsdcBridgeExtension {
  withdrawalUSDCxToEthereum(recipient: string, amount: string | number, options?: WithdrawOptions): Promise<any>;
}

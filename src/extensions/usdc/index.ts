import type { WithdrawOptions, UsdcBridgeExtension, WithdrawUsdcRequest, PreparedWithdrawPayload, ConnectWithdrawResponse } from './types';
import type { Provider } from '../../provider';
import type { Connection } from '../../connection';

export class UsdcBridge implements UsdcBridgeExtension {
  private getProvider: () => Provider | null;

  constructor(getProvider: () => Provider | null) {
    this.getProvider = getProvider;
  }

  private requireProvider(): Provider {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('SDK not connected. Call connect() and wait for acceptance first.');
    }
    return provider;
  }

  withdrawalUSDCxToEthereum(recipient: string, amount: string | number, options?: WithdrawOptions): Promise<any> {
    const provider = this.requireProvider();
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;

    const withdrawRequest: WithdrawUsdcRequest = {
      recipient,
      amount: amountStr,
      reference: options?.reference,
    };

    return prepareUsdcWithdraw(provider.connection, provider.getAuthToken(), withdrawRequest).then((preparedPayload: PreparedWithdrawPayload) =>
      provider.submitTransaction(
        {
          commands: preparedPayload.commands,
          disclosedContracts: preparedPayload.disclosedContracts,
          packageIdSelectionPreference: preparedPayload.packageIdSelectionPreference,
          actAs: preparedPayload.actAs,
          readAs: preparedPayload.readAs,
          synchronizerId: preparedPayload.synchronizerId,
        },
        { requestTimeout: options?.requestTimeout, message: options?.message },
      )
    );
  }
}

export async function prepareUsdcWithdraw(connection: Connection, authToken: string, params: WithdrawUsdcRequest): Promise<PreparedWithdrawPayload> {
  const payload: Record<string, any> = {
    recipient: params.recipient,
    amount: params.amount,
  };

  if (params.reference) {
    payload.reference = params.reference;
  }

  const response = await fetch(`${connection.apiUrl}/api/v1/.connect/pair/usdc/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to prepare USDC withdrawal.');
  }

  const data: ConnectWithdrawResponse = await response.json();
  return data.payload;
}

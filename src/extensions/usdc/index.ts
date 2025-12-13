import type { WithdrawOptions, UsdcBridgeExtension, WithdrawUsdcRequest, PreparedWithdrawPayload, ConnectWithdrawResponse } from '../../types';
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

  withdraw(recipient: string, amount: string | number, options?: WithdrawOptions): Promise<any> {
    const provider = this.requireProvider();
    return provider.withdrawUSDC(recipient, amount, options);
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

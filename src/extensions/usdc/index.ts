import type { WithdrawOptions, UsdcBridgeExtension } from '../../types';
import type { Provider } from '../../provider';

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

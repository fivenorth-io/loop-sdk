import type { InstrumentSpec, TransferOptions, Wallet } from './types';
import type { WithdrawOptions } from './extensions/usdc/types';
import type { Provider } from './provider';
import { UsdcBridge } from './extensions/usdc';

export class LoopWallet implements Wallet {
  private getProvider: () => Provider | null;
  public extension: Wallet['extension'];

  constructor(getProvider: () => Provider | null) {
    this.getProvider = getProvider;
    this.extension = {
      usdcBridge: new UsdcBridge(this.getProvider),
    };
  }

  private requireProvider(): Provider {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('SDK not connected. Call connect() and wait for acceptance first.');
    }
    return provider;
  }

  transfer(recipient: string, amount: string | number, instrument?: InstrumentSpec, options?: TransferOptions): Promise<any> {
    const provider = this.requireProvider();
    return provider.transfer(recipient, amount, instrument, options);
  }
}

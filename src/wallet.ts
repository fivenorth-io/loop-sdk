import type { InstrumentSpec, TransferOptions, Wallet, WithdrawOptions } from './types';
import type { Provider } from './provider';

export class LoopWallet implements Wallet {
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

  transfer(recipient: string, amount: string | number, instrument?: InstrumentSpec, options?: TransferOptions): Promise<any> {
    const provider = this.requireProvider();
    return provider.transfer(recipient, amount, instrument, options);
  }

  withdrawUSDC(recipient: string, amount: string | number, options?: WithdrawOptions): Promise<any> {
    const provider = this.requireProvider();
    return provider.withdrawUSDC(recipient, amount, options);
  }
}

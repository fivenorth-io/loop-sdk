import QRCode from 'qrcode';
import type { Account, Network, TransferOptions, InstrumentSpec, Wallet } from './types';
import { MessageType } from './types';
import { Connection } from './connection';
import { Provider, generateRequestId } from './provider';
import type { ProviderHooks } from './provider';
import { LoopWallet } from './wallet';
import { extractErrorCode, isUnauthCode, UnauthorizedError } from './errors';

class LoopSDK {
  private connectState: { status: 'init' | 'connecting' | 'connected'; promise: Promise<void> | null } = {
    status: 'init',
    promise: null,
  };
  private version: string = '0.0.1';
  private appName: string = 'Unknown';
  private connection: Connection | null = null;
  private provider: Provider | null = null;
  private openMode: 'popup' | 'tab' = 'popup';
  private requestSigningMode: 'popup' | 'tab' = 'popup';
  private popupWindow: Window | null = null; 
  private redirectUrl?: string;

  private onAccept: ((provider: Provider) => void) | null = null;
  private onReject: (() => void) | null = null;
  private overlay: HTMLDivElement | null = null;
  private ticketId: string | null = null;
  public wallet: Wallet;

  constructor() {
    this.wallet = new LoopWallet(() => this.provider);
  }

  init({ 
    appName, 
    network, 
    walletUrl, 
    apiUrl, 
    onAccept, 
    onReject,
    options,  
  }: { 
    appName: string, 
    network?: Network, 
    walletUrl?: string, 
    apiUrl?: string, 
    onAccept?: (provider: Provider) => void, 
    onReject?: () => void, 
    options?: {
      openMode?: 'popup' | 'tab' 
      requestSigningMode?: 'popup' | 'tab',
      redirectUrl?: string, 
    };
  }) {
    this.appName = appName;
    this.onAccept = onAccept || null;
    this.onReject = onReject || null;

    const resolvedOptions = {
      openMode: 'popup' as 'popup' | 'tab',
      requestSigningMode: 'popup' as 'popup' | 'tab',
      redirectUrl: undefined as string | undefined,
      ...(options ?? {}),
    };

    this.openMode = resolvedOptions.openMode;
    this.requestSigningMode = resolvedOptions.requestSigningMode;
    this.redirectUrl = resolvedOptions.redirectUrl;
    
    this.connection = new Connection({ network, walletUrl, apiUrl });
  }

  async connect() {
    if (typeof window === 'undefined') {
      console.warn('LoopSDK.connect() can only be called in a browser environment.');
      return;
    }
    if (!this.connection) {
      throw new Error('SDK not initialized. Call init() first.');
    }

    if (this.connectState.status === 'connected' || this.provider) {
      return;
    }

    if (this.connectState.status === 'connecting') {
      await this.connectState.promise;
      return;
    }

    // try to restore valid sessioin
    if (await this.tryRestoreValidSession()) {
      return;
    }

    // cached ticket, but no valid session
    if (await this.tryResumePendingTicket()) {
      return;
    }

    // create new ticket
    const sessionId = generateRequestId();

    // prevent double-connect
    this.connectState.status = 'connecting';
    const connectPromise = (async () => {
      const connection = this.connection;
      if (!connection) {
        throw new Error('Connection not initialized');
      }
      try {
        const { ticket_id: ticketId } = await connection.getTicket(this.appName, sessionId, this.version);
        this.ticketId = ticketId;

        localStorage.setItem('loop_connect', JSON.stringify({ sessionId, ticketId }));
        
        const connectUrl = this.buildConnectUrl(ticketId);
        this.showQrCode(connectUrl);

        connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
      } catch (error) {
        console.error(error);
        this.connectState.status = 'init';
      } finally {
        this.connectState.promise = null;
      }
    })();
    this.connectState.promise = connectPromise;

    await connectPromise;
  }

  // autoconnects if valid session exists
  async autoConnect(): Promise<Provider | null> {
    if (typeof window === 'undefined') {
      console.warn('LoopSDK.autoConnect() can only be called in a browser environment.');
      return null;
    }
    if (!this.connection) {
      throw new Error('SDK not initialized. Call init() first.');
    }

    const restored = await this.tryRestoreValidSession();
    return restored ? this.provider : null;
  }

  private handleWebSocketMessage(event: MessageEvent) {
    const message = JSON.parse(event.data);

    const errCode = extractErrorCode(message);

    if (isUnauthCode(errCode)) {
      console.warn('[LoopSDK] Detected session invalidation:', errCode, { message });
      this.logout();
      return;
    }

    console.log('[LoopSDK] WS message received:', message);
    if (message.type === MessageType.HANDSHAKE_ACCEPT) {
      console.log('[LoopSDK] Entering HANDSHAKE_ACCEPT flow');
      const { authToken, partyId, publicKey, email } = message.payload || {};
      if (authToken && partyId && publicKey) {
            this.provider = new Provider({ 
              connection: this.connection!, 
              party_id: partyId, 
              auth_token: authToken, 
              public_key: publicKey, 
              email,
              hooks: this.createProviderHooks(),
            });

        const connectionInfoRaw = localStorage.getItem('loop_connect');
        if (connectionInfoRaw) {
          try {
            const connectionInfo = JSON.parse(connectionInfoRaw);
            this.ticketId = connectionInfo.ticketId || this.ticketId;
            connectionInfo.authToken = authToken;
            connectionInfo.partyId = partyId;
            connectionInfo.publicKey = publicKey;
            connectionInfo.email = email;
            localStorage.setItem('loop_connect', JSON.stringify(connectionInfo));
            this.connectState.status = 'connected';
            this.onAccept?.(this.provider);
            this.hideQrCode();
            this.connection?.connectWebSocket(connectionInfo.ticketId, this.handleWebSocketMessage.bind(this));

            console.log('[LoopSDK] HANDSHAKE_ACCEPT: closing popup (if exists)');
            this.popupWindow = null;

          } catch (error) {
            console.error('Failed to update local storage with auth token.', error);
          }
        }
      }
    } else if (message.type === MessageType.HANDSHAKE_REJECT) {
      console.log('[LoopSDK] Entering HANDSHAKE_REJECT flow');
      localStorage.removeItem('loop_connect');
      this.connection?.ws?.close();
      this.onReject?.();
      this.hideQrCode();
      this.connectState.status = 'init';

      console.log('[LoopSDK] HANDSHAKE_REJECT: closing popup (if exists)');
      this.popupWindow = null;
    } else if (this.provider) {
        this.provider.handleResponse(message);
    }
  }

  private buildConnectUrl(ticketId: string): string {
    const url = new URL('/.connect/', this.connection!.walletUrl);
    url.searchParams.set('ticketId', ticketId);
    if (this.redirectUrl) {
      url.searchParams.set('redirectUrl', this.redirectUrl);
    }
    return url.toString();
  }

  private buildDashboardUrl() {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    return this.connection.walletUrl;
  }

  private openRequestUi(): Window | null {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!this.ticketId) {
      console.warn('[LoopSDK] Cannot open wallet UI for request: no active ticket.');
      return null;
    }

    const dashboardUrl = this.buildDashboardUrl();
    const targetMode = this.requestSigningMode === 'tab' ? 'tab' : 'popup';
    const opened = this.openWallet(dashboardUrl, targetMode);
    if (opened) {
      this.popupWindow = opened;
      return opened;
    }
    return null;
  }

  private closePopupIfExists() {
    if (this.popupWindow && !this.popupWindow.closed) {
      try {
        this.popupWindow.close();
      } catch {
        // ignore close errors
      }
    }
    this.popupWindow = null;
  }

  private openWallet(url: string, mode?: 'popup' | 'tab'): Window | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const targetMode = mode || this.openMode;

    if (targetMode === 'popup') {
      const width = 480;
      const height = 720;

      const left = (window.innerWidth - width) / 2 + window.screenX;
      const top = (window.innerWidth - height) / 2 + window.screenY;

      const features =
        `width=${width},height=${height},` +
        `left=${left},top=${top},` +
        'menubar=no,toolbar=no,location=no,' +
        'resizable=yes,scrollbars=yes,status=no';
      
      const popup = window.open(url, 'loop-wallet', features);

      if (!popup) {
        return window.open(url, '_blank', 'noopener,noreferrer');
      }

      this.popupWindow = popup;

      try { 
        popup.focus();
      } catch {
        // focus errors
      }

      return popup;
    }

    return window.open(url, '_blank', 'noopener,noreferrer');
  }
  private showQrCode(url: string) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    QRCode.toDataURL(url, (err, dataUrl) => {
      if (err) {
        console.error('Failed to generate QR code', err);
        return;
      }
      
      const overlay = document.createElement('div');
      overlay.id = 'loop-sdk-connect-overlay';
      overlay.className = 'loop-sdk-connect-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '1000';
      overlay.style.flexDirection = 'column';
      
      const content = document.createElement('div');
      content.className = 'loop-sdk-connect-content';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.alignItems = 'center';

      const img = document.createElement('img');
      img.src = dataUrl;
      content.appendChild(img);

      const link = document.createElement('a');
      link.href = url;
      link.textContent = 'Or click here to connect';
      link.style.color = 'white';
      link.style.marginTop = '20px';
      //link.target = '_blank';
      link.onclick = (e) => {
        e.preventDefault();
        this.openWallet(url);
      };
      content.appendChild(link);
      overlay.appendChild(content);
      
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          this.hideQrCode();
        }
      };

      document.body.appendChild(overlay);
      this.overlay = overlay;
    });
  }

  private hideQrCode() {
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
      this.overlay = null;
    }
  }

  logout() {
    const cached = this.getCachedConnection();
    const hadConnected = Boolean(this.provider || cached?.authToken);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('loop_connect');
    }

    this.ticketId = null;
    this.provider = null;
    this.connectState.status = 'init';
    this.connection?.ws?.close();
    this.hideQrCode();
  }

  private requireProvider(): Provider {
    if (!this.provider) {
      throw new Error('SDK not connected. Call connect() and wait for acceptance first.');
    }
    return this.provider;
  }

  private createProviderHooks(): ProviderHooks {
    return {
      onRequestStart: () => this.openRequestUi(),
      onRequestFinish: ({ requestContext }) => {
        const win = requestContext as Window | null | undefined;
        if (win) {
          // Delay closing to allow wallet UI to visibly transition / finalize
          setTimeout(() => {
            this.closePopupIfExists();
          }, 800);
        }
      },
    };
  }

  private getCachedConnection(): any | null {
    let existingConnectionRaw: string | null = null;
    try {
      existingConnectionRaw = localStorage.getItem('loop_connect');
    } catch (error) {
      console.warn('[LoopSDK] localStorage is not available; skipping cached session.', error);
      return null;
    }
    if (!existingConnectionRaw) {
      return null;
    }
    try {
      return JSON.parse(existingConnectionRaw);
    } catch (error) {
      console.error('Failed to parse existing connection info, creating a new one.', error);
      localStorage.removeItem('loop_connect');
      return null;
    }
  }

  private async tryRestoreValidSession(): Promise<boolean> {
    if (!this.connection) {
      return false;
    }

    const cached = this.getCachedConnection();
    if (!cached) {
      return false;
    }

    const { ticketId, authToken, partyId, publicKey, email } = cached;
    if (!(authToken && partyId && publicKey)) {
      return false;
    }

    try {
      const verifiedAccount = await this.connection.verifySession(authToken);
      if (verifiedAccount.party_id !== partyId) {
        console.warn('[LoopSDK] Stored partyId does not match verified account. Clearing cached session.');
        this.logout();
        return false;
      }

      this.provider = new Provider({ 
        connection: this.connection!, 
        party_id: partyId, 
        auth_token: authToken, 
        public_key: publicKey, 
        email,
        hooks: this.createProviderHooks(),
      });
      this.ticketId = ticketId;
      this.connectState.status = 'connected';
      this.onAccept?.(this.provider);
      if (ticketId) {
        this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
      }
      return true;
    } catch (err) {
      const isUnauthorized = err instanceof UnauthorizedError;
      if (isUnauthorized) {
        console.error('[LoopSDK] Auto-login failed, session is invalid.', err);
        this.logout();
        return false;
      }
      console.warn('[LoopSDK] Auto-login failed due to transient error; keeping cached session.', err);
      return false;
    }
  }

  private async tryResumePendingTicket(): Promise<boolean> {
    // user initiates connect() with cached ticket but no verified session
    const cached = this.getCachedConnection();
    if (!cached || !cached.ticketId) {
      return false;
    }

    if (!this.connection) {
      console.warn('[LoopSDK] Connection not initialized; cannot resume pending ticket.');
      return false;
    }

    this.ticketId = cached.ticketId;
    const connectUrl = this.buildConnectUrl(cached.ticketId);
    this.showQrCode(connectUrl);
    this.connection.connectWebSocket(cached.ticketId, this.handleWebSocketMessage.bind(this));
    this.connectState.status = 'connecting';
    return true;
  }
}

export const loop = new LoopSDK();
export * from './types';
export * from './extensions/usdc/types';

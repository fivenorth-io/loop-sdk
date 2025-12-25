import QRCode from 'qrcode';
import type { Account, Network, TransferOptions, InstrumentSpec, Wallet } from './types';
import { MessageType } from './types';
import { Connection } from './connection';
import { Provider, generateRequestId } from './provider';
import type { ProviderHooks } from './provider';
import { LoopWallet } from './wallet';
import { extractErrorCode, isUnauthCode, UnauthorizedError } from './errors';

const STORAGE_KEY_LOOP_CONNECT = 'loop_connect';

class ConnectionInfo  {
  public sessionId: string;
  public ticketId?: string;
  public authToken?: string;
  public partyId?: string;
  public publicKey?: string;
  public email?: string;

  constructor({ sessionId, ticketId, authToken, partyId, publicKey, email }: {  sessionId: string, ticketId?: string, authToken?: string, partyId?: string, publicKey?: string, email?: string }) {
    this.sessionId = sessionId;
    this.ticketId = ticketId;
    this.authToken = authToken;
    this.partyId = partyId;
    this.publicKey = publicKey;
    this.email = email;
  }

  setTicketId(ticketId: string): void {
    this.ticketId = ticketId;
    this.save()
  }

  save(): void {
    localStorage.setItem('loop_connect', this.toJson());
  }

  public toJson(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      ticketId: this.ticketId,
      authToken: this.authToken,
      partyId: this.partyId,
      publicKey: this.publicKey,
      email: this.email,
    });
  }

  validate(): boolean {
    return this.ticketId !== undefined && this.sessionId !== undefined;
  }

  authorized(): boolean {
    return this.ticketId !== undefined && this.sessionId !== undefined && this.authToken !== undefined && this.partyId !== undefined && this.publicKey !== undefined;
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY_LOOP_CONNECT);

    this.sessionId = generateRequestId();

    this.ticketId = undefined;
    this.authToken = undefined;
    this.partyId = undefined;
    this.publicKey = undefined;
    this.email = undefined;
  }

  static fromStorage(): ConnectionInfo {
    const existingConnectionRaw = localStorage.getItem(STORAGE_KEY_LOOP_CONNECT);

    if (!existingConnectionRaw) {
      return new ConnectionInfo({ sessionId: generateRequestId() });
    }

    let connectionInfo: ConnectionInfo | null = null;

    try {
      connectionInfo = new ConnectionInfo(JSON.parse(existingConnectionRaw));
    } catch (error) {
      console.error('Failed to parse existing connection info, local storage is corrupted.', error);
      localStorage.removeItem(STORAGE_KEY_LOOP_CONNECT);

      connectionInfo = new ConnectionInfo({ sessionId: generateRequestId() });
    }

    return connectionInfo;
  }
}

class LoopSDK {
  private connectState: { status: 'init' | 'connecting' | 'connected'; promise: Promise<void> | null } = {
    status: 'init',
    promise: null,
  };
  private version: string = '0.0.1';
  private appName: string = 'Unknown';
  private connection: Connection | null = null;
  private connectionInfo: ConnectionInfo | null = null;
  private provider: Provider | null = null;
  private openMode: 'popup' | 'tab' = 'popup';
  private requestSigningMode: 'popup' | 'tab' = 'popup';
  private popupWindow: Window | null = null; 
  private redirectUrl?: string;

  private onAccept: ((provider: Provider) => void) | null = null;
  private onReject: (() => void) | null = null;
  private overlay: HTMLDivElement | null = null;
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
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('LoopSDK can only be initialized in a browser environment with localStorage support.');
    }

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

  private async loadConnectionInfo(): Promise<void> {
    const connectionInfo = ConnectionInfo.fromStorage();

    if (!connectionInfo) { return; }

    this.connectionInfo = connectionInfo;
    if (!this.connectionInfo.authorized()) { return; }

    try {
      // when authorized, authToken is always defined
      const verifiedAccount = await this.connection?.verifySession(connectionInfo.authToken!);
      if (!verifiedAccount || verifiedAccount?.party_id !== connectionInfo.partyId) {
        console.warn('[LoopSDK] Stored partyId does not match verified account. Clearing cached session.');
        // this.logout();
        connectionInfo.clear();
        return;
      }

      this.connectionInfo = connectionInfo;
    } catch (error) {
      console.error('Failed to verify session.', error);
      // Depend on this kind of error we will clear out session or not, for now let just clear out
      // this.logout();
      // TODO: only clear on 401 or 403
      connectionInfo.clear();
    }
  }

  // auto connect attempt to establish a connection without user interaction if detected a valid session aleady exists
  async autoConnect(): Promise<void> {
    if (!this.connection) {
      throw new Error('SDK not initialized. Call init() first.');
    }

    await this.loadConnectionInfo();
    if (!this.connectionInfo) {
      throw new Error('No valid session found. Call init() first.');
    }

    if (this.connectionInfo.authorized()) {
      this.provider = new Provider({ 
        connection: this.connection, 
        party_id: this.connectionInfo!.partyId!, 
        auth_token: this.connectionInfo!.authToken!, 
        public_key: this.connectionInfo!.publicKey!, 
        email: this.connectionInfo!.email!,
        hooks: this.createProviderHooks(),
      });
      this.onAccept?.(this.provider);
      return Promise.resolve();
    }
  }

  async connect() {
    if (!this.connection) {
      throw new Error('SDK not initialized. Call init() first.');
    }

    await this.autoConnect();

    if (this.connectionInfo && this.connectionInfo.authorized()) {
      // if successfully connected from autoConnect, return early nothing we need to do
      // if the auto connect attempt failed, we will proceed to the connect flow with qr code
      return;
    }

    try {
        const { ticket_id: ticketId } = await this.connection.getTicket(this.appName, this.connectionInfo!.sessionId, this.version);

        this.connectionInfo!.setTicketId(ticketId);
        
        const connectUrl = this.buildConnectUrl(ticketId);
        this.showQrCode(connectUrl);

        this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
    } catch (error) {
        console.error(error);
        return;
    }
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

        try {
          // By the time this code hit, connectionInfo is already set
          this.connectionInfo!.authToken = authToken;
          this.connectionInfo!.partyId = partyId;
          this.connectionInfo!.publicKey = publicKey;
          this.connectionInfo!.email = email;
          this.connectionInfo!.save();

          this.connectState.status = 'connected';
          this.hideQrCode();
          this.onAccept?.(this.provider);
          this.connection?.connectWebSocket(this.connectionInfo!.ticketId!, this.handleWebSocketMessage.bind(this));

          console.log('[LoopSDK] HANDSHAKE_ACCEPT: closing popup (if exists)');
          this.popupWindow = null;

        } catch (error) {
          console.error('Failed to update local storage with auth token.', error);
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
    if (!this.connectionInfo?.ticketId) {
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
    this.connectionInfo?.clear();

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
}

export const loop = new LoopSDK();
export * from './types';
export * from './extensions/usdc/types';

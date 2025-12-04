import QRCode from 'qrcode';
import type { Account, Network, TransferOptions } from './types';
import { MessageType } from './types';
import { Connection } from './connection';
import { Provider, generateRequestId } from './provider';

class LoopSDK {
  private version: string = '0.0.1';
  private appName: string = 'Unknown';
  private connection: Connection | null = null;
  private provider: Provider | null = null;
  private openMode: 'popup' | 'tab' = 'popup';
  private popupWindow: Window | null = null; 
  private redirectUrl?: string;

  private onAccept: ((provider: Provider) => void) | null = null;
  private onReject: (() => void) | null = null;
  private overlay: HTMLDivElement | null = null;
  private ticketId: string | null = null;
  public wallet: {
    transfer: (recipient: string, amount: string | number, options?: TransferOptions) => Promise<any>;
  };

  constructor() {
    this.wallet = {
      transfer: this.walletTransfer.bind(this),
    };
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
      redirectUrl?: string, 
    };
  }) {
    this.appName = appName;
    this.onAccept = onAccept || null;
    this.onReject = onReject || null;

    const resolvedOptions = {
      openMode: 'popup' as 'popup' | 'tab',
      redirectUrl: undefined as string | undefined,
      ...(options ?? {}),
    };

    this.openMode = resolvedOptions.openMode;
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

    // Check for existing session in local storage
    const existingConnectionRaw = localStorage.getItem('loop_connect');
    if (existingConnectionRaw) {
      try {
        let canReuseTicket = true;
        const { ticketId, authToken, partyId, publicKey, email } = JSON.parse(existingConnectionRaw);

        // Attempt to auto-login if we have a token
        if (authToken && partyId && publicKey) {
            try {
                const verifiedAccount = await this.connection.verifySession(authToken);
                if (verifiedAccount.party_id === partyId) {
                    this.provider = new Provider({ connection: this.connection, party_id: partyId, auth_token: authToken, public_key: publicKey, email });
                    this.onAccept?.(this.provider);
                    
                    // Re-establish websocket for this session
                    if (ticketId) {
                        this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
                    }
                    return;
                  } else {
                    console.warn('[LoopSDK] Sttored partyId does not march verified account. Clearing cached session.');
                    canReuseTicket = false;
                    localStorage.removeItem('loop_connect');
                  }
              } catch (err) {
                  console.error('Auto-login failed, token is invalid. Starting new connection.', err);
                  canReuseTicket = false;
                  localStorage.removeItem('loop_connect');
              }
        }
        
        // Reuse ticket if it exists but no token
        if (ticketId && canReuseTicket) {
          this.ticketId = ticketId;
          const url = new URL('/.connect/', this.connection.walletUrl);
          url.searchParams.set('ticketId', ticketId);
          if (this.redirectUrl) {
            url.searchParams.set('redirectUrl', this.redirectUrl);
          }
          const connectUrl = url.toString();
          this.showQrCode(connectUrl);
          this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
          return;
        }
      } catch (error) {
        console.error('Failed to parse existing connection info, creating a new one.', error);
      }
      // Clear invalid storage item
      localStorage.removeItem('loop_connect');
    }

    const sessionId = generateRequestId();

    try {
        const { ticket_id: ticketId } = await this.connection.getTicket(this.appName, sessionId, this.version);
        this.ticketId = ticketId;

        localStorage.setItem('loop_connect', JSON.stringify({ sessionId, ticketId }));
        
        const url = new URL('/.connect/', this.connection.walletUrl);
        url.searchParams.set('ticketId', ticketId);
        if (this.redirectUrl) {
          url.searchParams.set('redirectUrl', this.redirectUrl);
        }
        const connectUrl = url.toString();
        this.showQrCode(connectUrl);

        this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
    } catch (error) {
        console.error(error);
        return;
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    const message = JSON.parse(event.data);
    console.log('[LoopSDK] WS message received:', message);
    if (message.type === MessageType.HANDSHAKE_ACCEPT) {
      console.log('[LoopSDK] Entering HANDSHAKE_ACCEPT flow');
      const { authToken, partyId, publicKey, email } = message.payload || {};
      if (authToken && partyId && publicKey) {
        this.provider = new Provider({ connection: this.connection!, party_id: partyId, auth_token: authToken, public_key: publicKey, email });

        const connectionInfoRaw = localStorage.getItem('loop_connect');
        if (connectionInfoRaw) {
          try {
            const connectionInfo = JSON.parse(connectionInfoRaw);
            connectionInfo.authToken = authToken;
            connectionInfo.partyId = partyId;
            connectionInfo.publicKey = publicKey;
            connectionInfo.email = email;
            localStorage.setItem('loop_connect', JSON.stringify(connectionInfo));
            this.onAccept?.(this.provider);
            this.hideQrCode();
            this.connection?.connectWebSocket(connectionInfo.ticketId, this.handleWebSocketMessage.bind(this));

            console.log('[LoopSDK] HANDSHAKE_ACCEPT: closing popup (if exists)');
            //if (this.popupWindow && !this.popupWindow.closed) {
            //  this.popupWindow.close();
            //}
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

      console.log('[LoopSDK] HANDSHAKE_REJECT: closing popup (if exists)');
      if (this.popupWindow && !this.popupWindow.closed) {
              this.popupWindow.close();
      }
      this.popupWindow = null;
    } else if (this.provider) {
        this.provider.handleResponse(message);
    }
  }

  private openWallet(url: string) {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.openMode === 'popup') {
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
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      this.popupWindow = popup;

      try { 
        popup.focus();
      } catch {
        // focus errors
      }

      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
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

  private requireProvider(): Provider {
    if (!this.provider) {
      throw new Error('SDK not connected. Call connect() and wait for acceptance first.');
    }
    return this.provider;
  }

  private walletTransfer(recipient: string, amount: string | number, options?: TransferOptions): Promise<any> {
    const provider = this.requireProvider();
    return provider.transfer(recipient, amount, options);
  }
}

export const loop = new LoopSDK();
export * from './types';

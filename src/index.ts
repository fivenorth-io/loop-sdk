import QRCode from 'qrcode';
import type { Account, Network } from './types';
import { MessageType } from './types';
import { Connection } from './connection';
import { Provider, generateRequestId } from './provider';

class LoopSDK {
  private version: string = '0.0.1';
  private appName: string = 'Unknown';
  private connection: Connection | null = null;
  private provider: Provider | null = null;

  private onAccept: ((provider: Provider) => void) | null = null;
  private onReject: (() => void) | null = null;
  private overlay: HTMLDivElement | null = null;
  private ticketId: string | null = null;

  constructor() {
  }

  init({ appName, network, walletUrl, apiUrl, onAccept, onReject }: { appName: string, network?: Network, walletUrl?: string, apiUrl?: string, onAccept?: (provider: Provider) => void, onReject?: () => void }) {
    this.appName = appName;
    this.onAccept = onAccept || null;
    this.onReject = onReject || null;
    
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
        const { ticketId, authToken, partyId, publicKey } = JSON.parse(existingConnectionRaw);

        // Attempt to auto-login if we have a token
        if (authToken && partyId && publicKey) {
            try {
                const verifiedAccount = await this.connection.verifySession(authToken);
                if (verifiedAccount.party_id === partyId) {
                    this.provider = new Provider({ connection: this.connection, party_id: partyId, auth_token: authToken, public_key: publicKey });
                    this.onAccept?.(this.provider);
                    
                    // Re-establish websocket for this session
                    if (ticketId) {
                        this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
                    }
                    return;
                }
            } catch (err) {
                console.error('Auto-login failed, token is invalid. Starting new connection.', err);
            }
        }
        
        // Reuse ticket if it exists but no token
        if (ticketId) {
          this.ticketId = ticketId;
          const connectUrl = `${this.connection.walletUrl}/.connect/?ticketId=${ticketId}`;
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
        
        const connectUrl = `${this.connection.walletUrl}/.connect/?ticketId=${ticketId}`;
        this.showQrCode(connectUrl);

        this.connection.connectWebSocket(ticketId, this.handleWebSocketMessage.bind(this));
    } catch (error) {
        console.error(error);
        return;
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    const message = JSON.parse(event.data);
    if (message.type === MessageType.HANDSHAKE_ACCEPT) {
      const { authToken, partyId, publicKey } = message.payload || {};
      if (authToken && partyId && publicKey) {
        this.provider = new Provider({ connection: this.connection!, party_id: partyId, auth_token: authToken, public_key: publicKey });

        const connectionInfoRaw = localStorage.getItem('loop_connect');
        if (connectionInfoRaw) {
          try {
            const connectionInfo = JSON.parse(connectionInfoRaw);
            connectionInfo.authToken = authToken;
            connectionInfo.partyId = partyId;
            connectionInfo.publicKey = publicKey;
            localStorage.setItem('loop_connect', JSON.stringify(connectionInfo));
            this.onAccept?.(this.provider);
            this.hideQrCode();
            this.connection?.connectWebSocket(connectionInfo.ticketId, this.handleWebSocketMessage.bind(this));
          } catch (error) {
            console.error('Failed to update local storage with auth token.', error);
          }
        }
      }
    } else if (message.type === MessageType.HANDSHAKE_REJECT) {
      localStorage.removeItem('loop_connect');
      this.connection?.ws?.close();
      this.onReject?.();
      this.hideQrCode();
    } else if (this.provider) {
        this.provider.handleResponse(message);
    }
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
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '1000';
      overlay.style.flexDirection = 'column';
      
      const img = document.createElement('img');
      img.src = dataUrl;
      overlay.appendChild(img);

      const link = document.createElement('a');
      link.href = url;
      link.textContent = 'Or click here to connect';
      link.style.color = 'white';
      link.style.marginTop = '20px';
      link.target = '_blank';
      overlay.appendChild(link);
      
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
}

export const loop = new LoopSDK();
export * from './types';
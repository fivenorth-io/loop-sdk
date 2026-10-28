import { Connection } from "./connection";
import { openConnectModal, type ConnectModalHandle } from "./connect-modal";
import { extractErrorCode, isUnauthCode, UnauthorizedError } from "./errors";
import type { ProviderHooks } from "./provider";
import { generateRequestId, Provider } from "./provider";
import { SessionInfo } from "./session";
import type {
	Account,
	InstrumentSpec,
	Network,
	TransferOptions,
	Wallet,
	RunTransactionResponse,
} from "./types";
import { MessageType } from "./types";
import { LoopWallet } from "./wallet";
import { createLoopCip103Provider, type LoopCip103Options } from "./cip103/loop-adapter";
import { Cip103Provider } from "./cip103/provider";
import { Cip103ProviderRpcError } from "./cip103/errors";

class LoopSDK {
	private version: string = "0.15.0";

	private appName: string = "Unknown";
	private connection: Connection | null = null;
	private session: SessionInfo | null = null;
	private provider: Provider | null = null;
	private openMode: "popup" | "tab" = "popup";
	private requestSigningMode: "popup" | "tab" = "popup";
	private popupWindow: Window | null = null;
	private redirectUrl?: string;

	private onAccept: ((provider: Provider) => void) | null = null;
	private onReject: (() => void) | null = null;
	private onTransactionUpdate: ((payload: RunTransactionResponse, message: any) => void) | null = null;
	private connectModal: ConnectModalHandle | null = null;
	private cip103Provider: Cip103Provider | null = null;
	private cip103SessionListeners = new Set<() => void>();
	private cip103RejectConnect: ((error: Error) => void) | null = null;
	private cip103Restore: Promise<void> | null = null;
	private cip103Epoch = 0;
	public wallet: Wallet;

	constructor() {
		this.wallet = new LoopWallet(() => this.provider);
	}

	init({
		appName,
		network,
		walletUrl,
		secondaryWalletUrl,
		apiUrl,
		onAccept,
		onReject,
		onTransactionUpdate,
		options,
	}: {
		appName: string;
		network?: Network;
		walletUrl?: string;
		secondaryWalletUrl?: string;
		apiUrl?: string;
		onAccept?: (provider: Provider) => void;
		onReject?: () => void;
		onTransactionUpdate?: (payload: RunTransactionResponse, message: any) => void;
		options?: {
			openMode?: "popup" | "tab";
			requestSigningMode?: "popup" | "tab";
			redirectUrl?: string;
		};
	}) {
		if (
			typeof window === "undefined" ||
			typeof document === "undefined" ||
			typeof localStorage === "undefined"
		) {
			throw new Error(
				"LoopSDK can only be initialized in a browser environment with localStorage support.",
			);
		}

		this.appName = appName;
		this.onAccept = onAccept || null;
		this.onReject = onReject || null;
		this.onTransactionUpdate = onTransactionUpdate || null;

		const resolvedOptions = {
			openMode: "popup" as "popup" | "tab",
			requestSigningMode: "popup" as "popup" | "tab",
			redirectUrl: undefined as string | undefined,
			...(options ?? {}),
		};

		this.openMode = resolvedOptions.openMode;
		this.requestSigningMode = resolvedOptions.requestSigningMode;
		this.redirectUrl = resolvedOptions.redirectUrl;

		this.connection = new Connection({ network, walletUrl, secondaryWalletUrl, apiUrl });
	}

	getCip103Provider(options: LoopCip103Options = {}): Cip103Provider {
		if (this.cip103Provider) return this.cip103Provider;
		if (!this.connection) throw new Error("SDK not initialized. Call init() first.");
		const connection = this.connection;
		const checkConnection = () => {
			if (this.connection !== connection) throw new Cip103ProviderRpcError(4900, "Loop was reinitialized; reload before using this provider");
		};
		this.cip103Provider = createLoopCip103Provider({
			walletUrl: connection.walletUrl,
			restore: async () => {
				checkConnection();
				if (!this.provider) {
					this.cip103Restore ??= this.autoConnect().finally(() => { this.cip103Restore = null; });
					await this.cip103Restore;
				}
			},
			connect: async (timeout) => { checkConnection(); await this.connectForCip103(timeout); },
			disconnect: async () => {
				checkConnection();
				// Restore only the stored ticket, without opening UI or authorizing it.
				this.session ??= SessionInfo.fromStorage();
				this.cip103Epoch++;
				this.cip103RejectConnect?.(new Cip103ProviderRpcError(4100, "Connection canceled by disconnect"));
				const ticketId = this.session.ticketId;
				const token = this.session.authToken ?? this.session.ticketAuthToken;
				if (ticketId && token) await connection.disconnect(ticketId, token);
				this.clearLocalSession();
			},
			account: async () => {
				checkConnection();
				const provider = this.provider;
				if (!provider || !this.session?.isAuthorized()) return null;
				try {
					const account = await provider.getAccount();
					if (provider !== this.provider) throw new Cip103ProviderRpcError(4100, "Session changed during account verification");
					if (account.party_id !== provider.party_id || account.public_key !== provider.public_key) {
						this.clearLocalSession();
						throw new Cip103ProviderRpcError(4100, "Account identity changed; reconnect required");
					}
					return account;
				} catch (error) {
					if (error instanceof UnauthorizedError && provider === this.provider) {
						this.invalidateLocalSession();
						return null;
					}
					throw error;
				}
			},
            submitTransaction: (payload, onProgress, timeout) => {
                checkConnection();
                const provider = this.requireProvider();
                return provider.submitCip103Transaction(payload, data => {
                    if (provider !== this.provider) return true;
                    return onProgress(data);
                }, timeout);
            },
			providerStatus: async () => { checkConnection(); return connection.getProviderStatus(); },
			ledgerApi: async request => {
				checkConnection();
				const provider = this.requireProvider();
				return connection.ledgerApi(provider.getAuthToken(), request);
			},
			signMessage: async (message) => { checkConnection(); return this.requireProvider().signMessage(message); },
			onSessionChanged: listener => { this.cip103SessionListeners.add(listener); },
		}, options);
		return this.cip103Provider;
	}

	private notifyCip103Session() {
		for (const listener of this.cip103SessionListeners) listener();
	}

	private connectForCip103(timeout: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const cleanup = () => {
				clearTimeout(timer);
				this.cip103SessionListeners.delete(accepted);
				if (this.cip103RejectConnect === failed) this.cip103RejectConnect = null;
			};
			const failed = (error: Error) => { cleanup(); reject(error); };
			const accepted = () => {
				if (this.provider && this.session?.isAuthorized()) { cleanup(); resolve(); }
			};
			const timer = setTimeout(() => failed(new Cip103ProviderRpcError(-32002, "Connection approval timed out")), timeout);
			this.cip103SessionListeners.add(accepted);
			this.cip103RejectConnect = failed;
			void this.connect().then(accepted, failed);
		});
	}

	// attempt to load a session from storage if it exists, parse it and validate it
	// if the session is valid, set the session object and return it
	// otherwise, clear the session storage and initialize a new session
	private async loadSessionInfo(): Promise<void> {
		if (this.session) {
			// session already loaded, no need to reload again
			return;
		}

		this.session = SessionInfo.fromStorage();

		// At this stage, session is initialize fresh or from storage with existing preauth information
		// If we had preauth information, we will proeed to verify it, if not, we will return early
		if (!this.session.isPreAuthorized()) {
			return;
		}

		try {
			// when authorized, authToken is always defined
			const verifiedAccount = await this.connection?.verifySession(
				this.session.authToken!,
			);
			if (
				!verifiedAccount ||
				verifiedAccount?.party_id !== this.session.partyId
			) {
				console.warn(
					"[LoopSDK] Stored partyId does not match verified account. Clearing cached session.",
				);
				this.logout();
				return;
			}

			this.session.authorized();
		} catch (err) {
			if (err instanceof UnauthorizedError) {
				console.error("Unauthorized error when verifying session.", err);
				this.session.reset();
				return;
			}
			// This could be a network error or a server outage, we will not clear out the session
			console.error("[LoopSDK] Failed to verify session.", err);
			// re-raise the error to let upstream layer handle it
			throw err;
		}
	}

	// auto connect attempts to establish a connection without user interaction if detected a valid session aleady exists
	async autoConnect(): Promise<void> {
		if (!this.connection) {
			throw new Error("SDK not initialized. Call init() first.");
		}

		await this.loadSessionInfo();
		if (!this.session) {
			throw new Error(
				"No valid session found. The network connection maynot available or the backend is not reachable.",
			);
		}

		if (this.session.isAuthorized()) {
			if (!this.session.ticketAuthToken) {
				console.warn(
					"[LoopSDK] Stored session is missing ticket auth. Reconnect required.",
				);
				this.logout();
				return Promise.resolve();
			}

			this.provider = new Provider({
				connection: this.connection,
				party_id: this.session!.partyId!,
				auth_token: this.session!.authToken!,
				public_key: this.session!.publicKey!,
				email: this.session!.email!,
				hooks: this.createProviderHooks(),
			});
			this.notifyCip103Session();
			this.onAccept?.(this.provider);
			this.connection.connectWebSocket(
				this.session!.ticketId!,
				this.session!.ticketAuthToken,
				this.handleWebSocketMessage.bind(this),
			);
			return Promise.resolve();
		}
	}

	async connect() {
		if (!this.connection) {
			throw new Error("SDK not initialized. Call init() first.");
		}

		const epoch = this.cip103Epoch;
		await this.autoConnect();
		if (this.cip103Provider && epoch !== this.cip103Epoch) throw new Cip103ProviderRpcError(4100, "Session changed during connection");

		if (!this.session) {
			throw new Error("No valid session found. The network connection maynot available or the backend is not reachable.");
		}

		if (this.session.isAuthorized()) {
			// if successfully connected from autoConnect, return early nothing we need to do
			// if the auto connect attempt failed, we will proceed to the connect flow with qr code
			return;
		}

		try {
			this.session.clearTicket();
			if (!this.session.ticketId) {
				if (!this.session.sessionId) {
					throw new Error("Session ID is required to create a connect ticket.");
				}
				const { ticket_id: ticketId, auth_token: ticketAuthToken } = await this.connection.getTicket(
					this.appName,
					this.session.sessionId,
					this.version,
				);
				if (this.cip103Provider && epoch !== this.cip103Epoch) {
					// A disconnect may finish while ticket creation is still in flight.
					await this.connection.disconnect(ticketId, ticketAuthToken).catch(error => {
						console.warn("[LoopSDK] Failed to revoke canceled connect ticket.", error);
					});
					throw new Cip103ProviderRpcError(4100, "Session changed during connection");
				}
				this.session!.setTicketId(ticketId, ticketAuthToken);
			}

			if (!this.connection.connectInProgress()) {
				this.connection.connectWebSocket(
					this.session!.ticketId!,
					this.session!.ticketAuthToken!,
					this.handleWebSocketMessage.bind(this),
				);
			}

			this.showQrCode(this.buildConnectUrls(this.session!.ticketId!));
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	private handleWebSocketMessage(event: MessageEvent) {
		const message = JSON.parse(event.data);

		const errCode = extractErrorCode(message);

		if (isUnauthCode(errCode)) {
			console.warn("[LoopSDK] Detected session invalidation:", errCode, {
				message,
			});
			this.logout();
			return;
		}

		console.log("[LoopSDK] WS message received:", message);
		if (message.type === MessageType.HANDSHAKE_ACCEPT) {
			console.log("[LoopSDK] Entering HANDSHAKE_ACCEPT flow");
			const { partyId, publicKey, email, isFromOldDomain } = message.payload || {};

			const authToken = this.session?.ticketAuthToken;
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
					// By the time this code hit, session is already set
					this.session!.authToken = authToken;
					this.session!.partyId = partyId;
					this.session!.publicKey = publicKey;
					this.session!.email = email;
					if (isFromOldDomain && this.connection?.secondaryWalletUrl) {
						this.session!.walletUrl = this.connection.secondaryWalletUrl;
					} else {
						this.session!.walletUrl = this.connection!.walletUrl;
					}
					this.session!.authorized();
					this.session!.save();

					this.notifyCip103Session();
					this.onAccept?.(this.provider);
					this.hideQrCode();

					console.log("[LoopSDK] HANDSHAKE_ACCEPT: closing popup (if exists)");
					this.popupWindow = null;
				} catch (error) {
					console.error(
						"Failed to update local storage with auth token.",
						error,
					);
				}
			}
		} else if (message.type === MessageType.HANDSHAKE_REJECT) {
			console.log("[LoopSDK] Entering HANDSHAKE_REJECT flow");
			this.cip103RejectConnect?.(new Cip103ProviderRpcError(4001, "Connection rejected by user"));
			this.clearLocalSession();
			this.onReject?.();

			console.log("[LoopSDK] HANDSHAKE_REJECT: closing popup (if exists)");
			this.popupWindow = null;
		} else if (message.type === MessageType.TICKET_REVOKED) {
			console.log("[LoopSDK] Entering TICKET_REVOKED flow");
			const status = message?.payload?.status || "invalid";
			this.provider?.rejectPendingRequests(
				"SESSION_EXPIRED",
				`Connect ticket is ${status}. Please reconnect.`,
			);
			this.clearLocalSession();
			this.onReject?.();
		} else if (this.provider) {
			this.provider.handleResponse(message);
		}
	}

	public getConnectUrl(isOldDomain?: boolean): string {
		if (!this.session?.ticketId) {
			throw new Error("No ticket ID found. Please call connect() first.");
		}
		const baseUrl = isOldDomain && this.connection?.secondaryWalletUrl
			? this.connection.secondaryWalletUrl
			: this.connection!.walletUrl;
		return this.buildConnectUrl(this.session!.ticketId!, baseUrl);
	}

	public getConnectUrls(): string[] {
		if (!this.session?.ticketId) {
			throw new Error("No ticket ID found. Please call connect() first.");
		}
		return this.buildConnectUrls(this.session!.ticketId!);
	}

	private buildConnectUrl(ticketId: string, baseUrl: string): string {
		const url = new URL("/.connect/", baseUrl);
		url.searchParams.set("ticketId", ticketId);
		if (this.redirectUrl) {
			url.searchParams.set("redirectUrl", this.redirectUrl);
		}
		return url.toString();
	}

	private buildConnectUrls(ticketId: string): string[] {
		const urls = [this.buildConnectUrl(ticketId, this.connection!.walletUrl)];
		if (this.connection?.secondaryWalletUrl) {
			urls.push(this.buildConnectUrl(ticketId, this.connection.secondaryWalletUrl));
		}
		return urls;
	}

	private resolveWalletUrl(): string {
		const stored = this.session?.walletUrl;
		const configured = [
			this.connection!.walletUrl,
			this.connection!.secondaryWalletUrl,
		].filter((u): u is string => !!u);
		if (stored && configured.includes(stored)) {
			return stored;
		}
		return this.connection!.walletUrl;
	}

	private openRequestUi(): Window | null {
		if (typeof window === "undefined") {
			return null;
		}
		if (!this.session?.ticketId) {
			console.warn(
				"[LoopSDK] Cannot open wallet UI for request: no active ticket.",
			);
			return null;
		}

		const targetMode = this.requestSigningMode === "tab" ? "tab" : "popup";
		const opened = this.openWallet(this.resolveWalletUrl(), targetMode);
		if (opened) {
			this.popupWindow = opened;
			return opened;
		}
		return null;
	}

	private openWallet(url: string, mode?: "popup" | "tab"): Window | null {
		if (typeof window === "undefined") {
			return null;
		}

		const targetMode = mode || this.openMode;

		if (targetMode === "popup") {
			const width = 480;
			const height = 720;

			const left = (window.innerWidth - width) / 2 + window.screenX;
			const top = (window.innerHeight - height) / 2 + window.screenY;

			const features =
				`width=${width},height=${height},` +
				`left=${left},top=${top},` +
				"menubar=no,toolbar=no,location=no," +
				"resizable=yes,scrollbars=yes,status=no";

			const popup = window.open(url, "loop-wallet", features);

			if (!popup) {
				return window.open(url, "_blank", "noopener,noreferrer");
			}

			this.popupWindow = popup;

			try {
				popup.focus();
			} catch {
				// focus errors
			}

			return popup;
		}

		return window.open(url, "_blank", "noopener,noreferrer");
	}
	private showQrCode(urls: string[]) {
		this.connectModal?.close();
		this.connectModal = openConnectModal({
			urls,
			onContinueInBrowser: (url) => this.openWallet(url),
			onDismiss: () => {
				this.connectModal = null;
			},
		});
	}

	private hideQrCode() {
		this.connectModal?.close();
		this.connectModal = null;
	}

	private clearLocalSession() {
		this.cip103Epoch++;
		this.cip103RejectConnect?.(new Cip103ProviderRpcError(4100, "Wallet session ended"));
		if (this.cip103Provider) this.provider?.rejectPendingRequests("SESSION_EXPIRED", "Wallet session ended");
		this.session?.reset();
		this.provider = null;
		this.connection?.ws?.close();
		this.hideQrCode();
		this.notifyCip103Session();
	}

	private invalidateLocalSession() {
		this.clearLocalSession();
		this.onReject?.();
	}

	logout() {
		const ticketId = this.session?.ticketId;
		const authToken = this.session?.authToken;
		if (ticketId && authToken) {
			this.connection?.disconnect(ticketId, authToken).catch((error) => {
				console.warn("[LoopSDK] Failed to disconnect connect ticket.", error);
			});
		}

		this.clearLocalSession();
	}

	private requireProvider(): Provider {
		if (!this.provider) {
			throw new Error(
				"SDK not connected. Call connect() and wait for acceptance first.",
			);
		}
		return this.provider;
	}

	private createProviderHooks(): ProviderHooks {
		return {
			onRequestStart: () => this.openRequestUi(),
			onRequestFinish: () => undefined,
			onTransactionUpdate: this.onTransactionUpdate ?? undefined,
			onSessionInvalid: () => this.invalidateLocalSession(),
		};
	}
}

export const loop = new LoopSDK();
export * from "./extensions/usdc/types";
export * from "./errors";
export * from "./types";
export * from "./cip103";

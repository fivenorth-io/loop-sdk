import QRCode from "qrcode";
import { Connection } from "./connection";
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

class LoopSDK {
	private version: string = "0.12.0";

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
		onTransactionUpdate,
		options,
	}: {
		appName: string;
		network?: Network;
		walletUrl?: string;
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

		this.connection = new Connection({ network, walletUrl, apiUrl });
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
			this.provider = new Provider({
				connection: this.connection,
				party_id: this.session!.partyId!,
				auth_token: this.session!.authToken!,
				public_key: this.session!.publicKey!,
				email: this.session!.email!,
				hooks: this.createProviderHooks(),
			});
			this.onAccept?.(this.provider);
			this.connection.connectWebSocket(
				this.session!.ticketId!,
				this.handleWebSocketMessage.bind(this),
			);
			return Promise.resolve();
		}
	}

	async connect() {
		if (!this.connection) {
			throw new Error("SDK not initialized. Call init() first.");
		}

		await this.autoConnect();

		if (!this.session) {
			throw new Error("No valid session found. The network connection maynot available or the backend is not reachable.");
		}

		if (this.session.isAuthorized()) {
			// if successfully connected from autoConnect, return early nothing we need to do
			// if the auto connect attempt failed, we will proceed to the connect flow with qr code
			return;
		}


		try {
			// acquire a ticket id from the backend if necessary
			if (!this.session.ticketId) {
				const { ticket_id: ticketId } = await this.connection.getTicket(
					this.appName,
					this.session!.sessionId,
					this.version,
				);
				this.session!.setTicketId(ticketId);
			}

			if (!this.connection.connectInProgress()) {
				this.connection.connectWebSocket(
					this.session!.ticketId!,
					this.handleWebSocketMessage.bind(this),
				);
			}

			this.showQrCode(this.buildConnectUrl(this.session!.ticketId!));
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
					// By the time this code hit, session is already set
					this.session!.authToken = authToken;
					this.session!.partyId = partyId;
					this.session!.publicKey = publicKey;
					this.session!.email = email;
					this.session!.authorized();
					this.session!.save();

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
			this.connection?.ws?.close();
			this.onReject?.();
			this.hideQrCode();
			this.session?.reset();

			console.log("[LoopSDK] HANDSHAKE_REJECT: closing popup (if exists)");
			this.popupWindow = null;
		} else if (this.provider) {
			this.provider.handleResponse(message);
		}
	}

	public getConnectUrl(): string {
		if (!this.session?.ticketId) {
			throw new Error("No ticket ID found. Please call connect() first.");
		}
		return this.buildConnectUrl(this.session!.ticketId!);
	}

	private buildConnectUrl(ticketId: string): string {
		const url = new URL("/.connect/", this.connection!.walletUrl);
		url.searchParams.set("ticketId", ticketId);
		if (this.redirectUrl) {
			url.searchParams.set("redirectUrl", this.redirectUrl);
		}
		return url.toString();
	}

	private buildDashboardUrl() {
		if (!this.connection) {
			throw new Error("Connection not initialized");
		}
		return this.connection.walletUrl;
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

		const dashboardUrl = this.buildDashboardUrl();
		const targetMode = this.requestSigningMode === "tab" ? "tab" : "popup";
		const opened = this.openWallet(dashboardUrl, targetMode);
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
			const top = (window.innerWidth - height) / 2 + window.screenY;

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
	private injectModalStyles() {
		if (document.getElementById("loop-connect-styles")) return;

		const style = document.createElement("style");
		style.id = "loop-connect-styles";
		style.textContent = `
			.loop-connect {
				position: fixed;
				inset: 0;
				background: rgba(0, 0, 0, 0.85);
				backdrop-filter: blur(8px);
				display: flex;
				justify-content: center;
				align-items: center;
				z-index: 10000;
				font-family: "Inter", system-ui, -apple-system, sans-serif;
				animation: fadeIn 0.2s ease-out;
			}
			.loop-connect dialog {
				position: relative;
				overflow: hidden;
				background: #080808;
				box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.5);
				border-radius: 40px;
				border: none;
				width: 340px;
				height: 534px;
				box-sizing: border-box;
				padding: 32px;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0;
				color: #ffffff;
			}
			.loop-connect .bg-logo {
				position: absolute;
				right: -20px;
				top: -40px;
				width: 140px;
				height: auto;
				opacity: 0.06;
				pointer-events: none;
			}
			.loop-connect h3 {
				position: absolute;
				top: 32px;
				left: 32px;
				right: 32px;
				margin: 0;
				font-size: 18px;
				font-weight: 700;
				line-height: 27px;
				letter-spacing: -0.45px;
				text-align: center;
			}
			.loop-connect figure {
				position: absolute;
				top: 91px;
				left: 32px;
				width: 276px;
				height: 276px;
				margin: 0;
				background: #ffffff;
				padding: 20px;
				border-radius: 8px;
				display: flex;
				justify-content: center;
				border: none;
				box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
				box-sizing: border-box;
			}
			.loop-connect img {
				display: block;
				width: 236px;
				height: 236px;
				object-fit: contain;
				border-radius: 12px;
			}
			.loop-connect .divider {
				position: absolute;
				top: 399px;
				left: 36px;
				right: 36px;
				width: auto;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 12px;
				color: #64748b;
				font-size: 11px;
				font-weight: 700;
				letter-spacing: 0.15em;
				text-transform: uppercase;
				text-align: center;
			}
			.loop-connect .divider::before,
			.loop-connect .divider::after {
				content: "";
				flex: 1;
				height: 1px;
				background: #1e293b;
			}
			.loop-connect button {
				position: absolute;
				top: 447.5px;
				left: 32px;
				right: 32px;
				background: #f2ff96;
				border: none;
				color: #0f172a;
				text-align: center;
				font-family: "Inter", system-ui, -apple-system, sans-serif;
				font-style: normal;
				padding: 0 24px;
				border-radius: 8px;
				font-size: 15px;
				font-weight: 600;
				line-height: 22.5px;
				cursor: pointer;
				transition: all 0.2s ease;
				width: auto;
				height: 54.5px;
				box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2),
					0 4px 6px -4px rgba(0, 0, 0, 0.2);
			}
			.loop-connect button:hover {
				background: #f6ffb4;
			}
			@keyframes fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}
		`;
		document.head.appendChild(style);
	}

	private showQrCode(url: string) {
		this.injectModalStyles();

		QRCode.toDataURL(url, { margin: 0 }, (err, dataUrl) => {
			if (err) {
				console.error("Failed to generate QR code", err);
				return;
			}

			const overlay = document.createElement("div");
			overlay.id = "loop-sdk-connect-overlay";
			overlay.className = "loop-sdk-connect-overlay loop-connect";

			const dialog = document.createElement("dialog");
			dialog.open = true;

			const bgLogo = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"svg",
			);
			bgLogo.setAttribute("class", "bg-logo");
			bgLogo.setAttribute("viewBox", "0 0 124.05 305.64");
			const path = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"path",
			);
			path.setAttribute(
				"d",
				"M24.58,99.47L124.05,0v224.42L24.58,124.95c-7.04-7.04-7.04-18.45,0-25.49Z",
			);
			path.setAttribute("fill", "currentColor");
			const rect = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"rect",
			);
			rect.setAttribute("x", "12.89");
			rect.setAttribute("y", "194.48");
			rect.setAttribute("width", "98.27");
			rect.setAttribute("height", "98.27");
			rect.setAttribute("rx", "18.02");
			rect.setAttribute("ry", "18.02");
			rect.setAttribute("transform", "translate(-154.1 115.21) rotate(-45)");
			rect.setAttribute("fill", "currentColor");
			bgLogo.appendChild(path);
			bgLogo.appendChild(rect);

			const title = document.createElement("h3");
			title.textContent = "Scan with Phone";

			const figure = document.createElement("figure");
			const img = document.createElement("img");
			img.src = dataUrl;
			img.alt = "QR Code";
			figure.appendChild(img);

			const divider = document.createElement("div");
			divider.className = "divider";
			divider.textContent = "OR";

			const button = document.createElement("button");
			button.type = "button";
			button.textContent = "Continue in Browser";
			button.addEventListener("click", () => {
				this.openWallet(url);
			});

			dialog.appendChild(bgLogo);
			dialog.appendChild(title);
			dialog.appendChild(figure);
			dialog.appendChild(divider);
			dialog.appendChild(button);
			overlay.appendChild(dialog);

			overlay.addEventListener("click", (e) => {
				if (e.target === overlay) {
					this.hideQrCode();
				}
			});

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
		this.session?.reset();

		this.provider = null;
		this.connection?.ws?.close();
		this.hideQrCode();
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
		};
	}
}

export const loop = new LoopSDK();
export * from "./extensions/usdc/types";
export * from "./errors";
export * from "./types";

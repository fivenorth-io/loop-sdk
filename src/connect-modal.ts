import styles from "./styles/connect-modal.css" with { type: "text" };
import { renderConnectQrSvg } from "./connect-qr";
import { svgElement } from "./svg";

const HOST_ID = "loop-sdk-connect-overlay";
/** Kept from the pre-shadow-root modal so dApp hooks on these classes keep matching. */
const HOST_CLASS = "loop-sdk-connect-overlay loop-connect";
const HOST_STYLE = "all: initial !important; display: contents !important;";
const TITLE_ID = "loop-connect-title";

const QR_PIXEL_SIZE = 198;

const CLOSE_ICON_PATH =
	"M8.70705 8L13 3.70705L12.2929 3L8 7.29295L3.70715 3L3 3.70705L7.29295 8L3 12.2929L3.70715 13L8 8.70705L12.2929 13L13 12.2929L8.70705 8Z";
const LOOP_MARK_PATHS = [
	"M34 10H44V14H34V24H30V14H20V10H30V0H34V10Z",
	"M62 10H72V14H62V24H58V14H48V10H58V0H62V10Z",
];

export interface ConnectModalOptions {
	urls: string[];
	onContinueInBrowser: (url: string) => void;
	onDismiss: () => void;
}

export interface ConnectModalHandle {
	close: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function button(className: string, text?: string): HTMLButtonElement {
	const node = el("button", className, text);
	node.type = "button";
	return node;
}

function hostnameOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function buildHeader(onClose: () => void): HTMLElement {
	const header = el("header", "header");
	const title = el("h2", "title", "Sign in with Loop Wallet");
	title.id = TITLE_ID;

	const closeButton = button("close");
	closeButton.setAttribute("aria-label", "Close");
	closeButton.appendChild(
		svgElement(
			"svg",
			{ viewBox: "0 0 16 16", width: 16, height: 16, fill: "currentColor", "aria-hidden": "true" },
			[svgElement("path", { d: CLOSE_ICON_PATH })],
		),
	);
	closeButton.addEventListener("click", onClose);

	header.append(title, closeButton);
	return header;
}

function buildLoopMark(): HTMLElement {
	const mark = el("span", "qr-mark");
	mark.appendChild(
		svgElement(
			"svg",
			{ viewBox: "20 0 52 24", width: 44, height: 20, fill: "currentColor", "aria-hidden": "true" },
			LOOP_MARK_PATHS.map((d) => svgElement("path", { d })),
		),
	);
	return mark;
}

interface ScanTile {
	tile: HTMLElement;
	/** Shows the QR code and hostname for `url`. */
	show: (url: string) => void;
}

function buildScanTile(): ScanTile {
	const tile = el("div", "tile");
	const text = el("p", "scan-text", "Scan the QR code to sign in from your phone.");
	const qrFrame = el("figure", "qr");
	const host = el("p", "host");
	tile.append(el("div", "glow"), text, qrFrame, host);

	const show = (url: string) => {
		const qr = renderConnectQrSvg(url, QR_PIXEL_SIZE);
		qrFrame.replaceChildren(...(qr ? [qr, buildLoopMark()] : []));
		qrFrame.hidden = qr === null;
		text.hidden = qr === null;
		host.textContent = hostnameOf(url);
	};

	return { tile, show };
}

function buildSeparator(): HTMLElement {
	const separator = el("div", "separator", "or");
	separator.setAttribute("role", "presentation");
	return separator;
}

/**
 * Constructed stylesheets are CSSOM, so a strict `style-src` without 'unsafe-inline' does
 * not block them the way it blocks a `<style>` element.
 */
function attachStyles(shadow: ShadowRoot): void {
	if (typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype && "adoptedStyleSheets" in shadow) {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];
		return;
	}
	const style = document.createElement("style");
	style.textContent = styles;
	shadow.appendChild(style);
}

/** Mounts the connect modal in its own shadow root and opens it. */
export function openConnectModal({
	urls,
	onContinueInBrowser,
	onDismiss,
}: ConnectModalOptions): ConnectModalHandle | null {
	const [primaryUrl, secondaryUrl] = urls;
	if (!primaryUrl) {
		console.error("[LoopSDK] openConnectModal called with no URLs");
		return null;
	}

	document.getElementById(HOST_ID)?.remove();

	const host = document.createElement("div");
	host.id = HOST_ID;
	host.className = HOST_CLASS;
	const shadow = host.attachShadow({ mode: "open" });

	const dialog = el("dialog", "panel");
	dialog.setAttribute("aria-labelledby", TITLE_ID);
	let isClosed = false;
	const close = () => {
		if (isClosed) return;
		isClosed = true;
		if (dialog.open) dialog.close();
		host.remove();
	};
	const dismiss = () => {
		if (isClosed) return;
		close();
		onDismiss();
	};

	const body = el("div", "body");
	const { tile, show } = buildScanTile();
	const continueButton = button("primary", "Continue in this browser");

	let activeUrl = primaryUrl;
	const showUrl = (url: string) => {
		activeUrl = url;
		show(url);
	};
	continueButton.addEventListener("click", () => onContinueInBrowser(activeUrl));
	showUrl(primaryUrl);

	body.append(
		el("p", "description", "Choose how you want to continue."),
		tile,
		buildSeparator(),
		continueButton,
	);

	if (secondaryUrl) {
		const switchLink = button("switch", "Using the old wallet?");
		switchLink.addEventListener("click", () => {
			const isShowingSecondary = activeUrl === secondaryUrl;
			showUrl(isShowingSecondary ? primaryUrl : secondaryUrl);
			switchLink.textContent = isShowingSecondary ? "Using the old wallet?" : "Back to new wallet";
		});
		body.appendChild(switchLink);
	}

	dialog.append(buildHeader(dismiss), body);

	// A press that starts in the panel and ends on the backdrop reports the dialog as the
	// target, so both ends of the gesture have to be on the backdrop to dismiss.
	let pressedBackdrop = false;
	dialog.addEventListener("pointerdown", (e) => {
		pressedBackdrop = e.target === dialog;
	});
	dialog.addEventListener("click", (e) => {
		if (pressedBackdrop && e.target === dialog) dismiss();
	});
	// Esc fires `cancel` before the dialog closes itself.
	dialog.addEventListener("cancel", (e) => {
		e.preventDefault();
		dismiss();
	});

	attachStyles(shadow);
	shadow.appendChild(dialog);
	document.body.appendChild(host);

	// dApps hid the old modal with rules on its id or class. Honour that by leaving the
	// host in place but never opening the dialog; the connect flow continues without it.
	if (isHiddenByPage(host)) return { close };

	// Otherwise the host opts out of the page's styles so unrelated rules cannot hide it.
	host.style.cssText = HOST_STYLE;
	dialog.showModal();

	return { close };
}

function isHiddenByPage(host: HTMLElement): boolean {
	const { display, visibility } = getComputedStyle(host);
	return display === "none" || visibility === "hidden";
}

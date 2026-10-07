import QRCode from "qrcode";
import { getPositions as getAlignmentPositions } from "qrcode/lib/core/alignment-pattern";
import { svgElement } from "./svg";

const FINDER_SIZE = 7;
const ALIGNMENT_RADIUS = 2;
const DOT_RADIUS = 0.36;
const FINDER_OUTER_CORNER = 1.6;
const FINDER_INNER_CORNER = 0.9;
const ALIGNMENT_OUTER_CORNER = 1;

const MARK_CLEARANCE_RATIO = 56 / 198;

interface Rect {
	top: number;
	left: number;
	bottom: number;
	right: number;
}

function contains(rect: Rect, row: number, col: number): boolean {
	return row >= rect.top && row <= rect.bottom && col >= rect.left && col <= rect.right;
}

function finderRects(size: number): Rect[] {
	const far = size - FINDER_SIZE;
	const last = FINDER_SIZE - 1;
	return [
		{ top: 0, left: 0, bottom: last, right: last },
		{ top: 0, left: far, bottom: last, right: size - 1 },
		{ top: far, left: 0, bottom: size - 1, right: last },
	];
}

function markClearance(size: number): Rect {
	const span = Math.round((size * MARK_CLEARANCE_RATIO) / 2) * 2 + 1;
	const start = (size - span) / 2;
	return { top: start, left: start, bottom: start + span - 1, right: start + span - 1 };
}

function locatingAlignmentRect(version: number): Rect | null {
	const positions = getAlignmentPositions(version);
	if (positions.length === 0) return null;
	const [row, col] = positions.reduce((last, position) =>
		position[0] + position[1] > last[0] + last[1] ? position : last,
	);
	return {
		top: row - ALIGNMENT_RADIUS,
		left: col - ALIGNMENT_RADIUS,
		bottom: row + ALIGNMENT_RADIUS,
		right: col + ALIGNMENT_RADIUS,
	};
}

function ringSvg({ top, left, bottom }: Rect, outerCorner: number, innerCorner: number): SVGElement[] {
	const span = bottom - top + 1;
	const core = span - 4;
	return [
		svgElement("rect", {
			x: left + 0.5,
			y: top + 0.5,
			width: span - 1,
			height: span - 1,
			rx: outerCorner,
			fill: "none",
			stroke: "currentColor",
			"stroke-width": 1,
		}),
		svgElement("rect", { x: left + 2, y: top + 2, width: core, height: core, rx: innerCorner }),
	];
}

function dotPath(row: number, col: number): string {
	const cx = col + 0.5;
	const cy = row + 0.5;
	const r = DOT_RADIUS;
	return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

export function renderConnectQrSvg(url: string, pixelSize: number): SVGSVGElement | null {
	let qr: QRCode.QRCode;
	try {
		qr = QRCode.create(url, { errorCorrectionLevel: "H" });
	} catch (error) {
		console.error(`[LoopSDK] Failed to generate QR code for ${url}`, error);
		return null;
	}

	const { modules, version } = qr;
	const { size } = modules;
	const clearance = markClearance(size);
	const finders = finderRects(size);
	const alignment = locatingAlignmentRect(version);
	const shapeRects = alignment ? [...finders, alignment, clearance] : [...finders, clearance];
	const isDrawnAsShape = (row: number, col: number) => shapeRects.some((rect) => contains(rect, row, col));

	const dots: string[] = [];
	for (let row = 0; row < size; row++) {
		for (let col = 0; col < size; col++) {
			if (!modules.get(row, col) || isDrawnAsShape(row, col)) continue;
			dots.push(dotPath(row, col));
		}
	}

	const shapes = finders.flatMap((rect) => ringSvg(rect, FINDER_OUTER_CORNER, FINDER_INNER_CORNER));
	if (alignment) shapes.push(...ringSvg(alignment, ALIGNMENT_OUTER_CORNER, 0));

	return svgElement(
		"svg",
		{
			viewBox: `0 0 ${size} ${size}`,
			width: pixelSize,
			height: pixelSize,
			role: "img",
			"aria-label": "QR code",
		},
		[svgElement("g", { fill: "currentColor" }, [svgElement("path", { d: dots.join("") }), ...shapes])],
	);
}

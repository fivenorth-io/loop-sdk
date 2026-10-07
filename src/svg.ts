const SVG_NS = "http://www.w3.org/2000/svg";

type SvgAttributes = Record<string, string | number>;

/**
 * Builds an SVG element through the DOM rather than markup, so it needs no `innerHTML`
 * (blocked under Trusted Types) and no `data:` URL (blocked by a strict `img-src`).
 */
export function svgElement<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attributes: SvgAttributes,
	children: SVGElement[] = [],
): SVGElementTagNameMap[K] {
	const node = document.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attributes)) {
		node.setAttribute(name, String(value));
	}
	node.append(...children);
	return node;
}

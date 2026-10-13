declare module "*.css" {
	const content: string;
	export default content;
}

declare module "qrcode/lib/core/alignment-pattern" {
	export function getPositions(version: number): Array<[number, number]>;
}

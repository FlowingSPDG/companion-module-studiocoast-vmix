export type Xml2jsNode = string | boolean | { $?: Record<string, string | boolean>; _?: string | boolean; [key: string]: unknown }

function coerce(value: string): string | boolean {
	if (value === 'True' || value === 'true') return true
	if (value === 'False' || value === 'false') return false
	return value
}

function unescapeXml(value: string): string {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&')
}

/**
 * vMix XML → xml2js-compatible tree.
 * Root is `{ vmix: { version: ['...'], inputs: [{ input: [...] }], ... } }`.
 */
export function parseVmixXml2js(xml: string): { vmix?: Xml2jsNode; [key: string]: unknown } {
	let i = 0
	const len = xml.length

	const skipWs = (): void => {
		while (i < len) {
			const c = xml.charCodeAt(i)
			if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break
			i++
		}
	}

	const parseName = (): string => {
		const start = i
		while (i < len) {
			const c = xml.charCodeAt(i)
			if (c === 32 || c === 9 || c === 10 || c === 13 || c === 62 || c === 47 || c === 61) break
			i++
		}
		return xml.slice(start, i)
	}

	const parseAttrs = (): Record<string, string | boolean> => {
		const attrs: Record<string, string | boolean> = {}
		while (i < len) {
			skipWs()
			const c = xml.charCodeAt(i)
			if (c === 62 || c === 47) break
			const name = parseName()
			skipWs()
			if (xml.charCodeAt(i) !== 61) continue
			i++
			skipWs()
			const quote = xml.charCodeAt(i)
			i++
			const start = i
			while (i < len && xml.charCodeAt(i) !== quote) i++
			attrs[name] = coerce(unescapeXml(xml.slice(start, i)))
			i++
		}
		return attrs
	}

	const parseElement = (): { name: string; node: Xml2jsNode } => {
		skipWs()
		if (xml.charCodeAt(i) !== 60) {
			throw new Error(`expected < at ${i}`)
		}
		i++
		if (xml.charCodeAt(i) === 33) {
			if (xml.charCodeAt(i + 1) === 45) {
				const close = xml.indexOf('-->', i)
				i = close === -1 ? len : close + 3
				return parseElement()
			}
			const close = xml.indexOf('>', i)
			i = close === -1 ? len : close + 1
			return parseElement()
		}
		if (xml.charCodeAt(i) === 63) {
			const close = xml.indexOf('?>', i)
			i = close === -1 ? len : close + 2
			return parseElement()
		}

		const name = parseName()
		const attrs = parseAttrs()
		skipWs()
		let selfClosing = false
		if (xml.charCodeAt(i) === 47) {
			selfClosing = true
			i++
		}
		if (xml.charCodeAt(i) === 62) i++

		const attrKeys = Object.keys(attrs)
		if (selfClosing) {
			return { name, node: attrKeys.length > 0 ? { $: attrs } : '' }
		}

		const node: Record<string, unknown> = {}
		if (attrKeys.length > 0) node.$ = attrs
		let text = ''

		while (i < len) {
			if (xml.charCodeAt(i) === 60) {
				if (xml.charCodeAt(i + 1) === 47) {
					i += 2
					parseName()
					skipWs()
					if (xml.charCodeAt(i) === 62) i++
					break
				}
				const child = parseElement()
				const existing = node[child.name]
				if (existing === undefined) {
					node[child.name] = [child.node]
				} else {
					;(existing as Xml2jsNode[]).push(child.node)
				}
			} else {
				const start = i
				while (i < len && xml.charCodeAt(i) !== 60) i++
				text += xml.slice(start, i)
			}
		}

		const hasChildren = Object.keys(node).some((k) => k !== '$')
		const decoded = unescapeXml(text)
		if (decoded.length > 0) {
			if (hasChildren || attrKeys.length > 0) {
				if (!hasChildren || decoded.trim().length > 0) {
					node._ = coerce(hasChildren ? decoded.trim() : decoded)
				}
			} else {
				return { name, node: coerce(decoded) }
			}
		} else if (!hasChildren && attrKeys.length === 0) {
			return { name, node: '' }
		}

		return { name, node: node as Xml2jsNode }
	}

	const root = parseElement()
	return { [root.name]: root.node }
}

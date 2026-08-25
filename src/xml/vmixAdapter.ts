import type { XmlParserAdapter } from './adapter.js'
import { parseVmixXml2js } from './vmixParser.js'

export class VmixXmlAdapter implements XmlParserAdapter {
	async parse(xml: string): Promise<any> {
		return parseVmixXml2js(xml)
	}
}

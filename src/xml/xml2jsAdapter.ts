import * as xml2js from 'xml2js'
import type { XmlParserAdapter } from './adapter.js'

const parserOptions = {
	tagNameProcessors: [],
	attrNameProcessors: [],
	valueProcessors: [xml2js.processors.parseBooleans],
	attrValueProcessors: [xml2js.processors.parseBooleans],
}

const parser = new xml2js.Parser(parserOptions)

export class Xml2jsAdapter implements XmlParserAdapter {
	async parse(xml: string): Promise<any> {
		return parser.parseStringPromise(xml)
	}
}

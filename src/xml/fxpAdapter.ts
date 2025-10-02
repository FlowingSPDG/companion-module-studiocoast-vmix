import { XMLParser } from 'fast-xml-parser'
import { XmlParserAdapter } from './adapter'

export class FastXmlParserAdapter implements XmlParserAdapter {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      allowBooleanAttributes: true,
      parseAttributeValue: true,
      trimValues: false,
    })
  }

  async parse(xml: string): Promise<any> {
    return this.parser.parse(xml)
  }
}



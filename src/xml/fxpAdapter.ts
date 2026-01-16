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
    const result = this.parser.parse(xml)
    // Convert fast-xml-parser output to xml2js format
    // xml2js wraps scalar values in arrays, so we need to normalize the structure
    return this.normalizeToXml2jsFormat(result)
  }

  /**
   * Normalizes fast-xml-parser output to xml2js format (array-wrapped)
   */
  private normalizeToXml2jsFormat(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeToXml2jsFormat(item))
    }

    if (typeof obj === 'object') {
      const normalized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$') {
          // Attributes should remain as-is
          normalized[key] = value
        } else if (Array.isArray(value)) {
          // Already an array, normalize items
          normalized[key] = value.map((item) => this.normalizeToXml2jsFormat(item))
        } else if (typeof value === 'object' && value !== null) {
          // Object, normalize it
          normalized[key] = [this.normalizeToXml2jsFormat(value)]
        } else {
          // Scalar value, wrap in array (xml2js format)
          normalized[key] = [value]
        }
      }
      return normalized
    }

    // Scalar value, wrap in array (xml2js format)
    return [obj]
  }
}



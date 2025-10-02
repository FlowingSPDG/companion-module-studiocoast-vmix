export interface XmlParserAdapter {
  parse(xml: string): Promise<any>
}



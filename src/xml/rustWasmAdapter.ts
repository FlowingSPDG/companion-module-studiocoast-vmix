import { XmlParserAdapter } from './adapter'

export class RustWasmAdapter implements XmlParserAdapter {
  private wasm: any | null = null
  private loadPromise: Promise<void> | null = null

  constructor() {
    this.loadPromise = this.loadWasm()
  }

  /**
   * Dynamically loads the Rust WASM module
   */
  private async loadWasm(): Promise<void> {
    if (this.wasm) {
      return
    }

    try {
      // Try to load from dist directory first (production build)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require('path')
        const wasmPath = path.join(__dirname, '../bench/wasm/pkg/vmix_xml.js')
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.wasm = require(wasmPath)
      } catch {
        // Try source path (development)
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const path = require('path')
          const wasmPath = path.join(process.cwd(), 'src/bench/wasm/pkg/vmix_xml.js')
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          this.wasm = require(wasmPath)
        } catch {
          // Try direct sibling (if user placed a wrapper)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          this.wasm = require('./vmix_xml_wasm')
        }
      }

      // Initialize WASM if needed
      if (this.wasm && typeof this.wasm.default === 'function') {
        await this.wasm.default()
      }
    } catch (error) {
      throw new Error(`Failed to load Rust WASM module: ${(error as Error).message}`)
    }

    if (!this.wasm || typeof this.wasm.parse !== 'function') {
      throw new Error('Rust WASM module does not export parse function')
    }
  }

  async parse(xml: string): Promise<any> {
    // Ensure WASM is loaded
    if (this.loadPromise) {
      await this.loadPromise
      this.loadPromise = null
    }

    if (!this.wasm || typeof this.wasm.parse !== 'function') {
      throw new Error('Rust WASM module is not available')
    }

    // Rust WASM parser returns xml2js-compatible format
    return this.wasm.parse(xml)
  }
}

import { readFileSync } from 'fs'
import { join } from 'path'
import { Xml2jsAdapter } from '../xml/xml2jsAdapter'
import { FastXmlParserAdapter } from '../xml/fxpAdapter'

type BenchCase = {
  name: string
  adapterFactory: () => { parse(xml: string): Promise<any> }
}

function hrtimeMs(): number {
  const [s, ns] = process.hrtime()
  return s * 1000 + ns / 1e6
}

async function runOne(name: string, xml: string, adapterFactory: () => { parse(xml: string): Promise<any> }, iterations: number) {
  const adapter = adapterFactory()
  // warmup
  await adapter.parse(xml)

  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = hrtimeMs()
    const res = await adapter.parse(xml)
    if (!res) throw new Error('parser returned falsy result')
    const t1 = hrtimeMs()
    times.push(t1 - t0)
  }
  times.sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const p90 = times[Math.floor(times.length * 0.9)]
  const p99 = times[Math.floor(times.length * 0.99)]
  const max = times[times.length - 1]

  return { name, iterations, avg, p90, p99, max }
}

async function main() {
  const iterations = Number(process.env.BENCH_ITERS || 200)
  const sample = process.env.BENCH_XML || 'bench-sample.xml'
  const xmlPath = join(process.cwd(), 'src', 'bench', sample)
  // Read XML file (vMix state XML format)
  const xml = readFileSync(xmlPath, 'utf8')

  // XML parser adapters to benchmark
  const cases: BenchCase[] = [
    { name: 'xml2js', adapterFactory: () => new Xml2jsAdapter() },
    { name: 'fast-xml-parser', adapterFactory: () => new FastXmlParserAdapter() },
  ]

  const results = [] as any[]
  for (const c of cases) {
    try {
      const r = await runOne(c.name, xml, c.adapterFactory, iterations)
      results.push(r)
    } catch (e) {
      results.push({ name: c.name, error: (e as Error).message })
    }
  }

  // Rust WASM parser (optional): try dynamic import if available
  // Uses quick-xml for XML parsing compiled to WASM
  try {
    // Try local wrapper first
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let wasm = null as any
    try {
      // direct sibling (if user placed a wrapper)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      wasm = require('./vmix_xml_wasm')
    } catch {
      // try source wasm-pack output path relative to dist
      const path = require('path')
      const p = path.join(process.cwd(), 'src/bench/wasm/pkg/vmix_xml.js')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      wasm = require(p)
    }
    if (wasm && typeof wasm.parse === 'function') {
      // Rust WASM parser using quick-xml to parse vMix XML
      const wasmAdapter = { parse: async (x: string) => wasm.parse(x) }
      const r = await runOne('rust-wasm (quick-xml)', xml, () => wasmAdapter, iterations)
      results.push(r)
    }
  } catch {
    results.push({ name: 'rust-wasm (quick-xml)', skipped: true })
  }

  console.log(JSON.stringify({ iterations, sample, results }, null, 2))
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()



import { readFileSync } from 'fs'
import { join } from 'path'
import { VMixData } from '../data'
import type VMixInstance from '../'

// Mock VMixInstance for benchmarking
class MockVMixInstance {
  config = { xmlParser: 'xml2js' as const }
  apiProcessing = { parsed: 0 }
  log() {}
  checkFeedbacks() {}
  tcp = null
}

function hrtimeMs(): number {
  const [s, ns] = process.hrtime()
  return s * 1000 + ns / 1e6
}

async function runOneFull(name: string, xml: string, parserType: 'xml2js' | 'fast-xml-parser' | 'rust-wasm', iterations: number) {
  const mockInstance = new MockVMixInstance() as unknown as VMixInstance
  mockInstance.config.xmlParser = parserType
  const data = new VMixData(mockInstance)
  
  // warmup
  await data.update(xml)

  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = hrtimeMs()
    await data.update(xml)
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
  const xml = readFileSync(xmlPath, 'utf8')

  const results = [] as any[]
  
  // Benchmark full parse + data transformation
  for (const parserType of ['xml2js', 'fast-xml-parser'] as const) {
    try {
      const r = await runOneFull(parserType, xml, parserType, iterations)
      results.push(r)
    } catch (e) {
      results.push({ name: parserType, error: (e as Error).message })
    }
  }

  // Rust WASM (if available)
  try {
    const mockInstance = new MockVMixInstance() as unknown as VMixInstance
    mockInstance.config.xmlParser = 'rust-wasm'
    const data = new VMixData(mockInstance)
    await data.update(xml) // test if it works
    const r = await runOneFull('rust-wasm', xml, 'rust-wasm', iterations)
    results.push(r)
  } catch {
    results.push({ name: 'rust-wasm', skipped: true })
  }

  console.log(JSON.stringify({ iterations, sample, results, note: 'Full parse + data transformation benchmark' }, null, 2))
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()

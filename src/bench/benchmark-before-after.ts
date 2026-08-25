import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as xml2js from 'xml2js'
import { XMLParser } from 'fast-xml-parser'
import { VMixData } from '../data.js'
import type VMixInstance from '../index.js'
import { Xml2jsAdapter } from '../xml/xml2jsAdapter.js'
import { FastXmlParserAdapter } from '../xml/fxpAdapter.js'
import { VmixXmlAdapter } from '../xml/vmixAdapter.js'
import { parseVmixXml2js } from '../xml/vmixParser.js'

class MockVMixInstance {
	config = { xmlParser: 'vmix' as const, apiPollInterval: 250 }
	apiProcessing = { parsed: 0, hold: false, holdCount: 0, request: 0, response: 0, feedbacks: 0, variables: 0 }
	log(): void {
		return
	}
	checkFeedbacks(): void {
		return
	}
	tcp = null
	variables = null
}

function hrtimeMs(): number {
	const [s, ns] = process.hrtime()
	return s * 1000 + ns / 1e6
}

interface BenchmarkResult {
	name: string
	group: string
	iterations: number
	avg: number
	p50: number
	p90: number
	p99: number
	max: number
	min: number
	total: number
	opsPerSec: number
}

interface SkippedResult {
	name: string
	group: string
	skipped: true
	error: string
}

type AnyResult = BenchmarkResult | SkippedResult

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

async function timeAsync(fn: () => Promise<unknown> | unknown, iterations: number, warmup = 20): Promise<BenchmarkResult> {
	for (let i = 0; i < warmup; i++) {
		await fn()
	}
	if (global.gc) {
		global.gc()
		await new Promise((resolve) => setTimeout(resolve, 50))
	}

	const times: number[] = []
	for (let i = 0; i < iterations; i++) {
		const t0 = hrtimeMs()
		await fn()
		times.push(hrtimeMs() - t0)
	}

	times.sort((a, b) => a - b)
	const total = times.reduce((a, b) => a + b, 0)
	const avg = total / times.length
	return {
		name: '',
		group: '',
		iterations,
		avg,
		p50: percentile(times, 0.5),
		p90: percentile(times, 0.9),
		p99: percentile(times, 0.99),
		max: times[times.length - 1],
		min: times[0],
		total,
		opsPerSec: 1000 / avg,
	}
}

function formatResult(result: BenchmarkResult): string {
	return `${result.name}:
  avg ${result.avg.toFixed(3)}ms  p50 ${result.p50.toFixed(3)}ms  p90 ${result.p90.toFixed(3)}ms  p99 ${result.p99.toFixed(3)}ms
  min ${result.min.toFixed(3)}ms  max ${result.max.toFixed(3)}ms  ${result.opsPerSec.toFixed(1)} ops/sec`
}

function unwrapVmix(parsed: any): any {
	if (!parsed?.vmix) return parsed
	return Array.isArray(parsed.vmix) ? parsed.vmix[0] : parsed.vmix
}

function createFxpXml2jsParser(): XMLParser {
	return new XMLParser({
		ignoreAttributes: false,
		allowBooleanAttributes: true,
		parseAttributeValue: true,
		parseTagValue: true,
		trimValues: false,
		attributeNamePrefix: '',
		attributesGroupName: '$',
		textNodeName: '_',
		isArray: (_name, jpath, _isLeafNode, isAttribute) => {
			if (isAttribute) return false
			return jpath !== 'vmix'
		},
	})
}

async function loadXml(): Promise<{ xml: string; source: string }> {
	const liveUrl = process.env.BENCH_XML_URL || 'http://127.0.0.1:8088/api'
	try {
		const res = await fetch(liveUrl)
		if (res.ok) {
			const xml = await res.text()
			if (xml.includes('<vmix')) {
				const outPath = join(process.cwd(), 'src', 'bench', 'bench-live.xml')
				writeFileSync(outPath, xml)
				return { xml, source: `${liveUrl} (${outPath})` }
			}
		}
	} catch {
		// fall through to file
	}

	const sample = process.env.BENCH_XML || 'bench-live.xml'
	const xmlPath = join(process.cwd(), 'src', 'bench', sample)
	return { xml: readFileSync(xmlPath, 'utf8'), source: xmlPath }
}

async function main(): Promise<void> {
	const iterations = Number(process.env.BENCH_ITERS || 300)
	const { xml, source } = await loadXml()
	const inputCount = (xml.match(/<input[\s>]/g) || []).length
	const overlayCount = (xml.match(/<overlay[\s>]/g) || []).length
	const results: AnyResult[] = []

	console.log('='.repeat(80))
	console.log('vMix XML parser benchmark (v5, live XML)')
	console.log('='.repeat(80))
	console.log(`Source: ${source}`)
	console.log(`size: ${(xml.length / 1024).toFixed(2)} KB  inputs: ${inputCount}  overlays: ${overlayCount}  iters: ${iterations}`)
	console.log(`Node: ${process.version}  platform: ${process.platform} ${process.arch}`)
	console.log()

	const xml2jsParser = new xml2js.Parser({
		tagNameProcessors: [],
		attrNameProcessors: [],
		valueProcessors: [xml2js.processors.parseBooleans],
		attrValueProcessors: [xml2js.processors.parseBooleans],
	})
	const xml2jsAdapter = new Xml2jsAdapter()
	const fxpAdapter = new FastXmlParserAdapter()
	const vmixAdapter = new VmixXmlAdapter()
	const fxpCompat = createFxpXml2jsParser()

	const push = (group: string, name: string, result: BenchmarkResult): void => {
		result.group = group
		result.name = name
		results.push(result)
		console.log(formatResult(result))
		console.log()
	}

	console.log('--- Parse only (usable JS object) ---')
	push('parse', 'xml2js', await timeAsync(() => xml2jsParser.parseStringPromise(xml), iterations))
	push('parse', 'fast-xml-parser + normalize', await timeAsync(() => fxpAdapter.parse(xml), iterations))
	push('parse', 'fast-xml-parser xml2js-compat', await timeAsync(() => fxpCompat.parse(xml), iterations))
	push('parse', 'vMix JS parser', await timeAsync(() => parseVmixXml2js(xml), iterations))

	console.log('--- Full VMixData.update() ---')
	const runUpdate = async (parserType: 'xml2js' | 'fast-xml-parser' | 'vmix'): Promise<BenchmarkResult> => {
		const mock = new MockVMixInstance() as unknown as VMixInstance
		mock.config.xmlParser = parserType
		const data = new VMixData(mock)
		;(mock as { data: VMixData }).data = data
		return timeAsync(() => data.update(xml), iterations)
	}

	for (const parserType of ['xml2js', 'fast-xml-parser', 'vmix'] as const) {
		try {
			push('e2e', `VMixData.update ${parserType}`, await runUpdate(parserType))
		} catch (e) {
			results.push({
				name: `VMixData.update ${parserType}`,
				group: 'e2e',
				skipped: true,
				error: (e as Error).message,
			})
			console.error(`${parserType} e2e failed: ${(e as Error).message}`)
		}
	}

	const xml2jsParsed = unwrapVmix(await xml2jsAdapter.parse(xml))
	const vmixParsed = unwrapVmix(await vmixAdapter.parse(xml))

	const shapeCheck = {
		xml2jsInputs: xml2jsParsed?.inputs?.[0]?.input?.length ?? null,
		vmixInputs: vmixParsed?.inputs?.[0]?.input?.length ?? null,
		xml2jsVersion: xml2jsParsed?.version?.[0] ?? null,
		vmixVersion: vmixParsed?.version?.[0] ?? null,
		xml2jsFirstKey: xml2jsParsed?.inputs?.[0]?.input?.[0]?.$?.key ?? null,
		vmixFirstKey: vmixParsed?.inputs?.[0]?.input?.[0]?.$?.key ?? null,
		xml2jsFirstOverlays: xml2jsParsed?.inputs?.[0]?.input?.[0]?.overlay?.length ?? 0,
		vmixFirstOverlays: vmixParsed?.inputs?.[0]?.input?.[0]?.overlay?.length ?? 0,
	}

	const valid = results.filter((r): r is BenchmarkResult => !('skipped' in r))
	const parseResults = valid.filter((r) => r.group === 'parse')
	const baseline = parseResults.find((r) => r.name === 'xml2js')

	console.log('='.repeat(80))
	console.log('Relative to xml2js parse-only')
	console.log('='.repeat(80))
	if (baseline) {
		for (const r of parseResults) {
			console.log(`  ${r.name}: ${(baseline.avg / r.avg).toFixed(2)}x  (${r.avg.toFixed(3)}ms)`)
		}
	}

	console.log()
	console.log('Shape check')
	console.log(JSON.stringify(shapeCheck, null, 2))

	const output = {
		metadata: {
			source,
			xmlBytes: xml.length,
			inputCount,
			overlayCount,
			iterations,
			node: process.version,
			platform: `${process.platform} ${process.arch}`,
			timestamp: new Date().toISOString(),
		},
		shapeCheck,
		results: results.map((r) => {
			if ('skipped' in r) return r
			return {
				name: r.name,
				group: r.group,
				iterations: r.iterations,
				avg: Number(r.avg.toFixed(4)),
				p50: Number(r.p50.toFixed(4)),
				p90: Number(r.p90.toFixed(4)),
				p99: Number(r.p99.toFixed(4)),
				min: Number(r.min.toFixed(4)),
				max: Number(r.max.toFixed(4)),
				opsPerSec: Number(r.opsPerSec.toFixed(2)),
			}
		}),
	}

	const outDir = join(process.cwd(), 'dist', 'bench')
	mkdirSync(outDir, { recursive: true })
	const outPath = join(outDir, 'last-results.json')
	writeFileSync(outPath, JSON.stringify(output, null, 2))
	console.log()
	console.log(`Wrote ${outPath}`)
	console.log(JSON.stringify(output, null, 2))
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

import lodash from 'lodash'
import { createModuleLogger } from '@companion-module/base'
import type VMixInstance from './index.js'
import { type FeedbackId } from './feedbacks/feedback.js'
import type { XmlParserAdapter } from './xml/adapter.js'
import { Xml2jsAdapter } from './xml/xml2jsAdapter.js'
import { FastXmlParserAdapter } from './xml/fxpAdapter.js'
import { VmixXmlAdapter } from './xml/vmixAdapter.js'

export interface AudioBus {
  bus: 'master' | 'busA' | 'busB' | 'busC' | 'busD' | 'busE' | 'busF' | 'busG'
  volume: number
  muted: boolean
  meterF1: number
  meterF2: number
  headphonesVolume?: number
  solo: boolean
  sendToMaster: boolean
}

export interface AudioLevel {
  key: string
  type: 'input' | 'bus'
  meterF1: { time: Date; value: number }[]
  meterF2: { time: Date; value: number }[]
}

interface AudioLevelData {
  s1MeterF1Avg: number
  s1MeterF2Avg: number
  s3MeterF1Avg: number
  s3MeterF2Avg: number
  s1MeterF1Peak: number
  s1MeterF2Peak: number
  s3MeterF1Peak: number
  s3MeterF2Peak: number
}

export interface AudioBusses {
  M: boolean
  A: boolean
  B: boolean
  C: boolean
  D: boolean
  E: boolean
  F: boolean
  G: boolean

  [key: string]: boolean
}

export type CallAudioSource = 'Master' | 'Headphones' | 'BusA' | 'BusB' | 'BusC' | 'BusD' | 'BusE' | 'BusF' | 'BusG'

export type CallVideoSource = 'Output1' | 'Output2' | 'Output3' | 'Output4' | 'None'

export interface ChannelMixer {
  [key: string]: InputAudioChannels[]
}

export interface ColourCorrection {
  hue: number
  saturation: number
  liftR: number
  liftG: number
  liftB: number
  liftY: number
  gammaR: number
  gammaG: number
  gammaB: number
  gammaY: number
  gainR: number
  gainG: number
  gainB: number
  gainY: number
}

export interface DynamicInput {
  name: string
  value: string
}

export interface DynamicValue {
  name: string
  value: string
}

export interface Input {
  key: string
  number: number
  type: string
  title: string
  shortTitle: string | null
  state: string
  position: number
  duration: number
  loop: boolean
  markIn?: number
  markOut?: number
  muted?: boolean
  solo?: boolean
  volume?: number
  audioBusses?: AudioBusses
  audioAuto?: boolean
  balance?: number
  gain?: number
  volumeF1?: number
  volumeF2?: number
  meterF1?: number
  meterF2?: number
  list?: List[]
  overlay?: Layer[]
  text?: TitleText[]
  image?: TitleImage[]
  color?: TitleImage[]
  selectedIndex?: number
  callPassword?: string
  callConnected?: boolean
  callVideoSource?: CallVideoSource
  callAudioSource?: CallAudioSource
  channelMixer?: number[]
  cc?: ColourCorrection
  inputPosition?: InputPosition
  frameDelay?: number
}

export interface InputAudioChannels {
  channel: number
  volume: number
}

export interface InputPosition {
  panX: number
  panY: number
  zoomX: number
  zoomY: number
  cropX1: number
  cropX2: number
  cropY1: number
  cropY2: number
  [key: string]: number
}

export interface Layer {
  index: number
  key: string
  panX: number
  panY: number
  zoomX: number
  zoomY: number
  x: number
  y: number
  width: number
  height: number
  cropX1: number
  cropX2: number
  cropY1: number
  cropY2: number
  [key: string]: number | string
}

export interface List {
  index: number
  location: string
  filename: string
  selected: boolean
}

export interface Mix {
  number: number
  active: boolean
  preview: number
  program: number
  previewTally: string[]
  programTally: string[]
}

export interface Output {
  type: 'fullscreen' | 'output'
  number: number
  source: string
  input: number
  mix: number
  ndi: boolean
  omt: boolean
  srt: boolean
}

export interface Overlay {
  number: number
  preview: boolean
  input: number | null
}

export interface Recording {
  duration: number
  filename1: string
  filename2: string
}

export interface Replay {
  recording: boolean
  live: boolean
  forward: boolean
  channelMode: 'AB' | 'A' | 'B'
  quadMode: boolean
  events: number
  eventsA: number
  eventsB: number
  cameraA: number
  cameraB: number
  speed: number
  speedA: number
  speedB: number
  timecode: string
  timecodeA: string
  timecodeB: string
}

export interface Status {
  fadeToBlack: boolean
  recording: boolean
  external: boolean
  streaming: boolean
  stream: [boolean, boolean, boolean, boolean, boolean]
  playList: boolean
  multiCorder: boolean
  fullscreen: boolean
}

export interface TitleText {
  index: number
  name: string
  value: string
}

export interface TitleImage {
  index: number
  name: string
  value: string
}

export interface TitleColor {
  index: number
  name: string
  value: string
}

export interface Transition {
  number: number
  effect: any
  duration: number
}

interface APIData {
  version: string
  majorVersion: number
  edition: string
  preset: string
  inputs: Input[]
  outputs: Output[]
  overlays: Overlay[]
  transitions: Transition[]
  mix: [Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix, Mix]
  audio: AudioBus[]
  status: Status
  recording: Recording
  replay: Replay
  channelMixer: ChannelMixer
  dynamicInput: DynamicInput[]
  dynamicValue: DynamicValue[]
}

const log = createModuleLogger('Data')
const INPUT_NUMBER_PATTERN = /^\d+$/

export class VMixData {
  instance: VMixInstance
  loaded: boolean
  version: string
  majorVersion: number
  edition: string
  preset: string
  inputs: Input[]
  private inputsMap: Map<string, Input>
  private inputsByNumberMap: Map<number, Input>
  outputs: Output[]
  overlays: Overlay[]
  transitions: Transition[]
  mix: Mix[]
  audio: AudioBus[]
  audioLevels: AudioLevel[]
  private audioLevelsMap: Map<string, AudioLevel>
  status: Status
  recording: Recording
  replay: Replay
  channelMixer: ChannelMixer
  dynamicInput: DynamicInput[]
  dynamicValue: DynamicValue[]
  private parser: XmlParserAdapter

  constructor(instance: VMixInstance) {
    this.instance = instance
    this.loaded = false
    this.version = ''
    this.majorVersion = 0
    this.edition = ''
    this.preset = ''
    this.inputs = []
    this.inputsMap = new Map()
    this.inputsByNumberMap = new Map()
    this.outputs = []
    this.overlays = []
    this.transitions = []
    this.mix = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((mixNumber) => {
      return {
        number: mixNumber,
        active: mixNumber === 1,
        preview: 0,
        program: 0,
        previewTally: [],
        programTally: [],
      }
    })

    this.audio = []
    this.audioLevels = []
    this.audioLevelsMap = new Map()
    this.status = {
      fadeToBlack: false,
      recording: false,
      external: false,
      streaming: false,
      stream: [false, false, false, false, false],
      playList: false,
      multiCorder: false,
      fullscreen: false,
    }
    this.recording = {
      duration: 0,
      filename1: '',
      filename2: '',
    }
    this.replay = {
      recording: false,
      live: false,
      forward: true,
      channelMode: 'AB',
      quadMode: false,
      events: 1,
      eventsA: 1,
      eventsB: 1,
      cameraA: 1,
      cameraB: 1,
      speed: 1,
      speedA: 1,
      speedB: 1,
      timecode: '',
      timecodeA: '',
      timecodeB: '',
    }
    this.channelMixer = {}
    this.dynamicInput = []
    this.dynamicValue = []
    this.parser = this.createParser()
  }

  /**
   * @description Creates a parser adapter based on the instance configuration
   */
  private createParser(): XmlParserAdapter {
    const parserType = this.instance.config.xmlParser || 'vmix'
    if (parserType === 'xml2js') {
      return new Xml2jsAdapter()
    }
    if (parserType === 'fast-xml-parser') {
      return new FastXmlParserAdapter()
    }
    return new VmixXmlAdapter()
  }

  /**
   * @description Updates the parser when configuration changes
   */
  public updateParser(): void {
    this.parser = this.createParser()
  }

  /**
   * @param bus Must be either Master, A to G, or busA to busG
   * @returns AudioBus or null
   * @description Will return the audio bus, or null if the bus is not found (or not supported on the connected vMix machine)
   */
  public getAudioBus(bus: string): AudioBus | null {
    let id = bus.toLowerCase()

    if (bus.length === 1) {
      id = 'bus' + id
    }

    const audioBus = this.audio.find((item) => item.bus.toLowerCase() === id)

    return audioBus || null
  }

  /**
   * @param level
   * @returns AudioLevelData
   * @description parses an AudioLevel into 1 second and 3 second data
   */
  public getAudioLevel(key: string): AudioLevel | undefined {
    return this.audioLevelsMap.get(key)
  }

  public getAudioLevelData(level: AudioLevel): AudioLevelData {
    const now = Math.floor(new Date().getTime() / 1000)
    const s1ArrF1: number[] = []
    const s1ArrF2: number[] = []
    const s3ArrF1: number[] = []
    const s3ArrF2: number[] = []
    let s1MeterF1Peak = 0
    let s1MeterF2Peak = 0
    let s3MeterF1Peak = 0
    let s3MeterF2Peak = 0

    for (const sample of level.meterF1) {
      const sec = Math.floor(sample.time.getTime() / 1000)
      if (sec === now - 1) {
        s1ArrF1.push(sample.value)
        if (sample.value > s1MeterF1Peak) s1MeterF1Peak = sample.value
      }
      if (sec < now && sec > now - 4) {
        s3ArrF1.push(sample.value)
        if (sample.value > s3MeterF1Peak) s3MeterF1Peak = sample.value
      }
    }

    for (const sample of level.meterF2) {
      const sec = Math.floor(sample.time.getTime() / 1000)
      if (sec === now - 1) {
        s1ArrF2.push(sample.value)
        if (sample.value > s1MeterF2Peak) s1MeterF2Peak = sample.value
      }
      if (sec < now && sec > now - 4) {
        s3ArrF2.push(sample.value)
        if (sample.value > s3MeterF2Peak) s3MeterF2Peak = sample.value
      }
    }

    return {
      s1MeterF1Avg: s1ArrF1.reduce((a, b) => a + b, 0) / s1ArrF1.length,
      s1MeterF2Avg: s1ArrF2.reduce((a, b) => a + b, 0) / s1ArrF2.length,
      s3MeterF1Avg: s3ArrF1.reduce((a, b) => a + b, 0) / s3ArrF1.length,
      s3MeterF2Avg: s3ArrF2.reduce((a, b) => a + b, 0) / s3ArrF2.length,
      s1MeterF1Peak,
      s1MeterF2Peak,
      s3MeterF1Peak,
      s3MeterF2Peak,
    }
  }

  /**
   * @param value accepts input number, shortTitle, title, GUID, or instance variable
   * @returns Input or null if not found
   * @description any instance variables are parsed, and then input numbers take priority over other types
   */
  public getInput(value: string | number): Input | null {
    let input: Input | null | undefined

    if (typeof value === 'number' || INPUT_NUMBER_PATTERN.test(value)) {
      const num = typeof value === 'number' ? value : parseInt(value, 10)
      input = this.inputsByNumberMap.get(num) || null
    } else {
      input = this.inputsMap.get(value) || null
      if (!input) {
        input = this.inputs.find((item) => item.shortTitle === value || item.title === value) || null
      }
    }

    return input || null
  }

  /**
   * @param value accepts input number, shortTitle, title, GUID, or instance variable
   * @returns shortTitle, title, or an empty string
   */
  public getInputTitle(value: string | number): string {
    const input = this.getInput(value)

    return input ? input.shortTitle || input.title : ''
  }

  /**
   * @param data XML API data from vMix
   * @returns Promise resolving to the new data
   */
  private async parse(data: string): Promise<APIData> {
    return this.parser.parse(data).then((parsedData: any) => {
      if (parsedData.vmix) {
        parsedData = Array.isArray(parsedData.vmix) ? parsedData.vmix[0] : parsedData.vmix
      }
      const version = parsedData.version[0] || ''
      const majorVersion = parseInt(version.split('.')[0])

      const getInputs = (): Input[] => {
        if (!parsedData.inputs || parsedData.inputs[0] === '') {
          return []
        }

        const inputs = parsedData.inputs[0].input.map((input: any) => {
          const inputData: Input = {
            key: input.$.key,
            number: parseInt(input.$.number, 10),
            type: input.$.type,
            title: input.$.title + '',
            shortTitle: input.$.shortTitle + '' || null,
            state: input.$.state,
            position: parseFloat(input.$.position),
            duration: parseFloat(input.$.duration),
            loop: input.$.loop,
            volume: parseFloat(input.$.volume || '100'),
            audioAuto: true,
            muted: input.$.muted,
            solo: input.$.solo,
            selectedIndex: parseInt(input.$.selectedIndex, 10),
            frameDelay: parseInt(input.$.frameDelay, 10) || 0,
          }

          if (input.$.balance !== undefined) inputData.balance = parseFloat(input.$.balance)
          if (input.$.gainDb !== undefined) inputData.gain = parseFloat(input.$.gainDb)

          if (input.list) {
            if (input.list[0] !== '') {
              inputData.list = input.list[0].item.map((listItem: any, index: number) => {
                const data: List = {
                  index,
                  location: '',
                  filename: '',
                  selected: false,
                }

                if (typeof listItem !== 'string') {
                  data.location = listItem._
                  data.selected = true
                } else {
                  data.location = listItem
                }

                const parts = data.location.split('\\')
                data.filename = parts[parts.length - 1]

                return data
              })
            } else {
              inputData.list = []
            }
          }

          if (input.$.markIn !== undefined) {
            inputData.markIn = parseInt(input.$.markIn, 10)
          }

          if (input.$.markOut !== undefined) {
            inputData.markOut = parseInt(input.$.markOut, 10)
          }

          if (input.$.volumeF1 !== undefined) {
            inputData.volumeF1 = parseFloat(input.$.volumeF1)
          }

          if (input.$.volumeF2 !== undefined) {
            inputData.volumeF2 = parseFloat(input.$.volumeF2)
          }

          if (input.$.meterF1 !== undefined) {
            inputData.meterF1 = parseFloat(input.$.meterF1)
          }

          if (input.$.meterF2 !== undefined) {
            inputData.meterF2 = parseFloat(input.$.meterF2)
          }

          if (inputData.meterF1 && inputData.meterF2) {
            const now = new Date()
            let audioLevel = this.audioLevelsMap.get(inputData.key)

            if (!audioLevel) {
              audioLevel = {
                key: inputData.key,
                type: 'input',
                meterF1: [{ time: now, value: inputData.meterF1 }],
                meterF2: [{ time: now, value: inputData.meterF2 }],
              }
              this.audioLevels.push(audioLevel)
              this.audioLevelsMap.set(inputData.key, audioLevel)
            } else {
              audioLevel.meterF1.push({ time: now, value: inputData.meterF1 })
              audioLevel.meterF2.push({ time: now, value: inputData.meterF2 })

              if (audioLevel.meterF1.length > 50) audioLevel.meterF1.shift()
              if (audioLevel.meterF2.length > 50) audioLevel.meterF2.shift()
            }
          }

          if (input.$.audiobusses !== undefined) {
            // API Data is a string of comma separated busses, eg 'M', or 'M,A,B,G'
            inputData.audioBusses = {
              M: input.$.audiobusses.includes('M'),
              A: input.$.audiobusses.includes('A'),
              B: input.$.audiobusses.includes('B'),
              C: input.$.audiobusses.includes('C'),
              D: input.$.audiobusses.includes('D'),
              E: input.$.audiobusses.includes('E'),
              F: input.$.audiobusses.includes('F'),
              G: input.$.audiobusses.includes('G'),
            }
          }

          if (input?.overlay?.[0]?.$) {
            inputData.overlay = input.overlay.map((overlay: any) => {
              const position = overlay.position?.[0]?.$ || {}
              const crop = overlay.crop?.[0]?.$ || {}
              return {
                index: parseInt(overlay.$.index, 10),
                key: overlay.$.key,
                panX: parseFloat(position.panX || '0'),
                panY: parseFloat(position.panY || '0'),
                zoomX: parseFloat(position.zoomX || '1'),
                zoomY: parseFloat(position.zoomY || '1'),
                x: parseFloat(position.x || '0'),
                y: parseFloat(position.y || '0'),
                width: parseFloat(position.width || '0'),
                height: parseFloat(position.height || '0'),
                cropX1: parseFloat(crop.X1 || '0'),
                cropX2: parseFloat(crop.X2 || '1'),
                cropY1: parseFloat(crop.Y1 || '0'),
                cropY2: parseFloat(crop.Y2 || '1'),
              }
            })
          }

          // Check both input.$.text and input.text (avoid duplicate processing)
          const textData = input.$.text || (input.text && input.text.length > 0 ? input.text : null)
          if (textData) {
            inputData.text = textData.map((text: any) => ({
              index: parseInt(text.$.index, 10),
              name: text.$.name + '',
              value: text._ === undefined ? '' : text._ + '',
            }))
          }

          if (input.$.type === 'GT') {
            if (input.image) {
              inputData.image = input.image.map((image: any) => ({
                index: parseInt(image.$.index, 10),
                name: image.$.name + '',
                value: image._ === undefined ? '' : image._ + '',
              }))
            }

            if (input.color) {
              inputData.color = input.color.map((color: any) => ({
                index: parseInt(color.$.index, 10),
                name: color.$.name + '',
                value: color._ === undefined ? '' : color._ + '',
              }))
            }
          }

          if (input.$.type === 'VideoCall') {
            inputData.callPassword = input.$.callPassword
            inputData.callConnected = input.$.callConnected
            inputData.callVideoSource = input.$.callVideoSource
            inputData.callAudioSource = input.$.callAudioSource
          }

          if (!isNaN(majorVersion) && majorVersion >= 27) {
            inputData.cc = {
              hue: parseFloat(input.cc?.[0]?.$?.hue ?? 0),
              saturation: parseFloat(input.cc?.[0]?.$?.saturation ?? 0),
              liftR: parseFloat(input.cc?.[0]?.$?.liftR ?? 0),
              liftG: parseFloat(input.cc?.[0]?.$?.liftG ?? 0),
              liftB: parseFloat(input.cc?.[0]?.$?.liftB ?? 0),
              liftY: parseFloat(input.cc?.[0]?.$?.liftY ?? 0),
              gammaR: parseFloat(input.cc?.[0]?.$?.gammaR ?? 0),
              gammaG: parseFloat(input.cc?.[0]?.$?.gammaG ?? 0),
              gammaB: parseFloat(input.cc?.[0]?.$?.gammaB ?? 0),
              gammaY: parseFloat(input.cc?.[0]?.$?.gammaY ?? 0),
              gainR: parseFloat(input.cc?.[0]?.$?.gainR ?? 1),
              gainG: parseFloat(input.cc?.[0]?.$?.gainG ?? 1),
              gainB: parseFloat(input.cc?.[0]?.$?.gainB ?? 1),
              gainY: parseFloat(input.cc?.[0]?.$?.gainY ?? 1),
            }

            inputData.inputPosition = {
              panX: parseFloat(input.position?.[0]?.$?.panX ?? 0),
              panY: parseFloat(input.position?.[0]?.$?.panY ?? 0),
              zoomX: parseFloat(input.position?.[0]?.$?.zoomX ?? 1),
              zoomY: parseFloat(input.position?.[0]?.$?.zoomY ?? 1),
              cropX1: parseFloat(input.crop?.[0]?.$?.X1 ?? 0),
              cropX2: parseFloat(input.crop?.[0]?.$?.X2 ?? 1),
              cropY1: parseFloat(input.crop?.[0]?.$?.Y1 ?? 0),
              cropY2: parseFloat(input.crop?.[0]?.$?.Y2 ?? 1),
            }
          }

          return inputData
        })

        return inputs
      }

      const getOutputs = (): Output[] => {
        const outputs = lodash.get(parsedData, 'outputs[0].output')

        if (!outputs) return []

        return outputs.map((output: any) => ({
          type: output.$.type,
          number: parseInt(output.$.number, 10),
          source: output.$.source,
          input: parseInt(output.$.inputNumber || 0, 10),
          mix: parseInt(output.$.mix || 0, 10),
          ndi: output.$.ndi || false,
          omt: output.$.omt || false,
          srt: output.$.srt || false,
        }))
      }

      const getOverlays = (): Overlay[] => {
        const overlays = lodash.get(parsedData, 'overlays[0].overlay')

        if (!overlays) {
          return []
        }

        return overlays.map((overlay: any) => ({
          number: parseInt(overlay.$.number, 10),
          preview: overlay.$.preview || false,
          input: overlay._ !== undefined ? parseInt(overlay._, 10) : null,
        }))
      }

      const getTransitions = (): Transition[] => {
        const transitions = lodash.get(parsedData, 'transitions[0].transition')

        if (!transitions) {
          return []
        }

        return transitions.map((transition: any) => ({
          number: parseInt(transition.$.number, 10),
          effect: transition.$.effect,
          duration: parseInt(transition.$.duration, 10),
        }))
      }

      const getMix = (mixID: number): Mix => {
        const mix = {
          number: mixID,
          active: false,
          preview: 0,
          program: 0,
          previewTally: [],
          programTally: [],
        }

        if (mixID === 1) {
          mix.active = true
          mix.preview = parseInt(parsedData.preview[0], 10)
          mix.program = parseInt(parsedData.active[0], 10)
        } else {
          if (parsedData.mix) {
            parsedData.mix.forEach((item: any) => {
              if (item.$.number == mixID) {
                mix.active = true
                mix.preview = item.preview[0]
                mix.program = item.active[0]
              }
            })
          }
        }

        return mix
      }

      const getAudio = (): AudioBus[] => {
        const audio = parsedData.audio[0]
        const busData: AudioBus[] = []

        Object.keys(audio).forEach((key) => {
          const bus = { ...audio[key][0].$, bus: key }
          if (bus.solo === undefined) bus.solo = false
          if (bus.sendToMaster === undefined) bus.sendToMaster = false

          bus.volume = parseFloat(bus.volume)
          bus.meterF1 = parseFloat(bus.meterF1)
          bus.meterF2 = parseFloat(bus.meterF2)
          if (bus.headphonesVolume !== undefined) {
            bus.headphonesVolume = parseFloat(bus.headphonesVolume)
          }

          busData.push(bus)

          const audioLevel = this.audioLevelsMap.get(key)
          const now = new Date()

          if (!audioLevel) {
            const created: AudioLevel = {
              key,
              type: 'bus',
              meterF1: [{ time: now, value: bus.meterF1 }],
              meterF2: [{ time: now, value: bus.meterF2 }],
            }
            this.audioLevels.push(created)
            this.audioLevelsMap.set(key, created)
          } else {
            audioLevel.meterF1.push({ time: now, value: bus.meterF1 })
            audioLevel.meterF2.push({ time: now, value: bus.meterF2 })

            if (audioLevel.meterF1.length > 50) audioLevel.meterF1.shift()
            if (audioLevel.meterF2.length > 50) audioLevel.meterF2.shift()
          }
        })

        return busData
      }

      const getRecordingDuration = (): number => {
        if (parsedData.recording[0]?.$?.duration) {
          return parsedData.recording[0]?.$?.duration
        } else {
          return 0
        }
      }

      const getReplay = (): Replay => {
        const defaultReplay: Replay = {
          recording: false,
          live: false,
          forward: true,
          channelMode: 'AB',
          quadMode: false,
          events: 1,
          eventsA: 1,
          eventsB: 1,
          cameraA: 1,
          cameraB: 1,
          speed: 1,
          speedA: 1,
          speedB: 1,
          timecode: '',
          timecodeA: '',
          timecodeB: '',
        }

        const inputs = lodash.get(parsedData, 'inputs[0].input')

        if (!inputs) {
          return defaultReplay
        }

        let replay = inputs.find((input: any) => {
          return input.$ && input.$.type === 'Replay'
        })

        // Handle no replay input, or partially loaded replay input that has an incomplete object
        if (!replay || !replay.replay) {
          return defaultReplay
        } else {
          replay = replay.replay[0]

          const replayData = {
            recording: replay.$.recording,
            live: replay.$.live,
            forward: this.replay.forward,
            channelMode: replay.$.channelMode ? replay.$.channelMode : 'AB',
            quadMode: this.replay.quadMode,
            events: parseInt(replay.$.events, 10),
            eventsA: replay.$.eventsA ? parseInt(replay.$.eventsA, 10) : 0,
            eventsB: replay.$.eventsB ? parseInt(replay.$.eventsB, 10) : 0,
            cameraA: parseInt(replay.$.cameraA, 10),
            cameraB: parseInt(replay.$.cameraB, 10),
            speed: parseFloat(replay.$.speed),
            speedA: replay.$.speedA ? parseFloat(replay.$.speedA) : 0,
            speedB: replay.$.speedB ? parseFloat(replay.$.speedB) : 0,
            timecode: replay.timecode[0],
            timecodeA: replay.timecodeA ? replay.timecodeA[0] : '',
            timecodeB: replay.timecodeB ? replay.timecodeB[0] : '',
          }

          // Prevent XML data from mirroring camera A to camera B. Activator data will be the more accurate source
          if (replayData.channelMode === 'AB') {
            replayData.cameraB = this.replay.cameraB
          }

          return replayData
        }
      }

      const getDynamics = (dynamicType: 'input' | 'value'): DynamicInput[] | DynamicValue[] => {
        // Dynamic inputs and variables are not supported prior to v24
        if (!parsedData.dynamic) {
          return []
        }

        const values: DynamicInput[] | DynamicValue[] = []

        for (const k in parsedData.dynamic[0]) {
          if (k.startsWith(dynamicType)) {
            values.push({ name: k, value: parsedData.dynamic[0][k][0] })
          }
        }

        return values
      }

      // Data object that will be used to track changes, and then overwrite existing data
      const newData: APIData = {
        version,
        majorVersion,
        edition: parsedData.edition[0] || '',
        preset: parsedData.preset ? parsedData.preset[0] : '',
        inputs: getInputs(),
        outputs: getOutputs(),
        overlays: getOverlays(),
        transitions: getTransitions(),
        mix: [
          getMix(1),
          getMix(2),
          getMix(3),
          getMix(4),
          getMix(5),
          getMix(6),
          getMix(7),
          getMix(8),
          getMix(9),
          getMix(10),
          getMix(11),
          getMix(12),
          getMix(13),
          getMix(14),
          getMix(15),
          getMix(16),
        ],
        audio: getAudio(),
        status: {
          fadeToBlack: parsedData.fadeToBlack[0],
          recording: parsedData.recording[0] === true || parsedData.recording[0]._ === true,
          external: parsedData.external[0],
          streaming: parsedData.streaming[0] === true || parsedData.streaming[0]._ === true,
          stream: [
            parsedData.streaming[0].$?.channel1 ? parsedData.streaming[0].$.channel1 : false,
            parsedData.streaming[0].$?.channel2 ? parsedData.streaming[0].$.channel2 : false,
            parsedData.streaming[0].$?.channel3 ? parsedData.streaming[0].$.channel3 : false,
            parsedData.streaming[0].$?.channel4 ? parsedData.streaming[0].$.channel4 : false,
            parsedData.streaming[0].$?.channel5 ? parsedData.streaming[0].$.channel5 : false,
          ],
          playList: parsedData.playList[0],
          multiCorder: parsedData.multiCorder[0],
          fullscreen: parsedData.fullscreen[0],
        },
        recording: {
          duration: getRecordingDuration(),
          filename1: parsedData.recording[0]?.$?.filename1 || '',
          filename2: parsedData.recording[0]?.$?.filename2 || '',
        },
        replay: getReplay(),
        channelMixer: { ...this.instance.data.channelMixer }, // channelMixer Data is from activators, so previous values must persist through API updates
        dynamicInput: getDynamics('input'),
        dynamicValue: getDynamics('value'),
      }

      // Create temporary Map for newData.inputs lookups (optimization)
      const newInputsMap = new Map<string, Input>()
      const newInputsByNumberMap = new Map<number, Input>()
      newData.inputs.forEach((input) => {
        newInputsMap.set(input.key, input)
        newInputsByNumberMap.set(input.number, input)
      })

      // Update layer tally
      newData.mix.forEach((mix) => {
        const checkTally = (type: 'previewTally' | 'programTally', input: Input) => {
          if (!mix[type].includes(input.key)) {
            mix[type].push(input.key)

            if (input.overlay) {
              input.overlay.forEach((layer) => {
                const layerInput = newInputsMap.get(layer.key)

                if (layerInput) {
                  checkTally(type, layerInput)
                }
              })
            }
          }
        }

        if (mix.preview !== null) {
          const previewInput = newInputsByNumberMap.get(mix.preview)

          if (previewInput) {
            checkTally('previewTally', previewInput)
          }
        }

        if (mix.program !== null) {
          const programInput = newInputsByNumberMap.get(mix.program)

          if (programInput) {
            checkTally('programTally', programInput)
          }
        }

        newData.overlays
          .filter((overlay) => overlay.input !== null)
          .forEach((overlay) => {
            const overlayInput = newInputsByNumberMap.get(overlay.input!)

            if (overlayInput) {
              checkTally(overlay.preview ? 'previewTally' : 'programTally', overlayInput)
            }
          })
      })

      // Update channel mixer
      newData.inputs.forEach((input) => {
        if (!newData.channelMixer[input.key]) {
          newData.channelMixer[input.key] = []
          for (let i = 0; i < 16; i++) {
            newData.channelMixer[input.key].push({ channel: i + 1, volume: 1 })
          }
        }
      })

      const inputKeys = new Set(newData.inputs.map((input) => input.key))

      Object.keys(newData.channelMixer).forEach((key) => {
        if (!inputKeys.has(key)) {
          delete newData.channelMixer[key]
        }
      })

      this.audioLevels = this.audioLevels.filter((level) => level.type === 'bus' || inputKeys.has(level.key))
      this.audioLevelsMap = new Map(this.audioLevels.map((level) => [level.key, level]))

      return newData
    })
  }

  /**0
   * @param newData newly parsed API data
   * @description compare new and old data to check for changes and trigger feedback/variable updates
   */
  private async setData(newData: APIData): Promise<void> {
    const changes: Set<FeedbackId> = new Set()

    // Create temporary Map for newData.inputs lookups (optimization)
    const newInputsMap = new Map<string, Input>()
    const newInputsByNumberMap = new Map<number, Input>()
    newData.inputs.forEach((input) => {
      newInputsMap.set(input.key, input)
      newInputsByNumberMap.set(input.number, input)
    })

    // Check inputs for additions/deletions or change in index order (optimized)
    const inputCheck =
      newData.inputs.length !== this.inputs.length ||
      (newData.inputs.length > 0 && (newData.inputs[0].key !== this.inputs[0]?.key || newData.inputs[newData.inputs.length - 1].key !== this.inputs[this.inputs.length - 1]?.key))

    // Copy any existing Channel Mixer data from activator updates (optimized with Map)
    newData.inputs.forEach((input) => {
      const oldInput = this.inputsMap.get(input.key)
      if (oldInput && oldInput.channelMixer) {
        input.channelMixer = oldInput.channelMixer
      }
    })

    // Add activator data
    newData.audio.forEach((bus) => {
      const oldBus = this.getAudioBus(bus.bus)

      if (oldBus && oldBus.solo) bus.solo = true
    })

    newData.inputs.forEach((newInput) => {
      const oldInput = this.inputsMap.get(newInput.key)

      if (oldInput) {
        newInput.audioAuto = oldInput.audioAuto
      } else {
        const request = [`ACTS InputAudioAuto ${newInput.number}\r\n`]
        for (let i = 1; i < 17; i++) {
          request.push(`ACTS InputVolumeChannelMixer${i} ${newInput.number}\r\n`)
        }

        this.instance.tcp?.updateActivatorData(request.join(''))
      }
    })

    // Check mix 1 to 4
    if (!lodash.isEqual(newData.mix, this.mix) || inputCheck) {
      changes.add('inputPreview')
      changes.add('inputLive')
      changes.add('overlayStatus')
    }

    // Check Outputs
    if (!lodash.isEqual(newData.outputs, this.outputs) || inputCheck) {
      changes.add('outputStatus')
      changes.add('outputNDISRT')
    }

    // Check overlays
    if (!lodash.isEqual(newData.overlays, this.overlays) || inputCheck) {
      changes.add('overlayStatus')
    }

    // Update feedbacks for first load, changes handled by Activators
    if (!this.loaded && (inputCheck || !lodash.isEqual(newData.inputs, this.inputs))) {
      changes.add('inputVolumeLevel')
    }

    // Update feedback if new data differs from previous data
    if (inputCheck || !lodash.isEqual(newData.inputs, this.inputs)) {
      changes.add('videoTimer')
      changes.add('inputAudio')
      changes.add('inputSolo')
      changes.add('inputBusRouting')
      changes.add('liveBusVolume')
      changes.add('liveInputVolume')
      changes.add('inputSelectedIndex')
      changes.add('inputSelectedIndexBoolean')
      changes.add('routableMultiviewLayer')
      changes.add('inputOnMultiview')
      changes.add('inputVolumeMeter')
      changes.add('inputState')
      changes.add('audioPresetActive')
    }

    // Check audio changes
    if (!lodash.isEqual(newData.audio, this.audio) || inputCheck) {
      changes.add('busVolumeMeter')
      changes.add('audioPresetActive')
    }

    // Check Transition changes
    if (!lodash.isEqual(newData.transitions, this.transitions)) {
      changes.add('transition')
    }

    // Check Video Call changes
    newData.inputs
      .filter((input) => input.type === 'VideoCall')
      .forEach((input) => {
        const previousInput = this.inputsMap.get(input.key)

        if (previousInput?.callAudioSource !== input.callAudioSource) {
          changes.add('videoCallAudioSource')
        }

        if (previousInput?.callVideoSource !== input.callVideoSource) {
          changes.add('videoCallVideoSource')
        }
      })

    // Check for status changes
    if (!lodash.isEqual(newData.status, this.status)) {
      changes.add('status')
    }

    // Check Audio status
    if (!lodash.isEqual(newData.audio, this.audio)) {
      changes.add('busMute')
      changes.add('busSendToMaster')
      changes.add('busVolumeLevel')
      changes.add('liveBusVolume')
    }

    // Check Replay
    if (!lodash.isEqual(newData.replay, this.replay)) {
      changes.add('replayStatus')
      changes.add('replayEvents')
      changes.add('replayCamera')
      changes.add('replaySelectedChannel')
    }

    // Dynamic Input / Value
    if (!lodash.isEqual(newData.dynamicInput, this.dynamicInput) || !lodash.isEqual(newData.dynamicValue, this.dynamicValue)) {
      changes.add('dynamic')
    }

    let variablesUpdate = false
    if (this.version !== newData.version || this.majorVersion !== newData.majorVersion || this.edition !== newData.edition || this.preset !== newData.preset) {
      variablesUpdate = true
    }

    // Overwrite old data with new data
    this.version = newData.version
    this.majorVersion = newData.majorVersion
    this.edition = newData.edition
    this.preset = newData.preset
    this.inputs = newData.inputs
    // Update inputsMap for O(1) lookups
    this.inputsMap.clear()
    this.inputsByNumberMap.clear()
    newData.inputs.forEach((input) => {
      this.inputsMap.set(input.key, input)
      this.inputsByNumberMap.set(input.number, input)
    })
    this.outputs = newData.outputs
    this.overlays = newData.overlays
    this.transitions = newData.transitions
    this.mix = newData.mix
    this.audio = newData.audio
    this.status = newData.status
    this.recording = newData.recording
    this.replay = newData.replay
    this.channelMixer = newData.channelMixer
    this.dynamicInput = newData.dynamicInput
    this.dynamicValue = newData.dynamicValue

    this.instance.apiProcessing.feedbacks = new Date().getTime()

    // Trigger updates for changes
    if (changes.size > 0) {
      const changeArray = [...changes]
      this.instance.checkFeedbacks(changeArray[0], ...changeArray.slice(1))
      if (this.instance.variables) this.instance.variables.updateVariables()
    } else if (variablesUpdate) {
      if (this.instance.variables) this.instance.variables.updateVariables()
    } else {
      this.instance.apiProcessing = {
        hold: false,
        holdCount: 0,
        request: 0,
        response: 0,
        parsed: 0,
        feedbacks: 0,
        variables: 0,
      }
    }
  }

  /**
   * @param data vMix XML API string
   * @description parses XML to JSON, updates instance data, triggers updates of feedback and instance variables
   */
  public async update(data: string): Promise<void> {
    return this.parse(data)
      .then(async (newData) => {
        this.instance.apiProcessing.parsed = new Date().getTime()
        await this.setData(newData)

        if (!this.loaded && this.instance.tcp) {
          this.loaded = true
          this.instance.tcp.initActivatorData()
        }
        return
      })
      .catch((err) => {
        log.debug(JSON.stringify(err))
        this.instance.checkFeedbacks('status')
        return
      })
  }
}

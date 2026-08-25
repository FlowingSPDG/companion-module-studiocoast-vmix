import type VMixInstance from '../index.js'
import { type CompanionVariableDefinitions, type JsonValue, createModuleLogger } from '@companion-module/base'
import { type AudioVariablesSchema, audioDefinitions, audioValues } from './audioVariables.js'
import { type DynamicVariablesSchema, dynamicDefinitions, dynamicValues } from './dynamicVariables.js'
import { type GeneralVariablesSchema, generalDefinitions, generalValues } from './generalVariables.js'
import { type InputVariablesSchema, inputDefinitions, inputValues } from './inputVariables.js'
import { type LayerVariablesSchema, layerDefinitions, layerValues } from './layerVariables.js'
import { type MixVariablesSchema, mixDefinitions, mixValues } from './mixVariables.js'
import { type OutputVariablesSchema, outputDefinitions, outputValues } from './outputVariables.js'
import { type OverlayVariablesSchema, overlayDefinitions, overlayValues } from './overlayVariables.js'
import { type ReplayVariablesSchema, replayDefinitions, replayValues } from './replayVariables.js'
import { type TransitionVariablesSchema, transitionDefinitions, transitionValues } from './transitionVariables.js'

export interface InstanceVariableValue {
  [key: string]: string | number | JsonValue | undefined
}

export type VariablesSchema = AudioVariablesSchema &
  DynamicVariablesSchema &
  GeneralVariablesSchema &
  InputVariablesSchema &
  LayerVariablesSchema &
  MixVariablesSchema &
  OutputVariablesSchema &
  OverlayVariablesSchema &
  ReplayVariablesSchema &
  TransitionVariablesSchema

const log = createModuleLogger('Variables')

const variableValuesEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

const definitionsUnchanged = (previous: CompanionVariableDefinitions, next: CompanionVariableDefinitions): boolean => {
  const previousKeys = Object.keys(previous)
  const nextKeys = Object.keys(next)
  if (previousKeys.length !== nextKeys.length) return false

  for (const key of nextKeys) {
    if (previous[key]?.name !== next[key]?.name) return false
  }

  return true
}

export class Variables {
  private readonly instance: VMixInstance
  public currentDefinitions: CompanionVariableDefinitions = {}
  public currentVariables: InstanceVariableValue = {}
  public definitionsUpdateDebounce: ReturnType<typeof setTimeout> | null = null
  public definitionsUpdateNeeded = false
  private definitionsSignature = ''

  constructor(instance: VMixInstance) {
    this.instance = instance
  }

  /**
   * @param variables Object of variable names and their values
   * @description Updates or removes variable for current instance
   */
  public readonly set = (variables: Partial<VariablesSchema>): void => {
    const newVariables: InstanceVariableValue = {}
    const changes: InstanceVariableValue = {}
    let changed = false

    for (const name in variables) {
      const value = variables[name as keyof typeof variables]
      newVariables[name] = value
      if (!variableValuesEqual(this.currentVariables[name], value)) {
        changes[name] = value
        changed = true
      }
    }

    for (const name in this.currentVariables) {
      if (variables[name as keyof typeof variables] === undefined) {
        changes[name] = undefined
        changed = true
      }
    }

    this.currentVariables = newVariables
    if (changed) {
      this.instance.setVariableValues(changes as Partial<VariablesSchema>)
    }

    if (this.instance.apiProcessing.hold) {
      this.instance.apiProcessing.variables = new Date().getTime()
      const duration = this.instance.apiProcessing.variables - this.instance.apiProcessing.request
      const freshStart = new Date().getTime() - this.instance.startTime.getTime() < 5000

      if (duration > this.instance.config.apiPollInterval && !freshStart) {
        if (duration > this.instance.config.apiPollInterval * 3) {
          log.warn(`API Processing took ${duration}ms, but the API Polling Interval is set to ${this.instance.config.apiPollInterval}ms`)
        } else {
          log.debug(`API Processing took ${duration}ms, but the API Polling Interval is set to ${this.instance.config.apiPollInterval}ms`)
        }
      }

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

  private readonly computeDefinitionsSignature = (): string => {
    const c = this.instance.config
    const d = this.instance.data
    const parts: string[] = [
      [
        +c.variablesShowInputs,
        +c.variablesShowInputsLowercase,
        +c.variablesShowInputNumbers,
        +c.variablesShowInputGUID,
        +c.variablesShowInputPosition,
        +c.variablesShowInputCC,
        +c.variablesShowInputLayers,
        +c.variablesShowInputLayerPosition,
        +c.variablesShowInputList,
        +c.variablesShowInputTitleIndex,
        +c.variablesShowInputTitleName,
        +c.variablesShowInputVolume,
        +c.variablesShowInputJSON,
        +c.variablesShowAudio,
        +c.variablesShowDynamicInputs,
        +c.variablesShowDynamicValues,
        +c.variablesShowMix,
        +c.variablesShowOutputs,
        +c.variablesShowOverlays,
        +c.variablesShowReplay,
        +c.variablesShowTransitions,
      ].join(''),
      `mixsel:${this.instance.routingData.mix}`,
      `dyn:${d.dynamicInput.map((item) => item?.value ?? '').join(',')}`,
      `mix:${d.mix.map((mix) => `${mix.number}:${+mix.active}:${mix.preview}:${mix.program}`).join('|')}`,
      `tr:${d.transitions.map((transition) => transition.number).join(',')}`,
      `al:${d.audioLevels.map((level) => level.key).join(',')}`,
    ]

    for (const input of d.inputs) {
      parts.push(
        [
          input.key,
          input.number,
          input.title,
          input.shortTitle ?? '',
          input.type,
          +(input.duration > 1),
          +(input.position !== undefined),
          +(input.volumeF1 !== undefined),
          +(input.volumeF2 !== undefined),
          +(input.meterF1 !== undefined),
          +(input.meterF2 !== undefined),
          input.list?.map((item) => item.index).join('.') ?? '',
          input.text?.map((layer) => `${layer.index}:${layer.name}`).join('.') ?? '',
          input.image?.map((layer) => `${layer.index}:${layer.name}`).join('.') ?? '',
          input.color?.map((layer) => `${layer.index}:${layer.name}`).join('.') ?? '',
        ].join('\x1f'),
      )
    }

    return parts.join('\x1e')
  }

  /**
   * @description Sets variable definitions
   */
  public readonly updateDefinitions = async (): Promise<void> => {
    const signature = this.computeDefinitionsSignature()
    if (signature === this.definitionsSignature && Object.keys(this.currentDefinitions).length > 0) {
      return
    }

    if (this.definitionsUpdateDebounce !== null) {
      this.definitionsUpdateNeeded = true
      return
    }

    this.definitionsUpdateDebounce = setTimeout(() => {
      this.definitionsUpdateDebounce = null
      if (this.definitionsUpdateNeeded) {
        this.definitionsUpdateNeeded = false
        this.updateDefinitions()
      }
    }, this.instance.config.debugVariableDefinitionDelay)

    const variableDefinitions: CompanionVariableDefinitions<VariablesSchema> = {
      ...audioDefinitions(this.instance),
      ...(await dynamicDefinitions(this.instance)),
      ...generalDefinitions(this.instance),
      ...inputDefinitions(this.instance),
      ...layerDefinitions(this.instance),
      ...(await mixDefinitions(this.instance)),
      ...outputDefinitions(this.instance),
      ...overlayDefinitions(this.instance),
      ...replayDefinitions(this.instance),
      ...transitionDefinitions(this.instance),
    }

    if (!definitionsUnchanged(this.currentDefinitions, variableDefinitions)) {
      this.instance.setVariableDefinitions(variableDefinitions)
    }
    this.currentDefinitions = variableDefinitions
    this.definitionsSignature = signature
  }

  /**
   * @description Update variables
   */
  public readonly updateVariables = async (): Promise<void> => {
    const variablesPromise = await Promise.all([
      audioValues(this.instance),
      dynamicValues(this.instance),
      generalValues(this.instance),
      inputValues(this.instance),
      layerValues(this.instance),
      mixValues(this.instance),
      outputValues(this.instance),
      overlayValues(this.instance),
      replayValues(this.instance),
      transitionValues(this.instance),
    ])

    const newVariables: Partial<VariablesSchema> = {}
    for (const variables of variablesPromise) {
      Object.assign(newVariables, variables)
    }

    this.set(newVariables)
    this.updateDefinitions()
  }
}

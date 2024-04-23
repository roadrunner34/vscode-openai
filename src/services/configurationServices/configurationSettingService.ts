import { extensions, version, env, UIKind } from 'vscode'
import CryptoJS from 'crypto-js'
import {
  SecretStorageService,
  StatusBarServiceProvider,
} from '@app/apis/vscode'
import {
  createErrorNotification,
  createInfoNotification,
  waitFor,
} from '@app/apis/node'
import ConfigurationService from './configurationService'
import { IConfigurationSetting, IDynamicLooseObject } from '@app/types'

type ApiHeader = {
  name: string
  value: string
}

class ConfigurationSettingService
  extends ConfigurationService
  implements IConfigurationSetting
{
  private static instance: ConfigurationSettingService | null = null

  static init(): void {
    try {
      ConfigurationSettingService._upgradeV1()
    } catch (error) {
      createErrorNotification(error)
    }
  }

  public static getInstance(): ConfigurationSettingService {
    if (!ConfigurationSettingService.instance) {
      ConfigurationSettingService.instance = new ConfigurationSettingService()
    }
    return ConfigurationSettingService.instance
  }

  static async loadConfigurationService({
    serviceProvider,
    baseUrl,
    defaultModel,
    scmModel,
    embeddingModel,
    azureDeployment,
    scmDeployment,
    embeddingsDeployment,
    azureApiVersion,
  }: {
    serviceProvider: string
    baseUrl: string
    defaultModel: string
    scmModel: string
    embeddingModel: string
    azureDeployment: string
    scmDeployment: string
    embeddingsDeployment: string
    azureApiVersion: string
  }) {
    StatusBarServiceProvider.instance.showStatusBarInformation(
      'vscode-openai',
      'update-setting-configuration'
    )
    if (this.instance) {
      this.instance.serviceProvider = serviceProvider
      this.instance.baseUrl = baseUrl
      this.instance.defaultModel = defaultModel
      this.instance.azureDeployment = azureDeployment
      this.instance.scmModel = scmModel
      this.instance.scmDeployment = scmDeployment
      this.instance.embeddingModel = embeddingModel
      this.instance.embeddingsDeployment = embeddingsDeployment
      this.instance.azureApiVersion = azureApiVersion
      //Force wait as we need the config to be written
      await waitFor(500, () => false)
      StatusBarServiceProvider.instance.showStatusBarInformation(
        'vscode-openai',
        ''
      )
    }
  }

  public get serviceProvider(): string {
    return this.getConfigValue<string>('serviceProvider')
  }
  public set serviceProvider(value: string | undefined) {
    this.setConfigValue<string | undefined>('serviceProvider', value)
  }

  public get baseUrl(): string {
    return this.getConfigValue<string>('baseUrl')
  }
  public set baseUrl(value: string | undefined) {
    this.setConfigValue<string | undefined>('baseUrl', value)
  }

  public get defaultModel(): string {
    return this.getConfigValue<string>('defaultModel')
  }
  public set defaultModel(value: string | undefined) {
    this.setConfigValue<string | undefined>('defaultModel', value)
  }

  public get azureDeployment(): string {
    return this.getConfigValue<string>('azureDeployment')
  }
  public set azureDeployment(value: string | undefined) {
    this.setConfigValue<string | undefined>('azureDeployment', value)
  }

  public get scmModel(): string {
    const model =
      this.getConfigValue<string>('scmModel') ??
      this.getConfigValue<string>('defaultModel')
    return model
  }
  public set scmModel(value: string | undefined) {
    this.setConfigValue<string | undefined>('scmModel', value)
  }

  public get scmDeployment(): string {
    return this.getConfigValue<string>('scmDeployment')
  }
  public set scmDeployment(value: string | undefined) {
    this.setConfigValue<string | undefined>('scmDeployment', value)
  }

  public get embeddingModel(): string {
    return this.getConfigValue<string>('embeddingModel')
  }
  public set embeddingModel(value: string | undefined) {
    this.setConfigValue<string | undefined>('embeddingModel', value)
  }

  public get embeddingsDeployment(): string {
    return this.getConfigValue<string>('embeddingsDeployment')
  }
  public set embeddingsDeployment(value: string | undefined) {
    this.setConfigValue<string | undefined>('embeddingsDeployment', value)
  }

  public get azureApiVersion(): string {
    return this.getConfigValue<string>('azureApiVersion')
  }
  public set azureApiVersion(value: string | undefined) {
    this.setConfigValue<string | undefined>('azureApiVersion', value)
  }

  // host is used for vscode status bar display only
  public get vscodeVersion(): string {
    return version
  }

  public get vscodeUiKind(): string {
    switch (env.uiKind) {
      case UIKind.Desktop:
        return 'desktop'
      case UIKind.Web:
        return 'web'
      default:
        return 'unknown'
    }
  }

  public get vscodeLanguage(): string {
    return env.language
  }

  public get host(): string {
    if (this.serviceProvider === 'VSCode-OpenAI') return 'vscode-openai'
    return new URL(this.baseUrl).host
  }

  public get inferenceUrl(): string {
    if (this.azureDeployment !== 'setup-required') {
      return `${this.baseUrl}/deployments/${this.azureDeployment}`
    }
    return `${this.baseUrl}`
  }

  public get scmUrl(): string {
    if (this.scmDeployment !== 'setup-required') {
      return `${this.baseUrl}/deployments/${this.scmDeployment}`
    }
    return `${this.baseUrl}`
  }

  public get embeddingUrl(): string {
    if (this.azureDeployment !== 'setup-required') {
      return `${this.baseUrl}/deployments/${this.embeddingsDeployment}`
    }
    return `${this.baseUrl}`
  }

  public get apiHeaders(): IDynamicLooseObject {
    const apiHeaders = this.getConfigValue<Array<ApiHeader>>(
      'conversation-configuration.api-headers'
    )
    const headers: IDynamicLooseObject = {}

    apiHeaders.forEach((apiHeader) => {
      headers[apiHeader.name] = apiHeader.value
    })
    return headers
  }

  public async getRequestConfig(): Promise<any> {
    const headers = this.apiHeaders

    if (this.serviceProvider === 'VSCode-OpenAI') {
      const hash = CryptoJS.SHA512(`vscode-openai::${this.extensionVersion}`)
      return { headers: { ...headers, 'vscode-openai': hash } }
    } else if (this.serviceProvider === 'Azure-OpenAI') {
      return {
        headers: {
          ...headers,
          'api-key':
            (await SecretStorageService.instance.getAuthApiKey()) as string,
        },
        params: { 'api-version': this.azureApiVersion },
      }
    } else {
      return {
        headers: {
          ...headers,
        },
      }
    }
  }
  public async getApiKey(): Promise<string> {
    return (await SecretStorageService.instance.getAuthApiKey()) as string
  }

  public get extensionVersion(): string {
    try {
      const extension = extensions.getExtension(
        'AndrewButson.vscode-openai'
      )?.packageJSON
      return extension.version ? extension.version.toString() : 'beta'
    } catch (error) {
      createErrorNotification(error)
    }
    return ''
  }

  public static ResetConfigurationService(): void {
    if (this.instance) {
      this.instance.serviceProvider = undefined
      this.instance.baseUrl = undefined
      this.instance.defaultModel = undefined
      this.instance.azureDeployment = undefined
      this.instance.scmModel = undefined
      this.instance.scmDeployment = undefined
      this.instance.embeddingModel = undefined
      this.instance.embeddingsDeployment = undefined
      this.instance.azureApiVersion = undefined
    }
  }

  public static LogConfigurationService(): void {
    try {
      const cfgMap = new Map<string, string>()
      if (this.instance) {
        cfgMap.set('vscode_version', this.instance.vscodeVersion)
        cfgMap.set('vscode_ui_kind', this.instance.vscodeUiKind)
        cfgMap.set('vscode_language', this.instance.vscodeLanguage)
        cfgMap.set('extension_version', this.instance.extensionVersion)
        cfgMap.set('service_provider', this.instance.serviceProvider)
        cfgMap.set('host', this.instance.host)
        cfgMap.set('base_url', this.instance.baseUrl)
        cfgMap.set('inference_model', this.instance.defaultModel)
        cfgMap.set('inference_deploy', this.instance.azureDeployment)
        cfgMap.set('scm_model', this.instance.scmModel)
        cfgMap.set('scm_deploy', this.instance.scmDeployment)
        cfgMap.set('embeddings_model', this.instance.embeddingModel)
        cfgMap.set('embeddings_deploy', this.instance.embeddingsDeployment)
        cfgMap.set('az_api_version', this.instance.azureApiVersion)
      }

      createInfoNotification(
        Object.fromEntries(cfgMap),
        'setting_configuration'
      )
    } catch (error) {
      createErrorNotification(error)
    }
  }

  private static _upgradeV1() {
    upgradeConfigProperty('prompt-editor.comment', 'editor.code.comment')
    upgradeConfigProperty('prompt-editor.explain', 'editor.code.explain')
    upgradeConfigProperty('prompt-editor.bounty', 'editor.code.bounty')
    upgradeConfigProperty('prompt-editor.optimize', 'editor.code.optimize')
    upgradeConfigProperty('prompt-editor.patterns', 'editor.code.pattern')

    function upgradeConfigProperty(oldProperty: string, newProperty: string) {
      const value =
        ConfigurationSettingService.getInstance().getConfigValue<string>(
          oldProperty
        )
      if (value) {
        // migrate new property
        ConfigurationSettingService.getInstance().setConfigValue(
          newProperty,
          value
        )
        // remove old property
        ConfigurationSettingService.getInstance().setConfigValue(
          oldProperty,
          undefined
        )
      }
    }
  }
}

export default ConfigurationSettingService.getInstance()

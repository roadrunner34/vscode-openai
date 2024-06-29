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
import { IConfigurationSetting, IDynamicLooseObject } from '@app/interfaces'

type ApiHeader = {
  name: string
  value: string
}

class ConfigurationSettingService
  extends ConfigurationService
  implements IConfigurationSetting
{
  private static instance: ConfigurationSettingService | null = null

  private constructor() {
    super()
  }

  public static getInstance(): ConfigurationSettingService {
    if (!ConfigurationSettingService.instance) {
      ConfigurationSettingService.instance = new ConfigurationSettingService()
      ConfigurationSettingService._upgradeV1()
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

  public ResetConfigurationService(): void {
    this.serviceProvider = undefined
    this.baseUrl = undefined
    this.defaultModel = undefined
    this.azureDeployment = undefined
    this.scmModel = undefined
    this.scmDeployment = undefined
    this.embeddingModel = undefined
    this.embeddingsDeployment = undefined
    this.azureApiVersion = undefined
  }

  public LogConfigurationService(): void {
    try {
      const cfgMap = new Map<string, string>()
      cfgMap.set('vscode_version', this.vscodeVersion)
      cfgMap.set('vscode_ui_kind', this.vscodeUiKind)
      cfgMap.set('vscode_language', this.vscodeLanguage)
      cfgMap.set('extension_version', this.extensionVersion)
      cfgMap.set('service_provider', this.serviceProvider)
      cfgMap.set('host', this.host)
      cfgMap.set('base_url', this.baseUrl)
      cfgMap.set('inference_model', this.defaultModel)
      cfgMap.set('inference_deploy', this.azureDeployment)
      cfgMap.set('scm_model', this.scmModel)
      cfgMap.set('scm_deploy', this.scmDeployment)
      cfgMap.set('embeddings_model', this.embeddingModel)
      cfgMap.set('embeddings_deploy', this.embeddingsDeployment)
      cfgMap.set('az_api_version', this.azureApiVersion)

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

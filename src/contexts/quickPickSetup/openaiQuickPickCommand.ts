import {
  ExtensionContext,
  QuickPickItem,
  QuickPickItemKind,
  window,
} from 'vscode'
import {
  quickPickChangeModel,
  quickPickSetupAzureOpenai,
  quickPickSetupCredalOpenai,
  quickPickSetupOpenai,
  quickPickSetupVscodeOpenai,
} from '@app/quickPicks'
import { ICommandOpenai } from '@app/types'
import {
  VSCODE_OPENAI_EXTENSION,
  VSCODE_OPENAI_SERVICE_PROVIDER,
} from '@app/constants/constants'
import { getFeatureFlag } from '@app/utilities/vscode'
import { ConfigurationSettingService } from '@app/services'

export class OpenaiQuickPickCommand implements ICommandOpenai {
  private static instance: OpenaiQuickPickCommand
  private context: ExtensionContext

  constructor(context: ExtensionContext) {
    this.context = context
  }

  public static getInstance(context: ExtensionContext): OpenaiQuickPickCommand {
    if (!OpenaiQuickPickCommand.instance) {
      OpenaiQuickPickCommand.instance = new OpenaiQuickPickCommand(context)
    }
    return OpenaiQuickPickCommand.instance
  }

  public async execute(): Promise<void> {
    const openAiServiceType = BuildOpenAiServiceTypes()
    const selectedProvider = await this.showQuickPick(openAiServiceType)

    switch (selectedProvider.label) {
      case VSCODE_OPENAI_SERVICE_PROVIDER.VSCODE_OPENAI:
        quickPickSetupVscodeOpenai(this.context)
        break

      case VSCODE_OPENAI_SERVICE_PROVIDER.OPENAI:
        quickPickSetupOpenai(this.context)
        break

      case VSCODE_OPENAI_SERVICE_PROVIDER.AZURE_OPENAI:
        quickPickSetupAzureOpenai(this.context)
        break

      case VSCODE_OPENAI_SERVICE_PROVIDER.CREDAL:
        quickPickSetupCredalOpenai(this.context)
        break

      case VSCODE_OPENAI_SERVICE_PROVIDER.CHANGE_MODEL:
        quickPickChangeModel(this.context)
        break

      default:
        break
    }
  }

  private async showQuickPick(items: QuickPickItem[]): Promise<QuickPickItem> {
    return new Promise((resolve) => {
      const quickPick = window.createQuickPick()
      quickPick.items = items
      quickPick.onDidChangeSelection((selection) => {
        if (selection[0]) {
          resolve(selection[0])
          quickPick.dispose()
        }
      })
      quickPick.onDidHide(() => quickPick.dispose())
      quickPick.title = 'Register OpenAI Service Provider'
      quickPick.show()
    })
  }
}

function BuildOpenAiServiceTypes(): QuickPickItem[] {
  const quickPickItemTypes: QuickPickItem[] = [
    {
      label: 'Service Provider',
      kind: QuickPickItemKind.Separator,
    },
    {
      label: VSCODE_OPENAI_SERVICE_PROVIDER.VSCODE_OPENAI,
      description: '(Sponsored) Use vscode-openai service',
    },
    {
      label: VSCODE_OPENAI_SERVICE_PROVIDER.OPENAI,
      description: '(BYOK) Use your own OpenAI subscription (api.openai.com)',
    },
    {
      label: VSCODE_OPENAI_SERVICE_PROVIDER.AZURE_OPENAI,
      description:
        '(BYOK) Use your own Azure OpenAI instance (instance.openai.azure.com)',
    },
    {
      label: VSCODE_OPENAI_SERVICE_PROVIDER.CREDAL,
      description: '(BYOK) Use your own Credal instance (credal.ai)',
    },
  ]

  const isValidKey = getFeatureFlag(VSCODE_OPENAI_EXTENSION.ENABLED_COMMAND_ID)
  const validSP: string[] = ['OpenAI', 'Azure-OpenAI']
  const allowed = validSP.includes(
    ConfigurationSettingService.instance.serviceProvider
  )
  let quickPickModelSelecter: QuickPickItem[] = []
  if (isValidKey && allowed) {
    quickPickModelSelecter = [
      {
        label: 'Models',
        kind: QuickPickItemKind.Separator,
      },
      {
        label: VSCODE_OPENAI_SERVICE_PROVIDER.CHANGE_MODEL,
        description: 'change chat and embedding model',
        alwaysShow: false,
      },
    ]
  }

  return [...quickPickItemTypes, ...quickPickModelSelecter]
}

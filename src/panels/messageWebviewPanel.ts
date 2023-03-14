import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
  ColorThemeKind,
} from 'vscode'
import { getUri } from '../vscode-utils/webviewServices/getUri'
import { getNonce } from '../vscode-utils/webviewServices/getNonce'
import { IChatMessage } from '../interfaces/IChatMessage'
import { IConversation } from '../interfaces/IConversation'
import { completionComments } from '../openai-utils/api/completionComments'

export class ChatMessageViewerPanel {
  public static currentPanel: ChatMessageViewerPanel | undefined
  private readonly _panel: WebviewPanel
  private _disposables: Disposable[] = []
  private readonly _extensionUri: Uri

  /**
   * The ChatMessageViewerPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri) {
    this._panel = panel
    this._extensionUri = extensionUri

    this._setPanelIcon()

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri
    )

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview)
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, conversation: IConversation) {
    //Check that we have a valid object
    const activeFilename = `Prompt Engineer (OpenAI)`

    if (ChatMessageViewerPanel.currentPanel) {
      ChatMessageViewerPanel.currentPanel._panel.dispose()
    }
    // If a webview panel does not already exist create and show a new one
    const panel = window.createWebviewPanel(
      'showPreviewClaimset',
      activeFilename,
      ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [Uri.joinPath(extensionUri, 'out')],
      }
    )
    ChatMessageViewerPanel.currentPanel = new ChatMessageViewerPanel(
      panel,
      extensionUri
    )
    ChatMessageViewerPanel.currentPanel?._panel.webview.postMessage({
      command: 'loadChatThreads',
      text: JSON.stringify(conversation.chatMessages),
    })
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    ChatMessageViewerPanel.currentPanel = undefined

    // Dispose of the current webview panel
    this._panel.dispose()

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop()
      if (disposable) {
        disposable.dispose()
      }
    }
  }

  private _setPanelIcon() {
    const iconPathOnDisk = Uri.joinPath(
      this._extensionUri,
      'assets',
      'openai-webview.png'
    )
    this._panel.iconPath = iconPathOnDisk
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the React webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    const scriptUri = getUri(webview, extensionUri, [
      'out',
      'webview-ui',
      'messageWebview',
      'index.js',
    ])

    const panelTheme = {
      [ColorThemeKind.Light]: 'light',
      [ColorThemeKind.Dark]: 'dark',
      [ColorThemeKind.HighContrast]: 'dark',
      [ColorThemeKind.HighContrastLight]: 'light',
    }[window.activeColorTheme.kind]

    const nonce = getNonce()

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * 'self' data: https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
          <title>Claimset</title>
        </head>
        <body style="margin:0;padding:0">
          <div id="root" theme='${panelTheme}' />
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   *
   * Event Model:
   *    | source  	| target  	 | command						   | model  	      |
   *    |-----------|------------|-----------------------|----------------|
   *    | extension | webview		 | loadChatThreads  		 | IChatMessage[] |
   *    | webview		| extension  | saveChatThread				 | IChatMessage[] |
   *    | extension | webview		 | newChatThreadAnswer	 | IChatMessage   |
   *    | webview		| extension  | newChatThreadQuestion | IChatMessage   |
   *
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'newChatThreadQuestion':
            completionComments(message.text).then((result) => {
              // eslint-disable-next-line no-case-declarations
              const chatThread: IChatMessage = {
                content: result,
                author: 'Prompt Engineer (OpenAI)',
                timestamp: Date().toLocaleString(),
                mine: false,
              }

              ChatMessageViewerPanel.currentPanel?._panel.webview.postMessage({
                command: 'newChatThreadAnswer',
                text: JSON.stringify(chatThread),
              })
            })

            return

          case 'saveChatThread':
            // eslint-disable-next-line no-case-declarations
            const chatMessages: IChatMessage[] = JSON.parse(message.text)
            console.log(`saveChatThread: ${chatMessages.length}`)
            return

          default:
            window.showErrorMessage(message.command)
            return
        }
      },
      null,
      this._disposables
    )
  }
}

import { window } from 'vscode'
import { EmbeddingTreeDataProvider, EmbeddingTreeItem } from '@app/providers'
import { Command } from '@app/commands'
import { EmbeddingStorageService } from '@app/services'

export default class RefreshCommand implements Command {
  public readonly id = '_vscode-openai.embeddings.delete.resource'
  public constructor(private _instance: EmbeddingTreeDataProvider) {}

  public async execute(nodes: EmbeddingTreeItem[]) {
    if (!nodes || nodes.length === 0) return

    const message = nodes.length === 1 
      ? 'Are you sure you want to delete this embedding?' 
      : `Are you sure you want to delete these ${nodes.length} embeddings?`

    window
      .showInformationMessage(message, 'Yes', 'No')
      .then((answer) => {
        if (answer === 'Yes') {
          nodes.forEach(node => {
            EmbeddingStorageService.instance.delete(node.embeddingId)
          })
          this._instance.refresh()
        }
      })
  }
}

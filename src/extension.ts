// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import { TextEncoder } from 'util';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerCodeActionsProvider('typescript', new DTO(), { providedCodeActionKinds: DTO.providedCodeActionKinds }));
}

// This method is called when your extension is deactivated
export function deactivate() { }

export class DTO implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		const activeTab = vscode.window.activeTextEditor;
		if (!activeTab) { return []; }
		const uri = activeTab.document.uri;
		const massFix = this.createMassFix(document, vscode.languages.getDiagnostics(uri));
		const singleFix = this.createFix(document, context.diagnostics);
		return [massFix, singleFix].filter(a => a !== null) as vscode.CodeAction[];
	}
	private createFix(document: vscode.TextDocument, diagnostics: readonly vscode.Diagnostic[]): vscode.CodeAction | null {
		const filtered = diagnostics.filter(d => (d.code === 2304 || d.code === 2552) && document.getText(d.range).match(/.*Dto/)).map(d => document.getText(d.range));
		let action: vscode.CodeAction;
		if (filtered.length === 0) { return null; }
		const { className, fileName, dtoPath, fileContent } = this.generateDtoMeta(filtered[0]);
		action = new vscode.CodeAction(`Create DTO for ${filtered[0]}`, vscode.CodeActionKind.QuickFix);
		action.edit = new vscode.WorkspaceEdit();
		action.edit.createFile(vscode.Uri.file(dtoPath), { ignoreIfExists: false, contents: new TextEncoder().encode(fileContent) });
		action.edit.insert(vscode.window.activeTextEditor!.document.uri, new vscode.Position(0, 0), `import { ${className} } from './dto/${fileName}';\n`);
		return action;
	}
	private createMassFix(document: vscode.TextDocument, diagnostics: readonly vscode.Diagnostic[]): vscode.CodeAction | null {
		const filtered = diagnostics.filter(d => (d.code === 2304 || d.code === 2552) && document.getText(d.range).match(/.*Dto/)).map(d => document.getText(d.range));
		if (filtered.length === 0) { return null; }
		const action = new vscode.CodeAction(`Create DTO for all missing items`, vscode.CodeActionKind.QuickFix);
		action.edit = new vscode.WorkspaceEdit();
		filtered.forEach(query => {
			const { className, fileName, dtoPath, fileContent } = this.generateDtoMeta(query);
			action.edit!.createFile(vscode.Uri.file(dtoPath), { ignoreIfExists: false, contents: new TextEncoder().encode(fileContent) });
			action.edit!.insert(vscode.window.activeTextEditor!.document.uri, new vscode.Position(0, 0), `import { ${className} } from './dto/${fileName}';\n`);
		});
		return action;
	}
	private generateDtoMeta(query: string): { className: string, fileName: string, dtoPath: string, fileContent: string } {
		const camelParts = query.replace(/Dto$/, '').replace(/([A-Z])([a-z])/g, ' $1$2').trim().split(' ');
		const className = camelParts.join('') + 'Dto';
		const fileName = camelParts.map(p => p.toLowerCase()).join('-') + '.dto';
		const dtoPath = path.join(path.dirname(vscode.window.activeTextEditor!.document.uri.fsPath), 'dto', fileName + '.ts');
		const fileContent = `export class ${className} {}`;
		return { className, fileName, dtoPath, fileContent };
	}


}
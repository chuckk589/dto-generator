// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import { TextEncoder } from 'util';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerCodeActionsProvider('typescript', new DTO(), { providedCodeActionKinds: DTO.providedCodeActionKinds }));
	context.subscriptions.push(vscode.commands.registerCommand('extension.doThing', async (uri: vscode.Uri, rest: vscode.Uri[]) => {
		let text = "import { PartialType } from '@nestjs/mapped-types';\nimport { IsString, IsNumber, IsBoolean, IsDate, IsArray, IsObject } from 'class-validator';\n";
		for (const uri of rest) {
			text += await handleFile(uri);
		}
		//create new file
		const activeTab = vscode.window.activeTextEditor;
		if (!activeTab) { return; }
		const dtoPath = path.join(path.dirname(uri.fsPath), 'summary.dto.ts');
		console.log(dtoPath);
		const fileUri = vscode.Uri.file(dtoPath);
		const wsedit = new vscode.WorkspaceEdit();
		wsedit.createFile(fileUri, { ignoreIfExists: false, contents: new TextEncoder().encode(text) });
		vscode.workspace.applyEdit(wsedit);

	}));
}

async function handleFile(uri: vscode.Uri) {
	const doc = await vscode.workspace.openTextDocument(uri);
	let text = doc.getText();
	const properties = text.matchAll(/@Property\((.*)\)\n(.*)[!\?]?:(.*);/g);
	const className = text.match(/export class (\w+)/)?.[1];
	//iterate over properties
	let classContent = '';
	for (const property of properties) {
		const optionalType = property[1].match(/columnType: '(.*)'/)?.[1];
		const name = property[2].replace(/!?/g, '').trim();
		const type = property[3].split('=')[0].trim();
		if (name === 'id') { continue; }
		let decorator = '';
		switch (type) {
			case 'string':
				decorator = '\t@IsString()\n\t';
				break;
			case 'number':
				decorator = '\t@IsNumberString()\n\t';
				break;
			case 'boolean':
				decorator = '\t@IsBooleanString()\n\t';
				break;
			case 'Date':
				decorator = '\t@IsDateString()\n\t';
				break;
			case 'Array':
				decorator = '\t@IsArray()\n\t';
				break;
			case 'Object':
				decorator = '\t@IsObject()\n\t';
				break;
			default:
				decorator = '\t@IsString()\n\t';
				break;
		}
		if (optionalType === 'jsonb') {
			decorator = '\t@IsString()//TODO: json type support\n\t';
		}
		classContent += `${decorator}${name}: ${type};\n\n`;
	}
	return `export class Create${className}Dto {\n${classContent}}\nexport class Update${className}Dto extends PartialType(Create${className}Dto) {}\n`;
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
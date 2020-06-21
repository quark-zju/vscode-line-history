import * as vscode from 'vscode';
import * as state from './state';
import * as editor from './editor';

let activate = (context: vscode.ExtensionContext) => {
	state.setContextPath(context.globalStoragePath);
	let config = vscode.workspace.getConfiguration("lineHistory");
	state.setImportGit(config.get("importFromGit", true));
	editor.initialize(context);
};

let deactivate = () => {
	state.clear();
};

export { activate, deactivate };

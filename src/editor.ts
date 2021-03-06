// VSCode Editor integration.
// - LinelogProvider renders "linelog:" URIs.
// - TextDecoration is used to render timestamps and marked lines as deleted.
// - Register a few commands that changes parameters of "linelog:" URIs to
//   trigger various features like checking out older versions, showing deleted
//   lines, etc.

import * as vscode from 'vscode';
import { rename, save, getLineLogPath, getLineLogForPath, getLineLogForFile, setImportGit, recreateLineLog, normalizeText } from './state';
import { URLSearchParams } from 'url';
import { displayTime } from './dateutil';
import { git } from 'linelog';

const kLinelogScheme = "linelog";

class LinelogProvider implements vscode.TextDocumentContentProvider {
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		let log = await getLineLogForPath(uri.path);
		let params = new URLSearchParams(uri.query);
		let rev = parseInt(params.get("rev") || log.maxRev.toString());
		let start = params.has("start") ? parseInt(params.get("start") || "0") : null;
		log.checkOut(0);
		log.checkOut(rev, start);
		let content = log.content;
		if (start !== null) {
			// Special case - include deleted lines.
			content = "";
			for (let i = 0; i < log.lines.length - 1; ++i) {
				let line = log.lines[i].data;
				if (line.endsWith("\n")) {
					content += line;
				} else {
					content += line + "\n";
				}
			}
			log.checkOut(0);
		};
		return content;
	}
}

let renderDecorations = async (editor: vscode.TextEditor | undefined, decorationTypes: DecorationTypes) => {
	if (!editor) {
		return;
	}
	let document = editor.document;
	let fileName = document.fileName;
	let scheme = document.uri.scheme;
	if (scheme !== "file" && scheme !== kLinelogScheme && scheme !== "untitled") {
		return;
	}

	// Draw timestamps.
	let decorations = [];
	let deletedDecorations = [];
	let config = vscode.workspace.getConfiguration("lineHistory");
	if (scheme === kLinelogScheme || config.get("showLineTimestamp") !== false) {
		let log = await getLineLogForFile(document);
		let params = new URLSearchParams(document.uri.query);
		let rev = parseInt(params.get("rev") || log.maxRev.toString());
		let start = params.has("start") ? parseInt(params.get("start") || "0") : null;
		if (scheme === kLinelogScheme) {
			// Force recalculate.
			log.checkOut(0);
		}
		log.checkOut(rev, start);

		let newest = log.getLineTimestamp(0);
		let oldestNonGit = newest;
		let oldestGit = newest;
		for (let line = 0; line < log.lines.length - 1; ++line) {
			let ts = log.getLineTimestamp(line);
			let info = log.getLineExtra(line);
			if (ts > newest) { newest = ts; }
			if ("commit" in info) {
				if (ts < oldestGit) { oldestGit = ts; }
			} else {
				if (ts < oldestNonGit) { oldestNonGit = ts; }
			}
		}

		let now = Date.now();
		let color = new vscode.ThemeColor("textPreformat.foreground");
		let lastTs = 0;
		for (let line = 0; line < log.lines.length - 1; ++line) {
			let ts = log.getLineTimestamp(line);
			let info = log.getLineExtra(line) as git.CommitPathInfo;
			let oldest = info.commit ? oldestGit : oldestNonGit;
			let secondsRange = newest - oldest;
			let opacity = Math.min((ts - oldest) / secondsRange, 1);
			let range = new vscode.Range(
				new vscode.Position(line, 0),
				new vscode.Position(line, 0)
			);
			let message = lastTs === ts ? "" : displayTime(ts, now);
			lastTs = ts;
			let backgroundRgb = info.commit ? "136,138,133" : "246,106,10";
			let backgroundColor: string | vscode.ThemeColor = `rgba(${backgroundRgb},${Math.round(opacity * 10) / 10.0})`;
			let hoverMessage = new vscode.MarkdownString();
			if (info.commit) {
				hoverMessage.appendText(`${info.commit.author.split(" <")[0]} · ${displayTime(ts, now)}`);
				hoverMessage.appendCodeblock(info.commit.message, "plain");
			} else {
				hoverMessage.appendText(new Date(ts).toString());
			}
			let deleted = log.lines[line].deleted;
			if (deleted) {
				hoverMessage.appendText(" (deleted)");
				deletedDecorations.push({ range });
			}
			if (scheme === kLinelogScheme) {
				let params = new URLSearchParams(document.uri.query);
				let rev = log.lines[line].rev.toString();
				if (info.commit) {
					rev += ` (${info.commit.commit.substr(0, 7)})`;
				}
				params.set("rev", rev);
				let uri = document.uri.with({ query: params.toString() });
				hoverMessage.appendMarkdown(`\n\n[Check out Rev ${rev}](${uri})`);
			}
			let renderOptions: vscode.DecorationInstanceRenderOptions = {
				before: {
					contentText: `\u00a0\u00a0${message}`,
					color,
					width: '20ch',
					backgroundColor,
					margin: '0px 1ch 0px 0px',
				},
			};
			decorations.push({
				hoverMessage,
				range,
				renderOptions,
			});
		}

		if (scheme === kLinelogScheme) {
			editor.setDecorations(decorationTypes.deletedLineDecorationType, deletedDecorations);
			// Force a recalculate.
			log.checkOut(0);
		}
	}
	editor.setDecorations(decorationTypes.timestampDecorationType, decorations);
};

interface DecorationTypes {
	timestampDecorationType: vscode.TextEditorDecorationType;
	deletedLineDecorationType: vscode.TextEditorDecorationType;
}

let reopenEditParams = async (scheme: string, editParams: (editor: vscode.TextEditor, params: URLSearchParams) => Promise<void>) => {
	let editor = vscode.window.activeTextEditor;
	if (!editor) { return; }
	let { document } = editor;
	if (scheme.indexOf(document.uri.scheme) < 0) { return; }
	let log = getLineLogForFile(document);
	let query = document.uri.query;
	let params = new URLSearchParams(query);
	await editParams(editor, params);
	query = params.toString();
	let uri = document.uri.with({ query, scheme: kLinelogScheme, path: document.fileName });
	await vscode.window.showTextDocument(uri, { preview: true });
};

let initialize = (context: vscode.ExtensionContext) => {
	// LinelogProvider knows how to handle "linelog:" URI.
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(kLinelogScheme, new LinelogProvider));

	// Register commands.
	context.subscriptions.push(vscode.commands.registerCommand('lineHistory.lineTimestamp', async () => {
		await reopenEditParams("file,untitled", async ({ document }, params) => {
			let log = await getLineLogForFile(document);
			params.set("rev", log.maxRev.toString());
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('lineHistory.toggleDeletedLines', async () => {
		await reopenEditParams(kLinelogScheme, async (editor, params) => {
			if (params.get("start") === null) {
				params.set("start", "0");
			} else {
				params.delete("start");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('lineHistory.rebuildHistory', async () => {
		await reopenEditParams(kLinelogScheme, async ({ document }, params) => {
			recreateLineLog(document);
			let log = await getLineLogForFile(document);
			let epoch = params.get("epoch") || "0";
			params.set("epoch", (parseInt(epoch) + 1).toString());
			params.set("rev", log.maxRev.toString());
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('lineHistory.previousRev', async () => {
		await reopenEditParams(kLinelogScheme, async ({ document }, params) => {
			let rev = parseInt(params.get("rev") || "0");
			params.set("rev", Math.max(rev - 1, 1).toString());
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('lineHistory.nextRev', async () => {
		await reopenEditParams(kLinelogScheme, async ({ document }, params) => {
			let log = await getLineLogForFile(document);
			let rev = parseInt(params.get("rev") || "0");
			params.set("rev", Math.min(rev + 1, log.maxRev).toString());
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('lineHistory.currentLineRev', async () => {
		await reopenEditParams(kLinelogScheme, async (editor, params) => {
			let document = editor.document;
			let line = editor.selection.active.line;
			let log = await getLineLogForFile(document);
			let rev = parseInt(params.get("rev") || "0");
			let start = params.has("start") ? parseInt(params.get("start") || "0") : null;
			log.checkOut(rev, start);
			if (line < log.lines.length - 1) {
				let rev = log.lines[line].rev;
				params.set("rev", rev.toString());
			}
		});
	}));

	// Text decorations.
	let timestampDecorationType = vscode.window.createTextEditorDecorationType({
		isWholeLine: true,
	});
	let deletedLineDecorationType = vscode.window.createTextEditorDecorationType({
		isWholeLine: true,
		backgroundColor: new vscode.ThemeColor("editorGutter.deletedBackground"),
	});
	let decorations: DecorationTypes = {
		timestampDecorationType,
		deletedLineDecorationType,
	};

	// Handle config changes.
	vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration("lineHistory.showLineTimestamp")) {
			renderDecorations(vscode.window.activeTextEditor, decorations);
		}
		if (e.affectsConfiguration("lineHistory.importFromGit")) {
			let config = vscode.workspace.getConfiguration("lineHistory");
			setImportGit(config.get("importFromGit", true));
		}
	});

	// Handle editor switches.
	vscode.window.onDidChangeActiveTextEditor((e) => {
		renderDecorations(vscode.window.activeTextEditor, decorations);
	});

	// Monitor content changes.
	let recordDocument = async (document: vscode.TextDocument) => {
		let scheme = document.uri.scheme;
		if (scheme !== "file" && scheme !== "untitled") {
			return;
		}
		let log = await getLineLogForFile(document);
		log.checkOut(log.maxRev);
		let text = normalizeText(document.getText());
		log.recordText(text);
	};
	vscode.workspace.onDidOpenTextDocument((document) => {
		recordDocument(document);
		renderDecorations(vscode.window.activeTextEditor, decorations);
	});
	vscode.workspace.onDidChangeTextDocument((change) => {
		recordDocument(change.document);
		renderDecorations(vscode.window.activeTextEditor, decorations);
	});
	vscode.workspace.onDidSaveTextDocument(async (document) => {
		let activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document.isUntitled) {
			if (document.getText() === activeEditor.document.getText()) {
				// document.uri: file URI (saved).
				// activeEditor.document.uri: untitled URI.
				//
				// Assuming it's saving "activeEditor" content.
				// Do a rename to preserve the history.
				rename(activeEditor.document.uri, document.uri);
			}
		}
		let log = await getLineLogForFile(document);
		let path = getLineLogPath(document.fileName);
		save(path, log);
	});
	vscode.workspace.onDidRenameFiles((e) => {
		e.files.forEach(({ oldUri, newUri }) => {
			rename(oldUri, newUri);
		});
	});
};

export { initialize };

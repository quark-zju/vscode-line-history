// State tracking line changes. The main structure is LineLog.

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { basename, dirname, join, relative as relativePath } from 'path';
import { existsSync, readFileSync, writeFileSync, fstat, unlinkSync } from 'fs';
import { LineLog, git } from 'linelog';
import * as mkdirp from 'mkdirp';

let dir: null | string = null;
let config = { importGit: false };
let linelogMap: { [fileName: string]: LineLog } = {};

let load = async (path: string, filePath: string): Promise<LineLog> => {
	if (existsSync(path)) {
		let log = new LineLog;
		log.import(readFileSync(path));
		return log;
	} else if (config.importGit) {
		let root = findGitRoot(filePath);
		if (root) {
			let relative = relativePath(root, filePath);
			if (relative.indexOf("..") < 0) {
				try {
					let log = await git.buildLineLogFromGitHistory(root, relative);
					return log;
				} catch {
					return new LineLog;
				}
			}
		}
	}
	return new LineLog;
};

let findGitRoot = (path: string): string | null => {
	let current = path;
	while (true) {
		if (existsSync(current + "/.git")) {
			return current;
		} else {
			let newPath = dirname(current);
			if (newPath === current) {
				return null;
			}
			current = newPath;
		}
	}
};

let save = (path: string, log: LineLog) => {
	mkdirp.sync(dirname(path));
	let bytes = log.export();
	writeFileSync(path, bytes);
};

let getLineLogPath = (fileName: string): string => {
	let hash = crypto.createHash('sha256');
	hash.update(fileName);
	let hashed = hash.digest("hex");
	assert(dir !== null, "setContextPath needs to be called first");
	let linelogPath = join(dir, "linelog", hashed.slice(0, 2), hashed.slice(2, 4), `${hashed.slice(4, 14)}-${basename(fileName)}.blob`);
	return linelogPath;
};

let getLineLogForPath = async (fileName: string): Promise<LineLog> => {
	if (!(fileName in linelogMap)) {
		let path = getLineLogPath(fileName);
		let log = await load(path, fileName);
		linelogMap[fileName] = log;
		return log;
	} else {
		let log = linelogMap[fileName];
		return log;
	}
};
let getLineLogForFile = async (document: vscode.TextDocument): Promise<LineLog> => {
	let fileName = document.fileName;
	if (!(fileName in linelogMap)) {
		let path = getLineLogPath(fileName);
		let log = await load(path, fileName);
		linelogMap[fileName] = log;
		log.checkOut(log.maxRev);
		log.recordText(normalizeText(document.getText()));
		return log;
	} else {
		let log = linelogMap[fileName];
		return log;
	}
};
let recreateLineLog = (document: vscode.TextDocument) => {
	let fileName = document.fileName;
	let path = getLineLogPath(fileName);
	try { unlinkSync(path); } catch { }
	delete linelogMap[fileName];
};

let setContextPath = (path: string) => {
	dir = path;
};

let setImportGit = (importGit: boolean) => {
	config.importGit = importGit;
};

let clear = () => {
	linelogMap = {};
};

let rename = (oldUri: vscode.Uri, newUri: vscode.Uri) => {
	if ((oldUri.scheme === "file" || oldUri.scheme === "untitled") && newUri.scheme === "file") {
		let newLineLogPath = getLineLogPath(newUri.fsPath);
		if (oldUri.fsPath in linelogMap && newUri.fsPath !== oldUri.fsPath && !existsSync(newLineLogPath)) {
			linelogMap[newUri.fsPath] = linelogMap[oldUri.fsPath];
			delete linelogMap[oldUri.fsPath];
		}
	}
};

let normalizeText = (text: string): string => {
	// CRLF -> LF.
	if (text.indexOf("\r") >= 0) {
		text = text.replace(/\r\n/g, "\n");
	}
	// Use LF at EOF.
	if (!text.endsWith("\n")) {
		text += "\n";
	}
	return text;
};

export {
	clear,
	rename,
	load,
	save,
	getLineLogPath,
	getLineLogForFile,
	getLineLogForPath,
	normalizeText,
	recreateLineLog,
	setContextPath,
	setImportGit,
};

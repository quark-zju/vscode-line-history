// State tracking line changes. The main structure is LineLog.

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { basename, dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { LineLog } from 'linelog';
import * as mkdirp from 'mkdirp';

let dir: null | string = null;
let linelogMap: { [fileName: string]: LineLog } = {};

let load = (path: string): LineLog => {
	let log = new LineLog;
	if (existsSync(path)) {
		log.import(readFileSync(path));
	}
	return log;
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

let getLineLogForPath = (fileName: string): LineLog => {
	if (!(fileName in linelogMap)) {
		let path = getLineLogPath(fileName);
		let log = load(path);
		linelogMap[fileName] = log;
		return log;
	} else {
		let log = linelogMap[fileName];
		return log;
	}
};
let getLineLogForFile = (document: vscode.TextDocument): LineLog => {
	let fileName = document.fileName;
	if (!(fileName in linelogMap)) {
		let path = getLineLogPath(fileName);
		let log = load(path);
		linelogMap[fileName] = log;
		log.checkOut(log.maxRev);
		log.recordText(document.getText());
		return log;
	} else {
		let log = linelogMap[fileName];
		return log;
	}
};

let setContextPath = (path: string) => {
	dir = path;
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

export { clear, rename, load, save, getLineLogPath, getLineLogForFile, getLineLogForPath, setContextPath };

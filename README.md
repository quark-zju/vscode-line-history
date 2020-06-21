# vscode-line-history

Track uncommitted line changes as you type.

## Features

Annotate lines with timestamps in real time. Think about `git blame`, but without explicit `git add` or `git commit`.

![Line Timestamp](https://github.com/quark-zju/vscode-line-history/raw/c5baec9d78243ed5269a013e748eec19cca1f7e2/images/line-timestamp.png)

View previous versions ever typed. Think about fine grained undo history that persists across VSCode restarts, and with `blame` integrated.

![Previous Version](https://github.com/quark-zju/vscode-line-history/raw/c5baec9d78243ed5269a013e748eec19cca1f7e2/images/previous-version.png)

Show all (including deleted) lines in a single view. Think about `git diff` but instead of comparing two versions, compare all versions together.

![All Lines](https://github.com/quark-zju/vscode-line-history/raw/c5baec9d78243ed5269a013e748eec19cca1f7e2/images/all-lines.png)

Import initial file history from Git.

![Git History](https://github.com/quark-zju/vscode-line-history/raw/c5baec9d78243ed5269a013e748eec19cca1f7e2/images/git-history.png)

## Usage

Enabling the extension will make it track changes to local files made by the VSCode text editor. When a file get saved, its tracked changes will be written to the extension [`globalStoragePath`](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext) specified by VSCode.

Press `Ctrl+K L`, or right-click the tab title then click "Show Line History" to enter the "Line History" view.

In the "Line History" view: Press `[` or `]` to check out previous, or next versions. Press `d` to toggle deleted lines. Those features can also be found as buttons at the right of the tab bar. Press `enter` to check out the version specified by the selected line.

## Settings

This extension contributes the following settings:

* `lineHistory.showLineTimestamp`: Enable/disable line timestamp in normal editors. Turning this on might affect performance.
* `lineHistory.importFromGit`: Whether to import history from Git on first access to a file.

## Release Notes

### 0.2.0

- Import history from Git (optionally).

### 0.1.0

- Initial Release.

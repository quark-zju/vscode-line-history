# vscode-line-history

Track uncommitted line changes as you type.

## Features

Annotate lines with timestamps in real time. Think about `git blame`, but without explicit `git add` or `git commit`.

![Line Timestamp](https://github.com/quark-zju/vscode-line-history/raw/e26319070a3a23ef3740b98a229b8287953f4442/images/line-timestamp.png)

View previous versions ever typed. Think about fine grained undo history that persists across VSCode restarts, and with `blame` integrated.

![Previous Version](https://github.com/quark-zju/vscode-line-history/raw/e26319070a3a23ef3740b98a229b8287953f4442/images/previous-version.png)

Show all (including deleted) lines in a single view. Think about `git diff` but instead of comparing two versions, compare all versions together.

![All Lines](https://github.com/quark-zju/vscode-line-history/raw/e26319070a3a23ef3740b98a229b8287953f4442/images/all-lines.png)

## Usage

Enabling the extension will make it track changes to local files made by the VSCode text editor. When a file get saved, its tracked changes will be written to the extension [`globalStoragePath`](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext) specified by VSCode.

Press `Ctrl+K L`, or right-click the tab title then click "Show Line History" to enter the "Line History" view.

In the "Line History" view: Press `[` or `]` to move to previous, or next versions. Press `d` to toggle deleted lines. Those features can also be found as buttons at the right of the tab bar. Press `enter` to move to the version of the selected line.

## Settings

This extension contributes the following settings:

* `lineHistory.showLineTimestamp`: enable/disable line timestamp in normal editors. Turning this on might affect performance.

## Release Notes

### 0.1.0

- Initial Release.

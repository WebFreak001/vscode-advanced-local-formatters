import { spawn } from 'child_process';

import * as vscode from 'vscode';

import { Config, FormatterConfig } from './types';
import path = require('path');

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Advanced Local Formatters');
  let disposables: readonly vscode.Disposable[] = [];

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration('advancedLocalFormatters')) return;
    disposables.forEach((d) => d.dispose());
    disposables = registerFormatters(getFormatterConfigs(), outputChannel);
  });

  disposables = registerFormatters(getFormatterConfigs(), outputChannel);
}

const getFormatterConfigs = () => {
  const config = vscode.workspace.getConfiguration('advancedLocalFormatters');
  return config.get<Config['formatters']>('formatters', []);
};

const registerFormatters = (
  formatters: readonly FormatterConfig[],
  outputChannel: vscode.OutputChannel,
): readonly vscode.Disposable[] => {
  return formatters
    .map((formatter) => {
      if (formatter.disabled) return;

      if (!formatter.languages) {
        vscode.window.showErrorMessage("Custom formatter does not have any languages defined");
        return;
      }

      let commandTemplate: string[];
      if (Array.isArray(formatter.command)) {
        commandTemplate = formatter.command;
      } else {
        let platformCommand = formatter.command[process.platform];
        if (!platformCommand)
          platformCommand = formatter.command["*"];
        commandTemplate = platformCommand;
      }

      if (!commandTemplate) {
        vscode.window.showWarningMessage("Not registering custom formatter for languages "
          + JSON.stringify(formatter.languages) + ", because no command is specified for this platform");
        return;
      }

      return vscode.languages.registerDocumentRangeFormattingEditProvider(formatter.languages, {
        provideDocumentRangeFormattingEdits(document, range, options) {
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
          const backupFolder = vscode.workspace.workspaceFolders?.[0];
          let cwd = workspaceFolder?.uri?.fsPath || backupFolder?.uri.fsPath;
          if (formatter.cwd)
            cwd = cwd ? path.resolve(cwd, formatter.cwd) : formatter.cwd;

          let command = commandTemplate
            .map(function (arg: string): string {
              switch (arg) {
                case "$absoluteFilePath": return document.fileName;
                case "$relativeFilePath": return cwd ? path.relative(cwd, document.fileName) : document.fileName;
                case "$insertSpaces": return options.insertSpaces ? "true" : "false";
                case "$tabSize": return options.tabSize + "";
                default: return arg;
              }
            });

          return new Promise<vscode.TextEdit[]>((resolve, reject) => {
            outputChannel.appendLine(`Starting formatter: ${JSON.stringify(command)}`);
            const originalDocumentText = document.getText();
            let newText = "";

            function makeEdits(): vscode.TextEdit[] {
              return diff(document, newText).filter(a => range.intersection(a.range));
            }

            const process = spawn(command[0], command.slice(1), { cwd });
            process.stdout.on('data', (data) => {
              newText += data;
            });
            process.stderr.on('data', (data) => {
              outputChannel.append(data);
            });
            process.on('close', (code) => {
              if (code !== 0)
                reject("Formatter failed with code " + code + ", see output tab for more details");
              else
                resolve(makeEdits());
            });
            process.on('error', (err) => {
              reject("Failed starting formatter: " + err);
            });

            process.stdin.write(originalDocumentText);
            process.stdin.end();
          });
        },
      });
    })
    .filter((v) => v != null) as vscode.Disposable[];
};

// this method is called when your extension is deactivated
export function deactivate() { }

// taken from https://github.com/Pure-D/serve-d/blob/ac0b6c3201cb2ba6fcaa7b3301214c5475f025c4/source/served/commands/format.d#L195
function diff(document: vscode.TextDocument, after: string): vscode.TextEdit[] {
  function isWhite(c: string) {
    return c.length === 1 && (c[0] === ' ' || (c.charCodeAt(0) >= 0x09 && c.charCodeAt(0) <= 0x0D));
  }

  let before = document.getText();
  let i = 0;
  let j = 0;
  let result: vscode.TextEdit[] = [];

  let startIndex = 0;
  let stopIndex = 0;
  let text = "";

  function pushTextEdit(): boolean {
    if (startIndex !== stopIndex || text.length > 0) {
      let startPosition = document.positionAt(startIndex);
      let stopPosition = document.positionAt(stopIndex);
      result.push({
        newText: text,
        range: new vscode.Range(startPosition, stopPosition)
      });
      return true;
    }

    return false;
  }

  while (i < before.length || j < after.length) {
    let newI = i;
    let newJ = j;
    let beforeChar = '';
    let afterChar = '';

    if (newI < before.length) {
      beforeChar = before.charAt(newI);
      newI += beforeChar.length;
    }

    if (newJ < after.length) {
      afterChar = after.charAt(newJ);
      newJ += afterChar.length;
    }

    if (i < before.length && j < after.length && beforeChar === afterChar) {
      i = newI;
      j = newJ;

      if (pushTextEdit()) {
        startIndex = stopIndex;
        text = "";
      }
    }

    if (startIndex === stopIndex) {
      startIndex = i;
      stopIndex = i;
    }

    let addition = !isWhite(beforeChar) && isWhite(afterChar);
    const deletion = isWhite(beforeChar) && !isWhite(afterChar);

    if (!addition && !deletion) {
      addition = before.length - i < after.length - j;
    }

    if (addition && j < after.length) {
      text += after.substring(j, newJ);
      j = newJ;
    }
    else if (i < before.length) {
      stopIndex = newI;
      i = newI;
    }
  }

  pushTextEdit();
  return result;
}

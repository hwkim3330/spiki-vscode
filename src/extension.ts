import * as vscode from 'vscode';
import { SpikiViewProvider } from './SpikiViewProvider';

let spikiProvider: SpikiViewProvider;
let statusBarItem: vscode.StatusBarItem;
let typingTimer: NodeJS.Timeout | undefined;
let saveCount = 0;

export function activate(context: vscode.ExtensionContext) {
    console.log('Spiki is waking up! 🐾');

    // Webview Provider 등록
    spikiProvider = new SpikiViewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('spiki.panel', spikiProvider)
    );

    // 상태바 아이템
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'spiki.show';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 명령어 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('spiki.show', () => {
            vscode.commands.executeCommand('spiki.panel.focus');
        }),
        vscode.commands.registerCommand('spiki.feed', () => {
            spikiProvider.sendMessage({ type: 'action', action: 'feed' });
        }),
        vscode.commands.registerCommand('spiki.play', () => {
            spikiProvider.sendMessage({ type: 'action', action: 'play' });
        }),
        vscode.commands.registerCommand('spiki.pet', () => {
            spikiProvider.sendMessage({ type: 'action', action: 'pet' });
        })
    );

    // 코딩 활동 감지
    const config = vscode.workspace.getConfiguration('spiki');

    // 타이핑 감지
    vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0 && config.get('autoFeed')) {
            handleTyping();
        }
    });

    // 파일 저장 감지
    vscode.workspace.onDidSaveTextDocument(() => {
        if (config.get('autoFeed')) {
            saveCount++;
            if (saveCount >= 3) {
                spikiProvider.sendMessage({ type: 'reward', reason: 'save', amount: 5 });
                saveCount = 0;
            }
        }
    });

    // 디버그 시작 감지
    vscode.debug.onDidStartDebugSession(() => {
        spikiProvider.sendMessage({ type: 'reward', reason: 'debug', amount: 10 });
    });

    // 터미널 명령 실행 감지
    vscode.window.onDidOpenTerminal(() => {
        spikiProvider.sendMessage({ type: 'event', event: 'terminal' });
    });

    // 스피키 상태 업데이트 수신
    spikiProvider.onStateUpdate((state) => {
        updateStatusBar(state);
    });

    // 30분마다 스탯 감소
    setInterval(() => {
        spikiProvider.sendMessage({ type: 'tick' });
    }, 30000);
}

function handleTyping() {
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(() => {
        spikiProvider.sendMessage({ type: 'reward', reason: 'typing', amount: 1 });
    }, 2000);
}

function updateStatusBar(state?: { happiness: number; hunger: number; energy: number; level: number }) {
    const happiness = state?.happiness ?? 100;
    const level = state?.level ?? 1;

    let emoji = '😊';
    if (happiness < 30) emoji = '😢';
    else if (happiness < 60) emoji = '😐';
    else if (happiness > 80) emoji = '😄';

    statusBarItem.text = `$(heart) Spiki ${emoji} Lv.${level}`;
    statusBarItem.tooltip = state
        ? `행복: ${Math.round(happiness)}% | 포만감: ${Math.round(state.hunger)}% | 에너지: ${Math.round(state.energy)}%`
        : 'Click to see Spiki!';
}

export function deactivate() {
    console.log('Spiki is sleeping... 💤');
}

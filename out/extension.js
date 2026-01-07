"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const SpikiViewProvider_1 = require("./SpikiViewProvider");
let spikiProvider;
let statusBarItem;
let typingTimer;
let saveCount = 0;
function activate(context) {
    console.log('Spiki is waking up! 🐾');
    // Webview Provider 등록
    spikiProvider = new SpikiViewProvider_1.SpikiViewProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('spiki.panel', spikiProvider));
    // 상태바 아이템
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'spiki.show';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // 명령어 등록
    context.subscriptions.push(vscode.commands.registerCommand('spiki.show', () => {
        vscode.commands.executeCommand('spiki.panel.focus');
    }), vscode.commands.registerCommand('spiki.feed', () => {
        spikiProvider.sendMessage({ type: 'action', action: 'feed' });
    }), vscode.commands.registerCommand('spiki.play', () => {
        spikiProvider.sendMessage({ type: 'action', action: 'play' });
    }), vscode.commands.registerCommand('spiki.pet', () => {
        spikiProvider.sendMessage({ type: 'action', action: 'pet' });
    }));
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
function updateStatusBar(state) {
    const happiness = state?.happiness ?? 100;
    const level = state?.level ?? 1;
    let emoji = '😊';
    if (happiness < 30)
        emoji = '😢';
    else if (happiness < 60)
        emoji = '😐';
    else if (happiness > 80)
        emoji = '😄';
    statusBarItem.text = `$(heart) Spiki ${emoji} Lv.${level}`;
    statusBarItem.tooltip = state
        ? `행복: ${Math.round(happiness)}% | 포만감: ${Math.round(state.hunger)}% | 에너지: ${Math.round(state.energy)}%`
        : 'Click to see Spiki!';
}
function deactivate() {
    console.log('Spiki is sleeping... 💤');
}
//# sourceMappingURL=extension.js.map
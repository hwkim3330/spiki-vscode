import * as vscode from 'vscode';

export class SpikiViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'spiki.panel';

    private _view?: vscode.WebviewView;
    private _stateCallback?: (state: any) => void;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 메시지 수신
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.type) {
                case 'stateUpdate':
                    this._stateCallback?.(message.state);
                    // 상태 저장
                    this._context.globalState.update('spikiState', message.state);
                    break;
                case 'notification':
                    vscode.window.showInformationMessage(`🐾 ${message.text}`);
                    break;
                case 'speech':
                    // 스피키가 말할 때
                    break;
            }
        });

        // 저장된 상태 로드
        const savedState = this._context.globalState.get('spikiState');
        if (savedState) {
            setTimeout(() => {
                this.sendMessage({ type: 'loadState', state: savedState });
            }, 500);
        }
    }

    public sendMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    public onStateUpdate(callback: (state: any) => void) {
        this._stateCallback = callback;
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );

        // 이미지 URI 생성
        const getImageUri = (name: string) =>
            webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'images', name));

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Spiki</title>
</head>
<body>
    <div class="container">
        <div class="stats">
            <div class="stat">
                <span class="stat-label">행복</span>
                <div class="stat-bar"><div class="stat-fill happiness" id="happiness-bar"></div></div>
                <span class="stat-value" id="happiness-value">100</span>
            </div>
            <div class="stat">
                <span class="stat-label">포만</span>
                <div class="stat-bar"><div class="stat-fill hunger" id="hunger-bar"></div></div>
                <span class="stat-value" id="hunger-value">100</span>
            </div>
            <div class="stat">
                <span class="stat-label">에너지</span>
                <div class="stat-bar"><div class="stat-fill energy" id="energy-bar"></div></div>
                <span class="stat-value" id="energy-value">100</span>
            </div>
        </div>

        <div class="level-bar">
            <span class="level-badge">Lv.<span id="level">1</span></span>
            <span class="spiki-count">x<span id="spiki-count">1</span></span>
            <div class="exp-track"><div class="exp-fill" id="exp-bar"></div></div>
            <span class="exp-text"><span id="exp">0</span>/<span id="exp-max">100</span></span>
        </div>

        <div class="character-area">
            <div class="speech-bubble" id="speech">
                <span id="speech-text"></span>
            </div>
            <div class="effects" id="effects"></div>
        </div>

        <div class="actions">
            <button class="action-btn" id="feed-btn" title="밥주기">🍰</button>
            <button class="action-btn" id="play-btn" title="놀아주기">🎮</button>
            <button class="action-btn" id="pet-btn" title="쓰다듬기">💕</button>
            <button class="action-btn" id="sleep-btn" title="재우기">💤</button>
            <button class="action-btn multiply-btn" id="multiply-btn" title="증식!">🥚</button>
        </div>

        <div class="coding-tip" id="coding-tip">
            코딩하면 스피키가 행복해져요! 💻
        </div>
    </div>

    <script nonce="${nonce}">
        const imageBase = "${getImageUri('')}";
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

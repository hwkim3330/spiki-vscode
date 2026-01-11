import * as vscode from 'vscode';
import { SpikiViewProvider } from './SpikiViewProvider';

let spikiProvider: SpikiViewProvider;
let statusBarItem: vscode.StatusBarItem;
let typingTimer: NodeJS.Timeout | undefined;
let saveCount = 0;

// 코딩 통계
interface CodingStats {
    sessionStart: number;
    totalLines: number;
    totalSaves: number;
    totalErrors: number;
    totalCommits: number;
    streak: number;  // 연속 코딩 일수
    lastCodingDate: string;
    todayLines: number;
    todaySaves: number;
}

let codingStats: CodingStats = {
    sessionStart: Date.now(),
    totalLines: 0,
    totalSaves: 0,
    totalErrors: 0,
    totalCommits: 0,
    streak: 0,
    lastCodingDate: '',
    todayLines: 0,
    todaySaves: 0,
};

// 휴식 알림
let lastBreakReminder = Date.now();
let continuousCodingMinutes = 0;
let breakReminderTimer: NodeJS.Timeout | undefined;

// 에디터 스피키들 (여러 마리가 에디터에서 돌아다님)
interface EditorSpiki {
    id: string;
    line: number;
    character: number;
    imageIndex: number;
    decoration: vscode.TextEditorDecorationType;
}

let editorSpikis: EditorSpiki[] = [];
let editorSpikiTimer: NodeJS.Timeout | undefined;
let editorSpikiEnabled = true;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    console.log('Spiki is waking up! 🐾');
    extensionContext = context;

    // 저장된 통계 로드
    loadCodingStats(context);
    updateStreak();

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
        }),
        vscode.commands.registerCommand('spiki.toggleEditorSpiki', () => {
            editorSpikiEnabled = !editorSpikiEnabled;
            if (editorSpikiEnabled) {
                startEditorSpikis();
                vscode.window.showInformationMessage('🐾 스피키가 에디터에 나타났어요!');
            } else {
                stopEditorSpikis();
                vscode.window.showInformationMessage('🐾 스피키가 에디터에서 숨었어요!');
            }
        }),
        vscode.commands.registerCommand('spiki.addEditorSpiki', () => {
            if (editorSpikiEnabled) {
                addEditorSpiki();
                vscode.window.showInformationMessage('🐾 에디터에 스피키 추가!');
            }
        }),
        vscode.commands.registerCommand('spiki.showStats', () => {
            showCodingStats();
        })
    );

    // 코딩 활동 감지
    const config = vscode.workspace.getConfiguration('spiki');

    // 타이핑 감지
    vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0 && config.get('autoFeed')) {
            handleTyping();

            // 라인 수 통계
            const addedLines = e.contentChanges.reduce((sum, change) => {
                return sum + (change.text.match(/\n/g) || []).length;
            }, 0);
            if (addedLines > 0) {
                codingStats.totalLines += addedLines;
                codingStats.todayLines += addedLines;

                // 100줄마다 칭찬
                if (codingStats.todayLines % 100 === 0) {
                    const msg = `🎉 오늘 ${codingStats.todayLines}줄 작성! 스피키가 기뻐해요!`;
                    vscode.window.showInformationMessage(msg);
                    spikiProvider.sendMessage({ type: 'speech', text: '대단해요! 열심히 하고 있네요!' });
                }
            }

            // 타이핑하면 스피키들 반응
            if (editorSpikiEnabled && Math.random() < 0.15) {
                moveAllEditorSpikis();
            }
        }
    });

    // 파일 저장 감지
    vscode.workspace.onDidSaveTextDocument(() => {
        codingStats.totalSaves++;
        codingStats.todaySaves++;
        saveCodingStats(context);

        if (config.get('autoFeed')) {
            saveCount++;
            if (saveCount >= 3) {
                spikiProvider.sendMessage({ type: 'reward', reason: 'save', amount: 5 });
                saveCount = 0;
                // 저장하면 스피키 추가 확률
                if (editorSpikiEnabled && Math.random() < 0.2) {
                    addEditorSpiki();
                }
            }
        }

        // 10번 저장마다 격려
        if (codingStats.todaySaves % 10 === 0) {
            spikiProvider.sendMessage({ type: 'speech', text: '저장 완료! 꾸준히 하고 있네요~' });
        }
    });

    // 에러 감지 (진단 변경)
    vscode.languages.onDidChangeDiagnostics((e) => {
        e.uris.forEach(uri => {
            const diagnostics = vscode.languages.getDiagnostics(uri);
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

            if (errors.length > 0 && Math.random() < 0.3) {
                codingStats.totalErrors++;
                const encouragements = [
                    '괜찮아요, 버그는 성장의 기회예요!',
                    '에러 발견! 같이 해결해봐요~',
                    '실수는 누구나 해요, 힘내세요!',
                    '디버깅 타임! 할 수 있어요!',
                ];
                const msg = encouragements[Math.floor(Math.random() * encouragements.length)];
                spikiProvider.sendMessage({ type: 'speech', text: msg });
            }
        });
    });

    // 디버그 시작 감지
    vscode.debug.onDidStartDebugSession(() => {
        spikiProvider.sendMessage({ type: 'reward', reason: 'debug', amount: 10 });
        spikiProvider.sendMessage({ type: 'speech', text: '디버깅 시작! 버그를 잡아봐요!' });
        // 디버그하면 스피키들 놀람
        if (editorSpikiEnabled) {
            moveAllEditorSpikis();
        }
    });

    // 디버그 종료 감지
    vscode.debug.onDidTerminateDebugSession(() => {
        spikiProvider.sendMessage({ type: 'speech', text: '디버깅 끝! 수고했어요~' });
    });

    // 터미널 명령 실행 감지
    vscode.window.onDidOpenTerminal(() => {
        spikiProvider.sendMessage({ type: 'event', event: 'terminal' });
    });

    // Git 커밋 감지 (소스 컨트롤 변경)
    vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.scheme === 'git') {
            codingStats.totalCommits++;
            spikiProvider.sendMessage({ type: 'speech', text: '커밋 완료! 잘하고 있어요!' });
            spikiProvider.sendMessage({ type: 'reward', reason: 'commit', amount: 15 });
        }
    });

    // 휴식 알림 타이머
    breakReminderTimer = setInterval(() => {
        continuousCodingMinutes++;

        // 50분마다 휴식 알림
        if (continuousCodingMinutes >= 50) {
            const breakMessages = [
                '🧘 50분 코딩했어요! 잠깐 스트레칭 어때요?',
                '☕ 열심히 했네요! 물 한 잔 마시고 와요~',
                '👀 눈이 피곤하지 않아요? 잠깐 쉬어가요!',
                '🚶 잠깐 걸으면서 환기해요!',
            ];
            const msg = breakMessages[Math.floor(Math.random() * breakMessages.length)];
            vscode.window.showInformationMessage(msg);
            spikiProvider.sendMessage({ type: 'speech', text: '쉬엄쉬엄 해요~' });
            continuousCodingMinutes = 0;
        }
    }, 60000); // 1분마다 체크

    // 에디터 변경 감지
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editorSpikiEnabled) {
            updateAllEditorSpikis();
        }
    });

    // 스피키 상태 업데이트 수신
    spikiProvider.onStateUpdate((state) => {
        updateStatusBar(state);
    });

    // 30초마다 스탯 감소
    setInterval(() => {
        spikiProvider.sendMessage({ type: 'tick' });
    }, 30000);

    // 에디터 스피키 시작
    if (editorSpikiEnabled) {
        startEditorSpikis();
    }
}

function getRandomSpikiImage(): vscode.Uri {
    const imageIndex = Math.floor(Math.random() * 15) + 1;
    return vscode.Uri.joinPath(extensionContext.extensionUri, 'media', 'images', `spiki${imageIndex}.png`);
}

function createSpikiDecoration(imageUri: vscode.Uri): vscode.TextEditorDecorationType {
    // gutter에만 표시 (코드에는 안 나옴)
    return vscode.window.createTextEditorDecorationType({
        gutterIconPath: imageUri,
        gutterIconSize: 'contain',
    });
}

function addEditorSpiki() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const lineCount = document.lineCount;
    if (lineCount === 0) return;

    // 랜덤 위치
    const line = Math.floor(Math.random() * Math.min(lineCount, 100));
    const lineText = document.lineAt(line).text;
    const character = Math.min(lineText.length, Math.floor(Math.random() * 50));

    const imageIndex = Math.floor(Math.random() * 15) + 1;
    const imageUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'media', 'images', `spiki${imageIndex}.png`);

    const decoration = createSpikiDecoration(imageUri);

    const spiki: EditorSpiki = {
        id: 'spiki_' + Date.now() + '_' + Math.random(),
        line,
        character,
        imageIndex,
        decoration,
    };

    editorSpikis.push(spiki);
    updateEditorSpiki(spiki, editor);
}

function moveEditorSpiki(spiki: EditorSpiki) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const lineCount = document.lineCount;
    if (lineCount === 0) return;

    // 새 위치로 이동 (점프하듯이)
    const newLine = Math.floor(Math.random() * Math.min(lineCount, 100));
    const lineText = document.lineAt(newLine).text;
    const newChar = Math.min(lineText.length, Math.floor(Math.random() * 50));

    spiki.line = newLine;
    spiki.character = newChar;

    // 표정 변경
    spiki.imageIndex = Math.floor(Math.random() * 15) + 1;
    const imageUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'media', 'images', `spiki${spiki.imageIndex}.png`);

    // 기존 데코레이션 제거하고 새로 생성
    spiki.decoration.dispose();
    spiki.decoration = createSpikiDecoration(imageUri);

    updateEditorSpiki(spiki, editor);
}

function updateEditorSpiki(spiki: EditorSpiki, editor: vscode.TextEditor) {
    const lineCount = editor.document.lineCount;
    if (lineCount === 0) return;

    const line = Math.min(spiki.line, lineCount - 1);
    const lineText = editor.document.lineAt(line).text;
    const char = Math.min(spiki.character, lineText.length);

    const range = new vscode.Range(
        new vscode.Position(line, char),
        new vscode.Position(line, char)
    );

    editor.setDecorations(spiki.decoration, [{ range }]);
}

function updateAllEditorSpikis() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    editorSpikis.forEach(spiki => {
        updateEditorSpiki(spiki, editor);
    });
}

function moveAllEditorSpikis() {
    editorSpikis.forEach(spiki => {
        if (Math.random() < 0.5) {
            moveEditorSpiki(spiki);
        }
    });
}

function startEditorSpikis() {
    // 초기 스피키 몇 마리 추가
    for (let i = 0; i < 3; i++) {
        setTimeout(() => addEditorSpiki(), i * 500);
    }

    // 주기적으로 이동
    editorSpikiTimer = setInterval(() => {
        // 랜덤하게 이동
        editorSpikis.forEach(spiki => {
            if (Math.random() < 0.3) {
                moveEditorSpiki(spiki);
            }
        });

        // 가끔 새 스피키 추가 (최대 20마리)
        if (editorSpikis.length < 20 && Math.random() < 0.1) {
            addEditorSpiki();
        }
    }, 3000 + Math.random() * 2000);
}

function stopEditorSpikis() {
    if (editorSpikiTimer) {
        clearInterval(editorSpikiTimer);
        editorSpikiTimer = undefined;
    }

    // 모든 데코레이션 제거
    editorSpikis.forEach(spiki => {
        spiki.decoration.dispose();
    });
    editorSpikis = [];
}

function handleTyping() {
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
    typingTimer = setTimeout(() => {
        spikiProvider.sendMessage({ type: 'reward', reason: 'typing', amount: 1 });
    }, 2000);
}

function updateStatusBar(state?: { happiness: number; hunger: number; energy: number; level: number; spikiCount?: number }) {
    const happiness = state?.happiness ?? 100;
    const level = state?.level ?? 1;
    const count = state?.spikiCount ?? 1;

    let emoji = '😊';
    if (happiness < 30) emoji = '😢';
    else if (happiness < 60) emoji = '😐';
    else if (happiness > 80) emoji = '😄';

    const editorCount = editorSpikis.length;
    const totalCount = count + editorCount;

    statusBarItem.text = `$(heart) Spiki ${emoji} Lv.${level} x${totalCount}`;
    statusBarItem.tooltip = state
        ? `행복: ${Math.round(happiness)}% | 포만감: ${Math.round(state.hunger)}% | 에너지: ${Math.round(state.energy)}%\n패널: ${count}마리 | 에디터: ${editorCount}마리`
        : 'Click to see Spiki!';
}

export function deactivate() {
    stopEditorSpikis();
    if (breakReminderTimer) {
        clearInterval(breakReminderTimer);
    }
    saveCodingStats(extensionContext);
    console.log('Spiki is sleeping... 💤');
}

// 통계 관련 함수들
function loadCodingStats(context: vscode.ExtensionContext) {
    const saved = context.globalState.get<CodingStats>('codingStats');
    if (saved) {
        codingStats = { ...codingStats, ...saved };
    }
    // 오늘 날짜 확인해서 일일 통계 리셋
    const today = new Date().toDateString();
    if (codingStats.lastCodingDate !== today) {
        codingStats.todayLines = 0;
        codingStats.todaySaves = 0;
        codingStats.lastCodingDate = today;
    }
    codingStats.sessionStart = Date.now();
}

function saveCodingStats(context: vscode.ExtensionContext) {
    codingStats.lastCodingDate = new Date().toDateString();
    context.globalState.update('codingStats', codingStats);
}

function updateStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (codingStats.lastCodingDate === yesterday) {
        codingStats.streak++;
    } else if (codingStats.lastCodingDate !== today) {
        codingStats.streak = 1;
    }

    // 스트릭 축하
    if (codingStats.streak > 1 && codingStats.lastCodingDate !== today) {
        setTimeout(() => {
            vscode.window.showInformationMessage(`🔥 ${codingStats.streak}일 연속 코딩 중! 대단해요!`);
            spikiProvider.sendMessage({ type: 'speech', text: `${codingStats.streak}일 연속! 최고예요!` });
        }, 3000);
    }
}

function showCodingStats() {
    const sessionMinutes = Math.floor((Date.now() - codingStats.sessionStart) / 60000);
    const sessionHours = Math.floor(sessionMinutes / 60);
    const sessionMins = sessionMinutes % 60;

    const message = `📊 Spiki 코딩 통계

🔥 연속 코딩: ${codingStats.streak}일

📝 오늘:
   • 작성한 줄: ${codingStats.todayLines}줄
   • 저장 횟수: ${codingStats.todaySaves}회
   • 이번 세션: ${sessionHours}시간 ${sessionMins}분

📈 전체:
   • 총 작성 줄: ${codingStats.totalLines}줄
   • 총 저장 횟수: ${codingStats.totalSaves}회
   • 발견한 에러: ${codingStats.totalErrors}개

스피키와 함께 화이팅! 💪`;

    vscode.window.showInformationMessage(message, { modal: true });
}

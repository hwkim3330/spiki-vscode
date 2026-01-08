// @ts-check

(function() {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // 상수
    const EXPRESSIONS = {
        idle: [1, 2, 3, 4],
        happy: [10, 12, 13],
        surprised: [6, 11],
        worried: [7, 8, 9],
        angry: [5],
        sleepy: [14, 15],
    };

    const SPEECH = {
        feed: ['냠냠~ 맛있어요!', '배불러요~', '최고!'],
        play: ['신나요!', '재밌어요!', '좋아요!'],
        pet: ['기분 좋아요~', '헤헤~', '좋아요!'],
        sleep: ['잘 자요~', 'Zzz...'],
        wake: ['좋은 아침!', '안녕!'],
        coding: ['열심히 하네요!', '화이팅!', '코딩 좋아요!', '멋져요!'],
        save: ['저장 완료!', '잘하고 있어요!'],
        debug: ['디버깅이다!', '버그 잡자!'],
        hungry: ['배고파요...'],
        tired: ['졸려요...'],
        sad: ['놀아주세요...'],
        tap: ['에?', '뭐예요?', '헤헤~'],
        multiply: ['친구다!', '우와~', '반가워!', '같이 놀자!'],
        wander: ['어디 갈까~', '산책 좋아!', '여기 뭐지?'],
    };

    const NAMES = ['스피키', '피키', '스삐', '키키', '삐삐', '코코', '모모', '뽀뽀', '두두', '루루'];

    // 오디오
    const SOUNDS = {};
    const SOUND_FILES = ['happy', 'happy2', 'tap', 'spiki', 'sad', 'surprise', 'dont', 'drag', 'play', 'tired'];
    let soundEnabled = true;

    function initAudio() {
        try {
            SOUND_FILES.forEach(name => {
                SOUNDS[name] = new Audio(`${audioBase}${name}.wav`);
                SOUNDS[name].volume = 0.5;
            });
        } catch (e) {
            console.log('Audio init failed:', e);
        }
    }

    function playSound(name) {
        if (!soundEnabled) return;
        try {
            const sound = SOUNDS[name];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(() => {});
            }
        } catch (e) {}
    }

    function playRandomSound(names) {
        playSound(pick(names));
    }

    // 상태
    let state = {
        stats: { happiness: 100, hunger: 100, energy: 100 },
        level: 1,
        exp: 0,
        expMax: 100,
        sleeping: false,
        animating: false,
    };

    // 스피키 배열 (여러 마리)
    let spikis = [];
    let mainSpikiId = null;

    // DOM
    const characterArea = document.querySelector('.character-area');
    const speech = document.getElementById('speech');
    const speechText = document.getElementById('speech-text');
    const effects = document.getElementById('effects');
    const codingTip = document.getElementById('coding-tip');

    const bars = {
        happiness: document.getElementById('happiness-bar'),
        hunger: document.getElementById('hunger-bar'),
        energy: document.getElementById('energy-bar'),
    };
    const values = {
        happiness: document.getElementById('happiness-value'),
        hunger: document.getElementById('hunger-value'),
        energy: document.getElementById('energy-value'),
    };

    const levelEl = document.getElementById('level');
    const expBar = document.getElementById('exp-bar');
    const expEl = document.getElementById('exp');
    const expMaxEl = document.getElementById('exp-max');
    const spikiCountEl = document.getElementById('spiki-count');

    // 스피키 클래스
    class Spiki {
        constructor(id, isMain = false) {
            this.id = id;
            this.isMain = isMain;
            this.name = isMain ? '스피키' : pick(NAMES);
            this.x = 50;
            this.y = 50;
            this.targetX = 50;
            this.targetY = 50;
            this.expression = pick(EXPRESSIONS.idle);
            this.size = isMain ? 1 : 0.5 + Math.random() * 0.3;
            this.speed = 0.5 + Math.random() * 1;
            this.wanderTimer = null;
            this.element = null;
            this.imgElement = null;
            this.sleeping = false;
            this.direction = 1; // 1: right, -1: left
            this.dragging = false;
            this.dragStart = { x: 0, y: 0 };
            this.dragOffset = { x: 0, y: 0 };
            this.lastTap = 0;

            this.createElement();
            this.startWandering();
        }

        createElement() {
            // 컨테이너
            this.element = document.createElement('div');
            this.element.className = 'spiki-creature' + (this.isMain ? ' main-spiki' : ' mini-spiki');
            this.element.style.left = this.x + '%';
            this.element.style.top = this.y + '%';
            this.element.style.transform = `translate(-50%, -50%) scale(${this.size})`;

            // 이미지
            this.imgElement = document.createElement('img');
            this.imgElement.src = `${imageBase}spiki${this.expression}.png`;
            this.imgElement.alt = this.name;
            this.imgElement.draggable = false;

            // 이름표 (미니 스피키만)
            if (!this.isMain) {
                const nameTag = document.createElement('div');
                nameTag.className = 'spiki-name';
                nameTag.textContent = this.name;
                this.element.appendChild(nameTag);
            }

            this.element.appendChild(this.imgElement);

            // 드래그 & 클릭 이벤트
            this.element.addEventListener('mousedown', (e) => this.onDragStart(e));
            this.element.addEventListener('touchstart', (e) => this.onDragStart(e), { passive: false });

            document.addEventListener('mousemove', (e) => this.onDragMove(e));
            document.addEventListener('touchmove', (e) => this.onDragMove(e), { passive: false });

            document.addEventListener('mouseup', (e) => this.onDragEnd(e));
            document.addEventListener('touchend', (e) => this.onDragEnd(e));

            characterArea?.appendChild(this.element);

            // 등장 애니메이션
            this.element.style.opacity = '0';
            this.element.style.transform = `translate(-50%, -50%) scale(0)`;
            setTimeout(() => {
                this.element.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                this.element.style.opacity = '1';
                this.element.style.transform = `translate(-50%, -50%) scale(${this.size})`;
            }, 50);
        }

        startWandering() {
            const wander = () => {
                if (this.sleeping) return;

                // 새 목표 위치 설정
                this.targetX = 15 + Math.random() * 70;
                this.targetY = 30 + Math.random() * 40;

                // 방향 결정
                if (this.targetX > this.x) {
                    this.direction = 1;
                } else {
                    this.direction = -1;
                }

                // 다음 이동 예약
                const nextWander = 3000 + Math.random() * 5000;
                this.wanderTimer = setTimeout(wander, nextWander);
            };

            // 첫 이동 시작
            setTimeout(wander, 1000 + Math.random() * 2000);

            // 부드러운 이동을 위한 애니메이션 루프
            this.moveLoop();
        }

        moveLoop() {
            const move = () => {
                if (!this.element) return;

                // 드래그 중이면 위치 업데이트 안함
                if (this.dragging) {
                    requestAnimationFrame(move);
                    return;
                }

                // 목표를 향해 이동
                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0.5) {
                    this.x += (dx / dist) * this.speed * 0.5;
                    this.y += (dy / dist) * this.speed * 0.5;

                    // 걷는 애니메이션
                    this.element.classList.add('walking');
                } else {
                    this.element.classList.remove('walking');
                }

                // 위치 업데이트
                const scaleX = this.direction * this.size;
                this.element.style.left = this.x + '%';
                this.element.style.top = this.y + '%';
                this.element.style.transform = `translate(-50%, -50%) scaleX(${scaleX}) scaleY(${this.size})`;

                requestAnimationFrame(move);
            };
            move();
        }

        setExpression(mood) {
            const imgs = EXPRESSIONS[mood] || EXPRESSIONS.idle;
            this.expression = pick(imgs);
            if (this.imgElement) {
                this.imgElement.style.opacity = '0.5';
                setTimeout(() => {
                    this.imgElement.src = `${imageBase}spiki${this.expression}.png`;
                    this.imgElement.style.opacity = '1';
                }, 100);
            }
        }

        onTap() {
            if (this.sleeping) {
                this.wake();
                return;
            }

            this.bounce();
            this.setExpression('happy');
            playSound('tap');

            if (this.isMain) {
                showSpeech(pick(SPEECH.tap));
            } else {
                // 미니 스피키는 메인에게 다가감
                const mainSpiki = spikis.find(s => s.isMain);
                if (mainSpiki) {
                    this.targetX = mainSpiki.x + (Math.random() - 0.5) * 20;
                    this.targetY = mainSpiki.y + (Math.random() - 0.5) * 10;
                }
                showSpeechAt(pick(['안녕!', '헤헤~', '놀자!']), this.x, this.y - 15);
            }
        }

        onDragStart(e) {
            if (this.sleeping) return;
            e.preventDefault();
            e.stopPropagation();

            const rect = characterArea?.getBoundingClientRect();
            if (!rect) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.dragging = true;
            this.dragStart = { x: clientX, y: clientY };
            this.dragOffset = {
                x: this.x - ((clientX - rect.left) / rect.width * 100),
                y: this.y - ((clientY - rect.top) / rect.height * 100)
            };

            this.element?.classList.add('dragging');
            this.setExpression('surprised');
        }

        onDragMove(e) {
            if (!this.dragging) return;
            e.preventDefault();

            const rect = characterArea?.getBoundingClientRect();
            if (!rect) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            // 새 위치 계산
            let newX = ((clientX - rect.left) / rect.width * 100) + this.dragOffset.x;
            let newY = ((clientY - rect.top) / rect.height * 100) + this.dragOffset.y;

            // 범위 제한
            newX = Math.max(10, Math.min(90, newX));
            newY = Math.max(20, Math.min(80, newY));

            this.x = newX;
            this.y = newY;
            this.targetX = newX;
            this.targetY = newY;

            // 늘어나는 효과 (위로 당기면 늘어남)
            const dragDist = this.dragStart.y - clientY;
            const stretch = Math.min(1.3, 1 + Math.abs(dragDist) / 300);

            this.element.style.left = this.x + '%';
            this.element.style.top = this.y + '%';
            this.element.style.transform = `translate(-50%, -50%) scale(${this.size}) scaleY(${stretch})`;

            // 많이 당기면 소리
            if (Math.abs(dragDist) > 50 && Math.random() < 0.02) {
                playRandomSound(['drag', 'dont']);
                this.setExpression('worried');
                showSpeech(pick(['아야!', '놔주세요~', '머리 잡아 당기지 마세요!']));
            }
        }

        onDragEnd(e) {
            if (!this.dragging) return;

            const wasDragging = this.dragging;
            this.dragging = false;
            this.element?.classList.remove('dragging');

            // 원래 비율로 복구
            this.element.style.transform = `translate(-50%, -50%) scale(${this.size})`;

            // 짧은 클릭이면 탭으로 처리
            const now = Date.now();
            if (now - this.lastTap < 300) {
                return;
            }
            this.lastTap = now;

            const rect = characterArea?.getBoundingClientRect();
            if (!rect) return;

            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const dragDist = this.dragStart.y - clientY;

            if (Math.abs(dragDist) < 10) {
                // 거의 안 움직였으면 탭
                this.onTap();
            } else if (dragDist > 30) {
                // 위로 많이 당겼다 놓으면 점프
                this.jump();
                this.setExpression('happy');
                playRandomSound(['happy', 'happy2']);
                showSpeech(pick(['우와~!', '신나요!', '높이 날았어요!']));
            } else {
                // 그냥 놓으면 원래대로
                this.setExpression('idle');
                this.bounce();
            }
        }

        bounce() {
            this.element?.classList.add('bouncing');
            setTimeout(() => {
                this.element?.classList.remove('bouncing');
            }, 500);
        }

        jump() {
            this.element?.classList.add('jumping');
            setTimeout(() => {
                this.element?.classList.remove('jumping');
            }, 800);
        }

        wiggle() {
            this.element?.classList.add('wiggling');
            setTimeout(() => {
                this.element?.classList.remove('wiggling');
            }, 500);
        }

        sleep() {
            this.sleeping = true;
            this.element?.classList.add('sleeping');
            this.setExpression('sleepy');
        }

        wake() {
            this.sleeping = false;
            this.element?.classList.remove('sleeping');
            this.setExpression('happy');
            this.startWandering();
        }

        remove() {
            clearTimeout(this.wanderTimer);
            if (this.element) {
                this.element.style.transition = 'all 0.3s ease';
                this.element.style.opacity = '0';
                this.element.style.transform = `translate(-50%, -50%) scale(0)`;
                setTimeout(() => {
                    this.element?.remove();
                }, 300);
            }
        }
    }

    // 초기화
    function init() {
        // 오디오 초기화
        initAudio();

        // 기존 character div 제거
        const oldChar = document.getElementById('character');
        if (oldChar) oldChar.remove();

        // 메인 스피키 생성
        const mainSpiki = new Spiki('main', true);
        mainSpiki.x = 50;
        mainSpiki.y = 50;
        spikis.push(mainSpiki);
        mainSpikiId = 'main';

        bindEvents();
        updateUI();

        // 인사
        setTimeout(() => {
            showSpeech(pick(['안녕하세요!', '코딩하러 왔어요~', '함께 해요!']));
            mainSpiki.setExpression('happy');
            playSound('spiki');
        }, 500);
    }

    function bindEvents() {
        document.getElementById('feed-btn')?.addEventListener('click', () => feed());
        document.getElementById('play-btn')?.addEventListener('click', () => play());
        document.getElementById('pet-btn')?.addEventListener('click', () => pet());
        document.getElementById('sleep-btn')?.addEventListener('click', () => toggleSleep());
        document.getElementById('multiply-btn')?.addEventListener('click', () => multiply());
        document.getElementById('music-btn')?.addEventListener('click', () => toggleYouTubePanel());
        document.getElementById('close-youtube')?.addEventListener('click', () => closeYouTubePanel());
        document.getElementById('play-youtube')?.addEventListener('click', () => playYouTubeFromInput());

        // 프리셋 버튼들
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const videoId = btn.dataset.video;
                if (videoId) playYouTube(videoId);
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // YouTube 기능
    let youtubePlayer = null;
    let isYoutubePlaying = false;

    function toggleYouTubePanel() {
        const panel = document.getElementById('youtube-panel');
        panel?.classList.toggle('show');
    }

    function closeYouTubePanel() {
        const panel = document.getElementById('youtube-panel');
        panel?.classList.remove('show');
    }

    function playYouTubeFromInput() {
        const input = document.getElementById('youtube-url');
        if (!input) return;
        const value = input.value.trim();
        if (!value) return;

        // URL에서 video ID 추출
        let videoId = value;
        let isShorts = false;

        if (value.includes('youtube.com/shorts/')) {
            // Shorts URL
            const match = value.match(/youtube\.com\/shorts\/([^?&\s]+)/);
            if (match) {
                videoId = match[1];
                isShorts = true;
            }
        } else if (value.includes('youtube.com') || value.includes('youtu.be')) {
            const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
            if (match) videoId = match[1];
        }

        playYouTube(videoId, isShorts);
    }

    function playYouTube(videoId, isShorts = false) {
        const container = document.getElementById('youtube-container');
        if (!container) return;

        // Shorts면 세로 비율
        if (isShorts) {
            container.style.aspectRatio = '9/16';
            container.style.maxHeight = '300px';
            container.style.margin = '0 auto';
        } else {
            container.style.aspectRatio = '16/9';
            container.style.maxHeight = '';
            container.style.margin = '';
        }

        // iframe 생성
        container.innerHTML = `<iframe
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}"
            allow="autoplay; encrypted-media"
            allowfullscreen>
        </iframe>`;

        isYoutubePlaying = true;
        document.getElementById('music-btn')?.classList.add('playing');

        // 스피키 반응
        const main = getMainSpiki();
        main?.setExpression('happy');
        showSpeech(pick(['음악이다!', '신나요~', '좋아요!']));
        playRandomSound(['happy', 'happy2']);

        // 춤추기 (모든 스피키)
        spikis.forEach(s => {
            if (!s.sleeping) {
                s.element?.classList.add('dancing');
            }
        });
    }

    function stopYouTube() {
        const container = document.getElementById('youtube-container');
        if (container) container.innerHTML = '';
        isYoutubePlaying = false;
        document.getElementById('music-btn')?.classList.remove('playing');

        spikis.forEach(s => {
            s.element?.classList.remove('dancing');
        });
    }

    // 증식!
    function multiply() {
        if (state.sleeping || state.animating) return;

        // 에너지와 포만감 소모
        if (state.stats.energy < 30 || state.stats.hunger < 30) {
            showSpeech('힘이 없어요...');
            getMainSpiki()?.setExpression('worried');
            return;
        }

        state.animating = true;
        state.stats.energy = Math.max(0, state.stats.energy - 20);
        state.stats.hunger = Math.max(0, state.stats.hunger - 20);

        // 메인 스피키 위치 근처에 생성
        const main = getMainSpiki();
        const newSpiki = new Spiki('spiki_' + Date.now(), false);
        newSpiki.x = (main?.x || 50) + (Math.random() - 0.5) * 30;
        newSpiki.y = (main?.y || 50) + (Math.random() - 0.5) * 20;
        newSpiki.targetX = newSpiki.x;
        newSpiki.targetY = newSpiki.y;
        spikis.push(newSpiki);

        // 이펙트
        showSpeech(pick(SPEECH.multiply));
        main?.setExpression('happy');
        main?.jump();
        spawnEffects(['✨', '🌟', '💫'], 5);
        playSound('spiki');
        addExp(30);

        updateSpikiCount();

        setTimeout(() => {
            state.animating = false;
            checkMood();
            updateUI();
            sendStateUpdate();
        }, 1000);
    }

    function getMainSpiki() {
        return spikis.find(s => s.isMain);
    }

    // 액션
    function feed() {
        if (state.sleeping || state.animating) return;
        state.animating = true;

        state.stats.hunger = Math.min(100, state.stats.hunger + 30);
        state.stats.happiness = Math.min(100, state.stats.happiness + 10);
        addExp(15);

        const main = getMainSpiki();
        main?.setExpression('happy');
        main?.bounce();
        showSpeech(pick(SPEECH.feed));
        spawnEffects(['🍰', '🍩', '🍪'], 4);
        playRandomSound(['happy', 'happy2']);

        // 모든 스피키에게 먹이 효과
        spikis.forEach(s => {
            if (!s.isMain) {
                setTimeout(() => {
                    s.setExpression('happy');
                    s.bounce();
                }, Math.random() * 500);
            }
        });

        endAction();
    }

    function play() {
        if (state.sleeping || state.animating) return;

        if (state.stats.energy < 20) {
            getMainSpiki()?.setExpression('sleepy');
            showSpeech('너무 피곤해요...');
            return;
        }

        state.animating = true;

        state.stats.happiness = Math.min(100, state.stats.happiness + 25);
        state.stats.energy = Math.max(0, state.stats.energy - 15);
        state.stats.hunger = Math.max(0, state.stats.hunger - 10);
        addExp(20);

        const main = getMainSpiki();
        main?.setExpression('happy');
        main?.jump();
        showSpeech(pick(SPEECH.play));
        spawnEffects(['⭐', '🌟', '✨'], 6);
        playRandomSound(['play', 'happy', 'happy2']);

        // 모든 스피키가 뛰어다님
        spikis.forEach(s => {
            if (!s.isMain) {
                s.speed = 2;
                s.targetX = 15 + Math.random() * 70;
                s.targetY = 30 + Math.random() * 40;
                setTimeout(() => {
                    s.jump();
                    s.speed = 0.5 + Math.random() * 1;
                }, Math.random() * 500);
            }
        });

        endAction();
    }

    function pet() {
        if (state.sleeping || state.animating) return;
        state.animating = true;

        state.stats.happiness = Math.min(100, state.stats.happiness + 15);
        addExp(10);

        const main = getMainSpiki();
        main?.setExpression('happy');
        main?.wiggle();
        showSpeech(pick(SPEECH.pet));
        playRandomSound(['happy', 'happy2']);
        spawnEffects(['💕', '💗'], 5);

        // 미니 스피키들이 메인에게 모임
        const mainX = main?.x || 50;
        const mainY = main?.y || 50;
        spikis.forEach(s => {
            if (!s.isMain) {
                s.targetX = mainX + (Math.random() - 0.5) * 25;
                s.targetY = mainY + (Math.random() - 0.5) * 15;
                setTimeout(() => s.wiggle(), Math.random() * 500);
            }
        });

        endAction();
    }

    function toggleSleep() {
        if (state.animating) return;

        if (state.sleeping) {
            wakeUp();
        } else {
            goSleep();
        }
    }

    function goSleep() {
        state.sleeping = true;
        showSpeech(pick(SPEECH.sleep));
        updateSleepBtn(true);

        // 모든 스피키 재우기
        spikis.forEach(s => s.sleep());
    }

    function wakeUp() {
        state.sleeping = false;
        showSpeech(pick(SPEECH.wake));
        updateSleepBtn(false);

        // 모든 스피키 깨우기
        spikis.forEach(s => s.wake());
    }

    function endAction() {
        setTimeout(() => {
            state.animating = false;
            checkMood();
            updateUI();
            sendStateUpdate();
        }, 1000);
    }

    // 코딩 보상
    function handleReward(reason, amount) {
        if (state.sleeping) return;

        const main = getMainSpiki();

        switch (reason) {
            case 'typing':
                state.stats.happiness = Math.min(100, state.stats.happiness + amount);
                if (Math.random() < 0.1) {
                    showSpeech(pick(SPEECH.coding));
                    main?.setExpression('happy');
                }
                // 타이핑하면 스피키들이 약간 반응
                if (Math.random() < 0.05) {
                    const randomSpiki = pick(spikis.filter(s => !s.isMain));
                    if (randomSpiki) {
                        randomSpiki.bounce();
                    }
                }
                break;
            case 'save':
                state.stats.happiness = Math.min(100, state.stats.happiness + amount);
                showSpeech(pick(SPEECH.save));
                main?.setExpression('happy');
                spawnEffects(['💾', '✅'], 3);
                addExp(5);
                break;
            case 'debug':
                state.stats.happiness = Math.min(100, state.stats.happiness + amount);
                showSpeech(pick(SPEECH.debug));
                main?.setExpression('surprised');
                spawnEffects(['🐛', '🔍'], 3);
                addExp(10);
                // 디버그하면 스피키들이 놀람
                spikis.forEach(s => {
                    if (!s.isMain) s.setExpression('surprised');
                });
                break;
        }

        updateUI();
        sendStateUpdate();
    }

    // 스탯 감소
    function handleTick() {
        if (state.sleeping) {
            state.stats.energy = Math.min(100, state.stats.energy + 2);
        } else {
            state.stats.happiness = Math.max(0, state.stats.happiness - 0.5);
            state.stats.hunger = Math.max(0, state.stats.hunger - 1);
            state.stats.energy = Math.max(0, state.stats.energy - 0.3);

            // 스탯 낮으면 미니 스피키 떠남
            if (state.stats.happiness < 20 && spikis.length > 1 && Math.random() < 0.3) {
                const miniSpiki = spikis.find(s => !s.isMain);
                if (miniSpiki) {
                    showSpeech(`${miniSpiki.name}이(가) 떠났어요... 😢`);
                    miniSpiki.remove();
                    spikis = spikis.filter(s => s.id !== miniSpiki.id);
                    updateSpikiCount();
                }
            }
        }

        checkMood();
        updateUI();
        sendStateUpdate();
    }

    // 표정
    function checkMood() {
        if (state.sleeping) return;
        const { happiness, hunger, energy } = state.stats;
        const main = getMainSpiki();

        if (energy < 20) {
            main?.setExpression('sleepy');
            if (Math.random() < 0.1) showSpeech(pick(SPEECH.tired));
        } else if (hunger < 30 || happiness < 30) {
            main?.setExpression('worried');
            if (Math.random() < 0.1) showSpeech(pick(SPEECH.hungry));
        } else if (happiness > 70) {
            main?.setExpression('happy');
        } else {
            main?.setExpression('idle');
        }
    }

    // 말풍선
    function showSpeech(text) {
        if (!speech || !speechText) return;
        speechText.textContent = text;
        speech.classList.add('show');

        setTimeout(() => {
            speech.classList.remove('show');
        }, 2500);
    }

    function showSpeechAt(text, x, y) {
        const bubble = document.createElement('div');
        bubble.className = 'mini-speech';
        bubble.textContent = text;
        bubble.style.left = x + '%';
        bubble.style.top = y + '%';
        characterArea?.appendChild(bubble);

        setTimeout(() => {
            bubble.classList.add('show');
        }, 10);

        setTimeout(() => {
            bubble.classList.remove('show');
            setTimeout(() => bubble.remove(), 300);
        }, 1500);
    }

    // 이펙트
    function spawnEffects(emojis, count) {
        if (!effects) return;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const el = document.createElement('div');
                el.className = 'effect-item';
                el.textContent = pick(emojis);
                el.style.left = (20 + Math.random() * 60) + '%';
                el.style.top = (30 + Math.random() * 30) + '%';
                effects.appendChild(el);

                setTimeout(() => el.remove(), 1500);
            }, i * 100);
        }
    }

    // 경험치
    function addExp(amount) {
        state.exp += amount;
        if (state.exp >= state.expMax) {
            levelUp();
        }
        updateUI();
    }

    function levelUp() {
        state.level++;
        state.exp -= state.expMax;
        state.expMax = Math.floor(state.expMax * 1.5);

        const main = getMainSpiki();
        main?.setExpression('happy');
        main?.jump();
        showSpeech('레벨 업! 🎉');
        spawnEffects(['🎉', '⭐', '🌟'], 8);
        playSound('spiki');

        // 레벨업하면 자동으로 증식!
        setTimeout(() => {
            const newSpiki = new Spiki('spiki_' + Date.now(), false);
            newSpiki.x = (main?.x || 50) + (Math.random() - 0.5) * 30;
            newSpiki.y = (main?.y || 50) + (Math.random() - 0.5) * 20;
            spikis.push(newSpiki);
            showSpeech('새 친구가 왔어요!');
            updateSpikiCount();
        }, 1000);

        // 알림
        vscode.postMessage({
            type: 'notification',
            text: `스피키가 레벨 ${state.level}이 되었어요! 🎉`
        });
    }

    // UI
    function updateUI() {
        Object.keys(state.stats).forEach(stat => {
            const val = state.stats[stat];
            const bar = bars[stat];
            const valEl = values[stat];

            if (bar) {
                bar.style.width = val + '%';
                bar.classList.toggle('low', val < 30);
            }
            if (valEl) {
                valEl.textContent = Math.round(val);
            }
        });

        if (levelEl) levelEl.textContent = state.level;
        if (expEl) expEl.textContent = Math.round(state.exp);
        if (expMaxEl) expMaxEl.textContent = state.expMax;
        if (expBar) expBar.style.width = (state.exp / state.expMax * 100) + '%';

        // 팁 업데이트
        if (codingTip) {
            if (state.stats.happiness < 30) {
                codingTip.textContent = '스피키가 외로워해요... 놀아주세요! 😢';
            } else if (state.stats.hunger < 30) {
                codingTip.textContent = '스피키가 배고파해요! 밥을 주세요 🍰';
            } else if (state.stats.energy < 30) {
                codingTip.textContent = '스피키가 피곤해요... 재워주세요 💤';
            } else if (spikis.length < 3) {
                codingTip.textContent = '레벨업하면 친구가 늘어나요! 💻';
            } else {
                codingTip.textContent = '스피키 가족이 행복해요! 🐾';
            }
        }
    }

    function updateSpikiCount() {
        if (spikiCountEl) {
            spikiCountEl.textContent = spikis.length;
        }
    }

    function updateSleepBtn(sleeping) {
        const btn = document.getElementById('sleep-btn');
        if (btn) {
            btn.textContent = sleeping ? '☀️' : '💤';
            btn.title = sleeping ? '깨우기' : '재우기';
        }
    }

    function sendStateUpdate() {
        vscode.postMessage({
            type: 'stateUpdate',
            state: {
                ...state.stats,
                level: state.level,
                exp: state.exp,
                expMax: state.expMax,
                spikiCount: spikis.length,
            }
        });
    }

    // VSCode 메시지 수신
    window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.type) {
            case 'action':
                if (message.action === 'feed') feed();
                else if (message.action === 'play') play();
                else if (message.action === 'pet') pet();
                break;
            case 'reward':
                handleReward(message.reason, message.amount);
                break;
            case 'tick':
                handleTick();
                break;
            case 'loadState':
                if (message.state) {
                    state.stats.happiness = message.state.happiness ?? 100;
                    state.stats.hunger = message.state.hunger ?? 100;
                    state.stats.energy = message.state.energy ?? 100;
                    state.level = message.state.level ?? 1;
                    state.exp = message.state.exp ?? 0;
                    state.expMax = message.state.expMax ?? 100;

                    // 저장된 스피키 수만큼 생성
                    const savedCount = message.state.spikiCount || 1;
                    for (let i = 1; i < savedCount && spikis.length < savedCount; i++) {
                        const newSpiki = new Spiki('spiki_' + i, false);
                        newSpiki.x = 20 + Math.random() * 60;
                        newSpiki.y = 35 + Math.random() * 30;
                        spikis.push(newSpiki);
                    }

                    updateUI();
                    updateSpikiCount();
                    checkMood();
                }
                break;
            case 'event':
                if (message.event === 'terminal') {
                    showSpeech('터미널이다!');
                    getMainSpiki()?.setExpression('surprised');
                }
                break;
        }
    });

    // 유틸
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // 시작
    init();
})();

// Spiki Tamagotchi Web Game
(function() {
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
        hungry: ['배고파요...'],
        tired: ['졸려요...'],
        sad: ['놀아주세요...'],
        tap: ['에?', '뭐예요?', '헤헤~'],
        multiply: ['친구다!', '우와~', '반가워!', '같이 놀자!'],
    };

    const NAMES = ['스피키', '피키', '스삐', '키키', '삐삐', '코코', '모모', '뽀뽀', '두두', '루루'];

    // Web Audio API로 개선된 오디오 시스템
    const SOUNDS = {};
    const SOUND_FILES = [
        'happy',      // 좋아요!
        'happy2',     // 좋아요 좋아요
        'tap',        // 에
        'spiki',      // 스피키
        'sad',        // 으앙
        'surprise',   // 으앙 (duplicate, will keep)
        'dont',       // 네르지 마세요
        'drag',       // 머리 잡아 당기지 마세요
        'play',       // 숨바꼭질 좋아요
        'tired',      // 열심히 했는데
        'mop',        // 물걸레질
        'pumpkin',    // 호박이 좋아요
        'hideseek',   // 숨바꼭질 좋아요 (longer version)
        'worked',     // 열심히 했는데 (longer version)
        'cry'         // 으앙 (crying)
    ];
    let soundEnabled = true;
    let audioUnlocked = false;
    let audioContext = null;
    let audioBuffers = {};

    async function initAudio() {
        try {
            // Web Audio API 초기화
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created:', audioContext.state);

            // 현재 경로 확인 (GitHub Pages 대응)
            const basePath = window.location.pathname.includes('/game.html')
                ? window.location.pathname.replace('/game.html', '/')
                : window.location.pathname.endsWith('/')
                    ? window.location.pathname
                    : window.location.pathname + '/';

            console.log('Base path for audio:', basePath);

            // HTML Audio 요소도 생성 (fallback용)
            SOUND_FILES.forEach(name => {
                const audioPath = `${name}.wav`;
                const audio = new Audio(audioPath);
                audio.volume = 0.4;
                audio.preload = 'auto';
                audio.crossOrigin = 'anonymous'; // CORS 대응
                SOUNDS[name] = audio;

                // 로드 성공 확인
                audio.addEventListener('canplaythrough', () => {
                    console.log(`✓ Audio ready: ${name}.wav`);
                }, { once: true });

                audio.addEventListener('error', (e) => {
                    console.error(`✗ Audio failed: ${name}.wav`, e);
                }, { once: true });

                // Web Audio API용 버퍼 로드 시도
                fetch(audioPath, { mode: 'cors' })
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.arrayBuffer();
                    })
                    .then(buffer => audioContext.decodeAudioData(buffer))
                    .then(decoded => {
                        audioBuffers[name] = decoded;
                        console.log(`✓ Web Audio loaded: ${name}.wav`);
                    })
                    .catch(e => console.log(`✗ Web Audio failed: ${name}.wav -`, e.message));
            });

            console.log(`Initialized ${SOUND_FILES.length} audio files`);
        } catch (e) {
            console.error('Audio init failed:', e);
        }
    }

    function unlockAudio() {
        if (audioUnlocked) return;

        // Web Audio Context 재개
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // HTML Audio 활성화
        Object.values(SOUNDS).forEach(sound => {
            sound.play().then(() => {
                sound.pause();
                sound.currentTime = 0;
            }).catch(() => {});
        });

        audioUnlocked = true;
        console.log('Audio unlocked');
    }

    function playSound(name) {
        if (!soundEnabled) return;

        try {
            // Web Audio API로 재생 시도
            if (audioContext && audioBuffers[name] && audioContext.state === 'running') {
                const source = audioContext.createBufferSource();
                const gainNode = audioContext.createGain();

                source.buffer = audioBuffers[name];
                gainNode.gain.value = 0.4;

                source.connect(gainNode);
                gainNode.connect(audioContext.destination);
                source.start(0);

                // Vibration API 사용 (모바일)
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
            // Fallback: HTML Audio
            else if (SOUNDS[name]) {
                SOUNDS[name].currentTime = 0;
                const playPromise = SOUNDS[name].play();
                if (playPromise) {
                    playPromise.catch(err => console.log('Play failed:', err));
                }
            }
        } catch (e) {
            console.log('Sound error:', e);
        }
    }

    function playRandomSound(names) {
        playSound(pick(names));
    }

    // Web API 기능
    let wakeLock = null;
    let notificationsEnabled = false;

    // Notification API 권한 요청
    async function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            notificationsEnabled = (permission === 'granted');
            if (notificationsEnabled) {
                showNotification('알림이 켜졌어요!', '스피키가 중요한 일이 있으면 알려드릴게요 🐾');
            }
        } else if (Notification.permission === 'granted') {
            notificationsEnabled = true;
        }
    }

    function showNotification(title, body) {
        if (!notificationsEnabled || !('Notification' in window)) return;
        if (document.visibilityState === 'visible') return; // 페이지 보고 있으면 알림 안 함

        try {
            new Notification(title, {
                body: body,
                icon: 'spiki1.png',
                badge: 'spiki1.png',
                vibrate: [200, 100, 200],
            });
        } catch (e) {
            console.log('Notification failed:', e);
        }
    }

    // Wake Lock API (화면 꺼짐 방지)
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock activated');

                wakeLock.addEventListener('release', () => {
                    console.log('Wake lock released');
                });
            } catch (e) {
                console.log('Wake lock failed:', e);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    // Page Visibility API (백그라운드 감지)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('Page visible');
            // 페이지로 돌아올 때 Wake Lock 재요청
            if (state && !state.sleeping) {
                requestWakeLock();
            }
        } else {
            console.log('Page hidden');
            releaseWakeLock();
        }
    });

    // 상태
    let state = {
        stats: { happiness: 100, hunger: 100, energy: 100 },
        level: 1,
        exp: 0,
        expMax: 100,
        sleeping: false,
        animating: false,
        autoMultiply: true, // 자동 증식 기능
    };

    // 스피키 배열
    let spikis = [];
    let mainSpikiId = null;

    // DOM
    const characterArea = document.getElementById('character-area');
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
            this.direction = 1;
            this.dragging = false;
            this.dragStart = { x: 0, y: 0 };
            this.dragOffset = { x: 0, y: 0 };
            this.lastTap = 0;

            this.createElement();
            this.startWandering();
        }

        createElement() {
            this.element = document.createElement('div');
            this.element.className = 'spiki-creature' + (this.isMain ? ' main-spiki' : ' mini-spiki');
            this.element.style.left = this.x + '%';
            this.element.style.top = this.y + '%';
            this.element.style.transform = `translate(-50%, -50%) scale(${this.size})`;

            this.imgElement = document.createElement('img');
            this.imgElement.src = `spiki${this.expression}.png`;
            this.imgElement.alt = this.name;
            this.imgElement.draggable = false;

            if (!this.isMain) {
                const nameTag = document.createElement('div');
                nameTag.className = 'spiki-name';
                nameTag.textContent = this.name;
                this.element.appendChild(nameTag);
            }

            this.element.appendChild(this.imgElement);

            this.element.addEventListener('mousedown', (e) => this.onDragStart(e));
            this.element.addEventListener('touchstart', (e) => this.onDragStart(e), { passive: false });

            document.addEventListener('mousemove', (e) => this.onDragMove(e));
            document.addEventListener('touchmove', (e) => this.onDragMove(e), { passive: false });

            document.addEventListener('mouseup', (e) => this.onDragEnd(e));
            document.addEventListener('touchend', (e) => this.onDragEnd(e));

            characterArea.appendChild(this.element);

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

                this.targetX = 15 + Math.random() * 70;
                this.targetY = 30 + Math.random() * 40;

                if (this.targetX > this.x) {
                    this.direction = 1;
                } else {
                    this.direction = -1;
                }

                const nextWander = 3000 + Math.random() * 5000;
                this.wanderTimer = setTimeout(wander, nextWander);
            };

            setTimeout(wander, 1000 + Math.random() * 2000);
            this.moveLoop();
        }

        moveLoop() {
            const move = () => {
                if (!this.element) return;

                if (this.dragging) {
                    requestAnimationFrame(move);
                    return;
                }

                const dx = this.targetX - this.x;
                const dy = this.targetY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0.5) {
                    this.x += (dx / dist) * this.speed * 0.5;
                    this.y += (dy / dist) * this.speed * 0.5;
                    this.element.classList.add('walking');
                } else {
                    this.element.classList.remove('walking');
                }

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
                    this.imgElement.src = `spiki${this.expression}.png`;
                    this.imgElement.style.opacity = '1';
                }, 100);
            }
        }

        onTap() {
            unlockAudio();
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

            const rect = characterArea.getBoundingClientRect();
            if (!rect) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.dragging = true;
            this.dragStart = { x: clientX, y: clientY };
            this.dragOffset = {
                x: this.x - ((clientX - rect.left) / rect.width * 100),
                y: this.y - ((clientY - rect.top) / rect.height * 100)
            };

            this.element.classList.add('dragging');
            this.setExpression('surprised');
        }

        onDragMove(e) {
            if (!this.dragging) return;
            e.preventDefault();

            const rect = characterArea.getBoundingClientRect();
            if (!rect) return;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            let newX = ((clientX - rect.left) / rect.width * 100) + this.dragOffset.x;
            let newY = ((clientY - rect.top) / rect.height * 100) + this.dragOffset.y;

            newX = Math.max(10, Math.min(90, newX));
            newY = Math.max(20, Math.min(80, newY));

            this.x = newX;
            this.y = newY;
            this.targetX = newX;
            this.targetY = newY;

            const dragDist = this.dragStart.y - clientY;
            const stretch = Math.min(1.3, 1 + Math.abs(dragDist) / 300);

            this.element.style.left = this.x + '%';
            this.element.style.top = this.y + '%';
            this.element.style.transform = `translate(-50%, -50%) scale(${this.size}) scaleY(${stretch})`;

            if (Math.abs(dragDist) > 50 && Math.random() < 0.02) {
                playRandomSound(['drag', 'dont']);
                this.setExpression('worried');
                showSpeech(pick(['아야!', '놔주세요~', '머리 잡아 당기지 마세요!']));
            }
        }

        onDragEnd(e) {
            if (!this.dragging) return;

            this.dragging = false;
            this.element.classList.remove('dragging');
            this.element.style.transform = `translate(-50%, -50%) scale(${this.size})`;

            const now = Date.now();
            if (now - this.lastTap < 300) return;
            this.lastTap = now;

            const rect = characterArea.getBoundingClientRect();
            if (!rect) return;

            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const dragDist = this.dragStart.y - clientY;

            if (Math.abs(dragDist) < 10) {
                this.onTap();
            } else if (dragDist > 30) {
                this.jump();
                this.setExpression('happy');
                playRandomSound(['happy', 'happy2']);
                showSpeech(pick(['우와~!', '신나요!', '높이 날았어요!']));
            } else {
                this.setExpression('idle');
                this.bounce();
            }
        }

        bounce() {
            this.element.classList.add('bouncing');
            setTimeout(() => this.element.classList.remove('bouncing'), 500);
        }

        jump() {
            this.element.classList.add('jumping');
            setTimeout(() => this.element.classList.remove('jumping'), 800);
        }

        wiggle() {
            this.element.classList.add('wiggling');
            setTimeout(() => this.element.classList.remove('wiggling'), 500);
        }

        sleep() {
            this.sleeping = true;
            this.element.classList.add('sleeping');
            this.setExpression('sleepy');
        }

        wake() {
            this.sleeping = false;
            this.element.classList.remove('sleeping');
            this.setExpression('happy');
            this.startWandering();
        }

        remove() {
            clearTimeout(this.wanderTimer);
            if (this.element) {
                this.element.style.transition = 'all 0.3s ease';
                this.element.style.opacity = '0';
                this.element.style.transform = `translate(-50%, -50%) scale(0)`;
                setTimeout(() => this.element?.remove(), 300);
            }
        }
    }

    // 초기화
    function init() {
        initAudio();

        // Web API 권한 요청
        requestNotificationPermission();
        requestWakeLock();

        // 먼저 저장된 상태 로드
        const savedState = loadState();

        const mainSpiki = new Spiki('main', true);
        mainSpiki.x = 50;
        mainSpiki.y = 50;
        spikis.push(mainSpiki);
        mainSpikiId = 'main';

        // 저장된 스피키 수만큼 생성
        if (savedState) {
            const savedCount = savedState.spikiCount || 1;
            for (let i = 1; i < savedCount; i++) {
                const newSpiki = new Spiki('spiki_' + i, false);
                newSpiki.x = 20 + Math.random() * 60;
                newSpiki.y = 35 + Math.random() * 30;
                spikis.push(newSpiki);
            }
        }

        bindEvents();
        updateUI();
        updateSpikiCount();
        checkMood();

        setTimeout(() => {
            showSpeech(pick(['안녕하세요!', '함께 놀아요~', '반가워요!']));
            mainSpiki.setExpression('happy');
            playSound('spiki');
        }, 500);

        // 자동 틱 (30초마다)
        setInterval(handleTick, 30000);
    }

    function bindEvents() {
        document.getElementById('feed-btn')?.addEventListener('click', feed);
        document.getElementById('play-btn')?.addEventListener('click', play);
        document.getElementById('pet-btn')?.addEventListener('click', pet);
        document.getElementById('sleep-btn')?.addEventListener('click', toggleSleep);
        document.getElementById('multiply-btn')?.addEventListener('click', multiply);
        document.getElementById('music-btn')?.addEventListener('click', toggleYouTubePanel);
        document.getElementById('close-youtube')?.addEventListener('click', closeYouTubePanel);
        document.getElementById('play-youtube')?.addEventListener('click', playYouTubeFromInput);

        // 오디오 테스트 버튼
        document.getElementById('audio-test-btn')?.addEventListener('click', testAudio);

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const videoId = btn.dataset.video;
                if (videoId) playYouTube(videoId);
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    function testAudio() {
        const status = document.getElementById('audio-status');
        status.textContent = '테스트 중...';

        unlockAudio();

        // 모든 오디오 파일 확인
        let loaded = 0;
        let failed = 0;

        SOUND_FILES.forEach(name => {
            const sound = SOUNDS[name];
            if (sound && sound.readyState >= 2) {
                loaded++;
            } else {
                failed++;
                console.log(`Failed to load: ${name}.wav`);
            }
        });

        status.textContent = `로드됨: ${loaded}/${SOUND_FILES.length}, 실패: ${failed}`;

        // 테스트 사운드 재생
        setTimeout(() => {
            playSound('happy');
            setTimeout(() => {
                status.textContent += ' | 재생 시도 완료';
            }, 500);
        }, 100);
    }

    // YouTube 기능
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

        let videoId = value;
        let isShorts = false;

        if (value.includes('youtube.com/shorts/')) {
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

        if (isShorts) {
            container.style.aspectRatio = '9/16';
            container.style.maxHeight = '300px';
            container.style.margin = '0 auto';
        } else {
            container.style.aspectRatio = '16/9';
            container.style.maxHeight = '';
            container.style.margin = '';
        }

        container.innerHTML = `<iframe
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}"
            allow="autoplay; encrypted-media"
            allowfullscreen>
        </iframe>`;

        isYoutubePlaying = true;
        document.getElementById('music-btn')?.classList.add('playing');

        const main = getMainSpiki();
        main?.setExpression('happy');
        showSpeech(pick(['음악이다!', '신나요~', '좋아요!']));
        // mop = 물걸레질 (신나는 소리)
        playRandomSound(['happy', 'happy2', 'mop']);

        spikis.forEach(s => {
            if (!s.sleeping) s.element?.classList.add('dancing');
        });
    }

    function stopYouTube() {
        const container = document.getElementById('youtube-container');
        if (container) container.innerHTML = '';
        isYoutubePlaying = false;
        document.getElementById('music-btn')?.classList.remove('playing');
        spikis.forEach(s => s.element?.classList.remove('dancing'));
    }

    // 증식
    function multiply() {
        unlockAudio();
        if (state.sleeping || state.animating) return;

        if (state.stats.energy < 30 || state.stats.hunger < 30) {
            showSpeech('힘이 없어요...');
            getMainSpiki()?.setExpression('worried');
            return;
        }

        state.animating = true;
        state.stats.energy = Math.max(0, state.stats.energy - 20);
        state.stats.hunger = Math.max(0, state.stats.hunger - 20);

        const main = getMainSpiki();
        const newSpiki = new Spiki('spiki_' + Date.now(), false);
        newSpiki.x = (main?.x || 50) + (Math.random() - 0.5) * 30;
        newSpiki.y = (main?.y || 50) + (Math.random() - 0.5) * 20;
        newSpiki.targetX = newSpiki.x;
        newSpiki.targetY = newSpiki.y;
        spikis.push(newSpiki);

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
            saveState();
        }, 1000);
    }

    function getMainSpiki() {
        return spikis.find(s => s.isMain);
    }

    // 액션
    function feed() {
        unlockAudio();
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
        // 더 다양한 음성 사용 (pumpkin = 호박이 좋아요)
        playRandomSound(['happy', 'happy2', 'pumpkin']);

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
        unlockAudio();
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
        // hideseek = 숨바꼭질 좋아요
        playRandomSound(['play', 'hideseek', 'happy', 'happy2']);

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
        unlockAudio();
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
        unlockAudio();
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
        spikis.forEach(s => s.sleep());
        releaseWakeLock(); // 잠들 때 wake lock 해제
    }

    function wakeUp() {
        state.sleeping = false;
        showSpeech(pick(SPEECH.wake));
        updateSleepBtn(false);
        spikis.forEach(s => s.wake());
        requestWakeLock(); // 깨어날 때 wake lock 다시 활성화
    }

    function endAction() {
        setTimeout(() => {
            state.animating = false;
            checkMood();
            updateUI();
            saveState();
        }, 1000);
    }

    // 스탯 감소
    function handleTick() {
        if (state.sleeping) {
            state.stats.energy = Math.min(100, state.stats.energy + 2);
        } else {
            state.stats.happiness = Math.max(0, state.stats.happiness - 0.5);
            state.stats.hunger = Math.max(0, state.stats.hunger - 1);
            state.stats.energy = Math.max(0, state.stats.energy - 0.3);

            // 낮은 스탯 알림
            if (state.stats.energy < 15) {
                showNotification('스피키가 피곤해해요 😴', '재워주세요! 에너지가 거의 없어요.');
            } else if (state.stats.hunger < 15) {
                showNotification('스피키가 배고파해요 🍰', '밥을 주세요! 포만감이 거의 없어요.');
            } else if (state.stats.happiness < 15) {
                showNotification('스피키가 외로워해요 💔', '놀아주거나 쓰다듬어주세요!');
            }

            if (state.stats.happiness < 20 && spikis.length > 1 && Math.random() < 0.3) {
                const miniSpiki = spikis.find(s => !s.isMain);
                if (miniSpiki) {
                    showSpeech(`${miniSpiki.name}이(가) 떠났어요... 😢`);
                    showNotification('스피키가 떠났어요 😢', `${miniSpiki.name}이(가) 떠났어요. 행복도를 올려주세요!`);
                    // 슬픈 음성 재생
                    playRandomSound(['cry', 'sad']);
                    miniSpiki.remove();
                    spikis = spikis.filter(s => s.id !== miniSpiki.id);
                    updateSpikiCount();
                }
            }

            // 자동 증식 (높은 스탯일 때)
            if (state.autoMultiply && spikis.length < 10) {
                if (state.stats.happiness > 80 && state.stats.hunger > 70 &&
                    state.stats.energy > 70 && Math.random() < 0.05) {
                    const main = getMainSpiki();
                    const newSpiki = new Spiki('spiki_' + Date.now(), false);
                    newSpiki.x = (main?.x || 50) + (Math.random() - 0.5) * 30;
                    newSpiki.y = (main?.y || 50) + (Math.random() - 0.5) * 20;
                    spikis.push(newSpiki);
                    showSpeech('새 친구가 저절로 나타났어요! ✨');
                    spawnEffects(['✨', '⭐'], 3);
                    updateSpikiCount();
                }
            }
        }

        checkMood();
        updateUI();
        saveState();
    }

    // 표정
    function checkMood() {
        if (state.sleeping) return;
        const { happiness, hunger, energy } = state.stats;
        const main = getMainSpiki();

        if (energy < 20) {
            main?.setExpression('sleepy');
            if (Math.random() < 0.1) {
                showSpeech(pick(SPEECH.tired));
                // worked = 열심히 했는데
                playRandomSound(['tired', 'worked']);
            }
        } else if (hunger < 30 || happiness < 30) {
            main?.setExpression('worried');
            if (Math.random() < 0.1) {
                showSpeech(pick(SPEECH.hungry));
                // cry = 으앙 (울음소리)
                playRandomSound(['sad', 'cry']);
            }
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

        setTimeout(() => speech.classList.remove('show'), 2500);
    }

    function showSpeechAt(text, x, y) {
        const bubble = document.createElement('div');
        bubble.className = 'mini-speech';
        bubble.textContent = text;
        bubble.style.left = x + '%';
        bubble.style.top = y + '%';
        characterArea.appendChild(bubble);

        setTimeout(() => bubble.classList.add('show'), 10);
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
        showNotification('레벨 업! 🎉', `스피키가 레벨 ${state.level}이 되었어요!`);
        spawnEffects(['🎉', '⭐', '🌟'], 8);
        playSound('spiki');

        setTimeout(() => {
            const newSpiki = new Spiki('spiki_' + Date.now(), false);
            newSpiki.x = (main?.x || 50) + (Math.random() - 0.5) * 30;
            newSpiki.y = (main?.y || 50) + (Math.random() - 0.5) * 20;
            spikis.push(newSpiki);
            showSpeech('새 친구가 왔어요!');
            updateSpikiCount();
            saveState();
        }, 1000);
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

    // 저장/로드
    function saveState() {
        const saveData = {
            stats: state.stats,
            level: state.level,
            exp: state.exp,
            expMax: state.expMax,
            spikiCount: spikis.length,
        };
        localStorage.setItem('spiki-tamagotchi', JSON.stringify(saveData));
    }

    function loadState() {
        try {
            const saved = localStorage.getItem('spiki-tamagotchi');
            if (saved) {
                const data = JSON.parse(saved);
                state.stats = data.stats || state.stats;
                state.level = data.level || 1;
                state.exp = data.exp || 0;
                state.expMax = data.expMax || 100;
                return data;
            }
        } catch (e) {
            console.log('Load failed:', e);
        }
        return null;
    }

    // 유틸
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ====== 새로운 기능들 ======

    // Particles.js 초기화
    function initParticles() {
        if (typeof particlesJS !== 'undefined') {
            particlesJS('particles-js', {
                particles: {
                    number: { value: 50, density: { enable: true, value_area: 800 } },
                    color: { value: ['#ff6b9d', '#ffa94d', '#69db7c', '#845ef7'] },
                    shape: { type: 'circle' },
                    opacity: { value: 0.3, random: true },
                    size: { value: 3, random: true },
                    line_linked: { enable: false },
                    move: {
                        enable: true,
                        speed: 1,
                        direction: 'none',
                        random: true,
                        out_mode: 'out'
                    }
                },
                interactivity: {
                    detect_on: 'canvas',
                    events: {
                        onhover: { enable: true, mode: 'bubble' },
                        onclick: { enable: true, mode: 'push' }
                    },
                    modes: {
                        bubble: { distance: 100, size: 6, duration: 2 },
                        push: { particles_nb: 4 }
                    }
                }
            });
        }
    }

    // Hammer.js - Touch Gestures
    function initGestures() {
        if (typeof Hammer === 'undefined') return;

        spikis.forEach(spiki => {
            if (!spiki.element) return;

            const hammer = new Hammer(spiki.element);

            // Double Tap
            hammer.on('doubletap', () => {
                spiki.jump();
                spiki.setExpression('happy');
                showSpeechAt(pick(['야호!', '와!', '신나요!']), spiki.x, spiki.y - 15);
                playRandomSound(['happy', 'happy2']);
                addExp(5);
            });

            // Press (Long Press)
            hammer.on('press', () => {
                spiki.setExpression('surprised');
                showSpeechAt(pick(['왜요?', '뭐예요?', '??']), spiki.x, spiki.y - 15);
                playSound('surprise');
            });

            // Swipe
            hammer.on('swipe', (ev) => {
                const direction = ev.direction;
                if (direction === Hammer.DIRECTION_LEFT || direction === Hammer.DIRECTION_RIGHT) {
                    spiki.targetX = direction === Hammer.DIRECTION_LEFT ? 20 : 80;
                    spiki.speed = 3;
                    showSpeechAt('슝!', spiki.x, spiki.y - 15);
                    setTimeout(() => spiki.speed = 0.5, 500);
                }
            });

            // Pinch (Zoom)
            hammer.get('pinch').set({ enable: true });
            hammer.on('pinch', (ev) => {
                const scale = Math.max(0.5, Math.min(2, ev.scale));
                spiki.size = scale;
                spiki.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
            });
        });
    }

    // Speech Recognition API - 음성 명령
    let recognition = null;
    function initVoiceControl() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech Recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const command = event.results[0][0].transcript.toLowerCase();
            console.log('음성 명령:', command);

            if (command.includes('밥') || command.includes('먹')) {
                feed();
                showSpeech('밥 먹을게요!');
            } else if (command.includes('놀') || command.includes('재미')) {
                play();
                showSpeech('놀아요!');
            } else if (command.includes('자')) {
                toggleSleep();
                showSpeech('잘 자요~');
            } else if (command.includes('증식')) {
                multiply();
            } else if (command.includes('음악')) {
                toggleYouTubePanel();
            } else {
                showSpeech('잘 못 들었어요 😅');
            }
        };

        recognition.onerror = (event) => {
            console.log('Speech recognition error:', event.error);
        };
    }

    function startVoiceCommand() {
        if (!recognition) {
            initVoiceControl();
        }
        if (recognition) {
            try {
                recognition.start();
                showSpeech('무엇을 할까요? 🎤');
            } catch (e) {
                console.log('Voice recognition error:', e);
            }
        }
    }

    // DeviceOrientation API - 흔들기 감지
    let lastShake = 0;
    function initShakeDetection() {
        if (!window.DeviceMotionEvent) {
            console.log('Device Motion not supported');
            return;
        }

        window.addEventListener('devicemotion', (event) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const magnitude = Math.sqrt(
                acc.x * acc.x +
                acc.y * acc.y +
                acc.z * acc.z
            );

            if (magnitude > 25 && Date.now() - lastShake > 1000) {
                lastShake = Date.now();
                onShake();
            }
        });
    }

    function onShake() {
        console.log('Device shaken!');
        spikis.forEach(s => {
            s.wiggle();
            s.setExpression('surprised');
        });
        showSpeech(pick(['우와!', '깜짝이야!', '어지러워!']));
        playSound('surprise');
        spawnEffects(['✨', '💫', '⭐'], 8);
    }

    function simulateShake() {
        onShake();
    }

    // Screen Capture API - 사진 찍기
    async function takePhoto() {
        try {
            const canvas = document.createElement('canvas');
            const area = characterArea;
            const rect = area.getBoundingClientRect();

            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = window.getComputedStyle(area).background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Capture each Spiki
            for (const spiki of spikis) {
                if (!spiki.element) continue;
                const img = spiki.element.querySelector('img');
                if (!img) continue;

                const x = (spiki.x / 100) * canvas.width;
                const y = (spiki.y / 100) * canvas.height;

                ctx.drawImage(img, x - 50, y - 50, 100, 100);
            }

            // Download
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spiki-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);

                showSpeech('📸 사진 저장!');
                playSound('happy');
            });
        } catch (e) {
            console.error('Photo capture failed:', e);
            showSpeech('사진 촬영 실패 😢');
        }
    }

    // Settings Panel
    function toggleSettings() {
        const panel = document.getElementById('settings-panel');
        if (panel) {
            if (panel.style.display === 'none' || !panel.style.display) {
                panel.style.display = 'block';
                panel.classList.add('show');
            } else {
                panel.classList.remove('show');
                setTimeout(() => panel.style.display = 'none', 300);
            }
        }
    }

    function resetGame() {
        if (confirm('정말 게임을 초기화하시겠습니까? 모든 진행 상황이 삭제됩니다.')) {
            localStorage.removeItem('spiki-state');
            location.reload();
        }
    }

    // YouTube Panel Controls Enhancement
    function stopYouTube() {
        const container = document.getElementById('youtube-container');
        if (container) container.innerHTML = '';
        isYoutubePlaying = false;
        document.getElementById('music-btn')?.classList.remove('playing');
        spikis.forEach(s => s.element?.classList.remove('dancing'));
        showSpeech('음악 정지!');
    }

    // Settings Toggles
    function bindSettingsEvents() {
        document.getElementById('sound-toggle')?.addEventListener('change', (e) => {
            soundEnabled = e.target.checked;
            localStorage.setItem('spiki-sound', soundEnabled);
        });

        document.getElementById('vibration-toggle')?.addEventListener('change', (e) => {
            localStorage.setItem('spiki-vibration', e.target.checked);
        });

        document.getElementById('notification-toggle')?.addEventListener('change', (e) => {
            notificationsEnabled = e.target.checked;
            localStorage.setItem('spiki-notifications', e.target.checked);
        });

        document.getElementById('auto-multiply-toggle')?.addEventListener('change', (e) => {
            state.autoMultiply = e.target.checked;
            localStorage.setItem('spiki-auto-multiply', e.target.checked);
        });

        document.getElementById('particles-toggle')?.addEventListener('change', (e) => {
            const particlesEl = document.getElementById('particles-js');
            if (particlesEl) {
                particlesEl.style.display = e.target.checked ? 'block' : 'none';
            }
            localStorage.setItem('spiki-particles', e.target.checked);
        });

        document.getElementById('reset-game')?.addEventListener('click', resetGame);
    }

    // Extended Event Bindings
    function bindAdvancedEvents() {
        document.getElementById('voice-btn')?.addEventListener('click', startVoiceCommand);
        document.getElementById('photo-btn')?.addEventListener('click', takePhoto);
        document.getElementById('shake-btn')?.addEventListener('click', simulateShake);
        document.getElementById('settings-btn')?.addEventListener('click', toggleSettings);
        document.getElementById('close-settings')?.addEventListener('click', toggleSettings);
        document.getElementById('stop-youtube')?.addEventListener('click', stopYouTube);

        bindSettingsEvents();
    }

    // Initialize Advanced Features
    function initAdvancedFeatures() {
        initParticles();
        initShakeDetection();
        initVoiceControl();
        bindAdvancedEvents();

        // Initialize Hammer.js after Spikis are created
        setTimeout(() => {
            initGestures();
        }, 1000);

        // Load settings
        const savedSound = localStorage.getItem('spiki-sound');
        if (savedSound !== null) {
            soundEnabled = savedSound === 'true';
            const toggle = document.getElementById('sound-toggle');
            if (toggle) toggle.checked = soundEnabled;
        }

        const savedParticles = localStorage.getItem('spiki-particles');
        if (savedParticles === 'false') {
            const particlesEl = document.getElementById('particles-js');
            if (particlesEl) particlesEl.style.display = 'none';
            const toggle = document.getElementById('particles-toggle');
            if (toggle) toggle.checked = false;
        }
    }

    // 시작
    init();
    initAdvancedFeatures();
})();

use crate::modules::oauth;
use std::sync::{Mutex, OnceLock};
use tauri::Url;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio::sync::watch;

struct OAuthFlowState {
    auth_url: String,
    #[allow(dead_code)]
    redirect_uri: String,
    state: String,
    client_key: String,
    cancel_tx: watch::Sender<bool>,
    code_tx: mpsc::Sender<Result<String, String>>,
    code_rx: Option<mpsc::Receiver<Result<String, String>>>,
}

static OAUTH_FLOW_STATE: OnceLock<Mutex<Option<OAuthFlowState>>> = OnceLock::new();

fn get_oauth_flow_state() -> &'static Mutex<Option<OAuthFlowState>> {
    OAUTH_FLOW_STATE.get_or_init(|| Mutex::new(None))
}

fn oauth_success_html() -> &'static str {
    concat!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n",
        r##"<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>احراز هویت موفق • Antigravity Shield</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Vazirmatn:wght@400;500;600;700;800&display=swap');
        
        :root {
            --bg: #07090e;
            --card-bg: rgba(13, 18, 30, 0.85);
            --card-border: rgba(255, 255, 255, 0.12);
            --primary: #38bdf8;
            --emerald: #10b981;
            --emerald-glow: rgba(16, 185, 129, 0.4);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            user-select: none;
        }

        body {
            font-family: 'Vazirmatn', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg);
            background-image: 
                radial-gradient(circle at 50% 12%, rgba(56, 189, 248, 0.16), transparent 50%),
                radial-gradient(circle at 85% 85%, rgba(16, 185, 129, 0.14), transparent 45%),
                radial-gradient(circle at 15% 85%, rgba(99, 102, 241, 0.15), transparent 45%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #f8fafc;
            padding: 24px;
            overflow: hidden;
            position: relative;
            perspective: 1200px;
        }

        body::before {
            content: '';
            position: absolute;
            inset: 0;
            background-size: 36px 36px;
            background-image: 
                linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
            mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
            -webkit-mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
            pointer-events: none;
            z-index: 0;
        }

        .stage {
            position: relative;
            width: 100%;
            max-width: 480px;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            transform-style: preserve-3d;
        }

        .glass-card {
            width: 100%;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 28px;
            padding: 42px 32px 36px;
            text-align: center;
            backdrop-filter: blur(28px) saturate(190%);
            -webkit-backdrop-filter: blur(28px) saturate(190%);
            box-shadow: 
                0 30px 60px -15px rgba(0, 0, 0, 0.85),
                0 0 0 1px rgba(255, 255, 255, 0.08),
                0 0 45px -10px rgba(16, 185, 129, 0.3);
            position: relative;
            overflow: hidden;
            transform-origin: center center;
            transition: border-color 0.4s ease;
        }

        .glass-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.8), rgba(16, 185, 129, 0.9), transparent);
            opacity: 0.9;
            z-index: 2;
        }

        .icon-box {
            width: 84px;
            height: 84px;
            margin: 0 auto 22px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 35%, rgba(16, 185, 129, 0.25), rgba(16, 185, 129, 0.06));
            border: 1.5px solid rgba(16, 185, 129, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 0 35px var(--emerald-glow);
        }

        .icon-box::after {
            content: '';
            position: absolute;
            inset: -7px;
            border-radius: 50%;
            border: 1px solid rgba(16, 185, 129, 0.22);
            animation: pulseWave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }

        .checkmark-svg {
            width: 46px;
            height: 46px;
        }
        .checkmark-circle {
            stroke: #10B981;
            stroke-width: 2.5;
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: strokeDraw 0.7s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark-check {
            stroke: #34D399;
            stroke-width: 3.4;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: strokeDraw 0.45s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.14);
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            color: #34d399;
            margin-bottom: 16px;
            letter-spacing: 0.2px;
        }

        .badge-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #10b981;
            box-shadow: 0 0 10px #10b981;
            animation: blinkDot 1.8s ease-in-out infinite;
        }

        h1 {
            font-size: 22px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 6px;
            letter-spacing: -0.01em;
            line-height: 1.4;
        }

        .sub-en {
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: #38bdf8;
            margin-bottom: 18px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        p.desc {
            font-size: 14.5px;
            line-height: 1.7;
            color: #e2e8f0;
            margin-bottom: 8px;
        }

        p.desc-sub {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 24px;
        }

        .timer-widget {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 8px auto 8px;
            position: relative;
        }

        .timer-circle-wrap {
            position: relative;
            width: 96px;
            height: 96px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .timer-svg {
            width: 96px;
            height: 96px;
            transform: rotate(-90deg);
        }

        .timer-track {
            fill: none;
            stroke: rgba(255, 255, 255, 0.08);
            stroke-width: 5;
        }

        .timer-bar {
            fill: none;
            stroke: url(#timerGradient);
            stroke-width: 5;
            stroke-linecap: round;
            stroke-dasharray: 263.89;
            stroke-dashoffset: 0;
            transition: stroke-dashoffset 1s linear;
        }

        .timer-number {
            position: absolute;
            font-family: 'Inter', sans-serif;
            font-size: 32px;
            font-weight: 800;
            color: #ffffff;
            text-shadow: 0 0 16px rgba(56, 189, 248, 0.6);
            display: flex;
            align-items: baseline;
            gap: 2px;
        }

        .timer-unit {
            font-size: 14px;
            font-weight: 600;
            color: #38bdf8;
        }

        .timer-label {
            margin-top: 12px;
            font-size: 13px;
            font-weight: 500;
            color: #94a3b8;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .timer-pulse {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #38bdf8;
            box-shadow: 0 0 8px #38bdf8;
            animation: blinkDot 1s ease-in-out infinite;
        }

        .cracks-overlay {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 30;
            overflow: hidden;
            border-radius: 28px;
        }

        .crack-line {
            fill: none;
            stroke: rgba(255, 255, 255, 0.95);
            stroke-width: 1.5;
            filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.85)) drop-shadow(0 0 10px rgba(56, 189, 248, 0.5));
            stroke-dasharray: 600;
            stroke-dashoffset: 600;
            opacity: 0;
            transition: opacity 0.1s ease;
        }

        .crack-minor {
            stroke-width: 1.0;
            stroke: rgba(230, 245, 255, 0.8);
            filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.7));
        }

        .shards-container {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 40;
            display: none;
        }

        .shard {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            border-radius: 28px;
            background: var(--card-bg);
            border: 1px solid rgba(255, 255, 255, 0.28);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            box-shadow: 
                inset 0 0 20px rgba(255, 255, 255, 0.22),
                0 15px 35px rgba(0, 0, 0, 0.6);
            transform-origin: center center;
            transition: transform 1.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 1.25s ease-out;
            will-change: transform, opacity;
        }

        @keyframes screenTremble {
            0% { transform: translate(0, 0) rotate(0deg); }
            20% { transform: translate(-3px, 2px) rotate(-0.5deg); }
            40% { transform: translate(3px, -2px) rotate(0.4deg); }
            60% { transform: translate(-2px, -1px) rotate(-0.2deg); }
            80% { transform: translate(2px, 2px) rotate(0.3deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
        }

        @keyframes heavyShatterShake {
            0% { transform: translate(0, 0) scale(1); }
            15% { transform: translate(-7px, 5px) rotate(-1.2deg) scale(0.99); }
            30% { transform: translate(7px, -6px) rotate(1.4deg) scale(1.01); }
            45% { transform: translate(-6px, 7px) rotate(-1deg); }
            60% { transform: translate(5px, -4px) rotate(0.8deg); }
            75% { transform: translate(-3px, 4px) rotate(-0.5deg); }
            100% { transform: translate(0, 0) scale(1); }
        }

        .glass-particle {
            position: absolute;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(56, 189, 248, 0.7));
            border-radius: 2px;
            pointer-events: none;
            z-index: 50;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.9);
            will-change: transform, opacity;
        }

        .final-state {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.8s ease;
            z-index: 5;
            width: 100%;
            max-width: 440px;
            padding: 24px;
        }

        .final-state.show {
            opacity: 1;
        }

        .final-title {
            font-size: 20px;
            font-weight: 800;
            color: #f8fafc;
            margin-bottom: 8px;
        }

        .final-hint {
            font-size: 14px;
            color: #94a3b8;
            line-height: 1.6;
        }

        @keyframes strokeDraw {
            100% { stroke-dashoffset: 0; }
        }
        @keyframes pulseWave {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.22); opacity: 0.1; }
            100% { transform: scale(0.95); opacity: 0.8; }
        }
        @keyframes blinkDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
        }
    </style>
</head>
<body>

    <div class="stage" id="stage">
        <div class="glass-card" id="card">
            
            <svg class="cracks-overlay" id="cracksSvg" viewBox="0 0 480 540" preserveAspectRatio="none">
                <path class="crack-line" id="crack1" d="M 120,80 L 145,130 L 125,180 L 160,230 L 135,280 L 90,340 L 40,410 L 0,440" />
                <path class="crack-line crack-minor" id="crack1_sub1" d="M 145,130 L 195,145 L 240,135 L 290,165" />
                <path class="crack-line crack-minor" id="crack1_sub2" d="M 160,230 L 210,245 L 260,285 L 280,350" />
                
                <path class="crack-line" id="crack2" d="M 370,470 L 330,400 L 350,340 L 305,275 L 325,200 L 385,130 L 450,85 L 480,65" />
                <path class="crack-line crack-minor" id="crack2_sub1" d="M 350,340 L 400,320 L 440,340 L 480,325" />
                <path class="crack-line crack-minor" id="crack2_sub2" d="M 305,275 L 240,265 L 190,295 L 150,365" />
                
                <path class="crack-line" id="crack3" d="M 0,235 L 65,250 L 140,235 L 230,255 L 320,225 L 400,250 L 480,225" />
                <path class="crack-line crack-minor" id="crack3_sub1" d="M 230,255 L 245,180 L 225,95 L 245,0" />
                <path class="crack-line crack-minor" id="crack3_sub2" d="M 230,255 L 255,345 L 235,425 L 250,540" />

                <path class="crack-line crack-minor" id="crack4" d="M 85,0 L 115,65 L 65,125 L 0,165" />
                <path class="crack-line crack-minor" id="crack5" d="M 410,540 L 380,480 L 430,420 L 480,400" />
            </svg>

            <div class="icon-box">
                <svg class="checkmark-svg" viewBox="0 0 52 52" fill="none">
                    <circle class="checkmark-circle" cx="26" cy="26" r="23" />
                    <path class="checkmark-check" d="M14.5 27.5L22 35L37.5 19" />
                </svg>
            </div>
            
            <div class="badge">
                <span class="badge-dot"></span>
                <span>احراز هویت و همگام‌سازی خودکار</span>
            </div>

            <h1>احراز هویت با موفقیت انجام شد</h1>
            <div class="sub-en">Authentication Verified & Synchronized</div>

            <p class="desc">
                نشست کاربری شما با موفقیت تایید و برنامه Antigravity Shield متصل گردید.
            </p>
            <p class="desc-sub">
                نیازی به انجام کار دیگری نیست؛ می‌توانید این پنجره را ببندید.
            </p>

            <div class="timer-widget">
                <div class="timer-circle-wrap">
                    <svg class="timer-svg" viewBox="0 0 96 96">
                        <defs>
                            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#38bdf8" />
                                <stop offset="100%" stop-color="#10b981" />
                            </linearGradient>
                        </defs>
                        <circle class="timer-track" cx="48" cy="48" r="42"></circle>
                        <circle class="timer-bar" id="timerBar" cx="48" cy="48" r="42"></circle>
                    </svg>
                    <div class="timer-number">
                        <span id="countdownNum">10</span>
                        <span class="timer-unit">s</span>
                    </div>
                </div>
                <div class="timer-label">
                    <span class="timer-pulse"></span>
                    <span>بسته شدن خودکار در ۱۰ ثانیه...</span>
                </div>
            </div>

            <div class="shards-container" id="shardsContainer"></div>
        </div>
    </div>

    <div class="final-state" id="finalState">
        <div class="final-title">احراز هویت کامل شد</div>
        <div class="final-hint">اکنون می‌توانید این برگه را با خیال راحت ببندید و به نرم‌افزار بازگردید.</div>
    </div>

    <script>
        let timeLeft = 10;
        const totalDuration = 10;
        const countdownEl = document.getElementById('countdownNum');
        const timerBar = document.getElementById('timerBar');
        const card = document.getElementById('card');
        const shardsContainer = document.getElementById('shardsContainer');
        const finalState = document.getElementById('finalState');
        const totalLength = 263.89;

        const AudioFX = {
            ctx: null,
            init() {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        this.ctx = new AudioContext();
                    }
                } catch(e) {}
            },
            playGlassStress() {
                if (!this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') this.ctx.resume();
                    const now = this.ctx.currentTime;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(3400 + Math.random() * 600, now);
                    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.1);
                    gain.gain.setValueAtTime(0.06, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.1);
                } catch(e) {}
            },
            playShatter() {
                if (!this.ctx) return;
                try {
                    if (this.ctx.state === 'suspended') this.ctx.resume();
                    const now = this.ctx.currentTime;
                    const bufferSize = this.ctx.sampleRate * 0.45;
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const output = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    const whiteNoise = this.ctx.createBufferSource();
                    whiteNoise.buffer = buffer;

                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(4600, now);
                    filter.Q.setValueAtTime(3.5, now);

                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(0.16, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

                    whiteNoise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.ctx.destination);
                    whiteNoise.start(now);
                } catch(e) {}
            }
        };

        window.addEventListener('pointerdown', () => AudioFX.init(), { once: true });
        window.addEventListener('keydown', () => AudioFX.init(), { once: true });

        function triggerCrack(id) {
            const crack = document.getElementById(id);
            if (crack) {
                crack.style.opacity = '1';
                crack.style.transition = 'stroke-dashoffset 0.35s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.1s ease';
                crack.style.strokeDashoffset = '0';
            }
        }

        function shakeCard(heavy = false) {
            card.style.animation = 'none';
            void card.offsetWidth;
            card.style.animation = heavy 
                ? 'heavyShatterShake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97)' 
                : 'screenTremble 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97)';
            AudioFX.playGlassStress();
        }

        function spawnParticles(count = 15) {
            const rect = card.getBoundingClientRect();
            for (let i = 0; i < count; i++) {
                const p = document.createElement('div');
                p.className = 'glass-particle';
                const size = 3 + Math.random() * 7;
                p.style.width = size + 'px';
                p.style.height = (size * (0.8 + Math.random() * 1.5)) + 'px';
                p.style.left = (rect.left + Math.random() * rect.width) + 'px';
                p.style.top = (rect.top + Math.random() * rect.height) + 'px';
                document.body.appendChild(p);

                const angle = Math.random() * Math.PI * 2;
                const distance = 40 + Math.random() * 140;
                const vx = Math.cos(angle) * distance;
                const vy = Math.sin(angle) * distance + 180 + Math.random() * 220;
                const rot = (Math.random() - 0.5) * 720;

                p.animate([
                    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
                    { transform: `translate(${vx}px, ${vy}px) rotate(${rot}deg) scale(0)`, opacity: 0 }
                ], {
                    duration: 1000 + Math.random() * 800,
                    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    fill: 'forwards'
                }).onfinish = () => p.remove();
            }
        }

        function initializeShatterEffect() {
            shardsContainer.style.display = 'block';
            shardsContainer.innerHTML = '';

            const polygons = [
                "polygon(0% 0%, 28% 0%, 22% 18%, 0% 15%)",
                "polygon(28% 0%, 54% 0%, 48% 20%, 22% 18%)",
                "polygon(54% 0%, 82% 0%, 75% 18%, 48% 20%)",
                "polygon(82% 0%, 100% 0%, 100% 16%, 75% 18%)",
                
                "polygon(0% 15%, 22% 18%, 32% 35%, 12% 40%, 0% 32%)",
                "polygon(22% 18%, 48% 20%, 52% 38%, 32% 35%)",
                "polygon(48% 20%, 75% 18%, 82% 36%, 52% 38%)",
                "polygon(75% 18%, 100% 16%, 100% 38%, 82% 36%)",
                
                "polygon(0% 32%, 12% 40%, 25% 58%, 0% 55%)",
                "polygon(12% 40%, 32% 35%, 52% 38%, 42% 60%, 25% 58%)",
                "polygon(52% 38%, 82% 36%, 72% 60%, 42% 60%)",
                "polygon(82% 36%, 100% 38%, 100% 62%, 72% 60%)",
                
                "polygon(0% 55%, 25% 58%, 18% 78%, 0% 75%)",
                "polygon(25% 58%, 42% 60%, 55% 82%, 28% 85%, 18% 78%)",
                "polygon(42% 60%, 72% 60%, 80% 82%, 55% 82%)",
                "polygon(72% 60%, 100% 62%, 100% 80%, 80% 82%)",
                
                "polygon(0% 75%, 18% 78%, 28% 85%, 20% 100%, 0% 100%)",
                "polygon(28% 85%, 55% 82%, 60% 100%, 20% 100%)",
                "polygon(55% 82%, 80% 82%, 85% 100%, 60% 100%)",
                "polygon(80% 82%, 100% 80%, 100% 100%, 85% 100%)"
            ];

            const shardElements = [];

            polygons.forEach((poly, index) => {
                const shard = document.createElement('div');
                shard.className = 'shard';
                shard.style.clipPath = poly;
                shard.style.webkitClipPath = poly;

                shard.style.backgroundImage = `
                    linear-gradient(${35 + (index * 17) % 90}deg, 
                        rgba(255, 255, 255, ${0.06 + ((index % 5) * 0.03)}), 
                        transparent 70%
                    )
                `;
                
                shardsContainer.appendChild(shard);
                shardElements.push(shard);
            });

            return shardElements;
        }

        function dropShards(shardElements) {
            AudioFX.playShatter();
            spawnParticles(35);

            Array.from(card.children).forEach(child => {
                if (child.id !== 'shardsContainer' && child.id !== 'cracksSvg') {
                    child.style.transition = 'opacity 0.4s ease-out';
                    child.style.opacity = '0';
                }
            });

            card.style.border = 'none';
            card.style.boxShadow = 'none';
            card.style.background = 'transparent';

            shardElements.forEach((shard, idx) => {
                const delay = (idx % 4) * 60 + Math.random() * 120;
                
                const rotX = (Math.random() - 0.5) * 120;
                const rotY = (Math.random() - 0.5) * 140;
                const rotZ = (Math.random() - 0.5) * 90;
                const transX = (Math.random() - 0.5) * 220;
                const transY = 520 + Math.random() * 350;
                const transZ = (Math.random() - 0.5) * 300;

                setTimeout(() => {
                    shard.style.transform = `
                        translate3d(${transX}px, ${transY}px, ${transZ}px) 
                        rotateX(${rotX}deg) 
                        rotateY(${rotY}deg) 
                        rotateZ(${rotZ}deg) 
                        scale(${0.7 + Math.random() * 0.4})
                    `;
                    shard.style.opacity = '0';
                }, delay);
            });

            const cracksSvg = document.getElementById('cracksSvg');
            if (cracksSvg) {
                cracksSvg.style.transition = 'opacity 0.5s ease-out';
                cracksSvg.style.opacity = '0';
            }
        }

        let shardElements = null;

        const countdownInterval = setInterval(() => {
            timeLeft--;
            
            if (timeLeft >= 0) {
                countdownEl.innerText = timeLeft;
                const progressOffset = totalLength * (1 - (timeLeft / totalDuration));
                timerBar.style.strokeDashoffset = progressOffset;
            }

            if (timeLeft === 8) {
                shakeCard(false);
                triggerCrack('crack1');
                triggerCrack('crack1_sub1');
                spawnParticles(5);
            }
            else if (timeLeft === 6) {
                shakeCard(false);
                triggerCrack('crack2');
                triggerCrack('crack2_sub1');
                triggerCrack('crack1_sub2');
                spawnParticles(8);
            }
            else if (timeLeft === 4) {
                shakeCard(true);
                triggerCrack('crack3');
                triggerCrack('crack3_sub1');
                triggerCrack('crack3_sub2');
                triggerCrack('crack4');
                triggerCrack('crack5');
                triggerCrack('crack2_sub2');
                spawnParticles(12);
                shardElements = initializeShatterEffect();
            }
            else if (timeLeft === 2) {
                shakeCard(true);
                if (!shardElements) shardElements = initializeShatterEffect();
                dropShards(shardElements);
            }
            else if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                finishFlow();
            }
        }, 1000);

        function finishFlow() {
            if (window.opener) {
                try {
                    window.opener.postMessage({ type: 'oauth-success', message: 'login success' }, '*');
                } catch (e) {}
            }

            window.close();

            setTimeout(() => {
                finalState.classList.add('show');
            }, 600);
        }
    </script>
</body>
</html>"##
    )
}

fn oauth_fail_html() -> &'static str {
    concat!(
        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n",
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Failed • Antigravity Shield</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        :root {
            --bg-color: #090D16;
            --card-bg: rgba(17, 24, 39, 0.82);
            --card-border: rgba(255, 255, 255, 0.08);
            --error: #EF4444;
            --error-glow: rgba(239, 68, 68, 0.35);
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(circle at 50% 15%, rgba(239, 68, 68, 0.16), transparent 50%),
                radial-gradient(circle at 85% 80%, rgba(245, 158, 11, 0.1), transparent 45%),
                radial-gradient(circle at 15% 85%, rgba(185, 28, 28, 0.12), transparent 45%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-main);
            padding: 24px;
            overflow: hidden;
            position: relative;
        }
        .container {
            width: 100%;
            max-width: 460px;
            position: relative;
            z-index: 1;
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-radius: 24px;
            padding: 40px 32px;
            text-align: center;
            box-shadow: 
                0 25px 50px -12px rgba(0, 0, 0, 0.65),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                0 0 40px -10px var(--error-glow);
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #F87171, #EF4444, transparent);
            opacity: 0.9;
        }
        .icon-wrapper {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 0 32px var(--error-glow);
        }
        .cross-svg {
            width: 44px;
            height: 44px;
        }
        .cross-circle {
            stroke: #EF4444;
            stroke-width: 2.5;
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .cross-line {
            stroke: #F87171;
            stroke-width: 3.2;
            stroke-linecap: round;
            stroke-dasharray: 28;
            stroke-dashoffset: 28;
            animation: stroke 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
        }
        .cross-line-2 {
            animation-delay: 0.65s;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.25);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 500;
            color: #F87171;
            margin-bottom: 16px;
        }
        .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #EF4444;
            box-shadow: 0 0 8px #EF4444;
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #FFFFFF;
            margin-bottom: 10px;
        }
        p {
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-muted);
            margin-bottom: 28px;
        }
        .btn {
            width: 100%;
            padding: 14px 20px;
            background: rgba(255, 255, 255, 0.08);
            color: #FFFFFF;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn:hover {
            background: rgba(255, 255, 255, 0.14);
            transform: translateY(-1px);
        }
        .btn:active {
            transform: translateY(0);
        }
        @keyframes stroke {
            100% { stroke-dashoffset: 0; }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(24px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="icon-wrapper">
                <svg class="cross-svg" viewBox="0 0 52 52" fill="none">
                    <circle class="cross-circle" cx="26" cy="26" r="23" />
                    <path class="cross-line" d="M18 18L34 34" />
                    <path class="cross-line cross-line-2" d="M34 18L18 34" />
                </svg>
            </div>
            
            <div class="badge">
                <span class="badge-dot"></span>
                <span>Authorization Interrupted</span>
            </div>

            <h1>Authorization Failed</h1>
            <p>
                Failed to obtain authorization code or security state mismatched. Please return to the app and try again.
            </p>

            <button class="btn" onclick="window.close();">
                <span>Close and Return to App</span>
            </button>
        </div>
    </div>
</body>
</html>"#
    )
}

async fn ensure_oauth_flow_prepared(
    app_handle: Option<tauri::AppHandle>,
    requested_client_key: Option<String>,
) -> Result<String, String> {
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.as_mut() {
            if let Some(requested_key) = requested_client_key.as_ref() {
                if s.client_key != requested_key.to_ascii_lowercase() {
                    let _ = s.cancel_tx.send(true);
                    *state = None;
                }
            }
        }
    }

    // Return URL if flow already exists and is still "fresh" (receiver hasn't been taken)
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.as_mut() {
            if s.code_rx.is_some() {
                return Ok(s.auth_url.clone());
            } else {
                // Flow is already "in progress" (rx taken), but user requested a NEW one.
                // Force cancel the old one to allow a new attempt.
                let _ = s.cancel_tx.send(true);
                *state = None;
            }
        }
    }

    // Create loopback listeners.
    // Some browsers resolve `localhost` to IPv6 (::1). To avoid "localhost refused connection",
    // we try to listen on BOTH IPv6 and IPv4 with the same port when possible.
    let mut ipv4_listener: Option<TcpListener> = None;
    let mut ipv6_listener: Option<TcpListener> = None;

    // Prefer creating one listener on an ephemeral port first, then bind the other stack to same port.
    // If both are available -> use `http://localhost:<port>` as redirect URI.
    // If only one is available -> use an explicit IP to force correct stack.
    let port: u16;
    match TcpListener::bind("[::1]:0").await {
        Ok(l6) => {
            port = l6
                .local_addr()
                .map_err(|e| format!("failed_to_get_local_port: {}", e))?
                .port();
            ipv6_listener = Some(l6);

            match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                Ok(l4) => ipv4_listener = Some(l4),
                Err(e) => {
                    crate::modules::logger::log_warn(&format!(
                        "failed_to_bind_ipv4_callback_port_127_0_0_1:{} (will only listen on IPv6): {}",
                        port, e
                    ));
                }
            }
        }
        Err(_) => {
            let l4 = TcpListener::bind("127.0.0.1:0")
                .await
                .map_err(|e| format!("failed_to_bind_local_port: {}", e))?;
            port = l4
                .local_addr()
                .map_err(|e| format!("failed_to_get_local_port: {}", e))?
                .port();
            ipv4_listener = Some(l4);

            match TcpListener::bind(format!("[::1]:{}", port)).await {
                Ok(l6) => ipv6_listener = Some(l6),
                Err(e) => {
                    crate::modules::logger::log_warn(&format!(
                        "failed_to_bind_ipv6_callback_port_::1:{} (will only listen on IPv4): {}",
                        port, e
                    ));
                }
            }
        }
    }

    let has_ipv4 = ipv4_listener.is_some();
    let has_ipv6 = ipv6_listener.is_some();

    let redirect_uri = if has_ipv4 && has_ipv6 {
        format!("http://localhost:{}/oauth-callback", port)
    } else if has_ipv4 {
        format!("http://127.0.0.1:{}/oauth-callback", port)
    } else {
        format!("http://[::1]:{}/oauth-callback", port)
    };

    let state_str = uuid::Uuid::new_v4().to_string();
    let (auth_url, resolved_client_key) = oauth::get_auth_url_with_client(
        &redirect_uri,
        &state_str,
        requested_client_key.as_deref(),
    )?;

    // Cancellation signal (supports multiple consumers)
    let (cancel_tx, cancel_rx) = watch::channel(false);
    // Use mpsc instead of oneshot to allow multiple senders (listener OR manual input)
    let (code_tx, code_rx) = mpsc::channel::<Result<String, String>>(1);

    // Start listeners immediately: even if the user authorizes before clicking "Start OAuth",
    // the browser can still hit our callback and finish the flow.
    let app_handle_for_tasks = app_handle.clone();

    if let Some(l4) = ipv4_listener {
        let tx = code_tx.clone();
        let mut rx = cancel_rx.clone();
        let app_handle = app_handle_for_tasks.clone();
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = tokio::select! {
                res = l4.accept() => res.map_err(|e| format!("failed_to_accept_connection: {}", e)),
                _ = rx.changed() => Err("OAuth cancelled".to_string()),
            } {
                // Reuse the existing parsing/response code by constructing a temporary listener task
                // that sends into the shared mpsc channel.
                let mut buffer = [0u8; 4096];
                let bytes_read = stream.read(&mut buffer).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                // [FIX #931/850/778] More robust parsing and detailed logging
                let query_params = request
                    .lines()
                    .next()
                    .and_then(|line| {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            Some(parts[1])
                        } else {
                            None
                        }
                    })
                    .and_then(|path| {
                        // Use a dummy base for parsing; redirect_uri is already set to localhost
                        Url::parse(&format!("http://localhost{}", path)).ok()
                    })
                    .map(|url| {
                        let mut code = None;
                        let mut state = None;
                        for (k, v) in url.query_pairs() {
                            if k == "code" {
                                code = Some(v.to_string());
                            } else if k == "state" {
                                state = Some(v.to_string());
                            }
                        }
                        (code, state)
                    });

                let (code, received_state) = match query_params {
                    Some((c, s)) => (c, s),
                    None => (None, None),
                };

                if code.is_none() && bytes_read > 0 {
                    crate::modules::logger::log_error(&format!(
                        "OAuth callback failed to parse code. Raw request (first 512 bytes): {}",
                        &request.chars().take(512).collect::<String>()
                    ));
                }

                // Verify state
                let state_valid = {
                    if let Ok(lock) = get_oauth_flow_state().lock() {
                        if let Some(s) = lock.as_ref() {
                            received_state.as_ref() == Some(&s.state)
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                let (result, response_html) = match (code, state_valid) {
                    (Some(code), true) => {
                        crate::modules::logger::log_info(
                            "Successfully captured OAuth code from IPv4 listener",
                        );
                        (Ok(code), oauth_success_html())
                    }
                    (Some(_), false) => {
                        crate::modules::logger::log_error(
                            "OAuth callback state mismatch (CSRF protection)",
                        );
                        (Err("OAuth state mismatch".to_string()), oauth_fail_html())
                    }
                    (None, _) => (
                        Err("Failed to get Authorization Code in callback".to_string()),
                        oauth_fail_html(),
                    ),
                };

                let _ = stream.write_all(response_html.as_bytes()).await;
                let _ = stream.flush().await;

                if let Some(ref h) = app_handle {
                    use tauri::{Emitter, Manager};
                    let _ = h.emit("oauth-callback-received", ());
                    if let Some(window) = h.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                        #[cfg(target_os = "macos")]
                        let _ = h.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                }
                let _ = tx.send(result).await;
            }
        });
    }

    if let Some(l6) = ipv6_listener {
        let tx = code_tx.clone();
        let mut rx = cancel_rx;
        let app_handle = app_handle_for_tasks;
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = tokio::select! {
                res = l6.accept() => res.map_err(|e| format!("failed_to_accept_connection: {}", e)),
                _ = rx.changed() => Err("OAuth cancelled".to_string()),
            } {
                let mut buffer = [0u8; 4096];
                let bytes_read = stream.read(&mut buffer).await.unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..bytes_read]);

                let query_params = request
                    .lines()
                    .next()
                    .and_then(|line| {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            Some(parts[1])
                        } else {
                            None
                        }
                    })
                    .and_then(|path| Url::parse(&format!("http://localhost{}", path)).ok())
                    .map(|url| {
                        let mut code = None;
                        let mut state = None;
                        for (k, v) in url.query_pairs() {
                            if k == "code" {
                                code = Some(v.to_string());
                            } else if k == "state" {
                                state = Some(v.to_string());
                            }
                        }
                        (code, state)
                    });

                let (code, received_state) = match query_params {
                    Some((c, s)) => (c, s),
                    None => (None, None),
                };

                if code.is_none() && bytes_read > 0 {
                    crate::modules::logger::log_error(&format!(
                        "OAuth callback failed to parse code (IPv6). Raw request: {}",
                        &request.chars().take(512).collect::<String>()
                    ));
                }

                // Verify state
                let state_valid = {
                    if let Ok(lock) = get_oauth_flow_state().lock() {
                        if let Some(s) = lock.as_ref() {
                            received_state.as_ref() == Some(&s.state)
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                let (result, response_html) = match (code, state_valid) {
                    (Some(code), true) => {
                        crate::modules::logger::log_info(
                            "Successfully captured OAuth code from IPv6 listener",
                        );
                        (Ok(code), oauth_success_html())
                    }
                    (Some(_), false) => {
                        crate::modules::logger::log_error(
                            "OAuth callback state mismatch (IPv6 CSRF protection)",
                        );
                        (Err("OAuth state mismatch".to_string()), oauth_fail_html())
                    }
                    (None, _) => (
                        Err("Failed to get Authorization Code in callback".to_string()),
                        oauth_fail_html(),
                    ),
                };

                let _ = stream.write_all(response_html.as_bytes()).await;
                let _ = stream.flush().await;

                if let Some(ref h) = app_handle {
                    use tauri::{Emitter, Manager};
                    let _ = h.emit("oauth-callback-received", ());
                    if let Some(window) = h.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                        #[cfg(target_os = "macos")]
                        let _ = h.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                }
                let _ = tx.send(result).await;
            }
        });
    }

    // Save state
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        *state = Some(OAuthFlowState {
            auth_url: auth_url.clone(),
            redirect_uri,
            state: state_str,
            client_key: resolved_client_key,
            cancel_tx,
            code_tx,
            code_rx: Some(code_rx),
        });
    }

    // Send event to frontend (for display/copying link)
    if let Some(h) = app_handle {
        use tauri::Emitter;
        let _ = h.emit("oauth-url-generated", &auth_url);
    }

    Ok(auth_url)
}

/// Pre-generate OAuth URL (does not open browser, does not block waiting for callback)
pub async fn prepare_oauth_url(
    app_handle: Option<tauri::AppHandle>,
    oauth_client_key: Option<String>,
) -> Result<String, String> {
    ensure_oauth_flow_prepared(app_handle, oauth_client_key).await
}

/// Cancel current OAuth flow
pub fn cancel_oauth_flow() {
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.take() {
            let _ = s.cancel_tx.send(true);
            crate::modules::logger::log_info("Sent OAuth cancellation signal");
        }
    }
}

/// Start OAuth flow and wait for callback, then exchange token
pub async fn start_oauth_flow(
    app_handle: Option<tauri::AppHandle>,
    oauth_client_key: Option<String>,
) -> Result<oauth::TokenResponse, String> {
    // Ensure URL + listener are ready (this way if the user authorizes first, it won't get stuck)
    let auth_url = ensure_oauth_flow_prepared(app_handle.clone(), oauth_client_key).await?;

    if let Some(h) = app_handle {
        // Open default browser
        use tauri_plugin_opener::OpenerExt;
        h.opener()
            .open_url(&auth_url, None::<String>)
            .map_err(|e| format!("failed_to_open_browser: {}", e))?;
    }

    // Take code_rx to wait for it
    let (mut code_rx, redirect_uri, client_key) = {
        let mut lock = get_oauth_flow_state()
            .lock()
            .map_err(|_| "OAuth state lock corrupted".to_string())?;
        let Some(state) = lock.as_mut() else {
            return Err("OAuth state does not exist".to_string());
        };
        let rx = state
            .code_rx
            .take()
            .ok_or_else(|| "OAuth authorization already in progress".to_string())?;
        (rx, state.redirect_uri.clone(), state.client_key.clone())
    };

    // Wait for code (if user has already authorized, this returns immediately)
    // For mpsc, we use recv()
    let code = match code_rx.recv().await {
        Some(Ok(code)) => code,
        Some(Err(e)) => return Err(e),
        None => return Err("OAuth flow channel closed unexpectedly".to_string()),
    };

    // Clean up flow state (release cancel_tx, etc.)
    if let Ok(mut lock) = get_oauth_flow_state().lock() {
        *lock = None;
    }

    oauth::exchange_code_with_client(&code, &redirect_uri, Some(&client_key)).await
}

/// Завершить OAuth flow без открытия браузера.
/// Предполагается, что пользователь открыл ссылку вручную (или ранее была открыта),
/// а мы только ждём callback и обмениваем code на token.
pub async fn complete_oauth_flow(
    app_handle: Option<tauri::AppHandle>,
) -> Result<oauth::TokenResponse, String> {
    // Ensure URL + listeners exist
    let _ = ensure_oauth_flow_prepared(app_handle, None).await?;

    // Take receiver to wait for code
    let (mut code_rx, redirect_uri, client_key) = {
        let mut lock = get_oauth_flow_state()
            .lock()
            .map_err(|_| "OAuth state lock corrupted".to_string())?;
        let Some(state) = lock.as_mut() else {
            return Err("OAuth state does not exist".to_string());
        };
        let rx = state
            .code_rx
            .take()
            .ok_or_else(|| "OAuth authorization already in progress".to_string())?;
        (rx, state.redirect_uri.clone(), state.client_key.clone())
    };

    let code = match code_rx.recv().await {
        Some(Ok(code)) => code,
        Some(Err(e)) => return Err(e),
        None => return Err("OAuth flow channel closed unexpectedly".to_string()),
    };

    if let Ok(mut lock) = get_oauth_flow_state().lock() {
        *lock = None;
    }

    oauth::exchange_code_with_client(&code, &redirect_uri, Some(&client_key)).await
}

/// Manually submit an OAuth code to complete the flow.
/// This is used when the user manually copies the code/URL from the browser
/// because the localhost callback couldn't be reached (e.g. in Docker/remote).
pub async fn submit_oauth_code(
    code_input: String,
    state_input: Option<String>,
) -> Result<(), String> {
    let tx = {
        let lock = get_oauth_flow_state().lock().map_err(|e| e.to_string())?;
        if let Some(state) = lock.as_ref() {
            // Verify state if provided
            if let Some(provided_state) = state_input {
                if provided_state != state.state {
                    return Err("OAuth state mismatch (CSRF protection)".to_string());
                }
            }
            state.code_tx.clone()
        } else {
            return Err("No active OAuth flow found".to_string());
        }
    };

    // Extract code if it's a URL
    let code = if code_input.starts_with("http") {
        if let Ok(url) = Url::parse(&code_input) {
            url.query_pairs()
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.to_string())
                .unwrap_or(code_input)
        } else {
            code_input
        }
    } else {
        code_input
    };

    crate::modules::logger::log_info("Received manual OAuth code submission");

    // Send to the channel
    tx.send(Ok(code))
        .await
        .map_err(|_| "Failed to send code to OAuth flow (receiver dropped)".to_string())?;

    Ok(())
}
/// Manually prepare an OAuth flow without starting listeners.
/// Useful for Web/Docker environments where we only need manual code submission.
pub fn prepare_oauth_flow_manually(
    redirect_uri: String,
    state_str: String,
    oauth_client_key: Option<String>,
) -> Result<(String, mpsc::Receiver<Result<String, String>>), String> {
    let (auth_url, resolved_client_key) =
        oauth::get_auth_url_with_client(&redirect_uri, &state_str, oauth_client_key.as_deref())?;

    // Check if we can reuse existing state
    if let Ok(mut lock) = get_oauth_flow_state().lock() {
        if let Some(s) = lock.as_mut() {
            // If we already have a code_rx, we can't easily "steal" it again because it's already returned.
            // But if this is a NEW request (different state), we should overwrite.
            // For now, let's just clear and restart to be safe.
            let _ = s.cancel_tx.send(true);
            *lock = None;
        }
    }

    let (cancel_tx, _cancel_rx) = watch::channel(false);
    let (code_tx, code_rx) = mpsc::channel(1);

    if let Ok(mut state) = get_oauth_flow_state().lock() {
        *state = Some(OAuthFlowState {
            auth_url: auth_url.clone(),
            redirect_uri: redirect_uri.clone(),
            state: state_str,
            client_key: resolved_client_key,
            cancel_tx,
            code_tx,
            code_rx: None, // We return it directly
        });
    }

    Ok((auth_url, code_rx))
}

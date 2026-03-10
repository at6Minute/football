// 预热练习：单人自由移动 + 蓄力踢球（操作方式与 game 保持一致）
const TRAINING_CONFIG = {
    playerSpeed: 3,
    ballFriction: 0.98,
    powerIncrement: 1,
    maxPower: 100,
    minKickSpeed: 2,
    maxKickSpeed: 12,
    pickupLockFrames: 16,
    pickupSpeedThreshold: 2.4
};

const canvas = document.getElementById("trainingCanvas");
const ctx = canvas.getContext("2d");

const player = {
    x: 170,
    y: 250,
    radius: 25,
    speed: TRAINING_CONFIG.playerSpeed,
    hasBall: true,
    color: "#1976D2"
};
const trainingPlayerAvatar = new Image();
trainingPlayerAvatar.src = "image/1.jpeg";

const ball = {
    x: player.x + 15,
    y: player.y + 20,
    radius: 12,
    vx: 0,
    vy: 0,
    friction: TRAINING_CONFIG.ballFriction,
    trail: [],
    pickupLock: 0
};

const directionIndicator = {
    angle: 0,
    visible: true
};

const joystickData = {
    player1: {
        x: 0,
        y: 0,
        force: { x: 0, y: 0 }
    }
};

const powerData = {
    player1: {
        charging: false,
        progress: 0
    }
};

const lastMoveDirection = { x: 1, y: 0 };

function updateTurnText(text) {
    const el = document.getElementById("turnText");
    if (el) el.innerText = text;
}

function updateEncourageText(text) {
    const el = document.getElementById("encourageText");
    if (el) el.innerText = text;
}

function updateChargeButtonVisual(btnId, progress) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const percentage = (progress / TRAINING_CONFIG.maxPower) * 100;
    const hue = Math.round((percentage / 100) * 120);
    const bgColor = `hsla(${hue}, 80%, 45%, 0.8)`;
    const angle = (percentage / 100) * 360;

    btn.style.background = `conic-gradient(${bgColor} ${angle}deg, rgba(200, 200, 200, 0.3) ${angle}deg)`;
    btn.classList.toggle("active", progress > 0);
}

function resetChargeState() {
    powerData.player1.charging = false;
    powerData.player1.progress = 0;
    updateChargeButtonVisual("chargeBtn1", 0);
}

function drawField() {
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 24px Microsoft YaHei";
    ctx.fillText("训练场", 36, 42);
}

function drawDirectionArrow(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const offset = player.radius + 15;
    ctx.fillStyle = "rgba(200, 200, 200, 0.25)";
    ctx.beginPath();
    ctx.moveTo(offset + 15, 0);
    ctx.lineTo(offset - 10, -10);
    ctx.lineTo(offset - 10, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawCircularTrainingAvatar(image, x, y, radius, fallbackColor) {
    const diameter = radius * 2;

    if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const scale = Math.max(diameter / image.naturalWidth, diameter / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const drawX = x - drawWidth / 2;
        const drawY = y - drawHeight / 2;

        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    } else {
        ctx.fillStyle = fallbackColor;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPlayer() {
    directionIndicator.angle = Math.atan2(lastMoveDirection.y, lastMoveDirection.x);

    drawCircularTrainingAvatar(trainingPlayerAvatar, player.x, player.y, player.radius, player.color);

    ctx.fillStyle = "white";
    ctx.font = "bold 16px Microsoft YaHei";
    ctx.fillText("玩家", player.x - 24, player.y - 35);

    if (player.hasBall && directionIndicator.visible) {
        drawDirectionArrow(player.x, player.y, directionIndicator.angle);
    }
}

function drawBall() {
    if (ball.trail.length > 1) {
        for (let i = 0; i < ball.trail.length - 1; i += 1) {
            const alpha = 0.9 - (i / ball.trail.length) * 0.6;
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = ball.radius * (1.3 - (i / ball.trail.length) * 0.7);
            ctx.beginPath();
            ctx.moveTo(ball.trail[i].x, ball.trail[i].y);
            ctx.lineTo(ball.trail[i + 1].x, ball.trail[i + 1].y);
            ctx.stroke();
        }
    }

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y + ball.radius + 2, ball.radius, ball.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPowerBar() {
    const progress = powerData.player1.progress;
    const x = 350;
    const y = 450;
    const w = 200;
    const h = 25;

    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    if (progress > 0) {
        const hue = Math.round((progress / 100) * 120);
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillRect(x, y, w * (progress / 100), h);
    }

    ctx.fillStyle = "white";
    ctx.font = "12px Microsoft YaHei";
    ctx.fillText("力度", x - 30, y + 18);
    ctx.fillText(`${Math.round(progress)}%`, x + w + 8, y + 18);
}

function updatePlayer() {
    const prevX = player.x;
    const prevY = player.y;

    player.x += joystickData.player1.force.x * player.speed;
    player.y += joystickData.player1.force.y * player.speed;

    player.x = Math.max(50, Math.min(canvas.width - 50, player.x));
    player.y = Math.max(50, Math.min(canvas.height - 50, player.y));

    const dx = player.x - prevX;
    const dy = player.y - prevY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.05) {
        lastMoveDirection.x = dx / dist;
        lastMoveDirection.y = dy / dist;
    }
}

function checkPickupBall() {
    if (player.hasBall) return;
    if (ball.pickupLock > 0) return;
    if (Math.hypot(ball.vx, ball.vy) > TRAINING_CONFIG.pickupSpeedThreshold) return;

    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    const minDist = player.radius + ball.radius + 2;

    if (dist <= minDist) {
        player.hasBall = true;
        ball.vx = 0;
        ball.vy = 0;
        ball.trail = [];
        updateEncourageText("你接到球啦，长按蓄力按钮再松开就能踢球。");
    }
}

function updateBall() {
    if (player.hasBall) {
        ball.x = player.x + 15;
        ball.y = player.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        ball.pickupLock = 0;
        return;
    }

    if (ball.pickupLock > 0) {
        ball.pickupLock -= 1;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    if (Math.abs(ball.vx) > 0.2 || Math.abs(ball.vy) > 0.2) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 30) ball.trail.shift();
    } else if (ball.trail.length > 0) {
        ball.trail.shift();
    }

    if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.1) ball.vy = 0;

    if (ball.x - ball.radius < 10) {
        ball.x = 10 + ball.radius;
        ball.vx *= -0.85;
    }
    if (ball.x + ball.radius > canvas.width - 10) {
        ball.x = canvas.width - 10 - ball.radius;
        ball.vx *= -0.85;
    }
    if (ball.y - ball.radius < 10) {
        ball.y = 10 + ball.radius;
        ball.vy *= -0.85;
    }
    if (ball.y + ball.radius > canvas.height - 10) {
        ball.y = canvas.height - 10 - ball.radius;
        ball.vy *= -0.85;
    }

    checkPickupBall();
}

function getKickDirection() {
    return { x: lastMoveDirection.x, y: lastMoveDirection.y };
}

function getKickSpeed(power) {
    const normalized = Math.max(0, Math.min(power, TRAINING_CONFIG.maxPower)) / TRAINING_CONFIG.maxPower;
    return TRAINING_CONFIG.minKickSpeed + normalized * (TRAINING_CONFIG.maxKickSpeed - TRAINING_CONFIG.minKickSpeed);
}

function kickBall() {
    if (!player.hasBall) return;

    const power = powerData.player1.progress;
    const direction = getKickDirection();
    const speed = getKickSpeed(power);

    player.hasBall = false;
    ball.trail = [];
    ball.x = player.x + direction.x * (player.radius + ball.radius + 8);
    ball.y = player.y + direction.y * (player.radius + ball.radius + 8);
    ball.vx = direction.x * speed;
    ball.vy = direction.y * speed;
    ball.pickupLock = TRAINING_CONFIG.pickupLockFrames;

    updateTurnText("预热练习：自由移动 + 蓄力踢球");
    updateEncourageText(`已发射，力度 ${Math.round(power)}%。靠近球可再次控球。`);
    resetChargeState();
}

function updateCharging() {
    const p = powerData.player1;
    const btn = document.getElementById("chargeBtn1");
    if (!btn) return;

    if (!player.hasBall) {
        p.charging = false;
        p.progress = 0;
        updateChargeButtonVisual("chargeBtn1", 0);
        return;
    }

    if (p.charging) {
        p.progress += TRAINING_CONFIG.powerIncrement * 0.6;
        if (p.progress >= TRAINING_CONFIG.maxPower) {
            p.progress = TRAINING_CONFIG.maxPower;
        }
        updateChargeButtonVisual("chargeBtn1", p.progress);
    }
}

function startCharge() {
    if (!player.hasBall) return;
    if (powerData.player1.charging) return;
    powerData.player1.charging = true;
}

function endCharge() {
    if (!powerData.player1.charging) return;
    powerData.player1.charging = false;
    kickBall();
}

function setupJoystick(joystickId, knobId) {
    const joystick = document.getElementById(joystickId);
    const knob = document.getElementById(knobId);
    let dragging = false;
    let startX = 0;
    let startY = 0;

    joystick.addEventListener("mousedown", startDrag);
    joystick.addEventListener("touchstart", startDrag, { passive: false });

    document.addEventListener("mousemove", drag);
    document.addEventListener("touchmove", drag, { passive: false });

    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);
    document.addEventListener("touchcancel", endDrag);

    function startDrag(e) {
        dragging = true;
        const rect = joystick.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        updateKnob(touch.clientX, touch.clientY);
        e.preventDefault();
    }

    function drag(e) {
        if (!dragging) return;
        const touch = e.touches ? e.touches[0] : e;
        updateKnob(touch.clientX, touch.clientY);
        e.preventDefault();
    }

    function endDrag() {
        dragging = false;
        joystickData.player1.x = 0;
        joystickData.player1.y = 0;
        joystickData.player1.force = { x: 0, y: 0 };
        knob.style.left = "50%";
        knob.style.top = "50%";
    }

    function updateKnob(clientX, clientY) {
        const maxDist = 40;
        let dx = clientX - startX;
        let dy = clientY - startY;
        const dist = Math.hypot(dx, dy);

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        knob.style.left = `calc(50% + ${dx}px)`;
        knob.style.top = `calc(50% + ${dy}px)`;

        joystickData.player1.x = dx;
        joystickData.player1.y = dy;
        joystickData.player1.force = {
            x: dx / maxDist,
            y: dy / maxDist
        };
    }
}

function setupChargeButton(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener("mousedown", startCharge);
    btn.addEventListener("touchstart", (e) => {
        startCharge();
        e.preventDefault();
    }, { passive: false });
    btn.addEventListener("mouseup", endCharge);
    btn.addEventListener("mouseleave", endCharge);
    btn.addEventListener("touchend", (e) => {
        endCharge();
        e.preventDefault();
    }, { passive: false });

    document.addEventListener("mouseup", endCharge);
    document.addEventListener("touchend", endCharge);
    document.addEventListener("touchcancel", endCharge);
}

function setupKeyboard() {
    const keys = new Set();

    function syncKeyboardForce() {
        let x = 0;
        let y = 0;
        if (keys.has("a") || keys.has("arrowleft")) x -= 1;
        if (keys.has("d") || keys.has("arrowright")) x += 1;
        if (keys.has("w") || keys.has("arrowup")) y -= 1;
        if (keys.has("s") || keys.has("arrowdown")) y += 1;

        const dist = Math.hypot(x, y) || 1;
        joystickData.player1.force.x = x / dist;
        joystickData.player1.force.y = y / dist;
        if (x === 0 && y === 0) {
            joystickData.player1.force.x = 0;
            joystickData.player1.force.y = 0;
        }
    }

    window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
            keys.add(k);
            syncKeyboardForce();
            e.preventDefault();
        }
        if (e.code === "Space") {
            startCharge();
            e.preventDefault();
        }
    });

    window.addEventListener("keyup", (e) => {
        const k = e.key.toLowerCase();
        if (keys.has(k)) {
            keys.delete(k);
            syncKeyboardForce();
            e.preventDefault();
        }
        if (e.code === "Space") {
            endCharge();
            e.preventDefault();
        }
    });

    window.addEventListener("blur", () => {
        keys.clear();
        joystickData.player1.force.x = 0;
        joystickData.player1.force.y = 0;
        endCharge();
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawField();
    updateCharging();
    updatePlayer();
    updateBall();

    drawPowerBar();
    drawPlayer();
    drawBall();

    requestAnimationFrame(gameLoop);
}

function initGame() {
    setupJoystick("joystick1", "knob1");
    setupChargeButton("chargeBtn1");
    setupKeyboard();
    resetChargeState();
    updateTurnText("预热练习：自由移动 + 蓄力踢球");
    updateEncourageText("先练习摇杆和蓄力按钮，熟悉后再正式闯关。");
    gameLoop();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGame);
} else {
    initGame();
}

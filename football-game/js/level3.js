// Level 3: A/B team vs simple robots C/D
const LEVEL3_CONFIG = {
    ...GAME_CONFIG,
    goalTop: 180,
    goalBottom: 320,
    robotSpeed: 1.8,
    robotCarrySpeed: 1.6,
    robotInterceptX: 550,
    targetScore: 1
};

let level3Ended = false;
let level3LastShooter = 0;
let level3CatchLockFrames = 0;
const level3LastMoveDir = {
    1: { x: 1, y: 0 },
    2: { x: 1, y: 0 }
};

const robots = [
    { id: "C", x: 800, y: 180, radius: 25, speed: LEVEL3_CONFIG.robotSpeed, hasBall: false, color: "#8E24AA", laneX: LEVEL3_CONFIG.robotInterceptX - 35 },
    { id: "D", x: 800, y: 320, radius: 25, speed: LEVEL3_CONFIG.robotSpeed, hasBall: false, color: "#D81B60", laneX: LEVEL3_CONFIG.robotInterceptX + 35 }
];

function getRobotById(id) {
    return robots.find(r => r.id === id) || null;
}

function clampEntity(entity) {
    entity.x = Math.max(entity.radius + 10, Math.min(canvas.width - entity.radius - 10, entity.x));
    entity.y = Math.max(entity.radius + 10, Math.min(canvas.height - entity.radius - 10, entity.y));
}

function resolveCircleCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    if (dist <= 0 || dist >= minDist) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
}

function drawGoals() {
    const goalHeight = LEVEL3_CONFIG.goalBottom - LEVEL3_CONFIG.goalTop;

    // Left goal: robots attack target
    ctx.fillStyle = "#8E24AA";
    ctx.fillRect(0, LEVEL3_CONFIG.goalTop, 10, goalHeight);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, LEVEL3_CONFIG.goalTop, 10, goalHeight);

    // Right goal: A/B team attack target
    ctx.fillStyle = "#FB8C00";
    ctx.fillRect(canvas.width - 10, LEVEL3_CONFIG.goalTop, 10, goalHeight);
    ctx.strokeStyle = "#EF6C00";
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width - 10, LEVEL3_CONFIG.goalTop, 10, goalHeight);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 14px Microsoft YaHei";
    ctx.fillText("CD 进攻门", 20, LEVEL3_CONFIG.goalTop - 8);
    ctx.fillText("AB 进攻门", canvas.width - 110, LEVEL3_CONFIG.goalTop - 8);
}

function drawLevel3ActorAvatar(actor, imageIndex, fallbackColor) {
    const drawAvatar = window.drawCircularAvatar;
    const avatars = window.playerAvatarImages;
    const image = avatars ? avatars[imageIndex] : null;

    if (typeof drawAvatar === "function") {
        drawAvatar(image, actor.x, actor.y, actor.radius, fallbackColor);
        return;
    }

    ctx.fillStyle = fallbackColor;
    ctx.beginPath();
    ctx.arc(actor.x, actor.y, actor.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawRobots() {
    for (const robot of robots) {
        drawLevel3ActorAvatar(robot, robot.id === "C" ? 3 : 4, robot.color);

        if (robot.hasBall) {
            const angle = Math.PI; // robots attack left
            drawDirectionArrow(robot.x, robot.y, angle);
        }
    }
}

// Override player drawing: show A/B instead of player numbers.
drawPlayers = function () {
    drawLevel3ActorAvatar(player1Actor, 1, player1Actor.color);
    if (player1Actor.hasBall) {
        drawDirectionArrow(player1Actor.x, player1Actor.y, Math.atan2(level3LastMoveDir[1].y, level3LastMoveDir[1].x));
    }

    drawLevel3ActorAvatar(player2Actor, 2, player2Actor.color);
    if (player2Actor.hasBall) {
        drawDirectionArrow(player2Actor.x, player2Actor.y, Math.atan2(level3LastMoveDir[2].y, level3LastMoveDir[2].x));
    }
};

function getHolderKey() {
    if (player1Actor.hasBall) return "A";
    if (player2Actor.hasBall) return "B";
    if (robots[0].hasBall) return "C";
    if (robots[1].hasBall) return "D";
    return null;
}

function clearAllHolders() {
    player1Actor.hasBall = false;
    player2Actor.hasBall = false;
    robots[0].hasBall = false;
    robots[1].hasBall = false;
}

function placeBallAtHolder(holderKey) {
    if (holderKey === "A") {
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
    } else if (holderKey === "B") {
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
    } else if (holderKey === "C") {
        const robot = getRobotById("C");
        ball.x = robot.x - 15;
        ball.y = robot.y + 18;
    } else if (holderKey === "D") {
        const robot = getRobotById("D");
        ball.x = robot.x - 15;
        ball.y = robot.y + 18;
    }
}

function setHolder(holderKey) {
    clearAllHolders();
    if (holderKey === "A") {
        player1Actor.hasBall = true;
        turnPlayer = 1;
    } else if (holderKey === "B") {
        player2Actor.hasBall = true;
        turnPlayer = 2;
    } else if (holderKey === "C") {
        robots[0].hasBall = true;
        turnPlayer = 0;
    } else if (holderKey === "D") {
        robots[1].hasBall = true;
        turnPlayer = 0;
    } else {
        turnPlayer = 0;
    }

    ballInAir = false;
    ball.vx = 0;
    ball.vy = 0;
    if (holderKey) {
        placeBallAtHolder(holderKey);
    }
}

function moveToward(entity, tx, ty, speed) {
    const dx = tx - entity.x;
    const dy = ty - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;
    entity.x += (dx / dist) * speed;
    entity.y += (dy / dist) * speed;
}

function updateRobots() {
    if (level3Ended) return;

    const holder = getHolderKey();

    // 只有 A 或 B 持球时，C/D 才开始移动并追向持球玩家。
    if (holder === "A" || holder === "B") {
        const target = holder === "A" ? player1Actor : player2Actor;
        for (const robot of robots) {
            const offsetY = robot.id === "C" ? -18 : 18;
            moveToward(robot, target.x, target.y + offsetY, robot.speed);
            clampEntity(robot);
        }
    }

    // Light blocking only.
    resolveCircleCollision(robots[0], robots[1]);
    resolveCircleCollision(robots[0], player1Actor);
    resolveCircleCollision(robots[0], player2Actor);
    resolveCircleCollision(robots[1], player1Actor);
    resolveCircleCollision(robots[1], player2Actor);

    clampEntity(robots[0]);
    clampEntity(robots[1]);
    clampEntity(player1Actor);
    clampEntity(player2Actor);
}

function tryTransferByContact() {
    // 关卡3中，CD 不会通过接触改变球权。
    return;
}

function tryPickupLooseBall() {
    if (ballInAir || getHolderKey()) return;

    const abCandidates = [
        { key: "A", x: player1Actor.x, y: player1Actor.y, radius: player1Actor.radius },
        { key: "B", x: player2Actor.x, y: player2Actor.y, radius: player2Actor.radius }
    ];
    let bestAB = null;
    for (const c of abCandidates) {
        const d = Math.hypot(ball.x - c.x, ball.y - c.y);
        if (d <= ball.radius + c.radius) {
            if (!bestAB || d < bestAB.d) bestAB = { key: c.key, d };
        }
    }
    if (bestAB) {
        setHolder(bestAB.key);
        updateTurnText(`${bestAB.key} 控球`);
        updateEncourageText("继续配合，把球推进到右侧球门！");
    }
}

function isBallInGoalMouth() {
    return ball.y >= LEVEL3_CONFIG.goalTop && ball.y <= LEVEL3_CONFIG.goalBottom;
}

function checkGoalScored() {
    if (!isBallInGoalMouth()) return "";
    if (ball.x + ball.radius >= canvas.width - 10) return "AB";
    if (ball.x - ball.radius <= 10) return "CD";
    return "";
}

function resetRound() {
    player1Actor.x = 180;
    player1Actor.y = 220;
    player2Actor.x = 180;
    player2Actor.y = 300;

    robots[0].x = robots[0].laneX;
    robots[0].y = 180;
    robots[1].x = robots[1].laneX;
    robots[1].y = 320;
    robots[0].hasBall = false;
    robots[1].hasBall = false;

    clearAllHolders();
    turnPlayer = 0;
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail = [];
    ballInAir = false;

    level3LastMoveDir[1] = { x: 1, y: 0 };
    level3LastMoveDir[2] = { x: 1, y: 0 };
    level3LastShooter = 0;
    level3CatchLockFrames = 0;

    resetChargeState(1);
    resetChargeState(2);
}

function removeLevel3Overlay() {
    const overlay = document.getElementById("level3Overlay");
    if (overlay) overlay.remove();
}

function restartLevel3() {
    removeLevel3Overlay();
    level3Ended = false;
    resetRound();
    updateTurnText("关卡3：A/B 协力对抗机器人 C/D");
    updateEncourageText("简单模式：机器人在中路阻挡，A/B 射进右门获胜。");
}

function showLevel3WinDialog() {
    removeLevel3Overlay();
    level3Ended = true;

    const overlay = document.createElement("div");
    overlay.id = "level3Overlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2200;
    `;

    overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,#ffffff,#e8f5e9); padding:50px 80px; border-radius:20px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <h2 style="font-size:42px; margin:0 0 18px; color:#2e7d32; font-weight:bold;">协力进球成功！</h2>
            <div style="font-size:24px; margin:0 0 30px; color:#555; line-height:1.7;">
                配合非常默契！<br>
                成功战胜对方！
            </div>
            <div style="display:flex; justify-content:center;">
                <button id="restartLevel3Btn" style="padding:15px 40px; font-size:22px; border:none; border-radius:10px; background:#4caf50; color:white; cursor:pointer; box-shadow:0 4px 15px rgba(76,175,80,0.4);">重新挑战</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    const restartBtn = document.getElementById("restartLevel3Btn");
    if (restartBtn) restartBtn.addEventListener("click", restartLevel3);
}

function onABGoal() {
    updateTurnText("A/B 进球！");
    updateEncourageText("协力进球成功！");
    showLevel3WinDialog();
}

function onCDGoal() {
    if (level3Ended) return;
    updateTurnText("机器人 C/D 进球，本关重开");
    updateEncourageText("再试一次，注意绕开中路阻挡。");
    level3Ended = true;
    setTimeout(() => {
        restartLevel3();
    }, 1000);
}

// Disable level-1 popup logic.
showNoCatchWarning = function () {
    hideNoCatchDialog();
};
transferBallToOtherPlayer = function () {
    hideNoCatchDialog();
};

// Level 3 charge visuals: same as level 2.
drawSinglePowerBar = function (x, y, progress, color) {
    const w = 200;
    const h = 25;

    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    if (progress > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w * (progress / 100), h);
    }
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "white";
    ctx.font = "12px Microsoft YaHei";
    ctx.fillText("力度", x - 30, y + 18);
    ctx.fillText(`${Math.round(progress)}%`, x + w + 8, y + 18);
};

updateChargeButtonVisual = function (btnId, progress) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const percentage = (Math.max(0, Math.min(progress, GAME_CONFIG.maxPower)) / GAME_CONFIG.maxPower) * 100;
    const hue = Math.round((percentage / 100) * 120);
    const bgColor = `hsla(${hue}, 80%, 45%, 0.8)`;
    const angle = (percentage / 100) * 360;
    btn.style.background = `conic-gradient(${bgColor} ${angle}deg, rgba(200, 200, 200, 0.3) ${angle}deg)`;
};

updateCharging = function () {
    const p1 = powerData.player1;
    const p2 = powerData.player2;
    const btn1 = document.getElementById("chargeBtn1");
    const btn2 = document.getElementById("chargeBtn2");

    if (btn1) {
        if (!player1Actor.hasBall || level3Ended) {
            btn1.classList.add("disabled");
            p1.charging = false;
            p1.progress = 0;
            updateChargeButtonVisual("chargeBtn1", 0);
        } else {
            btn1.classList.remove("disabled");
            if (p1.charging) {
                p1.progress += GAME_CONFIG.powerIncrement * 0.5;
                if (p1.progress >= GAME_CONFIG.maxPower) p1.progress = GAME_CONFIG.maxPower;
                updateChargeButtonVisual("chargeBtn1", p1.progress);
            }
        }
    }

    if (btn2) {
        if (!player2Actor.hasBall || level3Ended) {
            btn2.classList.add("disabled");
            p2.charging = false;
            p2.progress = 0;
            updateChargeButtonVisual("chargeBtn2", 0);
        } else {
            btn2.classList.remove("disabled");
            if (p2.charging) {
                p2.progress += GAME_CONFIG.powerIncrement * 0.5;
                if (p2.progress >= GAME_CONFIG.maxPower) p2.progress = GAME_CONFIG.maxPower;
                updateChargeButtonVisual("chargeBtn2", p2.progress);
            }
        }
    }
};

startCharge = function (playerNum) {
    if (level3Ended) return;
    const hasBall = (playerNum === 1 && player1Actor.hasBall) || (playerNum === 2 && player2Actor.hasBall);
    if (!hasBall) return;
    const pData = powerData[playerNum === 1 ? "player1" : "player2"];
    if (pData.charging) return;
    pData.charging = true;
};

endCharge = function (playerNum) {
    if (level3Ended) return;
    const hasBall = (playerNum === 1 && player1Actor.hasBall) || (playerNum === 2 && player2Actor.hasBall);
    if (!hasBall) return;
    const pData = powerData[playerNum === 1 ? "player1" : "player2"];
    if (!pData.charging) return;
    pData.charging = false;
    passBall(playerNum);
};

updatePlayers = function () {
    if (level3Ended) return;

    const p1PrevX = player1Actor.x;
    const p1PrevY = player1Actor.y;
    const p2PrevX = player2Actor.x;
    const p2PrevY = player2Actor.y;

    player1Actor.x += joystickData.player1.force.x * player1Actor.speed;
    player1Actor.y += joystickData.player1.force.y * player1Actor.speed;
    player2Actor.x += joystickData.player2.force.x * player2Actor.speed;
    player2Actor.y += joystickData.player2.force.y * player2Actor.speed;

    clampEntity(player1Actor);
    clampEntity(player2Actor);
    resolveCircleCollision(player1Actor, player2Actor);
    clampEntity(player1Actor);
    clampEntity(player2Actor);

    const p1Dx = player1Actor.x - p1PrevX;
    const p1Dy = player1Actor.y - p1PrevY;
    const p1Dist = Math.hypot(p1Dx, p1Dy);
    if (p1Dist > 0.05) {
        level3LastMoveDir[1] = { x: p1Dx / p1Dist, y: p1Dy / p1Dist };
    }

    const p2Dx = player2Actor.x - p2PrevX;
    const p2Dy = player2Actor.y - p2PrevY;
    const p2Dist = Math.hypot(p2Dx, p2Dy);
    if (p2Dist > 0.05) {
        level3LastMoveDir[2] = { x: p2Dx / p2Dist, y: p2Dy / p2Dist };
    }
};

passBall = function (player) {
    if (level3Ended) return;
    const hasBall = (player === 1 && player1Actor.hasBall) || (player === 2 && player2Actor.hasBall);
    if (!hasBall) return;

    if (player === 1) {
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
    } else {
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
    }

    const power = player === 1 ? powerData.player1.progress : powerData.player2.progress;
    const direction = level3LastMoveDir[player];
    const speed = getKickSpeed(power);

    ball.trail = [];
    ball.vx = direction.x * speed;
    ball.vy = direction.y * speed;
    ballInAir = true;
    clearAllHolders();
    turnPlayer = 0;

    level3LastShooter = player;
    level3CatchLockFrames = 8;

    updateTurnText(`${player === 1 ? "A" : "B"} 射门中`);
    updateEncourageText(`力度 ${Math.round(power)}%，继续推进！`);
    resetChargeState(player);
};

function tryCatchMovingBall() {
    if (!ballInAir || level3Ended) return;

    const candidates = [
        { key: "A", x: player1Actor.x, y: player1Actor.y, radius: player1Actor.radius, allow: !(level3CatchLockFrames > 0 && level3LastShooter === 1) },
        { key: "B", x: player2Actor.x, y: player2Actor.y, radius: player2Actor.radius, allow: !(level3CatchLockFrames > 0 && level3LastShooter === 2) }
    ];

    let best = null;
    for (const c of candidates) {
        if (!c.allow) continue;
        const d = Math.hypot(ball.x - c.x, ball.y - c.y);
        if (d <= ball.radius + c.radius) {
            if (!best || d < best.d) best = { key: c.key, d };
        }
    }

    if (!best) return;

    setHolder(best.key);
    updateTurnText(`${best.key} 接到球`);
    updateEncourageText("继续配合，瞄准右侧球门！");
}

function handleBallRobotCollision() {
    if (getHolderKey()) return;
    for (const robot of robots) {
        const dx = ball.x - robot.x;
        const dy = ball.y - robot.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ball.radius + robot.radius;
        if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * 0.7;
            ball.vy = (ball.vy - 2 * dot * ny) * 0.7;
            ballInAir = true;
        }
    }
}

updateBall = function () {
    if (level3Ended) return;

    tryTransferByContact();
    const holder = getHolderKey();
    if (holder) {
        placeBallAtHolder(holder);
        const result = checkGoalScored();
        if (result === "AB") onABGoal();
        if (result === "CD") onCDGoal();
        return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    if (level3CatchLockFrames > 0) level3CatchLockFrames -= 1;

    if (Math.abs(ball.vx) > 0.2 || Math.abs(ball.vy) > 0.2) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 30) ball.trail.shift();
    }

    // Wall bounce except inside goal mouth.
    const inGoalMouth = isBallInGoalMouth();
    if (ball.x - ball.radius <= 10 && !inGoalMouth) {
        ball.x = 10 + ball.radius;
        ball.vx = -ball.vx * 0.78;
    }
    if (ball.x + ball.radius >= canvas.width - 10 && !inGoalMouth) {
        ball.x = canvas.width - 10 - ball.radius;
        ball.vx = -ball.vx * 0.78;
    }
    if (ball.y - ball.radius <= 10) {
        ball.y = 10 + ball.radius;
        ball.vy = -ball.vy * 0.78;
    }
    if (ball.y + ball.radius >= canvas.height - 10) {
        ball.y = canvas.height - 10 - ball.radius;
        ball.vy = -ball.vy * 0.78;
    }

    const goalResult = checkGoalScored();
    if (goalResult === "AB") {
        onABGoal();
        return;
    }
    if (goalResult === "CD") {
        onCDGoal();
        return;
    }

    handleBallRobotCollision();

    tryCatchMovingBall();
    if (getHolderKey()) return;

    if (Math.abs(ball.vx) < 0.1 && Math.abs(ball.vy) < 0.1) {
        ball.vx = 0;
        ball.vy = 0;
        ballInAir = false;
    }
    tryPickupLooseBall();
};

gameLoop = function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
    drawGoals();
    updateCharging();
    drawPowerBars();
    updatePlayers();
    updateRobots();
    updateBall();
    drawMovementIndicators();
    drawPlayers();
    drawRobots();
    drawBall();
    requestAnimationFrame(gameLoop);
};

function initLevel3() {
    hideNoCatchDialog();
    removeLevel3Overlay();
    level3Ended = false;
    resetRound();
    updateTurnText("关卡3：A/B 协力对抗机器人 C/D");
    updateEncourageText("简单模式：机器人在中路阻挡，A/B 射进右门获胜。");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLevel3);
} else {
    initLevel3();
}




// Level 2: competitive mode (free movement, midfield kickoff, obstacles A/B)
const LEVEL2_CONFIG = {
    ...GAME_CONFIG,
    targetScore: 3,
    goalTop: 180,
    goalBottom: 320,
    obstacleRadius: 24,
    obstacleSpeed: 1.3
};

let player1Score = 0;
let player2Score = 0;
let level2Ended = false;
let level2LastShooter = null;
let level2CatchLockFrames = 0;
const level2LastMoveDir = {
    1: { x: 1, y: 0 },
    2: { x: -1, y: 0 }
};

// 新增：射门失败状态变量
let level2ShotFailed = false;
let level2FailDialogShown = false;

// 障碍物头像图片
const obstacleAvatarImages = {
    A: new Image(),
    B: new Image()
};
obstacleAvatarImages.A.src = "image/3.jpeg";
obstacleAvatarImages.B.src = "image/4.jpeg";

const obstacles = [
    {
        id: "A",
        // Move at 40% of canvas width
        x: canvas.width * 0.4,
        y: 70,
        radius: LEVEL2_CONFIG.obstacleRadius,
        vy: LEVEL2_CONFIG.obstacleSpeed,
        color: "#8E24AA"
    },
    {
        id: "B",
        // Move at 60% of canvas width
        x: canvas.width * 0.6,
        y: canvas.height - 70,
        radius: LEVEL2_CONFIG.obstacleRadius,
        vy: -LEVEL2_CONFIG.obstacleSpeed,
        color: "#D81B60"
    }
];

function resetObstaclePositions() {
    obstacles[0].y = 70;
    obstacles[0].vy = Math.abs(LEVEL2_CONFIG.obstacleSpeed);
    obstacles[1].y = canvas.height - 70;
    obstacles[1].vy = -Math.abs(LEVEL2_CONFIG.obstacleSpeed);
}

function drawGoals() {
    const goalHeight = LEVEL2_CONFIG.goalBottom - LEVEL2_CONFIG.goalTop;

    ctx.fillStyle = "#1976D2";
    ctx.fillRect(0, LEVEL2_CONFIG.goalTop, 10, goalHeight);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, LEVEL2_CONFIG.goalTop, 10, goalHeight);

    ctx.fillStyle = "#F57C00";
    ctx.fillRect(canvas.width - 10, LEVEL2_CONFIG.goalTop, 10, goalHeight);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width - 10, LEVEL2_CONFIG.goalTop, 10, goalHeight);
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        // 使用圆形头像图片绘制障碍物
        const drawAvatar = window.drawCircularAvatar;
        const avatars = obstacleAvatarImages;
        const image = avatars ? avatars[obstacle.id] : null;

        if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
            const diameter = obstacle.radius * 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const scale = Math.max(diameter / image.naturalWidth, diameter / image.naturalHeight);
            const drawWidth = image.naturalWidth * scale;
            const drawHeight = image.naturalHeight * scale;
            const drawX = obstacle.x - drawWidth / 2;
            const drawY = obstacle.y - drawHeight / 2;

            ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();
        } else {
            ctx.fillStyle = obstacle.color;
            ctx.beginPath();
            ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制白色边框
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制 ID 文字
        ctx.fillStyle = "white";
        ctx.font = "bold 16px Microsoft YaHei";
        ctx.fillText(obstacle.id, obstacle.x - 6, obstacle.y + 6);
    }
}

function updateObstacles() {
    const topLimit = 45;
    const bottomLimit = canvas.height - 45;

    for (const obstacle of obstacles) {
        obstacle.y += obstacle.vy;

        if (obstacle.y - obstacle.radius <= topLimit) {
            obstacle.y = topLimit + obstacle.radius;
            obstacle.vy = Math.abs(obstacle.vy);
        } else if (obstacle.y + obstacle.radius >= bottomLimit) {
            obstacle.y = bottomLimit - obstacle.radius;
            obstacle.vy = -Math.abs(obstacle.vy);
        }
    }
}

function resolveSinglePlayerObstacleCollision(player) {
    for (const obstacle of obstacles) {
        const dx = player.x - obstacle.x;
        const dy = player.y - obstacle.y;
        const dist = Math.hypot(dx, dy);
        const minDist = player.radius + obstacle.radius;

        if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            player.x += nx * overlap;
            player.y += ny * overlap;
        } else if (dist === 0) {
            player.x += 0.5;
            player.y += 0.5;
        }
    }
}

function resolvePlayerObstacleCollisions() {
    resolveSinglePlayerObstacleCollision(player1Actor);
    resolveSinglePlayerObstacleCollision(player2Actor);

    player1Actor.x = Math.max(50, Math.min(canvas.width / 2 - player1Actor.radius, player1Actor.x));
    player1Actor.y = Math.max(50, Math.min(canvas.height - 50, player1Actor.y));
    player2Actor.x = Math.max(canvas.width / 2 + player2Actor.radius, Math.min(canvas.width - 50, player2Actor.x));
    player2Actor.y = Math.max(50, Math.min(canvas.height - 50, player2Actor.y));
}

function handleBallObstacleCollision() {
    if (player1Actor.hasBall || player2Actor.hasBall) return;

    for (const obstacle of obstacles) {
        const dx = ball.x - obstacle.x;
        const dy = ball.y - obstacle.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ball.radius + obstacle.radius;

        if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            ball.x += nx * overlap;
            ball.y += ny * overlap;

            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * 0.88;
            ball.vy = (ball.vy - 2 * dot * ny) * 0.88;
            ballInAir = true;
        }
    }
}

function positionBallOnHolder() {
    if (player1Actor.hasBall) {
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
    } else if (player2Actor.hasBall) {
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
    }
}

function setHolder(playerNum) {
    if (playerNum === 1) {
        player1Actor.hasBall = true;
        player2Actor.hasBall = false;
        turnPlayer = 1;
    } else if (playerNum === 2) {
        player2Actor.hasBall = true;
        player1Actor.hasBall = false;
        turnPlayer = 2;
    } else {
        player1Actor.hasBall = false;
        player2Actor.hasBall = false;
        turnPlayer = 0;
    }

    ballInAir = false;
    ball.vx = 0;
    ball.vy = 0;
    positionBallOnHolder();
}

function pickupLooseBall() {
    if (ballInAir || player1Actor.hasBall || player2Actor.hasBall) return;

    const dx1 = ball.x - player1Actor.x;
    const dy1 = ball.y - player1Actor.y;
    const d1 = Math.hypot(dx1, dy1);
    const min1 = player1Actor.radius + ball.radius;

    const dx2 = ball.x - player2Actor.x;
    const dy2 = ball.y - player2Actor.y;
    const d2 = Math.hypot(dx2, dy2);
    const min2 = player2Actor.radius + ball.radius;

    if (d1 <= min1 && (d1 <= d2 || d2 > min2)) {
        setHolder(1);
        updateTurnText("玩家 1 控球，准备射门");
    } else if (d2 <= min2) {
        setHolder(2);
        updateTurnText("玩家 2 控球，准备射门");
    }
}

function isBallInGoalMouth() {
    return ball.y >= LEVEL2_CONFIG.goalTop && ball.y <= LEVEL2_CONFIG.goalBottom;
}

function checkGoalScored() {
    if (!isBallInGoalMouth()) return 0;

    if (ball.x - ball.radius <= 10) return 2;
    if (ball.x + ball.radius >= canvas.width - 10) return 1;
    return 0;
}

function resetToMidfieldContest() {
    // Players move back 10% from center, but stay within their half boundaries
    player1Actor.x = 170;
    player1Actor.y = canvas.height * 0.5;  // 修改：使用百分比定位在中间区域
    player2Actor.x = 730;
    player2Actor.y = canvas.height * 0.5;  // 修改：使用百分比定位在中间区域

    setHolder(0);
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail = [];
    ballInAir = false;

    roundStep = 0;
    level2LastShooter = null;
    level2CatchLockFrames = 0;
    level2PassFailed = false;
    level2LastMoveDir[1] = { x: 1, y: 0 };
    level2LastMoveDir[2] = { x: -1, y: 0 };

    resetChargeState(1);
    resetChargeState(2);
    
    // 新增：重置射门失败状态
    level2ShotFailed = false;
    level2FailDialogShown = false;
}

function removeLevel2WinDialog() {
    const dialog = document.getElementById("level2WinOverlay");
    if (dialog) dialog.remove();
}

function restartLevel2() {
    removeLevel2WinDialog();
    removeLevel2FailDialog(); // 新增：移除失败弹窗
    level2Ended = false;
    player1Score = 0;
    player2Score = 0;
    resetObstaclePositions();
    startLevel2Game();  // 修改：使用新的开局设置（玩家 1 持球）
    updateTurnText("关卡 2：左右边路进攻");
    updateEncourageText("玩家 1 率先持球进攻，利用左边路突破射门！");
}

function showLevel2WinDialog(winnerPlayer) {
    removeLevel2WinDialog();
    level2Ended = true;

    const overlay = document.createElement("div");
    overlay.id = "level2WinOverlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;

    overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,#ffffff,#e8f5e9); padding:50px 80px; border-radius:20px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <h2 style="font-size:42px; margin:0 0 18px; color:#2e7d32; font-weight:bold;">玩家 ${winnerPlayer} 闯关成功！</h2>
            <div style="font-size:24px; margin:0 0 30px; color:#555; line-height:1.7;">
                脚下有力量，心中有光芒！<br>
                小小球员，大大梦想，胜利属于你！<br>
                勇敢向前冲，你就是冠军！<br>
                挥洒汗水，收获荣耀，太棒啦！
            </div>
            <div style="display:flex; justify-content:center;">
                <button id="restartLevel2Btn" style="padding:15px 40px; font-size:22px; border:none; border-radius:10px; background:#4caf50; color:white; cursor:pointer; transition:0.3s; box-shadow:0 4px 15px rgba(76,175,80,0.4);">重新开始</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const restartBtn = document.getElementById("restartLevel2Btn");
    if (restartBtn) restartBtn.addEventListener("click", restartLevel2);
}

// 新增：显示射门失败弹窗
function showLevel2FailDialog(shooterPlayer) {
    if (level2FailDialogShown) return;
    
    level2FailDialogShown = true;
    level2ShotFailed = true;

    const overlay = document.createElement("div");
    overlay.id = "level2FailOverlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;

    overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,#ffffff,#ffebee); padding:50px 80px; border-radius:20px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <h2 style="font-size:42px; margin:0 0 18px; color:#c62828; font-weight:bold;">再接再厉！</h2>
            <div style="font-size:24px; margin:0 0 30px; color:#555; line-height:1.7;">
                射门没有进哦～<br>
                调整角度和力度，继续加油！
            </div>
            <div style="display:flex; justify-content:center;">
                <button id="continueLevel2Btn" style="padding:15px 40px; font-size:22px; border:none; border-radius:10px; background:#ff9800; color:white; cursor:pointer; transition:0.3s; box-shadow:0 4px 15px rgba(255,152,0,0.4);">继续挑战</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const continueBtn = document.getElementById("continueLevel2Btn");
    if (continueBtn) {
        continueBtn.addEventListener("click", () => {
            removeLevel2FailDialog();
            // 球权转换给另一位玩家
            transferBallToOtherPlayerLevel2(shooterPlayer);
        });
    }
    
    // 3 秒后自动继续
    setTimeout(() => {
        if (level2FailDialogShown) {
            removeLevel2FailDialog();
            transferBallToOtherPlayerLevel2(shooterPlayer);
        }
    }, 3000);
}

function removeLevel2FailDialog() {
    const dialog = document.getElementById("level2FailOverlay");
    if (dialog) dialog.remove();
    level2FailDialogShown = false;
}

function onGoal(scorerPlayer) {
    if (scorerPlayer === 1) {
        player1Score += 1;
    } else {
        player2Score += 1;
    }

    updateTurnText(`玩家 ${scorerPlayer} 进球！`);
    updateEncourageText("漂亮进球，准备中场重新争球。");
    
    // 新增：进球后重置射门失败状态
    level2ShotFailed = false;
    level2FailDialogShown = false;

    if (player1Score >= LEVEL2_CONFIG.targetScore || player2Score >= LEVEL2_CONFIG.targetScore) {
        showLevel2WinDialog(scorerPlayer);
        return;
    }

    setTimeout(() => {
        resetToMidfieldContest();
        updateTurnText("中场重新争球");
        updateEncourageText("两队继续对抗，抢到球就进攻！");
    }, 900);
}

// Disable level-1 failure popup logic in level 2.
showNoCatchWarning = function () {
    hideNoCatchDialog();
    ballInAir = false;
};

transferBallToOtherPlayer = function () {
    hideNoCatchDialog();
    ballInAir = false;
};

// 新增：关卡 2 专用球权转换函数
function transferBallToOtherPlayerLevel2(shooterPlayer) {
    level2ShotFailed = false;
    ballInAir = false;
    
    // 转换球权给另一位玩家
    if (shooterPlayer === 1) {
        // 玩家 1 射门失败，球权给玩家 2
        player2Actor.hasBall = true;
        player1Actor.hasBall = false;
        turnPlayer = 2;
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        updateTurnText("玩家 1 射门失败，玩家 2 获得球权");
        updateEncourageText("再接再厉，抢到球就射门！");
    } else {
        // 玩家 2 射门失败，球权给玩家 1
        player1Actor.hasBall = true;
        player2Actor.hasBall = false;
        turnPlayer = 1;
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        updateTurnText("玩家 2 射门失败，玩家 1 获得球权");
        updateEncourageText("再接再厉，抢到球就射门！");
    }
    
    resetChargeState(1);
    resetChargeState(2);
}

// Keep level 2 meter style aligned with level 1 (power-based color gradient).
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

    const player1CanUseButton = player1Actor.hasBall;
    const player2CanUseButton = player2Actor.hasBall;

    if (btn1) {
        if (!player1CanUseButton || level2Ended) {
            btn1.classList.add("disabled");
            p1.charging = false;
            p1.progress = 0;
            updateChargeButtonVisual("chargeBtn1", 0);
        } else {
            btn1.classList.remove("disabled");
            if (!player1Actor.hasBall) {
                p1.charging = false;
                p1.progress = 0;
                updateChargeButtonVisual("chargeBtn1", 0);
            } else if (p1.charging) {
                p1.progress += GAME_CONFIG.powerIncrement * 0.5;
                if (p1.progress >= GAME_CONFIG.maxPower) p1.progress = GAME_CONFIG.maxPower;
                updateChargeButtonVisual("chargeBtn1", p1.progress);
            }
        }
    }

    if (btn2) {
        if (!player2CanUseButton || level2Ended) {
            btn2.classList.add("disabled");
            p2.charging = false;
            p2.progress = 0;
            updateChargeButtonVisual("chargeBtn2", 0);
        } else {
            btn2.classList.remove("disabled");
            if (!player2Actor.hasBall) {
                p2.charging = false;
                p2.progress = 0;
                updateChargeButtonVisual("chargeBtn2", 0);
            } else if (p2.charging) {
                p2.progress += GAME_CONFIG.powerIncrement * 0.5;
                if (p2.progress >= GAME_CONFIG.maxPower) p2.progress = GAME_CONFIG.maxPower;
                updateChargeButtonVisual("chargeBtn2", p2.progress);
            }
        }
    }
};

// Override charging flow for level 2.
startCharge = function (playerNum, btnElement) {
    if (level2Ended) return;

    const hasBall = (playerNum === 1 && player1Actor.hasBall) || (playerNum === 2 && player2Actor.hasBall);
    if (!hasBall) return;

    const pData = powerData[playerNum === 1 ? "player1" : "player2"];
    if (pData.charging) return;
    pData.charging = true;
};

endCharge = function (playerNum) {
    if (level2Ended) return;

    const hasBall = (playerNum === 1 && player1Actor.hasBall) || (playerNum === 2 && player2Actor.hasBall);
    if (!hasBall) return;

    const pData = powerData[playerNum === 1 ? "player1" : "player2"];
    if (!pData.charging) return;

    pData.charging = false;
    passBall(playerNum);
};

// Players are restricted to their own half-field and blocked by obstacles.
updatePlayers = function () {
    if (level2Ended) return;

    const p1PrevX = player1Actor.x;
    const p1PrevY = player1Actor.y;
    const p2PrevX = player2Actor.x;
    const p2PrevY = player2Actor.y;

    player1Actor.x += joystickData.player1.force.x * player1Actor.speed;
    player1Actor.y += joystickData.player1.force.y * player1Actor.speed;
    player2Actor.x += joystickData.player2.force.x * player2Actor.speed;
    player2Actor.y += joystickData.player2.force.y * player2Actor.speed;

    // 修改：X 轴限制在最左/最右 25%，Y 轴整个球场都可以活动
    // 玩家 1：左半场最左边 25% 区域活动，Y 轴全场
    const player1MaxX = canvas.width * 0.25;
    player1Actor.x = Math.max(50, Math.min(player1MaxX - player1Actor.radius, player1Actor.x));
    player1Actor.y = Math.max(50, Math.min(canvas.height - 50, player1Actor.y));  // Y 轴全场活动
    
    // 玩家 2：右半场最右边 25% 区域活动，Y 轴全场
    const player2MinX = canvas.width * 0.75;
    player2Actor.x = Math.max(player2MinX + player2Actor.radius, Math.min(canvas.width - 50, player2Actor.x));
    player2Actor.y = Math.max(50, Math.min(canvas.height - 50, player2Actor.y));  // Y 轴全场活动

    resolvePlayerObstacleCollisions();

    const p1Dx = player1Actor.x - p1PrevX;
    const p1Dy = player1Actor.y - p1PrevY;
    const p1Dist = Math.hypot(p1Dx, p1Dy);
    if (p1Dist > 0.05) {
        level2LastMoveDir[1] = { x: p1Dx / p1Dist, y: p1Dy / p1Dist };
    }

    const p2Dx = player2Actor.x - p2PrevX;
    const p2Dy = player2Actor.y - p2PrevY;
    const p2Dist = Math.hypot(p2Dx, p2Dy);
    if (p2Dist > 0.05) {
        level2LastMoveDir[2] = { x: p2Dx / p2Dist, y: p2Dy / p2Dist };
    }
};

passBall = function (player) {
    if (level2Ended) return;

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
    const direction = level2LastMoveDir[player];
    // 修改：增加射门力度系数 1.8，让球速更快，能射到球门
    const kickSpeed = getKickSpeed(power) * 1.8;

    ball.trail = [];
    ball.vx = direction.x * kickSpeed;
    ball.vy = direction.y * kickSpeed;
    ballInAir = true;

    level2LastShooter = player;
    level2CatchLockFrames = 8;
    player1Actor.hasBall = false;
    player2Actor.hasBall = false;
    turnPlayer = 0;

    updateTurnText(`玩家 ${player} 射门中！`);
    updateEncourageText(`力度 ${Math.round(power)}%，注意避开障碍 A/B。`);
    resetChargeState(player);
};

checkPlayerCatchBall = function () {
    if (!ballInAir || level2Ended) return;

    const dx1 = ball.x - player1Actor.x;
    const dy1 = ball.y - player1Actor.y;
    const d1 = Math.hypot(dx1, dy1);
    const min1 = player1Actor.radius + ball.radius;

    const dx2 = ball.x - player2Actor.x;
    const dy2 = ball.y - player2Actor.y;
    const d2 = Math.hypot(dx2, dy2);
    const min2 = player2Actor.radius + ball.radius;

    const player1CanCatch = !(level2CatchLockFrames > 0 && level2LastShooter === 1);
    const player2CanCatch = !(level2CatchLockFrames > 0 && level2LastShooter === 2);

    if (player1CanCatch && d1 <= min1 && (d1 <= d2 || d2 > min2)) {
        setHolder(1);
        updateTurnText("玩家 1 抢到球，准备射门");
        // 新增：接球成功，重置射门失败状态
        level2ShotFailed = false;
        level2FailDialogShown = false;
        return;
    }

    if (player2CanCatch && d2 <= min2) {
        setHolder(2);
        updateTurnText("玩家 2 抢到球，准备射门");
        // 新增：接球成功，重置射门失败状态
        level2ShotFailed = false;
        level2FailDialogShown = false;
    }
};

updateBall = function () {
    if (level2Ended) return;

    if (player1Actor.hasBall || player2Actor.hasBall) {
        positionBallOnHolder();

        const scorerWithBall = checkGoalScored();
        if (scorerWithBall) onGoal(scorerWithBall);
        return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    if (level2CatchLockFrames > 0) {
        level2CatchLockFrames -= 1;
    }

    if (Math.abs(ball.vx) > 0.2 || Math.abs(ball.vy) > 0.2) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 30) ball.trail.shift();
    }

    handleBallObstacleCollision();
    checkPlayerCatchBall();
    if (player1Actor.hasBall || player2Actor.hasBall) return;

    const scorer = checkGoalScored();
    if (scorer) {
        onGoal(scorer);
        return;
    }

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

    if (Math.abs(ball.vx) < 0.1 && Math.abs(ball.vy) < 0.1) {
        ball.vx = 0;
        ball.vy = 0;
        ballInAir = false;
        
        // 新增：检测射门失败（球停下且没有进球且没有被接住）
        if (level2LastShooter !== null && !level2ShotFailed && !level2FailDialogShown) {
            // 球已停下，但没有进球，判定为射门失败
            showLevel2FailDialog(level2LastShooter);
        }
    }

    pickupLooseBall();
};

gameLoop = function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawField();
    drawGoals();
    updateCharging();
    drawPowerBars();
    updatePlayers();
    updateObstacles();
    updateBall();
    drawMovementIndicators();
    drawObstacles();
    drawPlayers();
    drawBall();

    requestAnimationFrame(gameLoop);
};

// 新增：游戏开始设置（玩家 1 率先持球进攻）
function startLevel2Game() {
    // 玩家在各自半场的边路区域起始位置（X 轴：最左/最右 25%，Y 轴：中间）
    player1Actor.x = canvas.width * 0.15;  // 左边 25% 区域的中心
    player1Actor.y = canvas.height * 0.5;  // Y 轴中间位置
    player2Actor.x = canvas.width * 0.85;  // 右边 25% 区域的中心
    player2Actor.y = canvas.height * 0.5;  // Y 轴中间位置
    
    // 足球默认在玩家 1 手中
    setHolder(1);
    ball.x = player1Actor.x + 15;
    ball.y = player1Actor.y + 20;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail = [];
    ballInAir = false;
    
    roundStep = 0;
    level2LastShooter = null;
    level2CatchLockFrames = 0;
    level2PassFailed = false;
    level2LastMoveDir[1] = { x: 1, y: 0 };
    level2LastMoveDir[2] = { x: -1, y: 0 };
    
    resetChargeState(1);
    resetChargeState(2);
    
    level2ShotFailed = false;
    level2FailDialogShown = false;
}

function initLevel2() {
    hideNoCatchDialog();
    removeLevel2WinDialog();
    removeLevel2FailDialog(); // 新增：移除失败弹窗
    level2Ended = false;
    player1Score = 0;
    player2Score = 0;
    resetObstaclePositions();
    startLevel2Game();  // 修改：使用新的开局设置（玩家 1 持球）
    updateTurnText("关卡 2：左右边路进攻");
    updateEncourageText("玩家 1 率先持球进攻，利用左边路突破射门！");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLevel2);
} else {
    initLevel2();
}


// 足球合作挑战 - 关卡 1: 双人传球
// 游戏配置常量
const GAME_CONFIG = {
    playerSpeed: 3,
    ballFriction: 0.98,
    ballInitialSpeed: 6,
    powerIncrement: 1,
    sweetSpotMin: 40,
    sweetSpotMax: 70,
    maxPower: 100
};

// 游戏状态
let turnPlayer = 1;
let roundStep = 0;
let score = 0;

// 游戏状态变量
let ballInAir = false;
let noCatchTimeout = null;
let showNoCatchDialog = false;
const isLevelOnePage = /\/game\.html$/i.test(window.location.pathname);
let lastPasser = null;
let level1Completed = false;
let levelTransitionTimer = null;

// 玩家对象
const player1Actor = {
    x: 150,
    y: 250,
    radius: 25,
    speed: GAME_CONFIG.playerSpeed,
    hasBall: true,
    color: "#1976D2"
};

const player2Actor = {
    x: 750,
    y: 250,
    radius: 25,
    speed: GAME_CONFIG.playerSpeed,
    hasBall: false,
    color: "#F57C00"
};

// 足球
const ball = {
    x: 150,
    y: 280,
    radius: 12,
    vx: 0,
    vy: 0,
    friction: GAME_CONFIG.ballFriction,
    trail: []
};

// 方向指示器
const directionIndicator = {
    angle: 0,
    length: 40,
    visible: true
};
const lastMoveDirection = {
    1: { x: 1, y: 0 },
    2: { x: -1, y: 0 }
};

// 摇杆数据
const joystickData = {
    player1: { x: 0, y: 0, force: { x: 0, y: 0 } },
    player2: { x: 0, y: 0, force: { x: 0, y: 0 } }
};

// 蓄力数据
const powerData = {
    player1: { charging: false, progress: 0, direction: 1 },
    player2: { charging: false, progress: 0, direction: 1 }
};

// 初始化画布
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playerAvatarImages = {
    1: new Image(),
    2: new Image(),
    3: new Image(),
    4: new Image()
};
playerAvatarImages[1].src = "image/1.jpeg";
playerAvatarImages[2].src = "image/2.jpeg";
playerAvatarImages[3].src = "image/3.jpeg";
playerAvatarImages[4].src = "image/4.jpeg";

function drawCircularAvatar(image, x, y, radius, fallbackColor) {
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

window.playerAvatarImages = playerAvatarImages;
window.drawCircularAvatar = drawCircularAvatar;
// 绘制球场
function drawField() {
    // 草地底色
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 左右半场轻色块
    ctx.fillStyle = "rgba(25, 118, 210, 0.05)";
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height);
    ctx.fillStyle = "rgba(245, 124, 0, 0.05)";
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);

    // 中线与中圈
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // 最后绘制外边界，避免被后续元素覆盖导致“看不见”
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // 球场文字
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Microsoft YaHei";
    ctx.fillText("玩家 1", 150, 40);
    ctx.fillText("玩家 2", 720, 40);
}

// 缁樺埗鏂瑰悜绠ご锛堝湪鐜╁鍓嶆柟锛屾祬鐏拌壊锛岄€忔槑搴?20%锛
function drawDirectionArrow(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // 箭头在玩家前方
    const offset = player1Actor.radius + 15;
    ctx.fillStyle = "rgba(200, 200, 200, 0.2)";
    ctx.beginPath();
    ctx.moveTo(offset + 15, 0);  // 绠ご灏栫
    ctx.lineTo(offset - 10, -10);  // 宸︿笂
    ctx.lineTo(offset - 10, 10);   // 宸︿笅
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// 缁樺埗鐜╁
function drawPlayers() {
    if (player1Actor.hasBall) {
        if (isLevelOnePage) {
            directionIndicator.angle = Math.atan2(lastMoveDirection[1].y, lastMoveDirection[1].x);
        } else {
            const dx = joystickData.player1.force.x;
            const dy = joystickData.player1.force.y;
            directionIndicator.angle = (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) ? Math.atan2(dy, dx) : 0;
        }
    } else if (player2Actor.hasBall) {
        if (isLevelOnePage) {
            directionIndicator.angle = Math.atan2(lastMoveDirection[2].y, lastMoveDirection[2].x);
        } else {
            const dx = joystickData.player2.force.x;
            const dy = joystickData.player2.force.y;
            directionIndicator.angle = (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) ? Math.atan2(dy, dx) : Math.PI;
        }
    }

    // 鐜╁ 1
    drawCircularAvatar(playerAvatarImages[1], player1Actor.x, player1Actor.y, player1Actor.radius, player1Actor.color);

    ctx.fillStyle = "white";
    ctx.font = "bold 16px Microsoft YaHei";
    ctx.fillText("玩家 1", player1Actor.x - 30, player1Actor.y - 35);

    // 鐜╁ 1 鏂瑰悜鎸囩ず鍣紙鍦ㄧ帺瀹跺墠鏂癸紝娴呯伆鑹诧級
    if (player1Actor.hasBall && directionIndicator.visible) {
        drawDirectionArrow(player1Actor.x, player1Actor.y, directionIndicator.angle);
    }

    // 鐜╁ 2
    drawCircularAvatar(playerAvatarImages[2], player2Actor.x, player2Actor.y, player2Actor.radius, player2Actor.color);

    ctx.fillStyle = "white";
    ctx.font = "bold 16px Microsoft YaHei";
    ctx.fillText("玩家 2", player2Actor.x - 30, player2Actor.y - 35);

    // 鐜╁ 2 鏂瑰悜鎸囩ず鍣紙鍦ㄧ帺瀹跺墠鏂癸紝娴呯伆鑹诧級
    if (player2Actor.hasBall && directionIndicator.visible) {
        drawDirectionArrow(player2Actor.x, player2Actor.y, directionIndicator.angle);
    }
}

// 缁樺埗瓒崇悆
function drawBall() {
    // 缁樺埗杞ㄨ抗 - 澧炲己瑙嗚鏁堟灉锛屼娇鐢ㄦ洿鏄庢樉鐨勯鑹插拰绮楃粏
    if (ball.trail.length > 1) {
        for (let i = 0; i < ball.trail.length - 1; i++) {
            // 璁＄畻娓愬彉閫忔槑搴︼細浠庡熬閮ㄧ殑 0.9 鍒板ご閮ㄧ殑 0.3
            let alpha = 0.9 - (i / ball.trail.length) * 0.6;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            // 轨迹粗细渐变
            ctx.lineWidth = ball.radius * (1.5 - (i / ball.trail.length));
            ctx.beginPath();
            ctx.moveTo(ball.trail[i].x, ball.trail[i].y);
            ctx.lineTo(ball.trail[i + 1].x, ball.trail[i + 1].y);
            ctx.stroke();
        }
    }

    // 球阴影
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y + ball.radius + 2, ball.radius, ball.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 瓒崇悆涓讳綋
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // 瓒崇悆鑺辩汗
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // 持球指示器
    if (player1Actor.hasBall || player2Actor.hasBall) {
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.moveTo(ball.x - 5, ball.y - ball.radius - 10);
        ctx.lineTo(ball.x + 5, ball.y - ball.radius - 10);
        ctx.lineTo(ball.x, ball.y - ball.radius - 20);
        ctx.fill();
    }
}

// 缁樺埗鍔涘害鏉
function drawSinglePowerBar(x, y, progress, color) {
    const w = 200;
    const h = 25;

    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    if (!isLevelOnePage) {
        ctx.fillStyle = "rgba(76, 175, 80, 0.6)";
        ctx.fillRect(x + w * 0.4, y, w * 0.3, h);
        ctx.fillStyle = "rgba(244, 67, 54, 0.4)";
        ctx.fillRect(x, y, w * 0.4, h);
        ctx.fillStyle = "rgba(255, 152, 0, 0.4)";
        ctx.fillRect(x + w * 0.7, y, w * 0.3, h);
    }

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
}

function drawPowerBars() {
    drawSinglePowerBar(100, 440, powerData.player1.progress, "#1976D2");
    drawSinglePowerBar(600, 440, powerData.player2.progress, "#F57C00");
}

// 鏇存柊鐜╁浣嶇疆
function updatePlayers() {
    const p1PrevX = player1Actor.x;
    const p1PrevY = player1Actor.y;
    const p2PrevX = player2Actor.x;
    const p2PrevY = player2Actor.y;

    player1Actor.x += joystickData.player1.force.x * player1Actor.speed;
    player1Actor.y += joystickData.player1.force.y * player1Actor.speed;
    player2Actor.x += joystickData.player2.force.x * player2Actor.speed;
    player2Actor.y += joystickData.player2.force.y * player2Actor.speed;

    // 闄愬埗娲诲姩鑼冨洿
    player1Actor.x = Math.max(50, Math.min(canvas.width / 2 - 50, player1Actor.x));
    player1Actor.y = Math.max(50, Math.min(canvas.height - 50, player1Actor.y));
    player2Actor.x = Math.max(canvas.width / 2 + 50, Math.min(canvas.width - 50, player2Actor.x));
    player2Actor.y = Math.max(50, Math.min(canvas.height - 50, player2Actor.y));

    const p1Dx = player1Actor.x - p1PrevX;
    const p1Dy = player1Actor.y - p1PrevY;
    const p1Dist = Math.hypot(p1Dx, p1Dy);
    if (p1Dist > 0.05) {
        lastMoveDirection[1] = { x: p1Dx / p1Dist, y: p1Dy / p1Dist };
    }

    const p2Dx = player2Actor.x - p2PrevX;
    const p2Dy = player2Actor.y - p2PrevY;
    const p2Dist = Math.hypot(p2Dx, p2Dy);
    if (p2Dist > 0.05) {
        lastMoveDirection[2] = { x: p2Dx / p2Dist, y: p2Dy / p2Dist };
    }
}

// 鏇存柊瓒崇悆浣嶇疆
function updateBall() {
    // 先更新球的位置
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    // 记录轨迹
    if (Math.abs(ball.vx) > 0.2 || Math.abs(ball.vy) > 0.2) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 30) {  // 澧炲姞杞ㄨ抗鐐规暟閲忓埌 30
            ball.trail.shift();
        }
    }

    // 检测玩家是否接到球（实时）
    checkPlayerCatchBall();

    // 鐞冨畬鍏ㄥ仠涓嬫潵鍚庣殑澶勭悊
    if (Math.abs(ball.vx) < 0.1 && Math.abs(ball.vy) < 0.1) {
        ball.vx = 0;
        ball.vy = 0;
        
        // 鐞冨仠涓嬫潵鍚庯紝妫€鏌ユ槸鍚﹀湪绌轰腑涓旀病浜烘帴锛堟鏃跺凡缁忓垽瀹氬け璐ワ級
        if (ballInAir) {
            // 鐞冨凡鍋滄浣嗘棤浜烘帴鐞冿紝鐩存帴鏄剧ず澶辫触鎻愮ず
            showNoCatchWarning();
        }
    }

    // 只有持球时足球才跟随玩家
    if (player1Actor.hasBall && !ballInAir) {
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        ball.trail = [];
        ballInAir = false;
        clearTimeout(noCatchTimeout);
    }

    if (player2Actor.hasBall && !ballInAir) {
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        ball.trail = [];
        ballInAir = false;
        clearTimeout(noCatchTimeout);
    }

    // 杈圭晫纰版挒妫€娴?- 鐧界嚎杈圭晫 (canvas.width 鍜?canvas.height)
    let hitEdge = false;

    // 检查足球是否到达边界
    if (ball.x - ball.radius <= 10) {
        // 宸﹁竟鐣?- 鍙嶅脊
        ball.x = 10 + ball.radius;
        ball.vx = -ball.vx * 0.7;
        hitEdge = true;
    }

    if (ball.x + ball.radius >= canvas.width - 10) {
        // 鍙宠竟鐣?- 鍙嶅脊
        ball.x = canvas.width - 10 - ball.radius;
        ball.vx = -ball.vx * 0.7;
        hitEdge = true;
    }

    if (ball.y - ball.radius <= 10) {
        // 涓婅竟鐣?- 鍙嶅脊
        ball.y = 10 + ball.radius;
        ball.vy = -ball.vy * 0.7;
        hitEdge = true;
    }

    if (ball.y + ball.radius >= canvas.height - 10) {
        // 涓嬭竟鐣?- 鍙嶅脊
        ball.y = canvas.height - 10 - ball.radius;
        ball.vy = -ball.vy * 0.7;
        hitEdge = true;
    }

    if (hitEdge) {
        // 鍏冲崱 1锛氱悆瑙︾杈圭晫浼氬弽寮癸紝涓嶄細绔嬪嵆鍒ゅ畾澶辫触
        // 鍙湁褰撶悆鏈€缁堝仠涓嬫潵涓旀棤浜烘帴鐞冩椂锛屾墠鍒ゅ畾涓轰紶鐞冨け璐?
    }
}

// 鎾炶竟澶辫触澶勭悊
function handleEdgeHit() {
    if (turnPlayer === 1) {
        player1Actor.hasBall = false;
        turnPlayer = 2;
        updateTurnText("玩家 1 传球出界，玩家 2 获得球权");
        updateEncourageText("撞到边线了，请调整方向。");
    } else {
        player2Actor.hasBall = false;
        turnPlayer = 1;
        updateTurnText("玩家 2 传球出界，玩家 1 获得球权");
        updateEncourageText("撞到边线了，请调整方向。");
    }

    roundStep = 0;
    powerData.player1.charging = false;
    powerData.player1.progress = 0;
    powerData.player2.charging = false;
    powerData.player2.progress = 0;
    ball.trail = [];
}

// 鏇存柊鎻愮ず鏂囧瓧
function updateTurnText(text) {
    const turnTextEl = document.getElementById("turnText");
    if (turnTextEl) {
        turnTextEl.innerText = text;
    }
}

function updateEncourageText(text) {
    const encourageTextEl = document.getElementById("encourageText");
    if (encourageTextEl) {
        encourageTextEl.innerText = text;
    }
}

function resetChargeState(player) {
    if (player === 1) {
        powerData.player1.charging = false;
        powerData.player1.progress = 0;
        updateChargeButtonVisual("chargeBtn1", 0);
    } else {
        powerData.player2.charging = false;
        powerData.player2.progress = 0;
        updateChargeButtonVisual("chargeBtn2", 0);
    }
}

function getKickDirection(player) {
    if (isLevelOnePage) {
        return lastMoveDirection[player];
    }

    const force = player === 1 ? joystickData.player1.force : joystickData.player2.force;
    let dx = force.x;
    let dy = force.y;

    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        if (player === 1) {
            dx = player2Actor.x - player1Actor.x;
            dy = player2Actor.y - player1Actor.y;
        } else {
            dx = player1Actor.x - player2Actor.x;
            dy = player1Actor.y - player2Actor.y;
        }
    }

    const dist = Math.hypot(dx, dy) || 1;
    return { x: dx / dist, y: dy / dist };
}

function getKickSpeed(power) {
    const minSpeed = 2;
    const maxSpeed = 12;
    const normalizedPower = Math.max(0, Math.min(power, GAME_CONFIG.maxPower)) / GAME_CONFIG.maxPower;
    return minSpeed + normalizedPower * (maxSpeed - minSpeed);
}

function clearLevelTransitionTimer() {
    if (levelTransitionTimer) {
        clearTimeout(levelTransitionTimer);
        levelTransitionTimer = null;
    }
}

function goToNextLevel() {
    restartFromLevel1();
}

function restartFromLevel1() {
    clearLevelTransitionTimer();
    const successDialog = document.getElementById("level1SuccessDialog");
    if (successDialog) successDialog.remove();

    hideNoCatchDialog();
    clearTimeout(noCatchTimeout);
    noCatchTimeout = null;

    level1Completed = false;
    lastPasser = null;
    ballInAir = false;
    showNoCatchDialog = false;

    turnPlayer = 1;
    roundStep = 0;
    score = 0;

    player1Actor.x = 150;
    player1Actor.y = 250;
    player1Actor.hasBall = true;
    player2Actor.x = 750;
    player2Actor.y = 250;
    player2Actor.hasBall = false;

    ball.x = 150;
    ball.y = 280;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail = [];

    lastMoveDirection[1] = { x: 1, y: 0 };
    lastMoveDirection[2] = { x: -1, y: 0 };

    resetChargeState(1);
    resetChargeState(2);

    const btn1 = document.getElementById("chargeBtn1");
    const btn2 = document.getElementById("chargeBtn2");
    if (btn1) btn1.classList.remove("disabled");
    if (btn2) btn2.classList.remove("disabled");

    updateTurnText("当前回合：玩家 1 准备传球");
    updateEncourageText("");
}

function showLevel1SuccessDialog(passer, catcher) {
    const existingDialog = document.getElementById("level1SuccessDialog");
    if (existingDialog) {
        existingDialog.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "level1SuccessDialog";
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
        <div style="background:linear-gradient(135deg,#ffffff,#e8f5e9); padding:50px 80px; border-radius:20px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5); min-width:420px;">
            <h2 style="font-size:42px; margin:0 0 18px; color:#2e7d32; font-weight:bold;">恭喜玩家 ${passer}！</h2>
            <div style="font-size:24px; margin:0 0 30px; color:#555; line-height:1.7;">
                玩家 ${catcher} 在球停下前成功接到传球。<br>
                配合默契，闯关成功！
            </div>
            <div style="display:flex; justify-content:center;">
                <button id="restartLevelBtn" style="padding:15px 40px; font-size:22px; border:none; border-radius:10px; background:#ff9800; color:white; cursor:pointer; transition:0.3s; box-shadow:0 4px 15px rgba(255,152,0,0.4);">重新开始</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const restartBtn = document.getElementById("restartLevelBtn");
    if (restartBtn) {
        restartBtn.addEventListener("click", restartFromLevel1);
    }
}

function handleLevel1PassSuccess(catcherPlayer) {
    if (!isLevelOnePage || level1Completed) return;

    level1Completed = true;
    const passer = lastPasser || (catcherPlayer === 1 ? 2 : 1);

    updateTurnText(`恭喜玩家 ${passer} 传球成功！`);
    updateEncourageText(`玩家 ${catcherPlayer} 接球成功。`);
    showLevel1SuccessDialog(passer, catcherPlayer);

    const btn1 = document.getElementById("chargeBtn1");
    const btn2 = document.getElementById("chargeBtn2");
    if (btn1) btn1.classList.add("disabled");
    if (btn2) btn2.classList.add("disabled");

    resetChargeState(1);
    resetChargeState(2);
    clearLevelTransitionTimer();
}

// 浼犵悆閫昏緫
function passBall(player) {
    if (isLevelOnePage && level1Completed) return;

    const power = player === 1 ? powerData.player1.progress : powerData.player2.progress;
    const requiresSweetSpot = !isLevelOnePage;
    const inSweetSpot = power > GAME_CONFIG.sweetSpotMin && power < GAME_CONFIG.sweetSpotMax;

    if (requiresSweetSpot && !inSweetSpot) {
        if (player === 1) {
            player1Actor.hasBall = true;
            player2Actor.hasBall = false;
            turnPlayer = 1;
            updateTurnText("玩家 1 传球失败，请调整力度再试一次");
            updateEncourageText("试试其他力度，配合更重要。");
        } else {
            player2Actor.hasBall = true;
            player1Actor.hasBall = false;
            turnPlayer = 2;
            updateTurnText("玩家 2 传球失败，请调整力度再试一次");
            updateEncourageText("试试其他力度，配合更重要。");
        }
        roundStep = 0;
        resetChargeState(player);
        return;
    }

    ball.trail = [];
    ballInAir = true;
    lastPasser = player;
    hideNoCatchDialog();

    const direction = getKickDirection(player);
    const kickSpeed = isLevelOnePage ? getKickSpeed(power) : GAME_CONFIG.ballInitialSpeed;
    ball.vx = direction.x * kickSpeed;
    ball.vy = direction.y * kickSpeed;

    if (player === 1) {
        player1Actor.hasBall = false;
        player2Actor.hasBall = false;
        turnPlayer = 2;
        roundStep = 1;
        updateTurnText("玩家 1 已传球，玩家 2 准备接球");
    } else {
        player2Actor.hasBall = false;
        player1Actor.hasBall = false;
        turnPlayer = 1;
        if (!isLevelOnePage && roundStep === 1) {
            roundComplete();
        }
        roundStep = 0;
        updateTurnText("玩家 2 已传球，玩家 1 准备接球");
    }

    if (isLevelOnePage) {
        updateEncourageText(`发射力度 ${Math.round(power)}%，球速由力度决定。`);
    } else {
        updateEncourageText("");
    }

    resetChargeState(player);
}

// 杞洖瀹屾垚
function roundComplete() {
    score++;
    updateEncourageText("");
    const encourageTextEl = document.getElementById("encourageText");
    if (encourageTextEl) {
        encourageTextEl.innerHTML = `<span style="color:#00ff00; font-weight:bold;">配合成功，已完成第 ${score} 次传球轮回！</span>`;
    }
    roundStep = 0;

    setTimeout(() => {
        updateEncourageText("");
    }, 3000);
}

// 鎽囨潌鎺у埗
function setupJoystick(joystickId, knobId, playerNum) {
    const joystick = document.getElementById(joystickId);
    const knob = document.getElementById(knobId);

    let dragging = false;
    let startX, startY;
    let touchId = null;

    joystick.addEventListener("touchstart", (e) => {
        if (dragging) return;

        const touch = e.changedTouches[0];
        touchId = touch.identifier;

        const rect = joystick.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;

        dragging = true;
        updateKnob(touch.clientX, touch.clientY);
    });

    document.addEventListener("touchmove", (e) => {
        if (!dragging) return;

        for (let t of e.changedTouches) {
            if (t.identifier === touchId) {
                e.preventDefault();
                updateKnob(t.clientX, t.clientY);
                break;
            }
        }
    }, { passive: false });

    document.addEventListener("touchend", (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === touchId) {
                dragging = false;
                touchId = null;

                joystickData[playerNum].x = 0;
                joystickData[playerNum].y = 0;
                joystickData[playerNum].force = { x: 0, y: 0 };

                knob.style.left = "50%";
                knob.style.top = "50%";
                break;
            }
        }
    });

    function updateKnob(clientX, clientY) {
        const maxDist = 40;

        let dx = clientX - startX;
        let dy = clientY - startY;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }

        knob.style.left = `calc(50% + ${dx}px)`;
        knob.style.top = `calc(50% + ${dy}px)`;

        joystickData[playerNum].force = {
            x: dx / maxDist,
            y: dy / maxDist
        };
    }
}

// 钃勫姏鎸夐挳
function setupChargeButton(btnId, playerNum) {
    const btn = document.getElementById(btnId);

    btn.addEventListener("mousedown", () => startCharge(playerNum, btn));
    btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        startCharge(playerNum, btn);
    });

    document.addEventListener("mouseup", () => endCharge(playerNum));
    document.addEventListener("touchend", () => endCharge(playerNum));
}

function startCharge(playerNum, btnElement) {
    if (isLevelOnePage && level1Completed) return;

    // 只有球在玩家手里时才可以开始蓄力
    const hasBall = (playerNum === 1 && player1Actor.hasBall) || 
                    (playerNum === 2 && player2Actor.hasBall);
    
    if (!hasBall) return;  // 鐞冧笉鍦ㄦ墜閲岋紝涓嶈兘钃勫姏
    if (turnPlayer !== playerNum) return;
    if (powerData[playerNum === 1 ? "player1" : "player2"].charging) return;

    powerData[playerNum === 1 ? "player1" : "player2"].charging = true;
}

function endCharge(playerNum) {
    if (isLevelOnePage && level1Completed) return;

    // 只有球在玩家手里时才可以传球
    const hasBall = (playerNum === 1 && player1Actor.hasBall) || 
                    (playerNum === 2 && player2Actor.hasBall);
    
    if (!hasBall) return;  // 鐞冧笉鍦ㄦ墜閲岋紝涓嶈兘浼犵悆
    if (turnPlayer !== playerNum) return;

    const pData = powerData[playerNum === 1 ? "player1" : "player2"];

    if (pData.charging) {
        pData.charging = false;
        passBall(playerNum);
    }
}

// 鏇存柊钃勫姏杩涘害锛堝彧鍦ㄦ寔鐞冩椂鍙互钃勫姏锛
function updateCharging() {
    // 鐜╁ 1 钃勫姏
    const pData1 = powerData.player1;
    
    // 更新按钮状态
    const btn1 = document.getElementById("chargeBtn1");
    if (btn1) {
        if (!player1Actor.hasBall) {
            btn1.classList.add("disabled");
            pData1.charging = false;
            pData1.progress = 0;
            updateChargeButtonVisual("chargeBtn1", 0);
        } else {
            btn1.classList.remove("disabled");
            if (pData1.charging) {
                pData1.progress += GAME_CONFIG.powerIncrement * 0.5;  // 璋冩暣钃勫姏閫熷害
                
                if (pData1.progress >= GAME_CONFIG.maxPower) {
                    pData1.progress = GAME_CONFIG.maxPower;
                }
                
                // 鏇存柊鎸夐挳涓婄殑杩涘害鏄剧ず
                updateChargeButtonVisual("chargeBtn1", pData1.progress);
            }
        }
    }
    
    // 鐜╁ 2 钃勫姏
    const pData2 = powerData.player2;
    
    // 更新按钮状态
    const btn2 = document.getElementById("chargeBtn2");
    if (btn2) {
        if (!player2Actor.hasBall) {
            btn2.classList.add("disabled");
            pData2.charging = false;
            pData2.progress = 0;
            updateChargeButtonVisual("chargeBtn2", 0);
        } else {
            btn2.classList.remove("disabled");
            if (pData2.charging) {
                pData2.progress += GAME_CONFIG.powerIncrement * 0.5;  // 璋冩暣钃勫姏閫熷害
                
                if (pData2.progress >= GAME_CONFIG.maxPower) {
                    pData2.progress = GAME_CONFIG.maxPower;
                }
                
                // 鏇存柊鎸夐挳涓婄殑杩涘害鏄剧ず
                updateChargeButtonVisual("chargeBtn2", pData2.progress);
            }
        }
    }
}

// 鏇存柊钃勫姏鎸夐挳瑙嗚鏁堟灉锛堢幆褰㈣繘搴︼級
function updateChargeButtonVisual(btnId, progress) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    // 璁＄畻杩涘害鐧惧垎姣?(0-100 鏄犲皠鍒?0-100%)
    const percentage = (progress / GAME_CONFIG.maxPower) * 100;

    let bgColor;
    if (isLevelOnePage) {
        const hue = Math.round((percentage / 100) * 120);
        bgColor = `hsla(${hue}, 80%, 45%, 0.8)`;
    } else if (progress < GAME_CONFIG.sweetSpotMin) {
        bgColor = "rgba(244, 67, 54, 0.6)";
    } else if (progress < GAME_CONFIG.sweetSpotMax) {
        bgColor = "rgba(76, 175, 80, 0.6)";
    } else {
        bgColor = "rgba(255, 152, 0, 0.6)";
    }

    // 浣跨敤鍦嗛敟娓愬彉鍒涘缓鐜舰杩涘害鏁堟灉
    const angle = (percentage / 100) * 360;
    btn.style.background = `conic-gradient(${bgColor} ${angle}deg, rgba(200, 200, 200, 0.3) ${angle}deg)`;
}

// 缁樺埗绉诲姩鏂瑰悜鎸囩ず鍣
function drawMovementIndicators() {
    // 鍙互鍦ㄨ繖閲屾坊鍔犻澶栫殑鎸囩ず鍣ㄧ粯鍒堕€昏緫
}

// 娓告垙涓诲惊鐜
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawField();
    if (!(isLevelOnePage && level1Completed)) {
        updateCharging();
        updatePlayers();
        updateBall();
    }
    drawPowerBars();
    drawMovementIndicators();
    drawPlayers();
    drawBall();

    requestAnimationFrame(gameLoop);
}

// 鍒濆鍖栨父鎴
function initGame() {
    setupJoystick("joystick1", "knob1", "player1");
    setupJoystick("joystick2", "knob2", "player2");
    setupChargeButton("chargeBtn1", 1);
    setupChargeButton("chargeBtn2", 2);
    gameLoop();
}

// 椤甸潰鍔犺浇瀹屾垚鍚庡垵濮嬪寲
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// 妫€娴嬬帺瀹舵槸鍚︽帴鍒扮悆锛堟帴瑙︽娴嬶級
function checkPlayerCatchBall() {
    if (!ballInAir) return;
    
    // 检测玩家1接球（必须是对方传球）
    const dx1 = ball.x - player1Actor.x;
    const dy1 = ball.y - player1Actor.y;
    const distance1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const minDistance1 = player1Actor.radius + ball.radius;
    
    if (distance1 <= minDistance1 && turnPlayer === 1) {
        player1Actor.hasBall = true;
        player2Actor.hasBall = false;
        ballInAir = false;
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        clearTimeout(noCatchTimeout);
        hideNoCatchDialog();

        if (isLevelOnePage) {
            handleLevel1PassSuccess(1);
        } else {
            updateTurnText("玩家 1 接到球了，准备传给玩家 2");
            updateEncourageText("传球成功！");
        }
        return; // 鎻愬墠杩斿洖
    }
    
    // 检测玩家2接球（必须是对方传球）
    const dx2 = ball.x - player2Actor.x;
    const dy2 = ball.y - player2Actor.y;
    const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const minDistance2 = player2Actor.radius + ball.radius;
    
    if (distance2 <= minDistance2 && turnPlayer === 2) {
        player2Actor.hasBall = true;
        player1Actor.hasBall = false;
        ballInAir = false;
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        clearTimeout(noCatchTimeout);
        hideNoCatchDialog();

        if (isLevelOnePage) {
            handleLevel1PassSuccess(2);
        } else {
            updateTurnText("玩家 2 接到球了，准备传给玩家 1");
            updateEncourageText("传球成功！");
        }
        return; // 鎻愬墠杩斿洖
    }
}


// 鏄剧ず鏈帴鐞冭鍛婂脊绐
function showNoCatchWarning() {
    if (isLevelOnePage && level1Completed) return;
    if (showNoCatchDialog) return;
    
    showNoCatchDialog = true;
    
    // 鍒涘缓寮圭獥
    const dialog = document.createElement('div');
    dialog.id = 'noCatchDialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        padding: 30px 50px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        text-align: center;
        z-index: 1000;
        animation: popIn 0.3s ease;
    `;
    
    dialog.innerHTML = `
        <h2 style="color: #ff9800; margin: 0 0 15px 0; font-size: 28px;">⚠️ 传球失败</h2>
        <p style="color: #666; font-size: 18px; margin: 10px 0;">对方球员没有接到球</p>
        <p style="color: #999; font-size: 14px; margin-top: 20px;">点击屏幕继续游戏，球权将转换</p>
    `;
    
    // 娣诲姞鍔ㄧ敾鏍峰紡
    const style = document.createElement('style');
    style.textContent = `
        @keyframes popIn {
            from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
            to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(dialog);
    
    // 娣诲姞鐐瑰嚮浜嬩欢鐩戝惉
    dialog.addEventListener('click', () => {
        transferBallToOtherPlayer();
    });
    
    // 涔熺洃鍚暣涓敾甯冪殑鐐瑰嚮
    canvas.addEventListener('click', handleCanvasClick);
    
    // 3 绉掑悗鑷姩杞Щ鐞冩潈
    setTimeout(() => {
        if (showNoCatchDialog) {
            transferBallToOtherPlayer();
        }
    }, 3000);
}

// 澶勭悊鐢诲竷鐐瑰嚮
function handleCanvasClick() {
    if (showNoCatchDialog) {
        transferBallToOtherPlayer();
    }
}

// 闅愯棌寮圭獥
function hideNoCatchDialog() {
    const dialog = document.getElementById('noCatchDialog');
    if (dialog) {
        dialog.remove();
    }
    showNoCatchDialog = false;
    canvas.removeEventListener('click', handleCanvasClick);
}

// 灏嗙悆杞Щ缁欏彟涓€涓帺瀹
function transferBallToOtherPlayer() {
    if (isLevelOnePage && level1Completed) return;

    hideNoCatchDialog();
    clearTimeout(noCatchTimeout);
    noCatchTimeout = null;
    ballInAir = false;
    lastPasser = null;
    
    if (turnPlayer === 2) {
        // 鐜╁ 1 浼犵殑鐞冿紝娌′汉鎺ワ紝杞粰鐜╁ 2
        player2Actor.hasBall = true;
        player1Actor.hasBall = false;
        turnPlayer = 2;
        ball.x = player2Actor.x - 15;
        ball.y = player2Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        updateTurnText("玩家 1 传球无人接，玩家 2 获得球权");
        updateEncourageText("注意配合，及时接球！");
    } else {
        // 鐜╁ 2 浼犵殑鐞冿紝娌′汉鎺ワ紝杞粰鐜╁ 1
        player1Actor.hasBall = true;
        player2Actor.hasBall = false;
        turnPlayer = 1;
        ball.x = player1Actor.x + 15;
        ball.y = player1Actor.y + 20;
        ball.vx = 0;
        ball.vy = 0;
        updateTurnText("玩家 2 传球无人接，玩家 1 获得球权");
        updateEncourageText("注意配合，及时接球！");
    }
    
    roundStep = 0;  // 閲嶇疆杞洖杩涘害
}



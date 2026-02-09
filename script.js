const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const growthBar = document.getElementById("growth-bar");
const scoreLabel = document.getElementById("score");
const livesLabel = document.getElementById("lives");
const menuScreen = document.getElementById("menu");
const gameOverScreen = document.getElementById("gameover");
const finalScoreLabel = document.getElementById("final-score");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const GAME_STATES = {
  MENU: "menu",
  PLAYING: "playing",
  GAMEOVER: "gameover",
};

const inputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  mouse: { x: 0, y: 0 },
  hasMouse: false,
};

const powerUpTypes = {
  SPEED: "speed",
  SHIELD: "shield",
};

let lastTimestamp = 0;
let gameState = GAME_STATES.MENU;
let player;
let fishes = [];
let powerUps = [];
let score = 0;
let lives = 3;
let spawnTimer = 0;
let powerUpTimer = 0;

class Player {
  constructor() {
    this.position = { x: canvas.width / 2, y: canvas.height / 2 };
    this.radius = 24;
    this.baseSpeed = 260;
    this.speedMultiplier = 1;
    this.growthPoints = 0;
    this.growthThreshold = 100;
    this.level = 1;
    this.shielded = false;
    this.shieldTimer = 0;
    this.speedTimer = 0;
  }

  update(delta) {
    const speed = this.baseSpeed * this.speedMultiplier;
    let directionX = 0;
    let directionY = 0;

    if (inputState.left) directionX -= 1;
    if (inputState.right) directionX += 1;
    if (inputState.up) directionY -= 1;
    if (inputState.down) directionY += 1;

    if (directionX !== 0 || directionY !== 0) {
      const length = Math.hypot(directionX, directionY) || 1;
      directionX /= length;
      directionY /= length;
      this.position.x += directionX * speed * delta;
      this.position.y += directionY * speed * delta;
    } else if (inputState.hasMouse) {
      const dx = inputState.mouse.x - this.position.x;
      const dy = inputState.mouse.y - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 4) {
        this.position.x += (dx / distance) * speed * delta;
        this.position.y += (dy / distance) * speed * delta;
      }
    }

    this.position.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.position.x));
    this.position.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.position.y));

    if (this.speedTimer > 0) {
      this.speedTimer -= delta;
      if (this.speedTimer <= 0) {
        this.speedMultiplier = 1;
      }
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.shielded = false;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.ellipse(this.position.x, this.position.y, this.radius * 1.2, this.radius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(this.position.x + this.radius * 0.5, this.position.y - this.radius * 0.2, this.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    if (this.shielded) {
      ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, this.radius * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  addGrowth(points) {
    this.growthPoints += points;
    if (this.growthPoints >= this.growthThreshold) {
      this.growthPoints -= this.growthThreshold;
      this.level += 1;
      this.radius += 6;
      this.growthThreshold = Math.round(this.growthThreshold * 1.25);
    }
  }

  activatePowerUp(type) {
    if (type === powerUpTypes.SPEED) {
      this.speedMultiplier = 1.6;
      this.speedTimer = 6;
    }

    if (type === powerUpTypes.SHIELD) {
      this.shielded = true;
      this.shieldTimer = 8;
    }
  }
}

class Fish {
  constructor(tier) {
    this.tier = tier;
    this.radius = 18 + tier * 8;
    const spawnFromLeft = Math.random() > 0.5;
    this.position = {
      x: spawnFromLeft ? -this.radius : canvas.width + this.radius,
      y: Math.random() * (canvas.height - this.radius * 2) + this.radius,
    };
    const speedBase = 60 + tier * 20;
    const speedVariance = Math.random() * 40;
    this.velocity = {
      x: (spawnFromLeft ? 1 : -1) * (speedBase + speedVariance),
      y: (Math.random() - 0.5) * 40,
    };
    this.color = tier > 3 ? "#ef476f" : tier > 1 ? "#06d6a0" : "#118ab2";
  }

  update(delta) {
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;

    if (this.position.y < this.radius || this.position.y > canvas.height - this.radius) {
      this.velocity.y *= -1;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(this.position.x, this.position.y, this.radius * 1.1, this.radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isOffscreen() {
    return this.position.x < -this.radius * 3 || this.position.x > canvas.width + this.radius * 3;
  }
}

class PowerUp {
  constructor(type) {
    this.type = type;
    this.radius = 16;
    this.position = {
      x: Math.random() * (canvas.width - 120) + 60,
      y: Math.random() * (canvas.height - 120) + 60,
    };
    this.lifeTime = 10;
  }

  update(delta) {
    this.lifeTime -= delta;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.type === powerUpTypes.SPEED ? "#f4a261" : "#4cc9f0";
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b1b1b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.type === powerUpTypes.SPEED ? "S" : "P", this.position.x, this.position.y + 1);
    ctx.restore();
  }
}

const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (player) {
    player.position.x = Math.min(player.position.x, canvas.width - player.radius);
    player.position.y = Math.min(player.position.y, canvas.height - player.radius);
  }
};

const resetGame = () => {
  player = new Player();
  fishes = [];
  powerUps = [];
  score = 0;
  lives = 3;
  spawnTimer = 0;
  powerUpTimer = 0;
  updateHUD();
};

const updateHUD = () => {
  scoreLabel.textContent = `Score: ${score}`;
  livesLabel.textContent = `Lives: ${lives}`;
  const progress = Math.min(player.growthPoints / player.growthThreshold, 1);
  growthBar.style.width = `${progress * 100}%`;
};

const setGameState = (state) => {
  gameState = state;
  menuScreen.classList.toggle("active", state === GAME_STATES.MENU);
  gameOverScreen.classList.toggle("active", state === GAME_STATES.GAMEOVER);
  document.getElementById("ui").style.display = state === GAME_STATES.PLAYING ? "flex" : "none";
};

const spawnFish = () => {
  const tier = Math.floor(Math.random() * Math.min(player.level + 1, 5));
  fishes.push(new Fish(tier));
};

const spawnPowerUp = () => {
  const type = Math.random() > 0.5 ? powerUpTypes.SPEED : powerUpTypes.SHIELD;
  powerUps.push(new PowerUp(type));
};

const handleCollisions = () => {
  fishes = fishes.filter((fish) => {
    const distance = Math.hypot(player.position.x - fish.position.x, player.position.y - fish.position.y);
    if (distance < player.radius + fish.radius * 0.9) {
      if (player.radius >= fish.radius) {
        score += 10 + fish.tier * 5;
        player.addGrowth(25 + fish.tier * 10);
        updateHUD();
        return false;
      }

      if (!player.shielded) {
        lives -= 1;
        updateHUD();
        if (lives <= 0) {
          finalScoreLabel.textContent = `Final Score: ${score}`;
          setGameState(GAME_STATES.GAMEOVER);
        } else {
          player.position = { x: canvas.width / 2, y: canvas.height / 2 };
        }
        return false;
      }
    }
    return true;
  });

  powerUps = powerUps.filter((powerUp) => {
    const distance = Math.hypot(player.position.x - powerUp.position.x, player.position.y - powerUp.position.y);
    if (distance < player.radius + powerUp.radius) {
      player.activatePowerUp(powerUp.type);
      return false;
    }
    return powerUp.lifeTime > 0;
  });
};

const update = (timestamp) => {
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (gameState === GAME_STATES.PLAYING) {
    player.update(delta);
    fishes.forEach((fish) => fish.update(delta));
    powerUps.forEach((powerUp) => powerUp.update(delta));

    spawnTimer += delta;
    if (spawnTimer > 1.2) {
      spawnFish();
      spawnTimer = 0;
    }

    powerUpTimer += delta;
    if (powerUpTimer > 8) {
      spawnPowerUp();
      powerUpTimer = 0;
    }

    handleCollisions();
    fishes = fishes.filter((fish) => !fish.isOffscreen());

    draw();
  }

  requestAnimationFrame(update);
};

const draw = () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  fishes.forEach((fish) => fish.draw(context));
  powerUps.forEach((powerUp) => powerUp.draw(context));
  player.draw(context);
};

window.addEventListener("resize", resizeCanvas);

window.addEventListener("mousemove", (event) => {
  inputState.mouse.x = event.clientX;
  inputState.mouse.y = event.clientY;
  inputState.hasMouse = true;
});

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowUp":
    case "w":
    case "W":
      inputState.up = true;
      break;
    case "ArrowDown":
    case "s":
    case "S":
      inputState.down = true;
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      inputState.left = true;
      break;
    case "ArrowRight":
    case "d":
    case "D":
      inputState.right = true;
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key) {
    case "ArrowUp":
    case "w":
    case "W":
      inputState.up = false;
      break;
    case "ArrowDown":
    case "s":
    case "S":
      inputState.down = false;
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      inputState.left = false;
      break;
    case "ArrowRight":
    case "d":
    case "D":
      inputState.right = false;
      break;
    default:
      break;
  }
});

startButton.addEventListener("click", () => {
  resetGame();
  setGameState(GAME_STATES.PLAYING);
});

restartButton.addEventListener("click", () => {
  resetGame();
  setGameState(GAME_STATES.PLAYING);
});

resizeCanvas();
setGameState(GAME_STATES.MENU);
requestAnimationFrame(update);

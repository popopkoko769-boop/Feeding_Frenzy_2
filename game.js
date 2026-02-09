const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const menuOverlay = document.getElementById("menu");
const gameOverOverlay = document.getElementById("gameOver");
const scoreLabel = document.getElementById("score");
const livesLabel = document.getElementById("lives");
const growthFill = document.getElementById("growthFill");
const powerupsContainer = document.getElementById("powerups");
const finalScoreLabel = document.getElementById("finalScore");

const GAME_STATE = {
  MENU: "menu",
  RUNNING: "running",
  GAME_OVER: "game_over",
};

const input = {
  keys: new Set(),
  mouse: { x: canvas.width / 2, y: canvas.height / 2, active: false },
};

class Player {
  constructor() {
    this.baseRadius = 18;
    this.radius = this.baseRadius;
    this.position = { x: canvas.width / 2, y: canvas.height / 2 };
    this.speed = 2.6;
    this.targetSpeedMultiplier = 1;
    this.shielded = false;
    this.growthPoints = 0;
    this.growthThreshold = 100;
    this.level = 1;
  }

  update(deltaTime) {
    const movement = { x: 0, y: 0 };
    if (input.keys.has("ArrowUp") || input.keys.has("w")) movement.y -= 1;
    if (input.keys.has("ArrowDown") || input.keys.has("s")) movement.y += 1;
    if (input.keys.has("ArrowLeft") || input.keys.has("a")) movement.x -= 1;
    if (input.keys.has("ArrowRight") || input.keys.has("d")) movement.x += 1;

    const usingKeyboard = movement.x !== 0 || movement.y !== 0;
    if (usingKeyboard) {
      const length = Math.hypot(movement.x, movement.y) || 1;
      this.position.x +=
        (movement.x / length) * this.speed * this.targetSpeedMultiplier * deltaTime;
      this.position.y +=
        (movement.y / length) * this.speed * this.targetSpeedMultiplier * deltaTime;
    } else if (input.mouse.active) {
      const dx = input.mouse.x - this.position.x;
      const dy = input.mouse.y - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 4) {
        const step = Math.min(distance, this.speed * 3 * deltaTime);
        this.position.x += (dx / distance) * step;
        this.position.y += (dy / distance) * step;
      }
    }

    this.position.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.position.x));
    this.position.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.position.y));
  }

  draw() {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.fillStyle = "#ffcc5c";
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.2, this.radius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(this.radius * 0.4, -this.radius * 0.2, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    if (this.shielded) {
      ctx.strokeStyle = "rgba(80, 200, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  gainGrowth(points) {
    this.growthPoints += points;
    if (this.growthPoints >= this.growthThreshold) {
      this.growthPoints -= this.growthThreshold;
      this.level += 1;
      this.radius += 4;
      this.baseRadius = this.radius;
      this.growthThreshold = Math.floor(this.growthThreshold * 1.25);
    }
  }

  reset() {
    this.radius = this.baseRadius = 18;
    this.position = { x: canvas.width / 2, y: canvas.height / 2 };
    this.growthPoints = 0;
    this.growthThreshold = 100;
    this.level = 1;
    this.speed = 2.6;
    this.targetSpeedMultiplier = 1;
    this.shielded = false;
  }
}

class Fish {
  constructor(tier) {
    this.tier = tier;
    this.radius = 10 + tier * 6;
    this.speed = 0.9 + tier * 0.4 + Math.random() * 0.6;
    const direction = Math.random() > 0.5 ? 1 : -1;
    this.velocity = { x: direction * this.speed, y: (Math.random() - 0.5) * 0.6 };
    this.position = {
      x: direction === 1 ? -this.radius * 2 : canvas.width + this.radius * 2,
      y: 40 + Math.random() * (canvas.height - 80),
    };
    this.color = ["#8ce5ff", "#6cf4b4", "#ff8b8b", "#ffd56b"][tier % 4];
  }

  update(deltaTime) {
    this.position.x += this.velocity.x * deltaTime * 2.4;
    this.position.y += this.velocity.y * deltaTime * 2.4;

    if (this.position.x < -80 || this.position.x > canvas.width + 80) {
      this.respawn();
    }
  }

  respawn() {
    const direction = Math.random() > 0.5 ? 1 : -1;
    this.velocity.x = direction * this.speed;
    this.position.x = direction === 1 ? -this.radius * 2 : canvas.width + this.radius * 2;
    this.position.y = 40 + Math.random() * (canvas.height - 80);
  }

  draw() {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.3, this.radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class PowerUp {
  constructor(type) {
    this.type = type;
    this.radius = 12;
    this.position = {
      x: 60 + Math.random() * (canvas.width - 120),
      y: 60 + Math.random() * (canvas.height - 120),
    };
    this.duration = 6000;
    this.active = false;
    this.colors = {
      speed: "#f3ff6b",
      shield: "#7cc7ff",
    };
  }

  draw() {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.fillStyle = this.colors[this.type];
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a1a1a";
    ctx.font = "12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.type === "speed" ? "S" : "H", 0, 1);
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.state = GAME_STATE.MENU;
    this.player = new Player();
    this.fish = [];
    this.powerUps = [];
    this.score = 0;
    this.lives = 3;
    this.lastTime = 0;
    this.spawnTimer = 0;
    this.powerTimer = 0;
    this.activeBuffs = new Map();
    this.loop = this.loop.bind(this);
  }

  start() {
    this.reset();
    this.state = GAME_STATE.RUNNING;
    menuOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    requestAnimationFrame(this.loop);
  }

  reset() {
    this.player.reset();
    this.fish = Array.from({ length: 8 }, () => new Fish(Math.floor(Math.random() * 4)));
    this.powerUps = [];
    this.score = 0;
    this.lives = 3;
    this.spawnTimer = 0;
    this.powerTimer = 0;
    this.activeBuffs.clear();
    this.updateHud();
  }

  loop(timestamp) {
    if (this.state !== GAME_STATE.RUNNING) return;
    const deltaTime = Math.min(32, timestamp - this.lastTime) / 16;
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(deltaTime) {
    this.player.update(deltaTime);
    this.fish.forEach((fish) => fish.update(deltaTime));
    this.handleCollisions();

    this.spawnTimer += deltaTime;
    if (this.spawnTimer > 90) {
      this.spawnTimer = 0;
      this.fish.push(new Fish(Math.floor(Math.random() * 4)));
      if (this.fish.length > 12) this.fish.shift();
    }

    this.powerTimer += deltaTime;
    if (this.powerTimer > 160) {
      this.powerTimer = 0;
      const type = Math.random() > 0.5 ? "speed" : "shield";
      this.powerUps.push(new PowerUp(type));
      if (this.powerUps.length > 2) this.powerUps.shift();
    }

    this.tickBuffs();
    this.updateHud();
  }

  handleCollisions() {
    this.fish.forEach((fish) => {
      const distance = Math.hypot(
        fish.position.x - this.player.position.x,
        fish.position.y - this.player.position.y
      );

      if (distance < fish.radius + this.player.radius) {
        if (fish.radius < this.player.radius) {
          this.score += 10 + fish.tier * 2;
          this.player.gainGrowth(20 + fish.tier * 8);
          fish.respawn();
        } else if (!this.player.shielded) {
          this.loseLife();
        }
      }
    });

    this.powerUps = this.powerUps.filter((powerUp) => {
      const distance = Math.hypot(
        powerUp.position.x - this.player.position.x,
        powerUp.position.y - this.player.position.y
      );

      if (distance < powerUp.radius + this.player.radius) {
        this.activatePowerUp(powerUp.type);
        return false;
      }
      return true;
    });
  }

  activatePowerUp(type) {
    const now = performance.now();
    this.activeBuffs.set(type, now + 6000);
    if (type === "speed") {
      this.player.targetSpeedMultiplier = 1.7;
    }
    if (type === "shield") {
      this.player.shielded = true;
    }
  }

  tickBuffs() {
    const now = performance.now();
    this.activeBuffs.forEach((expiry, type) => {
      if (now > expiry) {
        this.activeBuffs.delete(type);
        if (type === "speed") {
          this.player.targetSpeedMultiplier = 1;
        }
        if (type === "shield") {
          this.player.shielded = false;
        }
      }
    });
  }

  loseLife() {
    this.lives -= 1;
    this.player.position = { x: canvas.width / 2, y: canvas.height / 2 };
    if (this.lives <= 0) {
      this.endGame();
    }
  }

  endGame() {
    this.state = GAME_STATE.GAME_OVER;
    finalScoreLabel.textContent = `Score: ${this.score}`;
    gameOverOverlay.classList.remove("hidden");
  }

  updateHud() {
    scoreLabel.textContent = `Score: ${this.score}`;
    livesLabel.textContent = `Lives: ${this.lives}`;
    const growthPercent = Math.min(
      100,
      Math.floor((this.player.growthPoints / this.player.growthThreshold) * 100)
    );
    growthFill.style.width = `${growthPercent}%`;

    powerupsContainer.innerHTML = "";
    this.activeBuffs.forEach((expiry, type) => {
      const remaining = Math.max(0, Math.ceil((expiry - performance.now()) / 1000));
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = `${type.toUpperCase()} ${remaining}s`;
      powerupsContainer.appendChild(badge);
    });
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let i = 0; i < 28; i += 1) {
      const x = (i * 120 + (Date.now() / 10) % 120) % canvas.width;
      const y = (i * 80) % canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    this.fish.forEach((fish) => fish.draw());
    this.powerUps.forEach((powerUp) => powerUp.draw());
    this.player.draw();
  }
}

const game = new Game();

startButton.addEventListener("click", () => game.start());
restartButton.addEventListener("click", () => game.start());

window.addEventListener("keydown", (event) => {
  input.keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  input.keys.delete(event.key);
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  input.mouse.x = event.clientX - rect.left;
  input.mouse.y = event.clientY - rect.top;
  input.mouse.active = true;
});

canvas.addEventListener("mouseleave", () => {
  input.mouse.active = false;
});

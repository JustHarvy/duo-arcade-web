class SnakeGame {
  constructor() {
    this.$app = document.querySelector('#app');
    this.$canvas = this.$app.querySelector('canvas');
    this.ctx = this.$canvas.getContext('2d');
    this.$startScreen = this.$app.querySelector('.start-screen');
    this.$score = this.$app.querySelector('.score');
    this.$hudMode = document.querySelector('#hud-mode');

    this.settings = {
      canvas: {
        width: 600,
        height: 440,
        background: '#090D16',
        gridColor: 'rgba(148, 163, 184, 0.05)'
      },
      snake: {
        size: 20,
        headColor: '#FBBF24',
        background: '#F59E0B',
        glow: 'rgba(245, 158, 11, 0.45)'
      }
    };

    this.game = {
      speed: 90,
      score: 0,
      direction: 'right',
      nextDirection: 'right',
      isRunning: false,
      keyCodes: {
        87: 'up',    // W
        38: 'up',    // Flecha Arriba
        83: 'down',  // S
        40: 'down',  // Flecha Abajo
        68: 'right', // D
        39: 'right', // Flecha Derecha
        65: 'left',  // A
        37: 'left'   // Flecha Izquierda
      }
    };

    this.soundEffects = {
      score: new Audio('https://arcade.arealalien.com/games/snake/sounds/score.mp3'),
      gameOver: new Audio('https://arcade.arealalien.com/games/snake/sounds/game-over.mp3')
    };

    this.setUpGame();
    this.resetCanvas();
    this.init();
  }

  init() {
    // Selección de dificultad corregida mediante delegación de eventos segura
    const optionsContainer = this.$startScreen.querySelector('.options');
    if (optionsContainer) {
      optionsContainer.addEventListener('click', (event) => {
        const btn = event.target.closest('button');
        if (btn && btn.dataset.difficulty) {
          this.chooseDifficulty(btn);
        }
      });
    }

    // Botón Play
    const playBtn = this.$startScreen.querySelector('.play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.startGame();
      });
    }

    // Listener global de teclado
    document.addEventListener('keydown', (event) => {
      if (!this.game.isRunning) return;
      
      if ([37, 38, 39, 40, 32].includes(event.keyCode)) {
        event.preventDefault(); // Evita que la página haga scroll con las flechas
      }
      this.changeDirection(event.keyCode);
    });
  }

  chooseDifficulty(button) {
    this.game.speed = Number(button.dataset.difficulty);
    this.$startScreen.querySelectorAll('.btn-diff').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    if (this.$hudMode) {
      this.$hudMode.innerText = button.innerText.toUpperCase();
    }
  }

  setUpGame() {
    const startX = 160;
    const startY = 220;
    const size = this.settings.snake.size;

    this.snake = [
      { x: startX, y: startY },
      { x: startX - size, y: startY },
      { x: startX - (size * 2), y: startY },
      { x: startX - (size * 3), y: startY },
      { x: startX - (size * 4), y: startY }
    ];

    this.food = {
      active: false,
      background: '#06B6D4',
      glow: 'rgba(6, 182, 212, 0.55)',
      coordinates: { x: 0, y: 0 }
    };

    this.game.score = 0;
    this.game.direction = 'right';
    this.game.nextDirection = 'right';
  }

  startGame() {
    // Detener sonidos previos si se reinicia rápido
    this.soundEffects.gameOver.pause();
    this.soundEffects.gameOver.currentTime = 0;

    this.setUpGame();
    this.game.isRunning = true;

    // Cambiar estados visuales en el contenedor principal
    this.$app.classList.add('game-in-progress');
    this.$app.classList.remove('game-over');
    if (this.$score) {
      this.$score.innerText = '0';
    }

    this.resetCanvas();
    this.generateFood();
    this.drawSnake();

    if (this.startGameInterval) {
      clearInterval(this.startGameInterval);
    }

    this.startGameInterval = setInterval(() => {
      if (!this.detectCollision()) {
        this.updateGame();
      } else {
        this.endGame();
      }
    }, this.game.speed);
  }

  changeDirection(keyCode) {
    const validKeyPress = Object.keys(this.game.keyCodes).includes(keyCode.toString());
    if (validKeyPress && this.validateDirectionChange(this.game.keyCodes[keyCode], this.game.direction)) {
      this.game.nextDirection = this.game.keyCodes[keyCode];
    }
  }

  validateDirectionChange(keyPress, currentDirection) {
    return (keyPress === 'left' && currentDirection !== 'right') ||
           (keyPress === 'right' && currentDirection !== 'left') ||
           (keyPress === 'up' && currentDirection !== 'down') ||
           (keyPress === 'down' && currentDirection !== 'up');
  }

  resetCanvas() {
    if (!this.$canvas) return;
    this.$canvas.width = this.settings.canvas.width;
    this.$canvas.height = this.settings.canvas.height;

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = this.settings.canvas.background;
    this.ctx.fillRect(0, 0, this.$canvas.width, this.$canvas.height);

    const step = this.settings.snake.size;
    this.ctx.strokeStyle = this.settings.canvas.gridColor;
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= this.$canvas.width; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.$canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.$canvas.height; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.$canvas.width, y);
      this.ctx.stroke();
    }
  }

  updateGame() {
    this.game.direction = this.game.nextDirection;
    const size = this.settings.snake.size;
    let coordinate;

    switch (this.game.direction) {
      case 'right': coordinate = { x: this.snake[0].x + size, y: this.snake[0].y }; break;
      case 'up':    coordinate = { x: this.snake[0].x, y: this.snake[0].y - size }; break;
      case 'left':  coordinate = { x: this.snake[0].x - size, y: this.snake[0].y }; break;
      case 'down':  coordinate = { x: this.snake[0].x, y: this.snake[0].y + size }; break;
    }

    this.snake.unshift(coordinate);

    if (this.detectCollision()) {
      this.endGame();
      return;
    }

    this.resetCanvas();

    const ateFood = this.snake[0].x === this.food.coordinates.x && this.snake[0].y === this.food.coordinates.y;

    if (ateFood) {
      this.food.active = false;
      this.game.score += 10;
      if (this.$score) {
        this.$score.innerText = this.game.score;
      }
      this.soundEffects.score.currentTime = 0;
      this.soundEffects.score.play().catch(() => {});
    } else {
      this.snake.pop();
    }

    this.generateFood();
    this.drawSnake();
  }

  drawSnake() {
    const size = this.settings.snake.size;

    this.snake.forEach((coordinate, index) => {
      this.ctx.fillStyle = index === 0 ? this.settings.snake.headColor : this.settings.snake.background;
      this.ctx.shadowColor = this.settings.snake.glow;
      this.ctx.shadowBlur = index === 0 ? 18 : 10;
      this.ctx.fillRect(coordinate.x + 1, coordinate.y + 1, size - 2, size - 2);
    });
  }

  generateFood() {
    if (this.food.active) {
      this.drawFood(this.food.coordinates.x, this.food.coordinates.y);
      return;
    }

    const gridSize = this.settings.snake.size;
    const cols = this.settings.canvas.width / gridSize;
    const rows = this.settings.canvas.height / gridSize;

    let x, y, conflict;
    do {
      x = Math.floor(Math.random() * cols) * gridSize;
      y = Math.floor(Math.random() * rows) * gridSize;
      conflict = this.snake.some(part => part.x === x && part.y === y);
    } while (conflict);

    this.drawFood(x, y);
  }

  drawFood(x, y) {
    const size = this.settings.snake.size;

    this.ctx.fillStyle = this.food.background;
    this.ctx.shadowColor = this.food.glow;
    this.ctx.shadowBlur = 18;
    this.ctx.fillRect(x + 2, y + 2, size - 4, size - 4);

    this.food.active = true;
    this.food.coordinates.x = x;
    this.food.coordinates.y = y;
  }

  detectCollision() {
    const head = this.snake[0];

    // Colisión consigo misma
    for (let i = 4; i < this.snake.length; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        return true;
      }
    }

    // Colisión con los bordes
    return (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= this.$canvas.width ||
      head.y >= this.$canvas.height
    );
  }

  endGame() {
    this.game.isRunning = false;
    this.soundEffects.gameOver.play().catch(() => {});
    clearInterval(this.startGameInterval);

    this.$app.classList.remove('game-in-progress');
    this.$app.classList.add('game-over');

    const title = this.$startScreen.querySelector('#screen-title');
    const endScore = this.$startScreen.querySelector('.end-score');
    const playBtn = this.$startScreen.querySelector('.play-btn');

    if (title) title.innerText = 'GAME OVER';
    if (endScore) {
      endScore.innerText = `SCORE: ${this.game.score}`;
      endScore.classList.remove('d-none');
    }
    if (playBtn) playBtn.innerText = 'VOLVER A JUGAR';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SnakeGame();
});
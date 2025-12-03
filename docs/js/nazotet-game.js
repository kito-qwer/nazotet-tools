(() => {
	'use strict';

	const GameConstants = {
		COLS: 10,
		ROWS: 23,
		HIDDEN_ROWS: 3,

		MINO_IDS: {
			EMPTY: 0,
			I: 1, L: 2, O: 3, Z: 4, T: 5, J: 6, S: 7,
			GRAY: 8
		},

		CHAR_TO_ID: {
			'I': 1, 'L': 2, 'O': 3, 'Z': 4, 'T': 5, 'J': 6, 'S': 7,
			'G': 8, 'N': 0
		},

		ID_TO_CHAR: {
			0: '', 1: 'I', 2: 'L', 3: 'O', 4: 'Z', 5: 'T', 6: 'J', 7: 'S', 8: 'G'
		},

		COLORS: {
			1: '#00FFFF', // I
			2: '#FFA500', // L
			3: '#FFFF00', // O
			4: '#FF0000', // Z
			5: '#FF00FF', // T
			6: '#0000FF', // J
			7: '#00FF00', // S
			8: '#808080', // GRAY
			0: '#000000', // EMPTY
			GHOST: 'rgba(255, 255, 255, 0.2)'
		},

		SHAPES: [
			null,
			[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
			[[0, 0, 1], [1, 1, 1], [0, 0, 0]], // L
			[[1, 1], [1, 1]],                  // O
			[[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
			[[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
			[[1, 0, 0], [1, 1, 1], [0, 0, 0]], // J
			[[0, 1, 1], [1, 1, 0], [0, 0, 0]], // S
			[[1]]                              // GRAY
		],

		RULE_KEYS: [
			'tss', 'tsd', 'tst',
			'miniTss', 'miniTsd',
			'single', 'double', 'triple', 'quad',
			'perfectClear', 'combo'
		],

		WALL_KICK_DATA_JLSTZ: [
			[[-1, 0], [-1, 1], [0, -2], [-1, -2]],
			[[1, 0], [1, -1], [0, 2], [1, 2]],
			[[1, 0], [1, -1], [0, 2], [1, 2]],
			[[-1, 0], [-1, 1], [0, -2], [-1, -2]],
			[[1, 0], [1, 1], [0, -2], [1, -2]],
			[[-1, 0], [-1, -1], [0, 2], [-1, 2]],
			[[-1, 0], [-1, -1], [0, 2], [-1, 2]],
			[[1, 0], [1, 1], [0, -2], [1, -2]],
		],
		WALL_KICK_DATA_I: [
			[[-2, 0], [1, 0], [-2, 1], [1, -2]],
			[[2, 0], [-1, 0], [2, -1], [-1, 2]],
			[[-1, 0], [2, 0], [-1, -2], [2, 1]],
			[[1, 0], [-2, 0], [1, 2], [-2, -1]],
			[[2, 0], [-1, 0], [2, -1], [-1, 2]],
			[[-2, 0], [1, 0], [-2, 1], [1, -2]],
			[[1, 0], [-2, 0], [1, 2], [-2, -1]],
			[[-2, 0], [1, 0], [-2, -2], [2, 1]],
		],
	};

	class Tetromino {
		constructor(typeId) {
			this.type = typeId;
			this.shape = GameConstants.SHAPES[typeId];
			this.rotation = 0;
			const width = this.shape[0].length;
			this.x = Math.floor(GameConstants.COLS / 2) - Math.ceil(width / 2);
			this.y = GameConstants.HIDDEN_ROWS - 2;
		}
	}

	class NazotetGame {
		constructor() {
			this.board = [];
			this.tetromino = null;
			this.nextBag = [];
			this.heldTetromino = null;
			this.gameOver = false;
			this.isCleared = false;

			this.gameStats = {};
			this.gameRules = {};

			this.currentCombo = -1;

			this.history = [];
			this.historyIndex = -1;

			this.lastMoveWasRotation = false;
			this.lastRotationKickIndex = -1;
		}

		_createBoard() {
			return Array.from({ length: GameConstants.ROWS }, () => Array(GameConstants.COLS).fill(0));
		}

		reset(config) {
			this.board = this._parseFumen(config.fumenString) || this._createBoard();

			this.gameOver = false;
			this.isCleared = false;
			this.lastMoveWasRotation = false;
			this.lastRotationKickIndex = -1;
			this.currentCombo = -1;

			this.gameStats = {};
			this.gameRules = {};
			GameConstants.RULE_KEYS.forEach(key => {
				this.gameStats[key] = 0;
				this.gameRules[key] = 0;
			});

			this._applyRules(config.activeRules);
			this.gameRules.holdEnabled = !config.isHoldDisabled;

			this.nextBag = this._parseQueue(config.nextQueue);

			const holdId = this._parseHold(config.holdPiece, config.isHoldDisabled);
			if (holdId) {
				this.heldTetromino = new Tetromino(holdId);
			} else {
				this.heldTetromino = null;
			}

			this.tetromino = this._getNextTetromino();

			if (!this.tetromino && this.nextBag.length === 0) {
				return;
			}

			this.history = [];
			this.historyIndex = -1;
			this.saveState();
		}

		_applyRules(activeRules) {
			const labelToKey = {
				'TSS': 'tss', 'TSD': 'tsd', 'TST': 'tst',
				'Mini TSS': 'miniTss', 'Mini TSD': 'miniTsd',
				'Single': 'single', 'Double': 'double', 'Triple': 'triple', 'Quad': 'quad',
				'Perfect Clear': 'perfectClear', 'Combo': 'combo'
			};

			if (Array.isArray(activeRules)) {
				activeRules.forEach(([label, val]) => {
					const key = labelToKey[label];
					if (key) {
						const numVal = parseInt(val, 10);
						if (!isNaN(numVal) && numVal > 0) {
							this.gameRules[key] = numVal;
						}
					}
				});
			}
		}

		_parseQueue(nextString) {
			const nextBag = [];
			if (nextString) {
				const chars = nextString.toUpperCase().split('');
				chars.forEach(c => {
					const id = GameConstants.CHAR_TO_ID[c];
					if (id) nextBag.push(id);
				});
			}
			return nextBag;
		}

		_parseHold(holdString, isHoldDisabled) {
			if (holdString && !isHoldDisabled) {
				return GameConstants.CHAR_TO_ID[holdString.toUpperCase()] || null;
			}
			return null;
		}

		_parseFumen(fumenString) {
			if (fumenString && typeof Tetfu !== 'undefined' && Tetfu.Fumen) {
				try {
					const decodedFumen = Tetfu.Fumen.decode(fumenString);
					if (decodedFumen && decodedFumen.getPages().length > 0) {
						const firstPage = decodedFumen.getPages()[0];
						return this._convertFumenFieldToBoard(firstPage.field);
					}
				} catch (e) {
					console.warn('Fumen decode failed.', e);
				}
			}
			return null;
		}

		_convertFumenFieldToBoard(fumenField) {
			const totalRows = GameConstants.ROWS;
			const board = Array.from({ length: totalRows }, () => Array(GameConstants.COLS).fill(0));
			const validLength = 230;

			for (let i = 0; i < validLength; i++) {
				const colorId = fumenField[i];
				if (colorId !== 0) {
					const x = i % 10;
					const y = Math.floor(i / 10);
					if (y < totalRows) {
						board[y][x] = colorId;
					}
				}
			}
			return board;
		}

		_getNextTetromino() {
			return this.nextBag.length === 0 ? null : new Tetromino(this.nextBag.shift());
		}

		isValid(piece) {
			for (let y = 0; y < piece.shape.length; y++) {
				for (let x = 0; x < piece.shape[y].length; x++) {
					if (piece.shape[y][x]) {
						const newX = piece.x + x;
						const newY = piece.y + y;
						if (
							newX < 0 ||
								newX >= GameConstants.COLS ||
								newY >= GameConstants.ROWS ||
								(newY >= 0 && this.board[newY] && this.board[newY][newX] !== GameConstants.MINO_IDS.EMPTY)
						) return false;
					}
				}
			}
			return true;
		}

		move(dx, dy) {
			if (!this.tetromino || this.gameOver) return;
			this.tetromino.x += dx; this.tetromino.y += dy;
			if (!this.isValid(this.tetromino)) {
				this.tetromino.x -= dx; this.tetromino.y -= dy;
			} else {
				this.lastMoveWasRotation = false;
				this.lastRotationKickIndex = -1;
			}
		}

		rotate(clockwise = true) {
			if (!this.tetromino || this.gameOver) return;
			const piece = this.tetromino, originalShape = piece.shape, N = originalShape.length;
			const newShape = Array.from({ length: N }, () => Array(N).fill(0));

			for (let y = 0; y < N; y++) {
				for (let x = 0; x < N; x++) {
					if (clockwise) newShape[x][N - 1 - y] = originalShape[y][x];
						else newShape[N - 1 - x][y] = originalShape[y][x];
				}
			}
			piece.shape = newShape;

			const from = piece.rotation, to = (piece.rotation + (clockwise ? 1 : 3)) % 4;
			const kickData = piece.type === GameConstants.MINO_IDS.I ? GameConstants.WALL_KICK_DATA_I : GameConstants.WALL_KICK_DATA_JLSTZ;
			const tests = [[0, 0], ...kickData[clockwise ? from * 2 : to * 2 + 1]];

			for (let i = 0; i < tests.length; i++) {
				const [dx, dy] = tests[i];
				piece.x += dx; piece.y -= dy;
				if (this.isValid(piece)) {
					piece.rotation = to;
					this.lastMoveWasRotation = true;
					this.lastRotationKickIndex = i;
					return;
				}
				piece.x -= dx;
				piece.y += dy;
			}
			piece.shape = originalShape;
		}

		hardDrop() {
			if (!this.tetromino || this.gameOver) return;
			while (this.isValid(this.tetromino)) this.tetromino.y++;
			this.tetromino.y--;
			this._lockTetromino();
		}

		hold() {
			if (!this.tetromino || this.gameOver || !this.gameRules.holdEnabled || (!this.heldTetromino && this.nextBag.length === 0)) return;
			const tempType = this.heldTetromino ? this.heldTetromino.type : null;
			this.heldTetromino = new Tetromino(this.tetromino.type);
			this.tetromino = tempType ? new Tetromino(tempType) : this._getNextTetromino();

			if (!this.tetromino) {
				this.tetromino = null;
			}

			this.lastMoveWasRotation = false;
			this.lastRotationKickIndex = -1;
			this.saveState();
		}

		_lockTetromino() {
			let tSpinType = 'none';
			if (this.tetromino.type === GameConstants.MINO_IDS.T && this.lastMoveWasRotation) {
				const cx = this.tetromino.x + 1, cy = this.tetromino.y + 1;
				const corners = [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]];
				let filledCorners = 0;
				const cornerStates = corners.map(([x, y]) => {
					const boardY = y;
					if (
						x < 0 || x >= GameConstants.COLS ||
							boardY < 0 || boardY >= GameConstants.ROWS ||
							(this.board[boardY] && this.board[boardY][x] !== GameConstants.MINO_IDS.EMPTY)
					) {
						filledCorners++;
						return true;
					}
					return false;
				});
				if (filledCorners >= 3) {
					if (this.lastRotationKickIndex === 4) tSpinType = 'tSpin';
						else {
							const [A, B, C, D] = cornerStates, r = this.tetromino.rotation;
							tSpinType = ((r === 0 && A && B) || (r === 1 && B && D) || (r === 2 && C && D) || (r === 3 && A && C)) ? 'tSpin' : 'miniTSpin';
						}
				}
			}

			this.tetromino.shape.forEach((row, y) => row.forEach((value, x) => {
				if (value) {
					const boardY = this.tetromino.y + y;
					if (boardY >= 0 && boardY < GameConstants.ROWS) {
						this.board[boardY][this.tetromino.x + x] = this.tetromino.type;
					}
				}
			}));

			const linesCleared = this._clearLines();

			if (tSpinType === 'tSpin') {
				if (linesCleared === 1) this.gameStats.tss++;
					else if (linesCleared === 2) this.gameStats.tsd++;
						else if (linesCleared === 3) this.gameStats.tst++;
			} else if (tSpinType === 'miniTSpin') {
				if (linesCleared === 1) this.gameStats.miniTss++;
					else if (linesCleared === 2) this.gameStats.miniTsd++;
			}

			if (this.checkWinConditions()) {
				this.isCleared = true;
				this.gameOver = true;
			}

			this.tetromino = this._getNextTetromino();

			if (!this.tetromino && this.heldTetromino) {
				this.tetromino = new Tetromino(this.heldTetromino.type);
				this.heldTetromino = null;
			}

			this.lastMoveWasRotation = false;
			this.lastRotationKickIndex = -1;
			this.saveState();
		}

		_clearLines() {
			let linesCleared = 0;
			this.board = this.board.filter(row => {
				if (row.every(cell => cell !== GameConstants.MINO_IDS.EMPTY)) {
					linesCleared++;
					return false;
				}
				return true;
			});

			if (linesCleared > 0) {
				this.currentCombo++;
				if (this.currentCombo > 0) {
					this.gameStats.combo = Math.max(this.gameStats.combo, this.currentCombo);
				}
			} else {
				this.currentCombo = -1;
			}

			if (linesCleared === 1) this.gameStats.single++;
				else if (linesCleared === 2) this.gameStats.double++;
					else if (linesCleared === 3) this.gameStats.triple++;
						else if (linesCleared === 4) this.gameStats.quad++;

			for (let i = 0; i < linesCleared; i++) this.board.unshift(Array(GameConstants.COLS).fill(GameConstants.MINO_IDS.EMPTY));

			if (linesCleared > 0 && this.board.every(row => row.every(cell => cell === GameConstants.MINO_IDS.EMPTY))) this.gameStats.perfectClear++;

			return linesCleared;
		}

		checkWinConditions() {
			const hasRules = GameConstants.RULE_KEYS.some(key => this.gameRules[key] > 0);
			if (!hasRules) return false;
			return GameConstants.RULE_KEYS.every(key => {
				const goal = this.gameRules[key];
				const current = this.gameStats[key];
				return goal === 0 || current >= goal;
			});
		}

		saveState() {
			if (this.gameOver) return;
			this.history = this.history.slice(0, this.historyIndex + 1);
			this.history.push({
				board: JSON.parse(JSON.stringify(this.board)),
				tetromino: this.tetromino ? JSON.parse(JSON.stringify(this.tetromino)) : null,
				nextBag: [...this.nextBag],
				heldTetromino: this.heldTetromino ? JSON.parse(JSON.stringify(this.heldTetromino)) : null,
				gameStats: { ...this.gameStats },
				currentCombo: this.currentCombo
			});
			this.historyIndex++;
		}

		restoreState(state) {
			this.board = JSON.parse(JSON.stringify(state.board));
			this.tetromino = state.tetromino ? Object.assign(new Tetromino(state.tetromino.type), state.tetromino) : null;
			this.nextBag = [...state.nextBag];
			this.heldTetromino = state.heldTetromino ? Object.assign(new Tetromino(state.heldTetromino.type), state.heldTetromino) : null;
			this.gameStats = { ...state.gameStats };
			this.currentCombo = state.currentCombo;
			this.gameOver = false;
			this.isCleared = false;
		}

		undo() {
			if (this.historyIndex > 0) this.restoreState(this.history[--this.historyIndex]);
		}

		redo() {
			if (this.historyIndex < this.history.length - 1) this.restoreState(this.history[++this.historyIndex]);
		}

		getState() {
			return { ...this, isValid: (piece) => this.isValid(piece) };
		}
	}

	class GameRenderer {
		constructor(dom) {
			this.dom = {
				canvas: dom.canvas,
				nextCanvas: dom.nextCanvas,
				holdCanvas: dom.holdCanvas,
				gameContainer: dom.gameContainer
			};

			this.ctx = this.dom.canvas.getContext('2d');
			this.nextCtx = this.dom.nextCanvas.getContext('2d');
			this.holdCtx = this.dom.holdCanvas.getContext('2d');

			[this.ctx, this.nextCtx, this.holdCtx].forEach(ctx => {
				ctx.imageSmoothingEnabled = false;
			});

			this.blockSize = 20;
			this.sideBlockSize = 12;
		}

		init() {
			this.resize();
		}

		resize() {
			// ウィンドウサイズを基準に計算
			const w = window.innerWidth - 65;
			const h = window.innerHeight - 200;

			const totalRows = GameConstants.ROWS; // 23
			const totalCols = GameConstants.COLS + 8; // 18 (Main 10 + Side 4*2)

			this.blockSize = Math.floor(Math.min(w / totalCols, h / totalRows));
			// this.blockSize = Math.max(15, this.blockSize);

			// Hold/Next用のブロックサイズ (小さくする)
			this.sideBlockSize = Math.floor(this.blockSize * 0.7);

			const setCanvasSize = (canvas, ctx, logicalWidth, logicalHeight, scale, applyTransform = true) => {
				const dpr = window.devicePixelRatio || 1;
				const displayWidth = logicalWidth * scale;
				const displayHeight = logicalHeight * scale;

				canvas.width = Math.round(displayWidth * dpr);
				canvas.height = Math.round(displayHeight * dpr);
				ctx.imageSmoothingEnabled = false;

				canvas.style.width = `${displayWidth}px`;
				canvas.style.height = `${displayHeight}px`;

				if (applyTransform) {
					ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
				}
			};

			// メイン盤面
			setCanvasSize(this.dom.canvas, this.ctx, GameConstants.COLS, GameConstants.ROWS, this.blockSize, true);
			// Hold: 4ブロック幅 x 4ブロック高
			setCanvasSize(this.dom.holdCanvas, this.holdCtx, 4, 4, this.sideBlockSize, false);
			setCanvasSize(this.dom.nextCanvas, this.nextCtx, 4, 21, this.sideBlockSize, false);
		}

		render(state) {
			this._drawBoard(state.board, state.tetromino, state.isValid);
			this._drawNext(state.nextBag);
			this._drawHold(state.heldTetromino);
		}

		_drawBlock(context, x, y, color, scale) {
			context.fillStyle = color;
			context.fillRect(x, y, 1, 1);

			const dpr = window.devicePixelRatio || 1;
			context.strokeStyle = '#000000';
			context.lineWidth = 1 / (scale * dpr);
			const inset = context.lineWidth / 2;
			context.strokeRect(x + inset, y + inset, 1 - context.lineWidth, 1 - context.lineWidth);
		}

		_drawPiece(context, piece, color, scale) {
			piece.shape.forEach((row, y) => row.forEach((value, x) => {
				if (value) {
					const drawY = piece.y + y;
					if (drawY >= 0) {
						if (color === GameConstants.COLORS.GHOST) {
							context.fillStyle = color;
							context.fillRect(piece.x + x, drawY, 1, 1);
						} else {
							this._drawBlock(context, piece.x + x, drawY, color, scale);
						}
					}
				}
			}));
		}

		_drawBoard(board, tetromino, isValidFn) {
			this.ctx.save();
			this.ctx.setTransform(1, 0, 0, 1, 0, 0);
			this.ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);
			this.ctx.restore();

			// 背景（プレイエリア全体）
			this.ctx.fillStyle = '#000000';
			this.ctx.fillRect(0, 0, GameConstants.COLS, GameConstants.ROWS);

			// Hidden Rows (上部3行) の背景色設定
			this.ctx.fillStyle = '#1f2937'; // 薄い紺色〜灰色
			this.ctx.fillRect(0, 0, GameConstants.COLS, GameConstants.HIDDEN_ROWS);

			// 盤面のブロック描画 (Hidden Rowsより下の行のみ描画)
			// ただし、Hidden Rowsにもブロックがある場合は描画されるべきなので、
			// 背景色の上書きとして全ブロックを描画する
			board.forEach((row, y) => row.forEach((value, x) => {
				if (value) {
					this._drawBlock(this.ctx, x, y, GameConstants.COLORS[value], this.blockSize);
				}
			}));

			// テトロミノ描画
			if (tetromino && isValidFn) {
				const ghost = JSON.parse(JSON.stringify(tetromino));
				while (isValidFn(ghost)) ghost.y++;
				ghost.y--;
				this._drawPiece(this.ctx, ghost, GameConstants.COLORS.GHOST, this.blockSize);
				this._drawPiece(this.ctx, tetromino, GameConstants.COLORS[tetromino.type], this.blockSize);
			}
		}

		_drawSidePanel(context, canvas, pieceTypes, isHold) {
			const dpr = window.devicePixelRatio || 1;
			// サイドパネル用のブロックサイズを使用
			const blockPixelSize = this.sideBlockSize * dpr;
			const lineWidth = 1;

			context.clearRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = '#000000';
			context.fillRect(0, 0, canvas.width, canvas.height);

			if (!pieceTypes || pieceTypes.length === 0) {
				return;
			}

			pieceTypes.forEach((type, i) => {
				const shape = GameConstants.SHAPES[type];
				const color = GameConstants.COLORS[type];
				const w = shape[0].length;
				const h = shape.length;

				shape.forEach((row, y) => {
					row.forEach((value, x) => {
						if (value) {
							const piecePixelWidth = w * blockPixelSize;
							const piecePixelHeight = h * blockPixelSize;

							const offsetX = Math.floor((canvas.width - piecePixelWidth) / 2);

							let offsetY;
							if (isHold) {
								offsetY = Math.floor((canvas.height - piecePixelHeight) / 2);
							} else {
								// Nextは縦に並べる
								const slotPixelHeight = 3 * this.sideBlockSize * dpr;
								const slotTop = i * slotPixelHeight + (5 * dpr); // 少しマージン
								offsetY = slotTop + Math.floor((slotPixelHeight - piecePixelHeight) / 2);
							}

							const pX = offsetX + x * blockPixelSize;
							const pY = offsetY + y * blockPixelSize;

							context.fillStyle = color;
							context.fillRect(pX, pY, blockPixelSize, blockPixelSize);

							context.strokeStyle = '#000000';
							context.lineWidth = lineWidth;
							const inset = lineWidth / 2;
							context.strokeRect(pX + inset, pY + inset, blockPixelSize - lineWidth, blockPixelSize - lineWidth);
						}
					});
				});
			});
		}

		_drawNext(nextBag) {
			// Next表示数を7に設定
			const visibleCount = 7;
			const visibleNext = nextBag ? nextBag.slice(0, visibleCount) : [];
			this._drawSidePanel(this.nextCtx, this.dom.nextCanvas, visibleNext, false);

			// 8個目以降のキューテキストを外部DOMに設定
			const textElement = document.getElementById('next-queue-text');
			if (textElement) {
				if (nextBag && nextBag.length > visibleCount) {
					const remaining = nextBag.slice(visibleCount).map(id => GameConstants.ID_TO_CHAR[id]).join('');
					textElement.textContent = remaining;
				} else {
					textElement.textContent = '';
				}
			}
		}

		_drawHold(held) {
			this._drawSidePanel(this.holdCtx, this.dom.holdCanvas, held ? [held.type] : [], true);
		}
	}

	if (typeof window !== 'undefined') {
		window.NazotetGame = NazotetGame;
		window.GameConstants = GameConstants;
		window.GameRenderer = GameRenderer;
	}

})();

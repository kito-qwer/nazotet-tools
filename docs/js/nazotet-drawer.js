class NazotetDrawer {
	constructor(containerId) {
		this.vis = document.getElementById(containerId);
		this.COLS = 10;
		this.ROWS = 23;

		if (typeof Tetfu !== 'undefined') {
			this.COLS = Tetfu.FIELD_WIDTH;
			this.ROWS = Tetfu.FIELD_HEIGHT - 1;
		}

		this.CELL_SIZE = 20;
		this.FONT_FAMILY_MONO = 'ui-monospace, "SF Mono", "Menlo", "Consolas", "Liberation Mono", "Courier New", monospace';
		this.LABEL_FONT_FAMILY = this.FONT_FAMILY_MONO;
		this.MESSAGE_FONT_FAMILY = this.FONT_FAMILY_MONO;
		this.AUTHOR_RULES_FONT_FAMILY = this.FONT_FAMILY_MONO;
		this.CREDIT_FONT_FAMILY = this.FONT_FAMILY_MONO;

		this.blockColors = {
			0: 'black', 1: 'aqua', 2: 'orange', 3: 'yellow',
			4: 'red', 5: 'fuchsia', 6: 'blue', 7: 'lime', 9: 'silver'
		};
		this.blockShapes = {
			1: [[1, 1, 1, 1]],
			2: [[0, 0, 1], [1, 1, 1]],
			3: [[1, 1], [1, 1]],
			4: [[1, 1, 0], [0, 1, 1]],
			5: [[0, 1, 0], [1, 1, 1]],
			6: [[1, 0, 0], [1, 1, 1]],
			7: [[0, 1, 1], [1, 1, 0]]
		};
		this.pieceTypeMap = { 
			'I': 1, 'L': 2, 'O': 3, 'Z': 4, 'T': 5, 'J': 6, 'S': 7, 'X': -1
		};
	}

	calculateDynamicFontSize(text, initialSize, maxWidth, fontFamily) {
		if (typeof document === 'undefined') return initialSize;
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		ctx.font = `${initialSize}px ${fontFamily}`;
		const textMetrics = ctx.measureText(text);
		if (textMetrics.width > maxWidth) {
			return initialSize * (maxWidth / textMetrics.width);
		}
		return initialSize;
	}

	_createSvgElement(tag, attrs = {}) {
		const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
		for (const [key, val] of Object.entries(attrs)) {
			el.setAttribute(key, val);
		}
		return el;
	}

	drawPieceSvg(pieceId, areaX, areaY, pieceAreaWidthCells, pieceAreaHeightCells) {
		if (!pieceId || pieceId < 1) return null;
		const group = this._createSvgElement('g');
		const shape = this.blockShapes[pieceId];
		const color = this.blockColors[pieceId];
		const pieceWidth = shape[0].length;
		const pieceHeight = shape.length;
		const offsetX = areaX + (this.CELL_SIZE * pieceAreaWidthCells - pieceWidth * this.CELL_SIZE) / 2;
		const offsetY = areaY + (this.CELL_SIZE * pieceAreaHeightCells - pieceHeight * this.CELL_SIZE) / 2;

		for (let y = 0; y < pieceHeight; y++) {
			for (let x = 0; x < pieceWidth; x++) {
				if (shape[y][x]) {
					const rect = this._createSvgElement('rect', {
						x: offsetX + x * this.CELL_SIZE,
						y: offsetY + y * this.CELL_SIZE,
						width: this.CELL_SIZE,
						height: this.CELL_SIZE,
						fill: color
					});
					group.appendChild(rect);
				}
			}
		}
		return group;
	}

	draw(config) {
		// Tetfuが読み込まれていない場合は処理を行わない
		if (typeof Tetfu === 'undefined') return;

		let field = Array(this.COLS * this.ROWS).fill(0);
		let nextQueue = config.nextQueue;
		let holdPiece = config.holdPiece;

		if (config.fumenString) {
			const decodedFumen = Tetfu.Fumen.decode(config.fumenString);
			if (decodedFumen && decodedFumen.getPages().length > 0) {
				const firstPage = decodedFumen.getPages()[0];
				field = firstPage.field;
			}
		}

		// 描画パラメータ計算
		const width = this.vis.clientWidth;
		const height = this.vis.clientHeight;

		const CANVAS_PAD_LEFT_IN_CELLS = 6;
		const FIELD_BUF_ZONE_HEIGHT = 3;
		const PIECE_AREA_WIDTH_IN_CELLS = 4;
		const PIECE_AREA_HEIGHT_IN_CELLS = 3;
		const PIECE_AREA_MARGIN_IN_CELLS = 1;
		const AREA_LABEL_OFFSET_Y = 5;
		const AREA_BOX_PAD_X = 5;
		const NEXT_PIECES_TO_DRAW_COUNT = 6;
		const NEXT_PIECE_VERT_GAP_IN_CELLS = 0.5;
		const NEXT_TEXT_CHARS_PAR_LINE = 8;
		const NEXT_TEXT_LINE_HEIGHT = 20;

		const startX = this.CELL_SIZE * CANVAS_PAD_LEFT_IN_CELLS;
		const startY = (height - this.ROWS * this.CELL_SIZE) / 2;
		const endX = startX + this.COLS * this.CELL_SIZE;
		const endY = startY + this.ROWS * this.CELL_SIZE;
		const areaHeight = this.CELL_SIZE * PIECE_AREA_HEIGHT_IN_CELLS;
		const areaWidth = this.CELL_SIZE * PIECE_AREA_WIDTH_IN_CELLS;
		const holdAreaX = startX - (PIECE_AREA_WIDTH_IN_CELLS + PIECE_AREA_MARGIN_IN_CELLS) * this.CELL_SIZE;
		const holdAreaY = startY;
		const nextAreaX = endX + PIECE_AREA_MARGIN_IN_CELLS * this.CELL_SIZE;
		const nextAreaY = startY;

		const svgRoot = this._createSvgElement('svg', {
			width: width,
			height: height,
			xmlns: 'http://www.w3.org/2000/svg',
			style: 'background-color: #ffffff'
		});

		svgRoot.appendChild(this._createSvgElement('rect',{
			x: 0,
			y: 0,
			width: width,
			height: height,
			fill: '#ffffff'
		}));

		// フィールドブロック
		for (let y = 0; y < this.ROWS; y++) {
			for (let x = 0; x < this.COLS; x++) {
				const blockValue = field[y * this.COLS + x];
				let color = this.blockColors[blockValue] || 'dimgray';
				if (y < FIELD_BUF_ZONE_HEIGHT && blockValue == 0) {
					color = 'dimgray';
				}
				svgRoot.appendChild(this._createSvgElement('rect', {
					x: startX + x * this.CELL_SIZE,
					y: startY + y * this.CELL_SIZE,
					width: this.CELL_SIZE,
					height: this.CELL_SIZE,
					fill: color,
				}));
			}
		}

		// グリッド線
		let pathData = '';
		for (let x = 0; x <= this.COLS; x++) { 
			const currentX = startX + x * this.CELL_SIZE;
			pathData += `M${currentX},${startY} L${currentX},${endY} `; 
		}
		for (let y = 0; y <= this.ROWS; y++) { 
			const currentY = startY + y * this.CELL_SIZE;
			pathData += `M${startX},${currentY} L${endX},${currentY} `;
		}

		const gridPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		gridPath.setAttribute('d', pathData);
		gridPath.setAttribute('stroke', 'dimgray');
		gridPath.setAttribute('stroke-width', '1');
		gridPath.setAttribute('fill', 'none');

		svgRoot.appendChild(gridPath);

		// HOLD描画

		const holdLabel = this._createSvgElement('text', {
			x: holdAreaX,
			y: holdAreaY - AREA_LABEL_OFFSET_Y,
			'font-family': this.LABEL_FONT_FAMILY,
			'font-size': '16px',
			fill: 'black',
			'text-anchor': 'start',
			'dominant-baseline': 'alphabetic'
		});
		holdLabel.textContent = 'HOLD';
		svgRoot.appendChild(holdLabel);

		svgRoot.appendChild(this._createSvgElement('rect', {
			x: holdAreaX - AREA_BOX_PAD_X,
			y: holdAreaY,
			width: areaWidth + AREA_BOX_PAD_X * 2,
			height: areaHeight,
			fill: 'silver'
		}));

		let holdMessage = 'Available';
		if (holdPiece && !config.isHoldDisabled) {
			const pieceId = this.pieceTypeMap[holdPiece];
			holdMessage = '';
			const pieceGroup = this.drawPieceSvg(pieceId, holdAreaX, holdAreaY, PIECE_AREA_WIDTH_IN_CELLS, PIECE_AREA_HEIGHT_IN_CELLS);
			if (pieceGroup) {
				svgRoot.appendChild(pieceGroup);
			}
		} else if (config.isHoldDisabled) {
			holdMessage = 'Unavailable';
		}
		if (holdMessage) {
			const textX = holdAreaX + areaWidth / 2;
			const textY = holdAreaY + areaHeight / 2;
			const holdMessageEl = this._createSvgElement('text', {
				x: textX,
				y: textY,
				'font-family': this.MESSAGE_FONT_FAMILY,
				'font-size': '13px',
				fill: 'black',
				'text-anchor': 'middle',
				'dominant-baseline': 'middle'
			});
			holdMessageEl.textContent = holdMessage;
			svgRoot.appendChild(holdMessageEl);
		}

		// NEXT描画
		const nextLabel = this._createSvgElement('text', {
			x: nextAreaX,
			y: nextAreaY - AREA_LABEL_OFFSET_Y,
			'font-family': this.LABEL_FONT_FAMILY,
			'font-size': '16px',
			fill: 'black',
			'text-anchor': 'start',
			'dominant-baseline': 'alphabetic'
		});
		nextLabel.textContent = 'NEXT';
		svgRoot.appendChild(nextLabel);

		if (nextQueue) {
			const pieceToDraw = Math.min(nextQueue.length, NEXT_PIECES_TO_DRAW_COUNT);
			for (let i = 0; i < pieceToDraw; i++) {
				const currentY = nextAreaY + i * (areaHeight + this.CELL_SIZE * NEXT_PIECE_VERT_GAP_IN_CELLS);
				svgRoot.appendChild(this._createSvgElement('rect', {
					x: nextAreaX - AREA_BOX_PAD_X,
					y: currentY,
					width: areaWidth + AREA_BOX_PAD_X * 2,
					height: areaHeight,
					fill: 'silver'
				}));
				const pieceId = this.pieceTypeMap[nextQueue[i]];
				const pieceGroup = this.drawPieceSvg(pieceId, nextAreaX, currentY, PIECE_AREA_WIDTH_IN_CELLS, PIECE_AREA_HEIGHT_IN_CELLS);
				if (pieceGroup) {
					svgRoot.appendChild(pieceGroup);
				}
			}
			const remainingQueue = nextQueue.slice(NEXT_PIECES_TO_DRAW_COUNT);
			if (remainingQueue) {
				let textY = nextAreaY + NEXT_PIECES_TO_DRAW_COUNT * (areaHeight + this.CELL_SIZE * NEXT_PIECE_VERT_GAP_IN_CELLS) + 12;
				for (let i = 0; i < remainingQueue.length; i += NEXT_TEXT_CHARS_PAR_LINE) {
					const line = remainingQueue.substring(i, i + NEXT_TEXT_CHARS_PAR_LINE);
					const nextGt = this._createSvgElement('text', {
						x: nextAreaX - 4,
						y: textY,
						'font-family': this.LABEL_FONT_FAMILY,
						'font-size': '16px',
						fill: 'black',
					});
					nextGt.textContent = '>';
					svgRoot.appendChild(nextGt);

					const lineEl = this._createSvgElement('text', {
						x: nextAreaX + 10,
						y: textY,
						'font-family': this.LABEL_FONT_FAMILY,
						'font-size': '16px',
						fill: 'black',
					});
					lineEl.textContent = line;
					svgRoot.appendChild(lineEl);

					textY += NEXT_TEXT_LINE_HEIGHT;
				}
			}
		}

		// Author & Rules テキスト描画
	{
			let currentY = holdAreaY + areaHeight + 20;
			const lineHeight = 20;
			const indent = 5;
			if (config.author) {
				const authorLabel = this._createSvgElement('text', {
					x: holdAreaX,
					y: currentY,
					'font-family': this.AUTHOR_RULES_FONT_FAMILY,
					'font-size': '14px',
					fill: 'black'
				});
				authorLabel.textContent = 'Author';
				svgRoot.appendChild(authorLabel);
				currentY += lineHeight;
				const initialFontSize = 14;
				const maxWidth = areaWidth - indent;
				const authorFontSize = this.calculateDynamicFontSize(config.author, initialFontSize, maxWidth, this.AUTHOR_RULES_FONT_FAMILY);
				const authorNameEl = this._createSvgElement('text', {
					x: holdAreaX + indent,
					y: currentY,
					'font-family': this.AUTHOR_RULES_FONT_FAMILY,
					'font-size': `${authorFontSize.toFixed(2)}px`,
					fill: 'black'
				});
				authorNameEl.textContent = config.author;
				svgRoot.appendChild(authorNameEl);
				currentY += lineHeight;
			}
			if (config.activeRules.length > 0 || config.otherRules.length > 0) {
				const ruleLabel = this._createSvgElement('text', {
					x: holdAreaX,
					y: currentY,
					'font-family': this.AUTHOR_RULES_FONT_FAMILY,
					'font-size': '14px',
					fill: 'black'
				});
				ruleLabel.textContent = 'Rules';
				svgRoot.appendChild(ruleLabel);
				currentY += lineHeight;
				config.activeRules.forEach(([ruleName, count]) => {
					const ruleNameEl = this._createSvgElement('text', {
						x: holdAreaX + indent,
						y: currentY,
						'font-family': this.AUTHOR_RULES_FONT_FAMILY,
						'font-size': '14px',
						fill: 'black'
					});
					ruleNameEl.textContent = `${ruleName}: ${count}`;
					svgRoot.appendChild(ruleNameEl);
					currentY += lineHeight;
				});
				config.otherRules.forEach(rule => {
					const otherRuleEl = this._createSvgElement('text', {
						x: holdAreaX + indent,
						y: currentY,
						'font-family': this.AUTHOR_RULES_FONT_FAMILY,
						'font-size': '14px',
						fill: 'black'
					});
					otherRuleEl.textContent = `${rule}`;
					svgRoot.appendChild(otherRuleEl);
					currentY += lineHeight;
				});
			}
		}

		// クレジット
		const padding = 5;
		const attribution = 'This image was generated by Nazotet Visualizer.';
		const attributionEl = this._createSvgElement('text', {
			x: width - padding,
			y: height - padding,
			'font-family': this.CREDIT_FONT_FAMILY,
			'font-size': '10px',
			fill: 'gray',
			'text-anchor': 'end',
			'dominant-baseline': 'alphabetic'
		});
		attributionEl.textContent = attribution;
		svgRoot.appendChild(attributionEl);

		this.vis.innerHTML = '';
		this.vis.appendChild(svgRoot);

		return;
	}

	getSvgString() {
		return this.vis.innerHTML;
	}

	getSize() {
		return { width: this.vis.clientWidth, height: this.vis.clientHeight };
	}
}

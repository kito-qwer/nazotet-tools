class NazotetForm {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		if (!this.container) return;

		let randomid;
		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
			 randomid = crypto.randomUUID();
		} else {
			// 代替のランダムID生成
			randomid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				const r = Math.random() * 16 | 0;
				const v = c === 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		}
		// ID衝突防止用のプレフィックス
		this.idPrefix = `nazotet-${randomid}-`;

		this.render();
		this.form = this.container.querySelector('form');
		this.setupEventListeners();
	}

	render() {
		const id = (suffix) => `${this.idPrefix}${suffix}`;

		// ボタンを含まない、入力フィールドのみのHTML
		this.container.innerHTML = `
<form class="nazotet-form" onsubmit="return false;">
	<div class="form-group">
		<label for="${id('fumen')}">Fumen</label>
		<input type="text" id="${id('fumen')}"
			name="fumen_string" placeholder="v115@...">
	</div>
	<div class="form-group">
		<label for="${id('next')}">Next</label>
		<input type="text" id="${id('next')}"
			name="next_string" class="uppercase-input"
			placeholder="ISZT..." pattern="[ILOZTJSiloztjs]*">
	</div>
	<div class="form-group">
		<label for="${id('toggle-hold')}" class="label-with-checkbox">
			Hold
			<input type="checkbox" id="${id('toggle-hold')}"
				data-action="toggle-hold">
		</label>
		<input type="text" id="${id('hold')}" name="hold_string"
			disabled class="uppercase-input" placeholder="Hold"
			maxlength="1" pattern="[ILOZTJSiloztjs]">
	</div>
	<div class="form-group">
		<label for="${id('author')}">Author</label>
		<input type="text" id="${id('author')}"
			name="author_string" placeholder="Your Name">
	</div>
	<fieldset class="rules-container">
		<legend>Rules</legend>
		<fieldset class="rule-group">
			<legend>T-spin</legend>
			<div class="form-group">
				<label for="${id('tss')}">TSS</label>
				<input type="number" id="${id('tss')}"
					name="tss_count" placeholder="0" min="0">

			</div>
			<div class="form-group">
				<label for="${id('tsd')}">TSD</label>
				<input type="number" id="${id('tsd')}"
					name="tsd_count" placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('tst')}">TST</label>
				<input type="number" id="${id('tst')}" name="tst_count"
					placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('tssm')}">Mini TSS</label>
				<input type="number" id="${id('tssm')}"
					name="tssm_count" placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('tsdm')}">Mini TSD</label>
				<input type="number" id="${id('tsdm')}"
					name="tsdm_count" placeholder="0" min="0">
			</div>
		</fieldset>
		<fieldset class="rule-group">
			<legend>Line Clear</legend>
			<div class="form-group">
				<label for="${id('single')}">Single</label>
				<input type="number" id="${id('single')}"
					name="single_count" placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('double')}">Double</label>
				<input type="number" id="${id('double')}"
					name="double_count" placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('triple')}">Triple</label>
				<input type="number" id="${id('triple')}"
					name="triple_count" placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('quad')}">Quad</label>
				<input type="number" id="${id('quad')}"
					name="quad_count" placeholder="0" min="0">
			</div>
		</fieldset>
		<fieldset class="full-width rule-group">
			<legend>Other Rules</legend>
			<div class="form-group">
				<label for="${id('pc')}">Perfect Clear</label>
				<input type="number" id="${id('pc')}" name="pc_count"
					placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('combo')}">Combo</label>
				<input type="number" id="${id('combo')}"
					name="combo_count" placeholder="0" min="0">
			</div>
			<div class="form-group">
				<label for="${id('srules')}">Extra Rules</label>
				<textarea id="${id('srules')}" name="srules_string"
					placeholder=
					"Back-to-Back: 1&#10;Shift-Return for newline"
					rows="2"></textarea>
			</div>
		</fieldset>
	</fieldset>
</form>
`;
	}

	setupEventListeners() {
		// Holdのトグル制御
		const toggleHold = this.form.querySelector('[data-action="toggle-hold"]');
		const holdInput = this.form.elements['hold_string'];
		if (toggleHold && holdInput) {
			toggleHold.addEventListener('change', (e) => {
				holdInput.disabled = !e.target.checked;
			});
		}

		// Enterキーでのフォーカス移動
		this.form.addEventListener('keydown', (e) => {
			if (e.key !== 'Enter') return;
			const current = e.target;
			if (current.tagName === 'TEXTAREA' && e.shiftKey) return;

			e.preventDefault();
			const focusableElements = 
			Array.from(this.form.querySelectorAll('input, textarea'))
			.filter(el => !el.disabled && el.offsetParent !== null);

			const index = focusableElements.indexOf(current);
			if (e.shiftKey) {
				if (index > 0) focusableElements[index - 1].focus();
			} else if (index > -1 && index < focusableElements.length - 1) {
				focusableElements[index + 1].focus();
			}
		});
	}

	isValid() {
		return this.form.reportValidity();
	}

	getConfig() {
		const getValue = (name) => {
			const el = this.form.elements[name];
			return el ? el.value : '';
		};
		const getDisabled = (name) => {
			const el = this.form.elements[name];
			return el ? el.disabled : true;
		};

		const activeRules = [];
		const ruleMap = [
			{ name: 'tss_count', label: 'TSS' },
			{ name: 'tsd_count', label: 'TSD' },
			{ name: 'tst_count', label: 'TST' },
			{ name: 'tssm_count', label: 'Mini TSS' },
			{ name: 'tsdm_count', label: 'Mini TSD' },
			{ name: 'single_count', label: 'Single' },
			{ name: 'double_count', label: 'Double' },
			{ name: 'triple_count', label: 'Triple' },
			{ name: 'quad_count', label: 'Quad' },
			{ name: 'pc_count', label: 'Perfect Clear' },
			{ name: 'combo_count', label: 'Combo' }
		];

		ruleMap.forEach(item => {
			const val = getValue(item.name);
			if (val && parseInt(val, 10) > 0) {
				activeRules.push([item.label, val]);
			}
		});

		let otherRules = [];
		const srulesInput = this.form.elements['srules_string'];
		if (!srulesInput.disabled && srulesInput.value) {
			otherRules = srulesInput.value.split(/\r\n|\n|\r/);
		}

		return {
			fumenString: getValue('fumen_string'),
			nextQueue: getValue('next_string').toUpperCase(),
			holdPiece: getValue('hold_string').toUpperCase(),
			isHoldDisabled: getDisabled('hold_string'),
			author: getValue('author_string'),
			activeRules: activeRules,
			otherRules: otherRules
		};
	}

	updateFromFumenAnalysis(next, hold) {
		if (next) this.form.elements['next_string'].value = next;
		if (hold) this.form.elements['hold_string'].value = hold;
	}

	autoComplete() {
		if (typeof Tetfu === 'undefined') return;
		const fumenString = this.form.elements['fumen_string'].value;
		if (!fumenString) return;
		try {
			const decodedFumen = Tetfu.Fumen.decode(fumenString);
			if (!decodedFumen || 
				decodedFumen.getPages().length === 0) return;
			const nextInput = this.form.elements['next_string'];
			const comment = decodedFumen.getPages()[0].flags.comment;
			if (!nextInput.value) {
				const nextMatch = comment
				.match(/^#Q=\[[ILOZTJS]?\]\(([ILOZTJS])\)([ILOZTJS]*)/);
				if (nextMatch) {
					nextInput.value = (nextMatch[1] + nextMatch[2])
						.toUpperCase();
				}
			}
			const holdInput = this.form.elements['hold_string'];
			if (!holdInput.value && !holdInput.disabled) {
				const holdMatch = comment
				.match(/^#Q=\[([ILOZTJS])\]\([ILOZTJS]\)[ILOZTJS]*/);
				if (holdMatch) {
					holdInput.value = holdMatch[1].toUpperCase();
				}
			}
		} catch (e) {
			console.warn('Auto-complete failed: ', e);
		}
	}

	getId(suffix) {
		return `${this.idPrefix}${suffix}`;
	}
}

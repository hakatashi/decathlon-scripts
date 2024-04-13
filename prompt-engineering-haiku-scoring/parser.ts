/* eslint-disable array-plural/array-plural */

const JAPANESE_SYLLABLES = [
	'あ', 'い', 'う', 'え', 'お',
	'か', 'き', 'く', 'け', 'こ',
	'さ', 'し', 'す', 'せ', 'そ',
	'た', 'ち', 'つ', 'て', 'と',
	'な', 'に', 'ぬ', 'ね', 'の',
	'は', 'ひ', 'ふ', 'へ', 'ほ',
	'ま', 'み', 'む', 'め', 'も',
	'や', 'ゆ', 'よ',
	'ら', 'り', 'る', 'れ', 'ろ',
	'わ', 'を', 'ん',
	'が', 'ぎ', 'ぐ', 'げ', 'ご',
	'ざ', 'じ', 'ず', 'ぜ', 'ぞ',
	'だ', 'ぢ', 'づ', 'で', 'ど',
	'ば', 'び', 'ぶ', 'べ', 'ぼ',
	'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ',
	'ゔぁ', 'ゔぃ', 'ゔ', 'ゔぇ', 'ゔぉ',
	'きゃ', 'きゅ', 'きょ',
	'しゃ', 'しゅ', 'しぇ', 'しょ',
	'ちゃ', 'ちゅ', 'ちぇ', 'ちょ',
	'にゃ', 'にゅ', 'にょ',
	'ひゃ', 'ひゅ', 'ひょ',
	'みゃ', 'みゅ', 'みょ',
	'りゃ', 'りゅ', 'りょ',
	'ぎゃ', 'ぎゅ', 'ぎょ',
	'じゃ', 'じゅ', 'じぇ', 'じょ',
	'ぢゃ', 'ぢゅ', 'ぢぇ', 'ぢょ',
	'びゃ', 'びゅ', 'びょ',
	'ぴゃ', 'ぴゅ', 'ぴょ',
	'てぃ', 'とぅ',
	'つぁ', 'つぃ', 'つぇ', 'つぉ',
	'ふぁ', 'ふぃ', 'ふぇ', 'ふぉ',
	'ゐ', 'ゑ',
	'っ', 'ー',
];

const JAPANESE_SYLLABLES_REGEX = new RegExp(`${JAPANESE_SYLLABLES.join('|')}`, 'g');
const JAPANESE_SYLLABLES_REGEX_ALL = new RegExp(`^(${JAPANESE_SYLLABLES.join('|')})+$`);

const TARGET_SYLLABLES = [5, 7, 5];

const UNPARSEABLE = {
	output: {
		haiku: null,
		ruby: null,
	},
	point: 0,
	points: {
		haiku: 0,
		ruby: 0,
		jiamari: 0,
		extraneous: 0,
	},
};

const countSyllables = (text: string) => {
	const syllablesMatch = text.match(JAPANESE_SYLLABLES_REGEX_ALL);
	if (!syllablesMatch) {
		return null;
	}
	const syllables = text.matchAll(JAPANESE_SYLLABLES_REGEX);
	return Array.from(syllables).length;
};

export const parse = (input: string) => {
	let isExtraneous = false;

	const lines = input.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	const csvLines: string[][] = [];
	let haiku: string[] | null = null;
	let ruby: string[] | null = null;
	let haikuPoint = 15;
	let rubyPoint = 15;
	let jiamariPoint = 15;

	for (const line of lines) {
		if (line.startsWith('```')) {
			continue;
		}

		const columns = line.split(/[,，､、]/);
		const commas = line.matchAll(/[,，､、]/g);
		if (columns.some((column) => column.trim().length === 0)) {
			isExtraneous = true;
			continue;
		}
		if (columns.length < 3) {
			isExtraneous = true;
			continue;
		}

		csvLines.push(columns);

		// 俳句
		if (csvLines.length === 1) {
			if (columns.length > 3) {
				haikuPoint -= 5;
			}
			if (Array.from(commas).some(([match]) => match !== ',')) {
				haikuPoint -= 5;
			}
			if (columns.some((column) => column !== column.trim())) {
				haikuPoint -= 5;
			}
			haiku = columns.map((column) => column.trim()).slice(0, 3);
		}

		// 俳句の読み仮名
		if (csvLines.length === 2) {
			const syllables = columns.map((column) => countSyllables(column));
			if (syllables.every((syllable) => syllable !== null)) {
				if (columns.length > 3) {
					rubyPoint -= 5;
				}
				if (Array.from(commas).some(([match]) => match !== ',')) {
					rubyPoint -= 5;
				}
				if (columns.some((column) => column !== column.trim())) {
					rubyPoint -= 5;
				}
				ruby = columns.map((column) => column.trim()).slice(0, 3);

				// 字足らず
				const syllablePairs = syllables.map((syllable, index) => [syllable!, TARGET_SYLLABLES[index]]);
				if (syllablePairs.some(([syllable, target]) => target > syllable)) {
					jiamariPoint -= 10;
				}

				// 字余り
				let jiamaries = 0;
				for (const [syllable, target] of syllablePairs) {
					if (syllable > target) {
						jiamaries += syllable - target;
					}
				}
				if (jiamaries <= 1) {
					jiamariPoint -= 0;
				} else if (jiamaries === 2) {
					jiamariPoint -= 5;
				} else if (jiamaries === 3) {
					jiamariPoint -= 10;
				} else {
					jiamariPoint -= 15;
				}
			}
		}
	}

	if (haiku === null) {
		return UNPARSEABLE;
	}

	if (csvLines.length > 2) {
		isExtraneous = true;
	}

	if (ruby === null) {
		rubyPoint = 0;
		jiamariPoint = 0;
	}

	const points = {
		haiku: Math.max(haikuPoint, 0),
		ruby: Math.max(rubyPoint, 0),
		jiamari: Math.max(jiamariPoint, 0),
		extraneous: isExtraneous ? 0 : 5,
	};

	const point = points.haiku + points.ruby + points.jiamari + points.extraneous;

	return {
		output: {
			haiku,
			ruby,
		},
		point,
		points,
	};
};

if (require.main === module) {
	(async () => {
		const {stripIndent} = await import('common-tags');
		{
			const testInput = stripIndent`
				古池や,蛙飛び込む,水の音
				ふるいけや,かわずとびこむ,みずのおと
			`;
			console.log(parse(testInput));
		}
		{
			const testInput = stripIndent`
				以下は「秋」をテーマとする俳句の一例です。

				林檎の香,秋風に揺れ,収穫の時
				りんごのこう,あきかぜにゆれ,しゅうかくのとき
			`;
			console.log(parse(testInput));
		}
	})();
}

import {Firestore} from '@google-cloud/firestore';
import OpenAI from 'openai';
import 'dotenv/config';
import {parse} from './parser';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const HAIKU_THEME = process.env.HAIKU_THEME ?? '';
if (HAIKU_THEME === '') {
	throw new Error('HAIKU_THEME is not set');
}

const HAIKU_GAME_ID = process.env.HAIKU_GAME_ID ?? '';
if (HAIKU_GAME_ID === '') {
	throw new Error('HAIKU_GAME_ID is not set');
}

const firestore = new Firestore();

(async () => {
	const gameRef = firestore.collection('games').doc(HAIKU_GAME_ID);
	const gameDoc = await gameRef.get();
	if (!gameDoc.exists) {
		throw new Error('Game not found');
	}

	const game = gameDoc.data();
	if (game === undefined) {
		throw new Error('Game not found');
	}

	const submissionsRef = firestore.collection(`games/${HAIKU_GAME_ID}/submissions`);
	const submissions = await submissionsRef.get();

	for (const submission of submissions.docs) {
		const submissionData = submission.data();
		const prompt = submissionData.prompt.replaceAll('【テーマ】', HAIKU_THEME);

		console.log(`=== Processing ${submission.id} ===`);

		const completion = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
			max_tokens: 1024,
		});

		const result = completion.choices?.[0]?.message?.content ?? null;
		if (result === null) {
			throw new Error(`No completion result in response: ${JSON.stringify(completion)}`);
		}
		console.log(result);
		console.log('');

		const parseResult = parse(result);
		console.log('=== Parse Result ===');
		console.log(parseResult);
		console.log('');

		await submission.ref.update({
			result: {
				openaiResponse: completion,
				output: result,
				parsedOutput: parseResult.output,
				point: parseResult.point,
				points: parseResult.points,
			},
		});
	}
})();


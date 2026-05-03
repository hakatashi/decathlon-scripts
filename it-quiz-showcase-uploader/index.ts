import {inspect} from 'node:util';
import {auth} from '@googleapis/forms';
import {sheets_v4 as sheets} from '@googleapis/sheets';
import {applicationDefault, initializeApp} from 'firebase-admin/app';
import {DocumentData, DocumentReference, getFirestore} from 'firebase-admin/firestore';
import 'dotenv/config';

interface ItQuizShowcaseQuizAnswer extends DocumentData {
	userId: string,
	text: string,
	status: 'correct' | 'wrong' | 'pending',
	isShown: boolean,
	isAnonymous: boolean,
}

interface ItQuizShowcaseQuiz extends DocumentData {
	id: string,
	index: number,
	question: string,
	correctAnswers: string[],
	imageUrl: string | null,
	description: string | null,
	answers: Record<string, ItQuizShowcaseQuizAnswer>,
}

interface ItQuizShowcase extends DocumentData {
	currentQuizIndex: number,
	quizzes: Record<string, ItQuizShowcaseQuiz>,
}

const getQuizzes = async () => {
	const authClient = await new auth.GoogleAuth({
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
	});

	const sheet = new sheets.Sheets({
		auth: authClient,
	});

	const response = await sheet.spreadsheets.values.get({
		spreadsheetId: process.env.IT_QUIZ_SPREADSHEET_ID,
		range: 'quizzes!B1:C60',
	});

	return response.data.values as string[][];
};

const getResults = async () => {
	const authClient = await new auth.GoogleAuth({
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
	});

	const sheet = new sheets.Sheets({
		auth: authClient,
	});

	const response = await sheet.spreadsheets.values.get({
		spreadsheetId: process.env.IT_QUIZ_RESPONSES_SPREADSHEET_ID,
		range: 'responses!C:BM',
	});

	return response.data.values as string[][];
};

const transpose = <T>(array: T[][]) => array[0].map((_, colIndex) => array.map((row) => row[colIndex]));

(async () => {
	process.env.GOOGLE_APPLICATION_CREDENTIALS = './tsg-decathlon-firebase-adminsdk-64vnw-18995df04d.json';

	const app = initializeApp({
		credential: applicationDefault(),
		databaseURL: 'https://tsg-decathlon.firebaseio.com',
	});

	const db = getFirestore(app);

	const showcaseRef = db
		.collection('games').doc('2026:it-quiz')
		.collection('showcases').doc('default') as DocumentReference<ItQuizShowcase>;

	console.log((await showcaseRef.get()).data());


	process.env.GOOGLE_APPLICATION_CREDENTIALS = './google_application_credentials_dev.json';

	const quizzesData = await getQuizzes();

	const quizzes = quizzesData.map(([quiz, answers], index) => ({
		quiz,
		correctAnswers:
			answers
				.split(/[[\]、]/)
				.map((answer) => answer.trim())
				.filter((answer) => answer.length > 0),
		index,
	}));

	const results = await getResults();
	const transposedResults = transpose(results);
	console.log(inspect(transposedResults, {depth: null, colors: true}));

	const userIds = transposedResults[0].slice(1).map((userId) => userId.trim());
	const anonymousFlags = transposedResults[1].slice(1).map((flag) => flag.trim() !== '');

	const quizResults: Record<string, ItQuizShowcaseQuiz> = {};

	for (const [quizIndex, quizResponses] of transposedResults.slice(2).entries()) {
		const [quiz, ...answers] = quizResponses.map((response) => response.trim());
		const correctAnswers = quizzes[quizIndex]?.correctAnswers;

		if (!correctAnswers) {
			continue;
		}

		const quizAnswers: Record<string, ItQuizShowcaseQuizAnswer> = {};

		for (const [userIndex, answer] of answers.entries()) {
			const userId = userIds[userIndex];
			const isAnonymous = anonymousFlags[userIndex];

			if (answer.trim() === '') {
				continue;
			}

			quizAnswers[userId] = {
				userId,
				text: answer,
				status: correctAnswers.some((correctAnswer) => {
					const a = correctAnswer.trim().toLowerCase().normalize('NFKC');
					const b = answer.trim().toLowerCase().normalize('NFKC');
					return a === b;
				}) ? 'correct' : 'wrong',
				isShown: true,
				isAnonymous,
			};
		}

		quizResults[quizIndex.toString()] = {
			id: quizIndex.toString(),
			index: quizIndex,
			question: quiz.replace(/^Q\d+\./, '').trim(),
			correctAnswers,
			imageUrl: null,
			description: null,
			answers: quizAnswers,
		};
	}

	process.env.GOOGLE_APPLICATION_CREDENTIALS = './tsg-decathlon-firebase-adminsdk-64vnw-18995df04d.json';

	const saveResultsResponse = await showcaseRef.set({
		currentQuizIndex: 0,
		usersCount: userIds.length,
		quizzes: quizResults,
	});
	console.log(inspect(saveResultsResponse, {depth: null, colors: true}));
})();

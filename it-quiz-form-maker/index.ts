import {inspect} from 'util';
import {forms_v1 as forms, auth} from '@googleapis/forms';
import {sheets_v4 as sheets} from '@googleapis/sheets';
import 'dotenv/config';

process.env.GOOGLE_APPLICATION_CREDENTIALS = './google_application_credentials_dev.json';

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

(async () => {
	const quizzes = await getQuizzes();

	const authClient = new auth.GoogleAuth({
		scopes: ['https://www.googleapis.com/auth/drive'],
	});

	const form = new forms.Forms({
		auth: authClient,
	});

	const getResponse = await form.forms.get({
		formId: process.env.IT_QUIZ_FORM_ID,
	});

	const questionsCount = getResponse.data.items?.length ?? 0;

	if (questionsCount > 0) {
		const deleteQuestionResponse = await form.forms.batchUpdate({
			formId: process.env.IT_QUIZ_FORM_ID,
			requestBody: {
				requests: Array.from({length: questionsCount}, () => ({
					deleteItem: {
						location: {
							index: 0,
						},
					},
				})),
			},
		});

		console.log(inspect(deleteQuestionResponse.data, {depth: null, colors: true}));
	}

	const addQuestionResponse = await form.forms.batchUpdate({
		formId: process.env.IT_QUIZ_FORM_ID,
		requestBody: {
			requests: quizzes.map(([quiz, answers], index) => ({
				createItem: {
					item: {
						title: `Q${index + 1}. ${quiz}`,
						questionItem: {
							question: {
								grading: {
									pointValue: 2,
									correctAnswers: {
										answers: answers.split(',').map((answer) => ({value: answer})),
									},
								},
								textQuestion: {},
							},
						},
					},
					location: {
						index,
					},
				},
			})),
		},
	});

	console.log(inspect(addQuestionResponse.data, {depth: null, colors: true}));
})();

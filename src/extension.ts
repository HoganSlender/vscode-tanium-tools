import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as he from 'he';
import * as parser from 'fast-xml-parser';
import { sanitize } from "sanitize-filename-ts";
import { TransformSensor } from './transform-sensor';
import { OutputChannel, window, ExtensionContext, commands, QuickInputButton, Uri, workspace, QuickPickItem, QuickInput, Disposable, QuickInputButtons, ConfigurationTarget } from 'vscode';

const got = require('got');
const { promisify } = require('util');
const stream = require('stream');

class MyButton implements QuickInputButton {
	constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
}

interface State {
	title: string;
	step: number;
	totalSteps: number;
	contentSetUrl: QuickPickItem | string;
	fqdn: QuickPickItem | string;
	username: QuickPickItem | string;
	password: string;
}

var outputChannel: OutputChannel;

function log(msg: string) {
	outputChannel.appendLine(msg);
}

function logWithMessage(msg: string) {
	log(msg);
	window.showInformationMessage(msg);
}

function logError(msg: string, errObject: any) {
	log(msg);
	if (errObject instanceof TypeError) {
		log(`${errObject.message} at ${errObject.stack}`);
	} else {
		log(JSON.stringify(errObject, null, 2));
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hoganslendertanium" is now active!');

	const addButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, '');


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = commands.registerCommand('hoganslendertanium.compareContentSet', async () => {
		// get the current folder
		const folderPath = workspace.rootPath;

		// define output channel
		if (outputChannel === undefined) {
			outputChannel = window.createOutputChannel("tanium");
		}

		// get configurations
		const config = workspace.getConfiguration('hoganslender.tanium');

		// get urls
		const urls: string[] = config.get('contentSetUrls', []);
		const contentSetUrlQuickPickItemss: QuickPickItem[] = urls.map(label => ({ label }));

		// get fqdns
		const fqdns: string[] = config.get('fqdns', []);
		const fqdnQuickPickItems: QuickPickItem[] = fqdns.map(label => ({ label }));

		// get usernames
		const usernames: string[] = config.get('usernames', []);
		const usernameQuickPickItems: QuickPickItem[] = usernames.map(label => ({ label }));

		async function collectInputs() {
			const state = {} as Partial<State>;
			await MultiStepInput.run(input => pickContentSetUrl(input, state));
			return state as State;
		}

		const title = 'Compare Content Set';

		async function pickContentSetUrl(input: MultiStepInput, state: Partial<State>) {
			if (contentSetUrlQuickPickItemss.length === 0) {
				return (input: MultiStepInput) => inputContentSetUrl(input, state, 0);
			} else {
				addButton.tooltip = 'Add New Content Url';
				const pick = await input.showQuickPick({
					title,
					step: 1,
					totalSteps: 4,
					placeholder: 'Please choose the url for the content set.',
					items: contentSetUrlQuickPickItemss,
					activeItem: typeof state.contentSetUrl !== 'string' ? state.contentSetUrl : undefined,
					buttons: [addButton],
					shouldResume: shouldResume
				});
				if (pick instanceof MyButton) {
					return (input: MultiStepInput) => inputContentSetUrl(input, state, 1);
				}
				state.contentSetUrl = pick;
				return (input: MultiStepInput) => pickFqdn(input, state, 0);
			}
		}

		async function inputContentSetUrl(input: MultiStepInput, state: Partial<State>, stepModifier: number) {
			state.contentSetUrl = await input.showInputBox({
				title,
				step: 1 + stepModifier,
				totalSteps: 4 + stepModifier,
				value: typeof state.contentSetUrl === 'string' ? state.contentSetUrl : '',
				prompt: 'Please enter the url for the content set.',
				shouldResume: shouldResume
			});
			return (input: MultiStepInput) => pickFqdn(input, state, stepModifier);
		}

		async function pickFqdn(input: MultiStepInput, state: Partial<State>, stepModifier: number) {
			if (fqdnQuickPickItems.length === 0) {
				return (input: MultiStepInput) => inputFqdn(input, state, stepModifier);
			} else {
				addButton.tooltip = 'Add New FQDN';
				const pick = await input.showQuickPick({
					title,
					step: 2 + stepModifier,
					totalSteps: 4 + stepModifier,
					placeholder: 'Please choose the Tanium server fqdn',
					items: fqdnQuickPickItems,
					activeItem: typeof state.fqdn !== 'string' ? state.fqdn : undefined,
					buttons: [addButton],
					shouldResume: shouldResume
				});
				if (pick instanceof MyButton) {
					return (input: MultiStepInput) => inputFqdn(input, state, stepModifier + 1);
				}
				state.fqdn = pick;
				return (input: MultiStepInput) => pickUsername(input, state, stepModifier);
			}
		}

		async function inputFqdn(input: MultiStepInput, state: Partial<State>, stepModifier: number) {
			state.fqdn = await input.showInputBox({
				title,
				step: 2 + stepModifier,
				totalSteps: 4 + stepModifier,
				value: typeof state.fqdn === 'string' ? state.fqdn : '',
				prompt: 'Please enter the Tanium server fqdn',
				shouldResume: shouldResume
			});
			return (input: MultiStepInput) => pickUsername(input, state, stepModifier);
		}

		async function pickUsername(input: MultiStepInput, state: Partial<State>, stepModifier: number) {
			if (usernameQuickPickItems.length === 0) {
				return (input: MultiStepInput) => inputUsername(input, state, stepModifier);
			} else {
				addButton.tooltip = 'Add New Username';
				const pick = await input.showQuickPick({
					title,
					step: 3 + stepModifier,
					totalSteps: 4 + stepModifier,
					placeholder: 'Please choose the Tanium server username',
					items: usernameQuickPickItems,
					activeItem: typeof state.username !== 'string' ? state.username : undefined,
					buttons: [addButton],
					shouldResume: shouldResume
				});
				if (pick instanceof MyButton) {
					return (input: MultiStepInput) => inputUsername(input, state, stepModifier + 1);
				}
				state.username = pick;
				return (input: MultiStepInput) => inputPassword(input, state, stepModifier);
			}
		}

		async function inputUsername(input: MultiStepInput, state: Partial<State>, stepModifier: number) {
			state.username = await input.showInputBox({
				title,
				step: 2 + stepModifier,
				totalSteps: 4 + stepModifier,
				value: typeof state.username === 'string' ? state.username : '',
				prompt: 'Please enter the Tanium server username',
				shouldResume: shouldResume
			});
			return (input: MultiStepInput) => inputPassword(input, state, stepModifier);
		}

		async function inputPassword(input: MultiStepInput, state: Partial<State>, stepModifier: number) {
			state.password = await input.showInputBox({
				title,
				step: 2 + stepModifier,
				totalSteps: 4 + stepModifier,
				value: typeof state.password === 'string' ? state.password : '',
				prompt: 'Please enter the Tanium server password',
				password: true,
				shouldResume: shouldResume
			});
		}

		function shouldResume() {
			// Could show a notification with the option to resume.
			return new Promise<boolean>((resolve, reject) => {
				// noop
			});
		}

		const state = await collectInputs();

		// store values
		var contentSet: string;
		var fqdn: string;
		var username: string;
		var password: string;

		if (typeof state.contentSetUrl === 'string'){
			urls.push(state.contentSetUrl);
			config.update('contentSetUrls', urls, ConfigurationTarget.Global);
			contentSet = state.contentSetUrl;
		} else {
			contentSet = state.contentSetUrl.label;
		}

		if (typeof state.fqdn === 'string'){
			fqdns.push(state.fqdn);
			config.update('fqdns', fqdns, ConfigurationTarget.Global);
			fqdn = state.fqdn;
		} else {
			fqdn = state.fqdn.label;
		}

		if (typeof state.username === 'string'){
			usernames.push(state.username);
			config.update('usernames', usernames, ConfigurationTarget.Global);
			username = state.username;
		} else {
			username = state.username.label;
		}

		password = state.password;

		log(`contentSet: ${contentSet}`);
		log(`fqdn: ${fqdn}`);
		log(`username: ${username}`);
		log(`password: XXXXXXXX`);

		const restBase = `https://${fqdn}/api/v2`;

		outputChannel.show();

		// get filename from url
		const parsed = url.parse(contentSet);
		const contentFilename = sanitize(path.basename(parsed.pathname!));
		log(`downloading ${contentFilename}`);

		// download the file
		const contentSetFile = path.join(folderPath!, contentFilename);

		var file = fs.createWriteStream(contentSetFile);

		const pipeline = promisify(stream.pipeline);

		(async () => {
			await pipeline(
				got.stream(contentSet),
				fs.createWriteStream(contentSetFile)
			);

			file.close();  // close() is async, call cb after close completes.
			log(`download complete.`);

			fs.readFile(contentSetFile, 'utf8', async function (err, data) {
				if (err) {
					logError(`could ot open '${contentSetFile}'`, err);
					return;
				}

				var options = {
					attributeNamePrefix: "@_",
					attrNodeName: "attr", //default is 'false'
					textNodeName: "#text",
					ignoreAttributes: true,
					ignoreNameSpace: false,
					allowBooleanAttributes: false,
					parseNodeValue: true,
					parseAttributeValue: false,
					trimValues: true,
					cdataTagName: "__cdata", //default is 'false'
					cdataPositionChar: "\\c",
					parseTrueNumberOnly: false,
					arrayMode: false, //"strict"
					attrValueProcessor: (val: string, attrName: string) => he.decode(val, { isAttributeValue: true }),//default is a=>a
					tagValueProcessor: (val: string, tagName: string) => he.decode(val), //default is a=>a
					stopNodes: ["parse-me-as-string"]
				};

				if (parser.validate(data) === true) { //optional (it'll return an object in case it's not valid)
					var jsonObj = parser.parse(data, options);

					// create folders
					const contentDir = path.join(folderPath!, `1 - ${contentFilename.replace('.xml', '')}`);
					const serverDir = path.join(folderPath!, `2 - ${sanitize(fqdn)}`);

					if (!fs.existsSync(contentDir)) {
						fs.mkdirSync(contentDir);
					}

					if (!fs.existsSync(serverDir)) {
						fs.mkdirSync(serverDir);
					}

					// process sensors
					var sensorHash: string[] = [];

					var lastSensorName = jsonObj.content.sensor[jsonObj.content.sensor.length - 1].name;
					jsonObj.content.sensor.forEach((sensor: any) => {
						sensorHash.push(`${sensor.what_hash}`);
						const name = sanitize(sensor.name);

						try {
							const tmpSensor = TransformSensor.transformContentSet(sensor);

							const content = JSON.stringify(tmpSensor, null, 2);

							// write to file
							const contentDirFile = path.join(contentDir, name + ".json");
							fs.writeFile(contentDirFile, content, (err) => {
								if (err) {
									logError(`error writing ${contentDirFile}`, err);
									return;
								}

								if (lastSensorName === sensor.name) {
									logWithMessage('content set extraction complete');
								}
							});
						} catch (err) {
							logError(`error processing content set - ${name}`, err);
						}

					});

					// get session
					const { body } = await got.post(`${restBase}/session/login`, {
						json: {
							username: username,
							password: password,
						},
						responseType: 'json'
					});

					var session: string = body.data.session;

					const lastHash = sensorHash[sensorHash.length - 1];
					sensorHash.forEach(async (hash) => {
						const { body } = await got.get(`${restBase}/sensors/by-hash/${hash}`, {
							headers: {
								session: session,
							},
							responseType: 'json'
						});

						let sensor: any = body.data;
						const name: string = sanitize(sensor.name);

						try {
							sensor = TransformSensor.transform(sensor);
							const content: string = JSON.stringify(sensor, null, 2);

							const serverFile = path.join(serverDir, name + '.json');
							fs.writeFile(serverFile, content, (err) => {
								if (err) {
									logError(`could not write ${serverFile}`, err);
								}
								if (lastHash === hash) {
									logWithMessage('server sensor retrieval complete');
								}
							});
						} catch (err) {
							logError(`error processing server sensor - ${name}`, err);
						}
					});
				}
			});
		})();

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }


// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------

class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	password?: boolean;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, password, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.password = password ? password : false;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						resolve(value);
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}

import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as he from 'he';
import * as parser from 'fast-xml-parser';
import { sanitize } from "sanitize-filename-ts";
import { TransformSensor } from './transform-sensor';
import { OutputChannel, window, ExtensionContext, commands, workspace, ProgressLocation } from 'vscode';
import { collectInputs } from './content-set-parameters';
import { RequestError } from 'got';

const got = require('got');
const { promisify } = require('util');
const stream = require('stream');

var outputChannel: OutputChannel;

function log(msg: string) {
	outputChannel.appendLine(msg);
}

function logError(msg: string, errObject: any) {
	log(msg);
	if (errObject instanceof TypeError) {
		log(`\t${errObject.message} at ${errObject.stack}`);
	} else if (errObject instanceof RequestError) {
		log(`\t${errObject.message} at ${errObject.stack}`);
	} else {
		log(`\t${JSON.stringify(errObject, null, 2)}`);
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hoganslendertanium" is now active!');

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
		const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

		const state = await collectInputs(config, context);

		// store values
		const contentSet: string = state.contentSetUrl;
		const fqdn: string = state.fqdnString;
		const username: string = state.usernameString;
		const password: string = state.password;

		const restBase = `https://${fqdn}/api/v2`;

		outputChannel.show();
		outputChannel.clear();

		log(`contentSet: ${contentSet}`);
		log(`fqdn: ${fqdn}`);
		log(`username: ${username}`);
		log(`password: XXXXXXXX`);

		// get filename from url
		const parsed = url.parse(contentSet);
		const contentFilename = sanitize(path.basename(parsed.pathname!));
		log(`downloading ${contentFilename}`);

		// download the file
		const contentSetFile = path.join(folderPath!, contentFilename);

		const pipeline = promisify(stream.pipeline);

		(async () => {
			try {
				await pipeline(
					got.stream(contentSet, {
						timeout: httpTimeout,
					}),
					fs.createWriteStream(contentSetFile)
				);
			} catch (err) {
				logError(`error downloading ${contentSet}`, err);
				return;
			}

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
					var sensorInfo: any[] = [];

					window.withProgress({
						location: ProgressLocation.Notification,
						title: "content set extraction",
						cancellable: true
					}, (progress, token) => {
						token.onCancellationRequested(() => {
							outputChannel.appendLine("User canceled the long running operation");
						});

						const jsonTotal = jsonObj.content.sensor.length;
						const jsonIncrement = 100 / jsonTotal;

						var jsonCounter = 0;

						const p = new Promise(resolve => {
							progress.report({ increment: 0 });
							jsonObj.content.sensor.forEach((sensor: any) => {
								sensorInfo.push({
									name: sensor.name,
									hash: `${sensor.what_hash}`
								});
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

										jsonCounter++;
										progress.report({
											increment: jsonCounter * jsonIncrement
										});

										if (jsonTotal === jsonCounter) {
											resolve();
										}
									});
								} catch (err) {
									logError(`error processing content set - ${name}`, err);

									jsonCounter++;
									progress.report({
										increment: jsonCounter * jsonIncrement
									});

									if (jsonTotal === jsonCounter) {
										resolve();
									}
								}
							});
						});

						return p;
					});

					// get session
					var session: string;
					try {
						const { body } = await got.post(`${restBase}/session/login`, {
							json: {
								username: username,
								password: password,
							},
							responseType: 'json',
							timeout: httpTimeout,
						});

						session = body.data.session;
					} catch (err) {
						logError('could not retrieve session', err);
						return;
					}

					window.withProgress({
						location: ProgressLocation.Notification,
						title: `sensor retrieval from ${fqdn}`,
						cancellable: true
					}, (progress, token) => {
						token.onCancellationRequested(() => {
							outputChannel.appendLine(`sensor retrieval from ${fqdn}`);
						});

						const sensorTotal = sensorInfo.length;
						const sensorIncrement = 100 / sensorTotal;

						var sensorCounter = 0;

						const p = new Promise(resolve => {
							progress.report({ increment: 0 });
							sensorInfo.forEach(async (sensorInfo: any) => {
								try {
									const hash = sensorInfo.hash;
									const { body } = await got.get(`${restBase}/sensors/by-hash/${hash}`, {
										headers: {
											session: session,
										},
										responseType: 'json',
										timeout: httpTimeout,
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

											sensorCounter++;
											progress.report({
												increment: sensorCounter * sensorIncrement
											});

											if (sensorTotal === sensorCounter) {
												window.withProgress({
													location: ProgressLocation.Notification,
													title: "Processing Complete!",
													cancellable: false
												}, (progress, token) => {
													progress.report({
														increment: 100,
														message: 'Processing is complete',
													});

													const p = new Promise(resolve => {
														setTimeout(() => {
															resolve();
														}, 5000);
													});

													return p;
												});
												resolve();
											}
										});
									} catch (err) {
										logError(`error processing server sensor - ${name}`, err);
									}
								} catch (err) {
									if (!err.message.includes('404')) {
										logError(`error retrieving ${sensorInfo.name} from ${fqdn}`, err);
									}

									sensorCounter++;
									progress.report({
										increment: sensorCounter * sensorIncrement
									});

									if (sensorTotal === sensorCounter) {
										resolve();
									}
								}
							});

						});

						return p;
					});
				}
			});
		})();
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }

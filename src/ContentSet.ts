import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as he from 'he';
import * as parser from 'fast-xml-parser';
import { sanitize } from "sanitize-filename-ts";
import { TransformSensor } from './transform-sensor';
import * as vscode from 'vscode';
import { collectContentSetSensorInputs } from './content-set-sensors-parameters';
import { OutputChannelLogging } from './logging';
import * as commands from './common/commands';

const diffMatchPatch = require('diff-match-patch');

const got = require('got');
const { promisify } = require('util');
const stream = require('stream');

export function activate(context: vscode.ExtensionContext) {
	commands.register(context, {
		'hoganslendertanium.compareContentSetSensors': async () => {
			ContentSet.processSensors(context);
		},
	});
}

class ContentSet {
	public static async processSensors(context: vscode.ExtensionContext) {
		// get the current folder
		const folderPath = vscode.workspace.rootPath;

		// define output channel
		OutputChannelLogging.initialize();

		// get configurations
		const config = vscode.workspace.getConfiguration('hoganslender.tanium');
		const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

		const state = await collectContentSetSensorInputs(config, context);

		// collect values
		const contentSet: string = state.contentSetUrl;
		const fqdn: string = state.fqdnString;
		const username: string = state.usernameString;
		const password: string = state.password;
		const extractCommentWhitespace: boolean = state.extractCommentWhitespace;

		const restBase = `https://${fqdn}/api/v2`;

		OutputChannelLogging.showClear();

		OutputChannelLogging.log(`contentSet: ${contentSet}`);
		OutputChannelLogging.log(`commentWhitespace: ${extractCommentWhitespace}`);
		OutputChannelLogging.log(`fqdn: ${fqdn}`);
		OutputChannelLogging.log(`username: ${username}`);
		OutputChannelLogging.log(`password: XXXXXXXX`);

		// get filename from url
		const parsed = url.parse(contentSet);
		const contentFilename = sanitize(path.basename(parsed.pathname!));
		OutputChannelLogging.log(`downloading ${contentFilename}`);

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
				OutputChannelLogging.logError(`error downloading ${contentSet}`, err);
				return;
			}

			OutputChannelLogging.log(`download complete.`);

			fs.readFile(contentSetFile, 'utf8', async function (err, data) {
				if (err) {
					OutputChannelLogging.logError(`could ot open '${contentSetFile}'`, err);
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
					const commentDir = path.join(folderPath!, 'Comments Only');
					const commentContentDir = path.join(commentDir, `1 - ${contentFilename.replace('.xml', '')}`);
					const commentServerDir = path.join(commentDir, `2 - ${sanitize(fqdn)}`);

					if (!fs.existsSync(contentDir)) {
						fs.mkdirSync(contentDir);
					}

					if (!fs.existsSync(serverDir)) {
						fs.mkdirSync(serverDir);
					}

					if (extractCommentWhitespace) {
						if (!fs.existsSync(commentDir)) {
							fs.mkdirSync(commentDir);
						}

						if (!fs.existsSync(commentContentDir)) {
							fs.mkdirSync(commentContentDir);
						}

						if (!fs.existsSync(commentServerDir)) {
							fs.mkdirSync(commentServerDir);
						}
					}

					// process sensors
					var sensorInfo: any[] = [];

					vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: "content set extraction",
						cancellable: true
					}, (progress, token) => {
						token.onCancellationRequested(() => {
							OutputChannelLogging.log("User canceled the long running operation");
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
											OutputChannelLogging.logError(`error writing ${contentDirFile}`, err);
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
									OutputChannelLogging.logError(`error processing content set - ${name}`, err);

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
						OutputChannelLogging.logError('could not retrieve session', err);
						return;
					}

					await vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: `sensor retrieval from ${fqdn}`,
						cancellable: true
					}, (progress, token) => {
						token.onCancellationRequested(() => {
							OutputChannelLogging.log(`sensor retrieval from ${fqdn} cancelled`);
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
												OutputChannelLogging.logError(`could not write ${serverFile}`, err);
											}

											sensorCounter++;
											progress.report({
												increment: sensorCounter * sensorIncrement
											});

											if (sensorTotal === sensorCounter) {
												resolve();
											}
										});
									} catch (err) {
										OutputChannelLogging.logError(`error processing server sensor - ${name}`, err);
									}
								} catch (err) {
									if (!err.message.includes('404')) {
										OutputChannelLogging.logError(`error retrieving ${sensorInfo.name} from ${fqdn}`, err);
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

					if (extractCommentWhitespace) {
						const files: string[] = fs.readdirSync(contentDir);
						await vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							title: 'Extracting sensors with comments/whitspaces changes only',
							cancellable: true
						}, (progress, token) => {
							token.onCancellationRequested(() => {
								OutputChannelLogging.log('Extracting sensors with comments/whitspaces changes only');
							});

							const fileTotal = files.length;
							const fileIncrement = 100 / fileTotal;

							var fileCounter = 0;

							const p = new Promise(resolve => {
								progress.report({ increment: 0 });
								files.forEach(file => {
									try {
										// check files
										const leftTarget = path.join(contentDir, file);
										const rightTarget = leftTarget.replace(contentDir, serverDir);
										if (fs.existsSync(rightTarget)) {
											// read contents of each file
											const leftContent = fs.readFileSync(leftTarget, 'utf-8');
											const rightContent = fs.readFileSync(rightTarget, 'utf-8');

											// do diff
											const dmp = new diffMatchPatch();
											const diffs = dmp.diff_main(leftContent, rightContent);
											dmp.diff_cleanupSemantic(diffs);

											var onlyComments = true;
											var allEqual = true;

											diffs.forEach((diff: any) => {
												const operation: number = diff[0];
												const text: string = diff[1];

												if (operation !== diffMatchPatch.DIFF_EQUAL) {
													allEqual = false;

													// trim text
													var test = text.trim();

													if (test.length !== 0) {
														var first = test.substr(0, 1);
														if (first === '"') {
															first = test.substr(1, 1);
														}

														if (first !== '#' && first !== "'" && first !== ',') {
															onlyComments = false;
														}
													}
												}
											});

											if (onlyComments && !allEqual) {
												// move the files
												fs.renameSync(leftTarget, path.join(commentContentDir, file));
												fs.renameSync(rightTarget, path.join(commentServerDir, file));
											}
										}

										fileCounter++;
										progress.report({
											increment: fileCounter * fileIncrement
										});

										if (fileTotal === fileCounter) {
											resolve();
										}
									} catch (err) {
										OutputChannelLogging.logError('error comparing files', err);
									}
								});
							});

							return p;
						});
					}

					vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
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
				}
			});
		})();
	}
}
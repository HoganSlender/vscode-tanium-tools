import * as parser from 'fast-xml-parser';
import * as fs from 'fs';
import * as he from 'he';
import * as path from 'path';
import { sanitize } from "sanitize-filename-ts";
import * as url from 'url';
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectContentSetSensorInputs } from '../parameter-collection/content-set-sensors-parameters';
import { TransformSensor } from '../transform/transform-sensor';

const diffMatchPatch = require('diff-match-patch');

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
		const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
		const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

		const state = await collectContentSetSensorInputs(config, context);

		// collect values
		const contentSet: string = state.contentSetUrl;
		const fqdn: string = state.fqdn;
		const username: string = state.username;
		const password: string = state.password;
		const extractCommentWhitespace: boolean = state.extractCommentWhitespace;

		const restBase = `https://${fqdn}/api/v2`;

		OutputChannelLogging.showClear();

		OutputChannelLogging.log(`contentSet: ${contentSet}`);
		OutputChannelLogging.log(`commentWhitespace: ${extractCommentWhitespace.toString()}`);
		OutputChannelLogging.log(`fqdn: ${fqdn}`);
		OutputChannelLogging.log(`username: ${username}`);
		OutputChannelLogging.log(`password: XXXXXXXX`);

		// get filename from url
		const parsed = url.parse(contentSet);
		const contentFilename = sanitize(path.basename(parsed.pathname!));
		OutputChannelLogging.log(`downloading ${contentFilename}`);

		// download the file
		const contentSetFile = path.join(folderPath!, contentFilename);

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Content Set Compare',
			cancellable: false
		}, async (progress, token) => {
			progress.report({ increment: 0 });

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

			const increment = extractCommentWhitespace ? 25 : 33;

			// process sensors
			var sensorInfo: any[] = [];

			if (extractCommentWhitespace) {
				progress.report({ increment: increment, message: `downloading ${contentSet}` });
				await RestClient.downloadFile(contentSet, contentSetFile, {}, allowSelfSignedCerts, httpTimeout);
				progress.report({ increment: increment, message: 'extracting sensors' });
				await this.extractContentSetSensors(contentSetFile, contentDir, sensorInfo);
				progress.report({ increment: increment, message: `retrieving sensors from ${fqdn}` });
				await this.retrieveServerSensors(sensorInfo, allowSelfSignedCerts, httpTimeout, username, password, serverDir, fqdn);
				progress.report({ increment: increment, message: 'Extracting sensors with comments/whitspaces changes only' });
				await this.extractCommentWhitespaceSensors(contentDir, serverDir, commentContentDir, commentServerDir);
                const p = new Promise<void>(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 3000);
                });
			} else {
				progress.report({ increment: increment, message: `downloading ${contentSet}` });
				await RestClient.downloadFile(contentSet, contentSetFile, {}, allowSelfSignedCerts, httpTimeout);
				progress.report({ increment: increment, message: 'extracting sensors' });
				await this.extractContentSetSensors(contentSetFile, contentDir, sensorInfo);
				progress.report({ increment: increment, message: `retrieving sensors from ${fqdn}` });
				await this.retrieveServerSensors(sensorInfo, allowSelfSignedCerts, httpTimeout, username, password, serverDir, fqdn);
                const p = new Promise<void>(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 3000);
                });
			}
		});
	}

	static extractCommentWhitespaceSensors(contentDir: string, serverDir: string, commentContentDir: string, commentServerDir: string) {
		const p = new Promise<void>(resolve => {
			const files: string[] = fs.readdirSync(contentDir);
			const fileTotal = files.length;

			var fileCounter = 0;
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

					if (fileTotal === fileCounter) {
						resolve();
					}
				} catch (err) {
					OutputChannelLogging.logError('error comparing files', err);

					fileCounter++;

					if (fileTotal === fileCounter) {
						resolve();
					}
				}
			});
		});

		return p;
	}

	static retrieveServerSensors(sensorInfo: any[], allowSelfSignedCerts: boolean, httpTimeout: number, username: string, password: string, serverDir: string, fqdn: string) {
		const p = new Promise<void>(async resolve => {
			// get session
			var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

			const sensorTotal = sensorInfo.length;

			var sensorCounter = 0;

			sensorInfo.forEach(async (sensorInfo: any) => {
				try {
					const hash = sensorInfo.hash;
					const options = {
						headers: {
							session: session,
						},
						responseType: 'json',
					};

					const body = await RestClient.get(`https://${fqdn}/api/v2/sensors/by-hash/${hash}`, options, allowSelfSignedCerts, httpTimeout);

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

					if (sensorTotal === sensorCounter) {
						resolve();
					}
				}
			});
		});

		return p;
	}

	static extractContentSetSensors(contentSetFile: string, contentDir: string, sensorInfo: any[]) {
		const p = new Promise<void>(resolve => {
			fs.readFile(contentSetFile, 'utf8', function (err, data) {
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
					const jsonTotal = jsonObj.content.sensor.length;
					const jsonIncrement = 100 / jsonTotal;

					var jsonCounter = 0;

					jsonObj.content.sensor.forEach((sensor: any) => {
						if (sensor.category === 'Reserved') {
							jsonCounter++;
							if (jsonTotal === jsonCounter) {
								resolve();
							}
						} else {
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
									if (jsonTotal === jsonCounter) {
										resolve();
									}
								});
							} catch (err) {
								OutputChannelLogging.logError(`error processing content set - ${name}`, err);

								jsonCounter++;
								if (jsonTotal === jsonCounter) {
									resolve();
								}
							}
						}
					});
				}
			});
		});

		return p;
	}
}
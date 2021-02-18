/* eslint-disable @typescript-eslint/naming-convention */
import * as parser from 'fast-xml-parser';
import * as fs from 'fs';
import * as he from 'he';
import * as path from 'path';
import { sanitize } from "sanitize-filename-ts";
import * as vscode from 'vscode';

import * as commands from '../common/commands';
import { OutputChannelLogging } from '../common/logging';
import { RestClient } from '../common/restClient';
import { Session } from '../common/session';
import { collectContentSetContentInputs } from '../parameter-collection/content-set-content-parameters';
import { collectContentSetSensorInputs } from '../parameter-collection/content-set-sensors-parameters';
import { TransformSensor } from '../transform/TransformSensor';
import { TransformContentSet } from '../transform/TransformContentSet';
import { TransformContentSetPrivilege } from '../transform/TransformContentSetPrivilege';
import { TransformContentSetRole } from '../transform/TransformContentSetRole';
import { TransformContentSetRolePrivilege } from '../transform/TransformContentSetRolePrivilege';
import { TransformPackage } from '../transform/TransformPackage';
import { TransformSavedAction } from '../transform/TransformSavedAction';
import { TransformSavedQuestion } from '../transform/TransformSavedQuestion';
import { TransformWhiteListedUrl } from '../transform/TransformWhiteListedUrl';
import { TaniumDiffProvider } from '../trees/TaniumDiffProvider';
import { ContentSetRolePrivileges } from './ContentSetRolePrivileges';
import { ServerServerBase } from './ServerServerBase';
import { WhiteListedUrls } from './WhiteListedUrls';
import { TransformDashboardGroup } from '../transform/TransformDashboardGroup';
import { TransformDashboard } from '../transform/TransformDashboard';
import { FqdnSetting } from '../parameter-collection/fqdnSetting';

const diffMatchPatch = require('diff-match-patch');
import { URL } from 'url';

export function activate(context: vscode.ExtensionContext) {
	commands.register(context, {
		'hoganslendertanium.compareContentSetSensors': async () => {
			ContentSet.processSensors(context);
		},
		'hoganslendertanium.compareContentSetContent': async (fqdn, contentUrl) => {
			ContentSet.processContentSetContent(fqdn, contentUrl, context);
		},

	});
}

class ContentSet extends ServerServerBase {
	static async processContentSetContent(fqdn: FqdnSetting, contentUrl: string, context: vscode.ExtensionContext) {
		// define output channel
		OutputChannelLogging.initialize();

		if (this.invalidWorkspaceFolders()) {
			return;
		}

		// get the current folder
		const folderPath = vscode.workspace.workspaceFolders![0].uri.fsPath;

		// get configurations
		const config = vscode.workspace.getConfiguration('hoganslender.tanium');
		const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
		const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

		const state = await collectContentSetContentInputs(config, context);

		// collect values
		const username: string = state.username;
		const password: string = state.password;

		OutputChannelLogging.showClear();

		OutputChannelLogging.log(`fqdn: ${fqdn.label}`);
		OutputChannelLogging.log(`username: ${username}`);
		OutputChannelLogging.log(`password: XXXXXXXX`);

        // validate credentials
        if (await this.invalidCredentials(allowSelfSignedCerts, httpTimeout, [
            {
                fqdn: fqdn,
                username: username,
                password: password
            }
        ])) {
            return;
        }

		// get filename from url
		const parsed = new URL(contentUrl);
		const contentFilename = sanitize(path.basename(parsed.pathname!));
		OutputChannelLogging.log(`downloading ${contentFilename}`);

		// download the file
		const contentSetFile = path.join(folderPath, contentFilename);

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Content Set Compare',
			cancellable: false
		}, async (progress, token) => {
			progress.report({ increment: 0 });

			// create folders
			const contentDir = path.join(folderPath!, `1 - ${contentFilename.replace('.xml', '')}`);
			const serverDir = path.join(folderPath!, `2 - ${sanitize(fqdn.label)}`);

			if (!fs.existsSync(contentDir)) {
				fs.mkdirSync(contentDir);
			}

			if (!fs.existsSync(serverDir)) {
				fs.mkdirSync(serverDir);
			}

			const increment = 50;

			progress.report({ increment: increment, message: `downloading ${contentUrl}` });
			await RestClient.downloadFile(contentUrl, contentSetFile, {}, allowSelfSignedCerts, httpTimeout);
			progress.report({ increment: increment, message: 'extracting content' });
			await this.extractContentSetContentAndCalcDiffs(contentSetFile, contentDir, serverDir, fqdn, username, password, allowSelfSignedCerts, httpTimeout, context);
			const p = new Promise<void>(resolve => {
				setTimeout(() => {
					resolve();
				}, 3000);
			});
		});
	}

	static extractContentSetContentAndCalcDiffs(contentSetFile: string, contentDir: string, serverDir: string, fqdn: FqdnSetting, username: string, password: string, allowSelfSignedCerts: boolean, httpTimeout: number, context: vscode.ExtensionContext) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				await this.extractContentSetContent(contentSetFile, contentDir, serverDir, fqdn, username, password, allowSelfSignedCerts, httpTimeout, context);
				await TaniumDiffProvider.currentProvider?.calculateDiffs(context);

				return resolve();
			} catch (err) {
				return reject();
			}
		});

		return p;
	}

	static extractContentSetContent(
		contentSetFile: string,
		contentDir: string,
		serverDir: string,
		fqdn: FqdnSetting,
		username: string,
		password: string,
		allowSelfSignedCerts: boolean,
		httpTimeout: number,
		context: vscode.ExtensionContext
	) {
		const p = new Promise<any>((resolve, reject) => {
			fs.readFile(contentSetFile, 'utf8', async (err, data) => {
				if (err) {
					OutputChannelLogging.logError(`could not open '${contentSetFile}'`, err);
					return reject();
				}

				// store for later
				TaniumDiffProvider.currentProvider?.addSolutionContentSetData({
					xmlContentSetFile: contentSetFile,
					leftDir: contentDir,
					rightDir: serverDir
				}, context);

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

				if (parser.validate(data) === true) {
					try {
						var jsonObj = parser.parse(data, options);

						// number of properties
						const propertyCount = Object.keys(jsonObj.content).length;

						const session = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

						// process contents
						await vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							title: 'Parse Content',
							cancellable: false
						}, async (progress) => {
							progress.report({ increment: 0 });

							const increment = 100 / propertyCount;

							// walk the content
							var serverContentSetRolePrivilegesMap: any;
							var serverWhiteListedUrlsMap: any;

							for (const property in jsonObj.content) {
								try {
									const items: string[] = [
										'solution',
										'api_requests',
										'dashboard',
										'dashboard_group',
										'white_listed_url',
										'sensor',
										'saved_question',
										'saved_action',
										'tanium_package',
										'content_set_role_privilege',
										'content_set_privilege',
										'content_set_role',
										'content_set'
									];

									if (items.includes(property)) {
										switch (property) {
											case 'solution':
												progress.report({
													increment: increment,
													message: `extracting solution`
												});
												break;

											case 'api_requests':
												progress.report({
													increment: increment,
													message: `extracting api_requests`
												});
												break;

											case 'dashboard':
												progress.report({
													increment: increment,
													message: `extracting dashboards`
												});

												var target = jsonObj.content.dashboard;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const dashboard = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${dashboard.name}`
															});

															await this.processDashboard(dashboard, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processDashboard(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'dashboard_group':
												progress.report({
													increment: increment,
													message: `extracting dashboard groups`
												});

												var target = jsonObj.content.dashboard_group;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const dashboardGroup = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${dashboardGroup.name}`
															});

															await this.processDashboardGroup(dashboardGroup, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processDashboardGroup(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'white_listed_url':
												progress.report({
													increment: increment,
													message: `extracting white listed urls`
												});

												if (!serverWhiteListedUrlsMap) {
													serverWhiteListedUrlsMap = await WhiteListedUrls.generateWhiteListedUrlMap(allowSelfSignedCerts, httpTimeout, session, fqdn);
												}

												var target = jsonObj.content.white_listed_url;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const whiteListedUrl = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${whiteListedUrl.url}`
															});

															await this.processWhiteListedUrl(whiteListedUrl, contentDir, serverDir, context, serverWhiteListedUrlsMap);
														}
													});
												} else {
													// process one
													await this.processWhiteListedUrl(target, contentDir, serverDir, context, serverWhiteListedUrlsMap);
												}
												break;

											case 'sensor':
												progress.report({
													increment: increment,
													message: `extracting sensors`
												});

												var target = jsonObj.content.sensor;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const sensor = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${sensor.name}`
															});

															await this.processSensor(sensor, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processSensor(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'saved_question':
												progress.report({
													increment: increment,
													message: `extracting saved questions`
												});

												var target = jsonObj.content.saved_question;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const savedQuestion = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${savedQuestion.name}`
															});

															await this.processSavedQuestion(savedQuestion, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processSavedQuestion(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'saved_action':
												progress.report({
													increment: increment,
													message: `extracting saved actions`
												});

												var target = jsonObj.content.saved_action;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const savedAction = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${savedAction.name}`
															});

															await this.processSavedAction(savedAction, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processSavedAction(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'tanium_package':
												progress.report({
													increment: increment,
													message: `extracting packages`
												});

												var target = jsonObj.content.tanium_package;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const taniumPackage = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${taniumPackage.name}`
															});

															await this.processPackage(taniumPackage, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processPackage(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'content_set_role_privilege':
												progress.report({
													increment: increment,
													message: `extracting content set role privileges`
												});

												if (!serverContentSetRolePrivilegesMap) {
													// load up map on first use
													serverContentSetRolePrivilegesMap = await ContentSetRolePrivileges.generateContentSetRolePrivilegeMap(allowSelfSignedCerts, httpTimeout, session, fqdn);
												}

												var target = jsonObj.content.content_set_role_privilege;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const contentSetRolePrivilege = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${contentSetRolePrivilege.content_set.name + '-' + contentSetRolePrivilege.content_set_role.name + '-' + contentSetRolePrivilege.content_set_privilege.name}`
															});

															await this.processContentSetRolePrivilege(contentSetRolePrivilege, contentDir, serverDir, context, serverContentSetRolePrivilegesMap);
														}
													});
												} else {
													// process one
													await this.processContentSetRolePrivilege(target, contentDir, serverDir, context, serverContentSetRolePrivilegesMap);
												}
												break;

											case 'content_set_privilege':
												progress.report({
													increment: increment,
													message: `extracting content set privileges`
												});

												var target = jsonObj.content.content_set_privilege;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const contentSetPrivilege = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${contentSetPrivilege.name}`
															});

															await this.processContentSetPrivilege(contentSetPrivilege, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processContentSetPrivilege(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'content_set_role':
												progress.report({
													increment: increment,
													message: `extracting content set roles`
												});

												var target = jsonObj.content.content_set_role;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const contentSetRole = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${contentSetRole.name}`
															});

															await this.processContentSetRole(contentSetRole, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processContentSetRole(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											case 'content_set':
												progress.report({
													increment: increment,
													message: `extracting content sets`
												});

												var target = jsonObj.content.content_set;
												if (Array.isArray(target)) {
													await vscode.window.withProgress({
														location: vscode.ProgressLocation.Notification,
														cancellable: false
													}, async (innerProgress) => {
														innerProgress.report({ increment: 0 });

														const innerIncrement = 100 / target.length;

														// process each
														for (var i = 0; i < target.length; i++) {
															const contentSet = target[i];

															innerProgress.report({
																increment: innerIncrement,
																message: `${i + 1}/${target.length}: ${contentSet.name}`
															});

															await this.processContentSet(contentSet, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
														}
													});
												} else {
													// process one
													await this.processContentSet(target, contentDir, serverDir, fqdn, session, allowSelfSignedCerts, httpTimeout, context);
												}
												break;

											default:
												OutputChannelLogging.log(`${property} not set up for processing in extractContentSetContent`);
											//return reject();
										}
									}

								} catch (err) {
									OutputChannelLogging.logError('extractContentSetContent', err);
								}
							}

							return resolve(jsonObj.content);
						});
					} catch (err) {
						OutputChannelLogging.logError('extractContentSetContent', err);
						return reject();
					}
				}
				else {
					OutputChannelLogging.log('could not parse content set xml');
					return reject();
				}
			});
		});

		return p;
	}

	static processDashboard(dashboard: any, contentDir: string, serverDir: string, fqdn: FqdnSetting, session: string, allowSelfSignedCerts: boolean, httpTimeout: number, context: vscode.ExtensionContext) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(dashboard.name);
				const subDirName = 'Dashboards';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Dashboards',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				dashboard = await TransformDashboard.transformCs(dashboard);
				const contentContent = JSON.stringify(dashboard, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processDashboard`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.post(`https://${fqdn.fqdn}/api/v2/export`, {
						headers: {
							session: session
						},
						json: {
							dashboards: {
								include: [
									dashboard.name
								]
							}
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data.object_list.dashboards[0];

						target = await TransformDashboard.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processDashboard`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processDashboard`, err);
				return reject();
			}
		});

		return p;
	}

	static processDashboardGroup(dashboardGroup: any, contentDir: string, serverDir: string, fqdn: FqdnSetting, session: string, allowSelfSignedCerts: boolean, httpTimeout: number, context: vscode.ExtensionContext) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(dashboardGroup.name);
				const subDirName = 'DashboardGroups';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Dashboard Groups',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				dashboardGroup = await TransformDashboardGroup.transformCs(dashboardGroup);
				const contentContent = JSON.stringify(dashboardGroup, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processDashboardGroup`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.post(`https://${fqdn.fqdn}/api/v2/export`, {
						headers: {
							session: session
						},
						json: {
							dashboard_groups: {
								include: [
									dashboardGroup.name
								]
							}
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data.object_list.dashboard_groups[0];

						target = await TransformDashboardGroup.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processDashboardGroup`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processDashboardGroup`, err);
				return reject();
			}
		});

		return p;
	}

	static processWhiteListedUrl(
		whiteListedUrl: any,
		contentDir: string,
		serverDir: string,
		context: vscode.ExtensionContext,
		serverWhiteListedUrlsMap: any
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(whiteListedUrl.url);
				const subDirName = 'WhiteListedUrls';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'White Listed Urls',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				whiteListedUrl = await TransformWhiteListedUrl.transformCs(whiteListedUrl);
				const contentContent = JSON.stringify(whiteListedUrl, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processWhiteListedUrl`, err);
						return reject();
					}

					// get server data
					var target = serverWhiteListedUrlsMap[whiteListedUrl.url];

					if (target) {
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processWhiteListedUrl`, err);
								return reject();
							}

							return resolve();
						});
					} else {
						// target doesn't exist on server
						return resolve();
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processWhiteListedUrl`, err);
				return reject();
			}
		});

		return p;
	}

	static processSensor(sensor: any, contentDir: string, serverDir: string, fqdn: FqdnSetting, session: string, allowSelfSignedCerts: boolean, httpTimeout: number, context: vscode.ExtensionContext) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(sensor.name);
				const subDirName = 'Sensors';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Sensors',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				sensor = await TransformSensor.transformContentSet(sensor);
				const contentContent = JSON.stringify(sensor, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processSensor`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/sensors/by-name/${sensor.name}`, {
						headers: {
							session: session
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data;

						target = await TransformSensor.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processSensor`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processSensor`, err);
				return reject();
			}
		});

		return p;
	}

	static processSavedQuestion(savedQuestion: any, contentDir: string, serverDir: string, fqdn: FqdnSetting, session: string, allowSelfSignedCerts: boolean, httpTimeout: number, context: vscode.ExtensionContext) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(savedQuestion.name);
				const subDirName = 'SavedQuestions';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Saved Questions',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				savedQuestion = await TransformSavedQuestion.transformCs(savedQuestion);
				const contentContent = JSON.stringify(savedQuestion, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processSavedQuestion`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/saved_questions/by-name/${savedQuestion.name}`, {
						headers: {
							session: session
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data;

						// load up filter sensors
						if (target.question.group) {
							if (target.question.group.filters) {
								for (var i = 0; i < target.question.group.filters.length; i++) {
									const filter = target.question.group.filters[i];

									const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/sensors/by-hash/${filter.sensor.hash}`, {
										headers: {
											session: session
										},
										responseType: 'json',
									}, allowSelfSignedCerts, httpTimeout, true);

									if (body.statusCode) {
										// doesn't exist on server
									} else {
										filter.sensor = body.data;
									}
								}
							}
						}

						// load up source sensors
						if (target.question.selects) {
							for (var i = 0; i < target.question.selects.length; i++) {
								const select = target.question.selects[i];

								if ('source_id' in select.sensor && select.sensor.source_id !== 0) {
									const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/sensors/${select.sensor.source_id}`, {
										headers: {
											session: session
										},
										responseType: 'json'
									}, allowSelfSignedCerts, httpTimeout);

									select['source'] = body.data;
								}
							}
						}

						target = await TransformSavedQuestion.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processSavedQuestion`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processSavedQuestion`, err);
				return resolve();
			}
		});

		return p;
	}

	static processSavedAction(
		savedAction: any,
		contentDir: string,
		serverDir: string,
		fqdn: FqdnSetting,
		session: string,
		allowSelfSignedCerts: boolean,
		httpTimeout: number,
		context: vscode.ExtensionContext
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(savedAction.name);
				const subDirName = 'SavedActions';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Saved Actions',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				savedAction = await TransformSavedAction.transformCs(savedAction);
				const contentContent = JSON.stringify(savedAction, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processSavedAction`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/saved_actions/by-name/${savedAction.name}`, {
						headers: {
							session: session
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data;

						// get target_group
						const groupBody = await RestClient.get(`https://${fqdn.fqdn}/api/v2/groups/${target.target_group.id}`, {
							headers: {
								session: session
							},
							responseType: 'json'
						}, allowSelfSignedCerts, httpTimeout);

						target.target_group = groupBody.data;

						target = await TransformSavedAction.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processSavedAction`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processSavedAction`, err);
				return reject();
			}
		});

		return p;
	}

	static processPackage(
		taniumPackage: any,
		contentDir: string,
		serverDir: string,
		fqdn: FqdnSetting,
		session: string,
		allowSelfSignedCerts: boolean,
		httpTimeout: number,
		context: vscode.ExtensionContext
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(taniumPackage.name);
				const subDirName = 'Packages';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Packages',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				taniumPackage = await TransformPackage.transformCs(taniumPackage);
				const contentContent = JSON.stringify(taniumPackage, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processPackage`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.post(`https://${fqdn.fqdn}/api/v2/export`, {
						headers: {
							session: session
						},
						json: {
							package_specs: {
								include: [
									taniumPackage.name
								]
							}
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data.object_list.package_specs[0];

						target = await TransformPackage.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processPackage`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processPackage for package: ${taniumPackage.name}`, err);
				return reject();
			}
		});

		return p;
	}

	static processContentSetRolePrivilege(
		contentSetRolePrivilege: any,
		contentDir: string,
		serverDir: string,
		context: vscode.ExtensionContext,
		serverContentSetRolePrivilegesMap: any
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const rawName: string = contentSetRolePrivilege.content_set.name + '-' + contentSetRolePrivilege.content_set_role.name + '-' + contentSetRolePrivilege.content_set_privilege.name;
				const name: string = sanitize(rawName);
				const subDirName = 'ContentSetRolePrivileges';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Content Set Role Privileges',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				contentSetRolePrivilege = await TransformContentSetRolePrivilege.transformCs(contentSetRolePrivilege);
				const contentContent = JSON.stringify(contentSetRolePrivilege, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processContentSetRolePrivilege`, err);
						return reject();
					}

					// get server data
					var target = serverContentSetRolePrivilegesMap[rawName];

					if (target) {
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processContentSetRolePrivilege`, err);
								return reject();
							}

							return resolve();
						});
					} else {
						// target doesn't exist on server
						return resolve();
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processContentSetRolePrivilege`, err);
				return reject();
			}
		});

		return p;
	}

	static processContentSetPrivilege(
		contentSetPrivilege: any,
		contentDir: string,
		serverDir: string,
		fqdn: FqdnSetting,
		session: string,
		allowSelfSignedCerts: boolean,
		httpTimeout: number,
		context: vscode.ExtensionContext
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(contentSetPrivilege.name);
				const subDirName = 'ContentSetPrivileges';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Content Set Privileges',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				contentSetPrivilege = await TransformContentSetPrivilege.transformCs(contentSetPrivilege);
				const contentContent = JSON.stringify(contentSetPrivilege, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processContentSetPrivilege`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/content_set_privileges/by-name/${contentSetPrivilege.name}`, {
						headers: {
							session: session
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data;

						target = await TransformContentSetPrivilege.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processContentSetPrivilege`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processContentSetPrivilege`, err);
				return reject();
			}
		});

		return p;
	}

	static processContentSetRole(
		contentSetRole: any,
		contentDir: string,
		serverDir: string,
		fqdn: FqdnSetting,
		session: string,
		allowSelfSignedCerts: boolean,
		httpTimeout: number,
		context: vscode.ExtensionContext
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(contentSetRole.name);
				const subDirName = 'ContentSetRoles';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Content Set Roles',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				contentSetRole = await TransformContentSetRole.transformCs(contentSetRole);
				const contentContent = JSON.stringify(contentSetRole, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processContentSetRole`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/content_set_roles/by-name/${contentSetRole.name}`, {
						headers: {
							session: session
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data;

						target = await TransformContentSetRole.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processContentSetRole`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processContentSetRole`, err);
				return reject();
			}
		});

		return p;
	}

	static processContentSet(
		contentSet: any,
		contentDir: string,
		serverDir: string,
		fqdn: FqdnSetting,
		session: string,
		allowSelfSignedCerts: boolean,
		httpTimeout: number,
		context: vscode.ExtensionContext
	) {
		const p = new Promise<void>(async (resolve, reject) => {
			try {
				const name = sanitize(contentSet.name);
				const subDirName = 'ContentSets';
				const serverSubDir = path.join(serverDir, subDirName);
				const contentSubDir = path.join(contentDir, subDirName);

				// ensure diff data
				TaniumDiffProvider.currentProvider?.addDiffData({
					label: 'Content Sets',
					leftDir: contentSubDir,
					rightDir: serverSubDir,
					commandString: 'hoganslendertanium.analyzeSolutions'
				}, context);

				// verify sub dir
				if (!fs.existsSync(serverSubDir)) {
					fs.mkdirSync(serverSubDir);
				}

				if (!fs.existsSync(contentSubDir)) {
					fs.mkdirSync(contentSubDir);
				}

				contentSet = await TransformContentSet.transformCs(contentSet);
				const contentContent = JSON.stringify(contentSet, null, 2);

				const contentFile = path.join(contentSubDir, `${name}.json`);

				fs.writeFile(contentFile, contentContent, async (err) => {
					if (err) {
						OutputChannelLogging.logError(`error writing ${contentFile} in processContentSet`, err);
						return reject();
					}

					// get server data
					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/content_sets/by-name/${contentSet.name}`, {
						headers: {
							session: session
						},
						responseType: 'json',
					}, allowSelfSignedCerts, httpTimeout, true);

					if (body.statusCode) {
						// looks like it doesn't exist on server
						return resolve();
					} else if (body.data) {
						var target: any = body.data;

						target = await TransformContentSet.transform(target);
						const serverContent = JSON.stringify(target, null, 2);

						const serverFile = path.join(serverSubDir, `${name}.json`);

						fs.writeFile(serverFile, serverContent, err => {
							if (err) {
								OutputChannelLogging.logError(`error writing ${serverFile} in processContentSet`, err);
								return reject();
							}

							return resolve();
						});
					}
				});
			} catch (err) {
				OutputChannelLogging.logError(`error in processContentSet`, err);
				return reject();
			}
		});

		return p;
	}

	public static async processSensors(context: vscode.ExtensionContext) {
		// get the current folder
		const folderPath = vscode.workspace.workspaceFolders![0].uri.fsPath;

		// define output channel
		OutputChannelLogging.initialize();

		// get configurations
		const config = vscode.workspace.getConfiguration('hoganslender.tanium');
		const allowSelfSignedCerts = config.get('allowSelfSignedCerts', false);
		const httpTimeout = config.get('httpTimeoutSeconds', 10) * 1000;

		const state = await collectContentSetSensorInputs(config, context);

		// collect values
		const contentUrl: string = state.contentSetUrl;
		const fqdn: FqdnSetting = state.fqdn;
		const username: string = state.username;
		const password: string = state.password;
		const extractCommentWhitespace: boolean = state.extractCommentWhitespace;

		const restBase = `https://${fqdn.fqdn}/api/v2`;

		OutputChannelLogging.showClear();

		OutputChannelLogging.log(`contentSet: ${contentUrl}`);
		OutputChannelLogging.log(`commentWhitespace: ${extractCommentWhitespace.toString()}`);
		OutputChannelLogging.log(`fqdn: ${fqdn.label}`);
		OutputChannelLogging.log(`username: ${username}`);
		OutputChannelLogging.log(`password: XXXXXXXX`);

        // validate credentials
        if (await this.invalidCredentials(allowSelfSignedCerts, httpTimeout, [
            {
                fqdn: fqdn,
                username: username,
                password: password
            }
        ])) {
            return;
        }

		// get filename from url
		const parsed = new URL(contentUrl);
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
			const serverDir = path.join(folderPath!, `2 - ${sanitize(fqdn.label)}`);
			const commentDir = path.join(folderPath!, 'Comments Only');
			const commentContentDir = path.join(commentDir, `1 - ${contentFilename.replace('.xml', '')}`);
			const commentServerDir = path.join(commentDir, `2 - ${sanitize(fqdn.label)}`);

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
				progress.report({ increment: increment, message: `downloading ${contentUrl}` });
				await RestClient.downloadFile(contentUrl, contentSetFile, {}, allowSelfSignedCerts, httpTimeout);
				progress.report({ increment: increment, message: 'extracting sensors' });
				await this.extractContentSetSensors(contentSetFile, contentDir, sensorInfo);
				progress.report({ increment: increment, message: `retrieving sensors from ${fqdn.label}` });
				await this.retrieveServerSensors(sensorInfo, allowSelfSignedCerts, httpTimeout, username, password, serverDir, fqdn);
				progress.report({ increment: increment, message: 'Extracting sensors with comments/whitspaces changes only' });
				await this.extractCommentWhitespaceSensors(contentDir, serverDir, commentContentDir, commentServerDir);
				const p = new Promise<void>(resolve => {
					setTimeout(() => {
						resolve();
					}, 3000);
				});
			} else {
				progress.report({ increment: increment, message: `downloading ${contentUrl}` });
				await RestClient.downloadFile(contentUrl, contentSetFile, {}, allowSelfSignedCerts, httpTimeout);
				progress.report({ increment: increment, message: 'extracting sensors' });
				await this.extractContentSetSensors(contentSetFile, contentDir, sensorInfo);
				progress.report({ increment: increment, message: `retrieving sensors from ${fqdn.fqdn}` });
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

	static retrieveServerSensors(sensorInfos: any[], allowSelfSignedCerts: boolean, httpTimeout: number, username: string, password: string, serverDir: string, fqdn: FqdnSetting) {
		const p = new Promise<void>(async resolve => {
			// get session
			var session: string = await Session.getSession(allowSelfSignedCerts, httpTimeout, fqdn, username, password);

			const sensorTotal = sensorInfos.length;

			var sensorCounter = 0;

			for (var i = 0; i < sensorInfos.length; i++) {
				const sensorInfo = sensorInfos[i];

				try {
					const hash = sensorInfo.hash;
					const options = {
						headers: {
							session: session,
						},
						responseType: 'json',
					};

					const body = await RestClient.get(`https://${fqdn.fqdn}/api/v2/sensors/by-hash/${hash}`, options, allowSelfSignedCerts, httpTimeout);

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
						OutputChannelLogging.logError(`error retrieving ${sensorInfo.name} from ${fqdn.label}`, err);
					}

					sensorCounter++;

					if (sensorTotal === sensorCounter) {
						resolve();
					}
				}
			}
		});

		return p;
	}

	static extractContentSetSensors(contentSetFile: string, contentDir: string, sensorInfo: any[]) {
		const p = new Promise<void>(resolve => {
			fs.readFile(contentSetFile, 'utf8', function (err, data) {
				if (err) {
					OutputChannelLogging.logError(`could not open '${contentSetFile}'`, err);
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
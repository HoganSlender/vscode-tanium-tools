import * as vscode from 'vscode';
import * as commands from './common/commands';
import { OutputChannelLogging } from './logging';
import { exec } from 'child_process';
import { collectInputs, MyButton, Step, StepType } from './multi-step-input';


export function activate(context: vscode.ExtensionContext) {
    commands.register(context, {
        'hoganslendertanium.signContentFile': (uri: vscode.Uri) => {
            SignContentFile.signContentFile(uri, context);
        },
    });
}

class SignContentFile {
    public static async signContentFile(target: vscode.Uri, context: vscode.ExtensionContext) {
        // define output channel
        OutputChannelLogging.initialize();

        // get configurations
        const config = vscode.workspace.getConfiguration('hoganslender.tanium');

        // get items
        const items = config.get<any>('signingPaths', []);

        const addButton = new MyButton({
            dark: vscode.Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
            light: vscode.Uri.file(context.asAbsolutePath('resources/light/add.svg')),
        }, '');

        const fileButton = new MyButton({
            dark: vscode.Uri.file(context.asAbsolutePath('resources/dark/dotdotdot.svg')),
            light: vscode.Uri.file(context.asAbsolutePath('resources/light/dotdotdot.svg')),
        }, '');

        interface SigningContentFileState {
            title: string;
            step: number;
            totalSteps: number;
            serverLabel: vscode.QuickPickItem | string;
            keyUtilityPath: string;
            privateKeyPath: string;
            selectedItem: any;
        }

        // define steps
        const steps: Step[] = [
            {
                stepType: StepType.quickPick,
                step: 1,
                totalSteps: 1,
                quickPickItems: items.map((item: any) => ({ label: item.serverLabel })),
                quickPickButtons: [
                    addButton
                ],
                fileDialogButtons: [],
                buttonTooltip: 'Add New Server Label',
                quickPickPlaceholder: 'Please choose the Server Label or click + upper right to add new',
                activeItemPropertyName: 'serverLabel',
                inputPrompt: '',
            },
            {
                stepType: StepType.quickPick,
                step: 1,
                totalSteps: 3,
                quickPickItems: [],
                quickPickButtons: [],
                fileDialogButtons: [],
                buttonTooltip: '',
                quickPickPlaceholder: '',
                activeItemPropertyName: 'serverLabel',
                inputPrompt: 'Please enter the source Tanium server fqdn',
            },
            {
                stepType: StepType.fileDialog,
                step: 2,
                totalSteps: 3,
                quickPickItems: [],
                quickPickButtons: [],
                fileDialogButtons: [fileButton],
                buttonTooltip: 'Select KeyUtility.exe path',
                quickPickPlaceholder: 'Please choose the path to KeyUtility.exe by clicking ... upper right',
                activeItemPropertyName: 'keyUtilityPath',
                inputPrompt: '',
            },
            {
                stepType: StepType.fileDialog,
                step: 3,
                totalSteps: 3,
                quickPickItems: [],
                quickPickButtons: [],
                fileDialogButtons: [fileButton],
                buttonTooltip: 'Select private key path',
                quickPickPlaceholder: 'Please choose the path to private key by clicking ... upper right',
                activeItemPropertyName: 'privateKeyPath',
                inputPrompt: '',
            }
        ];

        //const state = await collectSignContentFileInputs(config, context);
        const state = {} as Partial<SigningContentFileState>;
        await collectInputs('Sign Content File', state, steps);

        if (typeof state.serverLabel === 'string') {
            // check for undefined values
            if (state.keyUtilityPath === undefined || state.privateKeyPath === undefined) {
                state.selectedItem = undefined;
            } else {
                state.selectedItem = {
                    serverLabel: state.serverLabel,
                    keyUtilityPath: state.keyUtilityPath,
                    privateKeyFilePath: state.privateKeyPath
                };

                if (items.find((item: any) => item.serverLabel === state.serverLabel) === undefined) {
                    items.push(state.selectedItem);
                    config.update('signingPaths', items, vscode.ConfigurationTarget.Global);
                }
            }
        } else {
            var label = state.serverLabel!.label;
            state.selectedItem = items.find((item: any) => label === item.serverLabel);
        }

        if (state.selectedItem === undefined) {
            // something was cancelled, exit
            return;
        }

        // collect values
        const keyUtilityPath = state.selectedItem.keyUtilityPath.includes(' ') ? `"${state.selectedItem.keyUtilityPath}"` : state.selectedItem.keyUtilityPath;
        const privateKeyFilePath = state.selectedItem.privateKeyFilePath.includes(' ') ? `"${state.selectedItem.privateKeyFilePath}"` : state.selectedItem.privateKeyFilePath;
        const targetPath = target.fsPath.includes(' ') ? `"${target.fsPath}"` : target.fsPath;

        OutputChannelLogging.showClear();

        OutputChannelLogging.log(`Key utility path: ${keyUtilityPath}`);
        OutputChannelLogging.log(`private key file path: ${privateKeyFilePath}`);
        OutputChannelLogging.log(`file to sign: ${targetPath}`);

        const commandline = `${keyUtilityPath} signcontent ${privateKeyFilePath} ${targetPath}`;

        OutputChannelLogging.log(`executing - ${commandline}`);

        exec(commandline, (error, stdout, stderr) => {
            if (error) {
                OutputChannelLogging.logError(`error executing command`, error);
            }

            if (stderr) {
                OutputChannelLogging.log(`error executing command - ${stderr}`);
            }

            OutputChannelLogging.log(`commmand output: ${stdout}`);
        });
    }
}
import { collectInputs, MyButton, Step, StepType } from "../multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

interface SigningContentFileState {
    serverLabel: QuickPickItem | string;
    keyUtilityPath: string;
    privateKeyPath: string;
    selectedItem: any;
}

export async function collectSignContentFileInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    const addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    const fileButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/dotdotdot.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/dotdotdot.svg')),
    }, '');

    // get items
    const items = config.get<any>('signingPaths', []);

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
            buttonTooltip: 'Add New Server Label',
            quickPickPlaceholder: 'Please choose the Server Label or click + upper right to add new',
            activeItemPropertyName: 'serverLabel',
        },
        {
            stepType: StepType.inputBox,
            step: 1,
            totalSteps: 3,
            activeItemPropertyName: 'serverLabel',
            inputPrompt: 'Please enter the source Tanium server fqdn',
        },
        {
            stepType: StepType.fileDialog,
            step: 2,
            totalSteps: 3,
            fileDialogButtons: [fileButton],
            buttonTooltip: 'Select KeyUtility.exe path',
            quickPickPlaceholder: 'Please choose the path to KeyUtility.exe by clicking ... upper right',
            activeItemPropertyName: 'keyUtilityPath',
        },
        {
            stepType: StepType.fileDialog,
            step: 3,
            totalSteps: 3,
            fileDialogButtons: [fileButton],
            buttonTooltip: 'Select private key path',
            quickPickPlaceholder: 'Please choose the path to private key by clicking ... upper right',
            activeItemPropertyName: 'privateKeyPath',
        }
    ];

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
                config.update('signingPaths', items, ConfigurationTarget.Global);
            }
        }
    } else {
        var label = state.serverLabel!.label;
        state.selectedItem = items.find((item: any) => label === item.serverLabel);
    }

    // store data
    return state as SigningContentFileState;
}

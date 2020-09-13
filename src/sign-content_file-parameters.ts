import { MultiStepInput, MyButton } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

const title = 'Sign Content File';

var serverLabelQuickPickItems: QuickPickItem[];

var addButton: MyButton;

interface SigningContentFileState {
    title: string;
    step: number;
    totalSteps: number;
    serverLabel: QuickPickItem | string;
    keyUtilityPath: string;
    privateKeyPath: string;
    selectedItem: any;
}

export async function collectSignContentFileInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get items
    const items = config.get<any>('signingPaths', []);
    serverLabelQuickPickItems = items.map((item: any) => ({ label: item.serverLabel }));

    const state = {} as Partial<SigningContentFileState>;
    await MultiStepInput.run(input => pickServerLabel(input, state));

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

async function pickServerLabel(input: MultiStepInput, state: Partial<SigningContentFileState>) {
    if (serverLabelQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputServerLabel(input, state, 0);
    } else {
        addButton.tooltip = 'Add New Server Label';
        const pick = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 1,
            placeholder: 'Please choose the Server Label or click + upper right to add new',
            items: serverLabelQuickPickItems,
            activeItem: typeof state.serverLabel !== 'string' ? state.serverLabel : undefined,
            buttons: [addButton],
            shouldResume: shouldResume
        });
        if (pick instanceof MyButton) {
            return (input: MultiStepInput) => inputServerLabel(input, state, 1);
        }
        state.serverLabel = pick;
    }
}

async function inputServerLabel(input: MultiStepInput, state: Partial<SigningContentFileState>, stepModifier: number) {
    state.serverLabel = await input.showInputBox({
        title,
        step: 1 + stepModifier,
        totalSteps: 3 + stepModifier,
        value: typeof state.serverLabel === 'string' ? state.serverLabel : '',
        prompt: 'Please enter the source Tanium server fqdn',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickKeyUtilityPath(input, state, stepModifier);
}

async function pickKeyUtilityPath(input: MultiStepInput, state: Partial<SigningContentFileState>, stepModifier: number) {
    state.keyUtilityPath = await input.showFileDialog({
        title,
        step: 2 + stepModifier,
        totalSteps: 3 + stepModifier,
        placeholder: 'Please choose the path to KeyUtility.exe by clicking + upper right',
        activeItem: typeof state.serverLabel !== 'string' ? state.serverLabel : undefined,
        buttons: [addButton],
        openFileDialogOptions: {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
        },
        shouldResume: shouldResume
    });
    if (state.keyUtilityPath !== undefined) {
        return (input: MultiStepInput) => pickPrivateKeyPath(input, state, stepModifier);
    }
}

async function pickPrivateKeyPath(input: MultiStepInput, state: Partial<SigningContentFileState>, stepModifier: number) {
    state.privateKeyPath = await input.showFileDialog({
        title,
        step: 3 + stepModifier,
        totalSteps: 3 + stepModifier,
        placeholder: 'Please choose the path to private key by clicking + upper right',
        activeItem: typeof state.serverLabel !== 'string' ? state.serverLabel : undefined,
        buttons: [addButton],
        openFileDialogOptions: {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
        },
        shouldResume: shouldResume
    });
}

function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {
        // noop
    });
}

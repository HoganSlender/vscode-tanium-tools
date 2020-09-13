import { MultiStepInput, MyButton } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

const title = 'Create Export File';

var fqdnQuickPickItems: QuickPickItem[];
var usernameQuickPickItems: QuickPickItem[];

var addButton: MyButton;

interface ServerServerMissingSensorState {
    title: string;
    step: number;
    totalSteps: number;
    leftFqdn: QuickPickItem | string;
    leftUsername: QuickPickItem | string;
    leftPassword: string;
    leftFqdnString: string;
    leftUsernameString: string;
}

export async function collectServerServerMissingSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get fqdns
    const fqdns: string[] = config.get('fqdns', []);
    fqdnQuickPickItems = fqdns.map(label => ({ label }));

    // get usernames
    const usernames: string[] = config.get('usernames', []);
    usernameQuickPickItems = usernames.map(label => ({ label }));

    const state = {} as Partial<ServerServerMissingSensorState>;
    await MultiStepInput.run(input => pickLeftFqdn(input, state));

    if (typeof state.leftFqdn === 'string') {
        if (fqdns.indexOf(state.leftFqdn) === -1) {
            fqdns.push(state.leftFqdn);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
        }
        state.leftFqdnString = state.leftFqdn;
    } else {
        state.leftFqdnString = state.leftFqdn!.label;
    }

    if (typeof state.leftUsername === 'string') {
        if (usernames.indexOf(state.leftUsername) === -1) {
            usernames.push(state.leftUsername);
            config.update('usernames', usernames, ConfigurationTarget.Global);
        }
        state.leftUsernameString = state.leftUsername;
    } else {
        state.leftUsernameString = state.leftUsername!.label;
    }

    // store data
    return state as ServerServerMissingSensorState;
}

async function pickLeftFqdn(input: MultiStepInput, state: Partial<ServerServerMissingSensorState>) {
    if (fqdnQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputLeftFqdn(input, state, 0);
    } else {
        addButton.tooltip = 'Add New FQDN';
        const pick = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 3,
            placeholder: 'Please choose the source Tanium server fqdn or click + upper right to add new',
            items: fqdnQuickPickItems,
            activeItem: typeof state.leftFqdn !== 'string' ? state.leftFqdn : undefined,
            buttons: [addButton],
            shouldResume: shouldResume
        });
        if (pick instanceof MyButton) {
            return (input: MultiStepInput) => inputLeftFqdn(input, state, 1);
        }
        state.leftFqdn = pick;
        return (input: MultiStepInput) => pickLeftUsername(input, state, 1);
    }
}

async function inputLeftFqdn(input: MultiStepInput, state: Partial<ServerServerMissingSensorState>, stepModifier: number) {
    state.leftFqdn = await input.showInputBox({
        title,
        step: 1 + stepModifier,
        totalSteps: 3 + stepModifier,
        value: typeof state.leftFqdn === 'string' ? state.leftFqdn : '',
        prompt: 'Please enter the source Tanium server fqdn',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickLeftUsername(input, state, stepModifier);
}

async function pickLeftUsername(input: MultiStepInput, state: Partial<ServerServerMissingSensorState>, stepModifier: number) {
    if (usernameQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputLeftUsername(input, state, stepModifier);
    } else {
        addButton.tooltip = 'Add New Username';
        const pick = await input.showQuickPick({
            title,
            step: 2 + stepModifier,
            totalSteps: 3 + stepModifier,
            placeholder: 'Please choose the source Tanium server username or click + upper right to add new',
            items: usernameQuickPickItems,
            activeItem: typeof state.leftUsername !== 'string' ? state.leftUsername : undefined,
            buttons: [addButton],
            shouldResume: shouldResume
        });
        if (pick instanceof MyButton) {
            return (input: MultiStepInput) => inputLeftUsername(input, state, stepModifier + 1);
        }
        state.leftUsername = pick;
        return (input: MultiStepInput) => inputLeftPassword(input, state, stepModifier);
    }
}

async function inputLeftUsername(input: MultiStepInput, state: Partial<ServerServerMissingSensorState>, stepModifier: number) {
    state.leftUsername = await input.showInputBox({
        title,
        step: 2 + stepModifier,
        totalSteps: 3 + stepModifier,
        value: typeof state.leftUsername === 'string' ? state.leftUsername : '',
        prompt: 'Please enter the source Tanium server username',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => inputLeftPassword(input, state, stepModifier);
}

async function inputLeftPassword(input: MultiStepInput, state: Partial<ServerServerMissingSensorState>, stepModifier: number) {
    state.leftPassword = await input.showInputBox({
        title,
        step: 3 + stepModifier,
        totalSteps: 3 + stepModifier,
        value: typeof state.leftPassword === 'string' ? state.leftPassword : '',
        prompt: 'Please enter the source Tanium server password',
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

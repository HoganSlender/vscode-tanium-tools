import { MultiStepInput, MyButton } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

const title = 'Compare Content Set';

const commentWhitespaceItems: QuickPickItem[] = ['Yes', 'No'].map(label => ({ label }));
var fqdnQuickPickItems: QuickPickItem[];
var usernameQuickPickItems: QuickPickItem[];
var lastUsedUrl: string;

var addButton: MyButton;

interface ServerServerSensorState {
    title: string;
    step: number;
    totalSteps: number;
    leftFqdn: QuickPickItem | string;
    leftUsername: QuickPickItem | string;
    leftPassword: string;
    rightFqdn: QuickPickItem | string;
    rightUsername: QuickPickItem | string;
    rightPassword: string;
    leftFqdnString: string;
    leftUsernameString: string;
    rightFqdnString: string;
    rightUsernameString: string;
    extractCommentWhitespace: boolean;
}

export async function collectServerServerSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
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

    const state = {} as Partial<ServerServerSensorState>;
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

    if (typeof state.rightFqdn === 'string') {
        if (fqdns.indexOf(state.rightFqdn) === -1) {
            fqdns.push(state.rightFqdn);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
        }
        state.rightFqdnString = state.rightFqdn;
    } else {
        state.rightFqdnString = state.rightFqdn!.label;
    }

    if (typeof state.rightUsername === 'string') {
        if (usernames.indexOf(state.rightUsername) === -1) {
            usernames.push(state.rightUsername);
            config.update('usernames', usernames, ConfigurationTarget.Global);
            }
        state.rightUsernameString = state.rightUsername;
    } else {
        state.rightUsernameString = state.rightUsername!.label;
    }

    // store data
    return state as ServerServerSensorState;
}

async function pickLeftFqdn(input: MultiStepInput, state: Partial<ServerServerSensorState>) {
    if (fqdnQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputLeftFqdn(input, state, 0);
    } else {
        addButton.tooltip = 'Add New FQDN';
        const pick = await input.showQuickPick({
            title,
            step: 1,
            totalSteps: 7,
            placeholder: 'Please choose the source Tanium server fqdn',
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

async function inputLeftFqdn(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    state.leftFqdn = await input.showInputBox({
        title,
        step: 1 + stepModifier,
        totalSteps: 7 + stepModifier,
        value: typeof state.leftFqdn === 'string' ? state.leftFqdn : '',
        prompt: 'Please enter the source Tanium server fqdn',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickLeftUsername(input, state, stepModifier);
}

async function pickLeftUsername(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    if (usernameQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputLeftUsername(input, state, stepModifier);
    } else {
        addButton.tooltip = 'Add New Username';
        const pick = await input.showQuickPick({
            title,
            step: 2 + stepModifier,
            totalSteps: 7 + stepModifier,
            placeholder: 'Please choose the source Tanium server username',
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

async function inputLeftUsername(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    state.leftUsername = await input.showInputBox({
        title,
        step: 2 + stepModifier,
        totalSteps: 7 + stepModifier,
        value: typeof state.leftUsername === 'string' ? state.leftUsername : '',
        prompt: 'Please enter the source Tanium server username',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => inputLeftPassword(input, state, stepModifier);
}

async function inputLeftPassword(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    state.leftPassword = await input.showInputBox({
        title,
        step: 3 + stepModifier,
        totalSteps: 7 + stepModifier,
        value: typeof state.leftPassword === 'string' ? state.leftPassword : '',
        prompt: 'Please enter the source Tanium server password',
        password: true,
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickRightFqdn(input, state, stepModifier);
}

async function pickRightFqdn(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    if (fqdnQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputRightFqdn(input, state, 0);
    } else {
        addButton.tooltip = 'Add New FQDN';
        const pick = await input.showQuickPick({
            title,
            step: 4,
            totalSteps: 7,
            placeholder: 'Please choose the dest Tanium server fqdn',
            items: fqdnQuickPickItems,
            activeItem: typeof state.leftFqdn !== 'string' ? state.leftFqdn : undefined,
            buttons: [addButton],
            shouldResume: shouldResume
        });
        if (pick instanceof MyButton) {
            return (input: MultiStepInput) => inputRightFqdn(input, state, stepModifier + 1);
        }
        state.rightFqdn = pick;
        return (input: MultiStepInput) => pickRightUsername(input, state, stepModifier);
    }
}

async function inputRightFqdn(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    state.rightFqdn = await input.showInputBox({
        title,
        step: 4 + stepModifier,
        totalSteps: 7 + stepModifier,
        value: typeof state.leftFqdn === 'string' ? state.leftFqdn : '',
        prompt: 'Please enter the source Tanium server fqdn',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickRightUsername(input, state, stepModifier);
}

async function pickRightUsername(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    if (usernameQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputRightUsername(input, state, stepModifier);
    } else {
        addButton.tooltip = 'Add New Username';
        const pick = await input.showQuickPick({
            title,
            step: 5 + stepModifier,
            totalSteps: 7 + stepModifier,
            placeholder: 'Please choose the source Tanium server username',
            items: usernameQuickPickItems,
            activeItem: typeof state.leftUsername !== 'string' ? state.leftUsername : undefined,
            buttons: [addButton],
            shouldResume: shouldResume
        });
        if (pick instanceof MyButton) {
            return (input: MultiStepInput) => inputRightUsername(input, state, stepModifier + 1);
        }
        state.rightUsername = pick;
        return (input: MultiStepInput) => inputRightPassword(input, state, stepModifier);
    }
}

async function inputRightUsername(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    state.rightUsername = await input.showInputBox({
        title,
        step: 5 + stepModifier,
        totalSteps: 7 + stepModifier,
        value: typeof state.leftUsername === 'string' ? state.leftUsername : '',
        prompt: 'Please enter the source Tanium server username',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => inputRightPassword(input, state, stepModifier);
}

async function inputRightPassword(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    state.rightPassword = await input.showInputBox({
        title,
        step: 6 + stepModifier,
        totalSteps: 7 + stepModifier,
        value: typeof state.rightPassword === 'string' ? state.rightPassword : '',
        prompt: 'Please enter the dest Tanium server password',
        password: true,
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickCommentWhitespace(input, state, stepModifier);
}

async function pickCommentWhitespace(input: MultiStepInput, state: Partial<ServerServerSensorState>, stepModifier: number) {
    const pick = await input.showQuickPick({
        title,
        step: 7 + stepModifier,
        totalSteps: 7 + stepModifier,
        placeholder: 'Extract/group sensors with only comment and whitespace differences?',
        items: commentWhitespaceItems,
        //activeItem: state.extractCommentWhitespace,
        shouldResume: shouldResume
    });
    state.extractCommentWhitespace = pick.label === 'Yes' ? true : false;
}

function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {
        // noop
    });
}

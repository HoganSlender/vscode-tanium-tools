import { MultiStepInput, MyButton } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

const title = 'Compare Content Set';

const commentWhitespaceItems: QuickPickItem[] = ['Yes', 'No'].map(label => ({ label }));
var fqdnQuickPickItems: QuickPickItem[];
var usernameQuickPickItems: QuickPickItem[];
var lastUsedUrl: string;

var addButton: MyButton;

interface ContentSetSensorState {
	title: string;
	step: number;
	totalSteps: number;
	contentSetUrl: string;
	fqdn: QuickPickItem | string;
	username: QuickPickItem | string;
	password: string;
	fqdnString: string;
    usernameString: string;
    extractCommentWhitespace: boolean;
}

export async function collectContentSetSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get last url
    var retval = context.globalState.get<string>('hoganslender.tanium.contentset.url');
    lastUsedUrl = retval === undefined ? '' : retval;

    // get fqdns
    const fqdns: string[] = config.get('fqdns', []);
    fqdnQuickPickItems = fqdns.map(label => ({ label }));

    // get usernames
    const usernames: string[] = config.get('usernames', []);
    usernameQuickPickItems = usernames.map(label => ({ label }));

    const state = {} as Partial<ContentSetSensorState>;
    await MultiStepInput.run(input => inputContentSetUrl(input, state));

    context.globalState.update('hoganslender.tanium.contentset.url', state.contentSetUrl);

    if (typeof state.fqdn === 'string') {
        fqdns.push(state.fqdn);
        config.update('fqdns', fqdns, ConfigurationTarget.Global);
        state.fqdnString = state.fqdn;
    } else {
        state.fqdnString = state.fqdn!.label;
    }

    if (typeof state.username === 'string') {
        usernames.push(state.username);
        config.update('usernames', usernames, ConfigurationTarget.Global);
        state.usernameString = state.username;
    } else {
        state.usernameString = state.username!.label;
    }

    // store data
    return state as ContentSetSensorState;
}

async function inputContentSetUrl(input: MultiStepInput, state: Partial<ContentSetSensorState>) {
    state.contentSetUrl = await input.showInputBox({
        title,
        step: 1,
        totalSteps: 5,
        value: lastUsedUrl,
        prompt: 'Please enter the url for the content set.',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickCommentWhitespace(input, state);
}

async function pickCommentWhitespace(input: MultiStepInput, state: Partial<ContentSetSensorState>) {
        const pick = await input.showQuickPick({
            title,
            step: 2,
            totalSteps: 5,
            placeholder: 'Extract/group sensors with only comment and whitespace differences?',
            items: commentWhitespaceItems,
            //activeItem: state.extractCommentWhitespace,
            shouldResume: shouldResume
        });
        state.extractCommentWhitespace = pick.label === 'Yes' ? true : false;
        return (input: MultiStepInput) => pickFqdn(input, state);
}

async function pickFqdn(input: MultiStepInput, state: Partial<ContentSetSensorState>) {
    if (fqdnQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputFqdn(input, state, 0);
    } else {
        addButton.tooltip = 'Add New FQDN';
        const pick = await input.showQuickPick({
            title,
            step: 3,
            totalSteps: 5,
            placeholder: 'Please choose the Tanium server fqdn or click + upper right to add new',
            items: fqdnQuickPickItems,
            activeItem: typeof state.fqdn !== 'string' ? state.fqdn : undefined,
            buttons: [addButton],
            shouldResume: shouldResume
        });
        if (pick instanceof MyButton) {
            return (input: MultiStepInput) => inputFqdn(input, state, 1);
        }
        state.fqdn = pick;
        return (input: MultiStepInput) => pickUsername(input, state, 1);
    }
}

async function inputFqdn(input: MultiStepInput, state: Partial<ContentSetSensorState>, stepModifier: number) {
    state.fqdn = await input.showInputBox({
        title,
        step: 3 + stepModifier,
        totalSteps: 5 + stepModifier,
        value: typeof state.fqdn === 'string' ? state.fqdn : '',
        prompt: 'Please enter the Tanium server fqdn',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => pickUsername(input, state, stepModifier);
}

async function pickUsername(input: MultiStepInput, state: Partial<ContentSetSensorState>, stepModifier: number) {
    if (usernameQuickPickItems.length === 0) {
        return (input: MultiStepInput) => inputUsername(input, state, stepModifier);
    } else {
        addButton.tooltip = 'Add New Username';
        const pick = await input.showQuickPick({
            title,
            step: 4 + stepModifier,
            totalSteps: 5 + stepModifier,
            placeholder: 'Please choose the Tanium server username or click + upper right to add new',
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

async function inputUsername(input: MultiStepInput, state: Partial<ContentSetSensorState>, stepModifier: number) {
    state.username = await input.showInputBox({
        title,
        step: 4 + stepModifier,
        totalSteps: 5 + stepModifier,
        value: typeof state.username === 'string' ? state.username : '',
        prompt: 'Please enter the Tanium server username',
        shouldResume: shouldResume
    });
    return (input: MultiStepInput) => inputPassword(input, state, stepModifier);
}

async function inputPassword(input: MultiStepInput, state: Partial<ContentSetSensorState>, stepModifier: number) {
    state.password = await input.showInputBox({
        title,
        step: 5 + stepModifier,
        totalSteps: 5 + stepModifier,
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
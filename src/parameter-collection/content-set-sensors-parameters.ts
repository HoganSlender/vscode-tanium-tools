import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

interface ContentSetSensorState {
    contentSetUrl: string;
    fqdn: QuickPickItem | string;
    username: QuickPickItem | string;
    password: string;
    fqdnString: string;
    usernameString: string;
    extractCommentWhitespace: boolean;
}

export async function collectContentSetSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    const addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get last url
    var retval = context.globalState.get<string>('hoganslender.tanium.contentset.url');
    const lastUsedUrl = retval === undefined ? '' : retval;

    // get fqdns
    const fqdns: string[] = config.get('fqdns', []);

    // get usernames
    const usernames: string[] = config.get('usernames', []);

    // define steps
    const steps: Step[] = [
        {
            stepType: StepType.inputBox,
            step: 1,
            totalSteps: 5,
            activeItemPropertyName: 'contentSetUrl',
            inputPrompt: 'Please enter the url for the content set.',
        },
        {
            stepType: StepType.quickPick,
            step: 2,
            totalSteps: 5,
            quickPickItems: ['Yes', 'No'].map(label => ({ label })),
            quickPickPlaceholder: 'Extract/group sensors with only comment and whitespace differences?',
            activeItemPropertyName: 'extractCommentWhitespace',
        },
        {
            stepType: StepType.quickPick,
            step: 3,
            totalSteps: 5,
            quickPickItems: fqdns.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New FQDN',
            quickPickPlaceholder: 'Please choose the Tanium server fqdn or click + upper right to add new',
            activeItemPropertyName: 'fqdn',
        },
        {
            stepType: StepType.quickPick,
            step: 4,
            totalSteps: 5,
            quickPickItems: usernames.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New Username',
            quickPickPlaceholder: 'Please choose the Tanium server username or click + upper right to add new',
            activeItemPropertyName: 'username',
        },
        {
            stepType: StepType.inputBox,
            step: 5,
            totalSteps: 5,
            activeItemPropertyName: 'password',
            inputPrompt: 'Please enter the Tanium server password',
            password: true
        },
    ];

    const state = {} as Partial<ContentSetSensorState>;
    state.contentSetUrl = lastUsedUrl;
    await collectInputs('Compare Content Set', state, steps);

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

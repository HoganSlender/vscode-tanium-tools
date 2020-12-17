import { ConfigurationTarget, ExtensionContext, QuickPickItem, Uri, WorkspaceConfiguration } from "vscode";

import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";

interface ContentSetContentState {
    fqdnQp: QuickPickItem | string;
    usernameQp: QuickPickItem | string;
    password: string;
    fqdn: string;
    username: string;
}

export async function collectContentSetContentInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    const addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get fqdns
    const fqdns: string[] = config.get('fqdns', []);

    // get usernames
    const usernames: string[] = config.get('usernames', []);

    // define steps
    const steps: Step[] = [
        {
            stepType: StepType.quickPick,
            step: 1,
            totalSteps: 3,
            quickPickItems: fqdns.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New FQDN',
            quickPickPlaceholder: 'Please choose the Tanium server fqdn or click + upper right to add new',
            inputPrompt: 'Please enter the Tanium server fqdn',
            activeItemPropertyName: 'fqdnQp',
        },
        {
            stepType: StepType.quickPick,
            step: 2,
            totalSteps: 3,
            quickPickItems: usernames.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New Username',
            quickPickPlaceholder: 'Please choose the Tanium server username or click + upper right to add new',
            inputPrompt: 'Please enter the Tanium server username',
            activeItemPropertyName: 'usernameQp',
        },
        {
            stepType: StepType.inputBox,
            step: 3,
            totalSteps: 3,
            activeItemPropertyName: 'password',
            inputPrompt: 'Please enter the Tanium server password',
            password: true
        },
    ];

    const state = {} as Partial<ContentSetContentState>;
    await collectInputs('Compare Content Set to Tanium Server', state, steps);

    if (typeof state.fqdnQp === 'string') {
        fqdns.push(state.fqdnQp);
        config.update('fqdns', fqdns, ConfigurationTarget.Global);
        state.fqdn = state.fqdnQp;
    } else {
        state.fqdn = state.fqdnQp!.label;
    }

    if (typeof state.usernameQp === 'string') {
        usernames.push(state.usernameQp);
        config.update('usernames', usernames, ConfigurationTarget.Global);
        state.username = state.usernameQp;
    } else {
        state.username = state.usernameQp!.label;
    }

    // store data
    return state as ContentSetContentState;
}

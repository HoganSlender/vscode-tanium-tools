import { ConfigurationTarget, ExtensionContext, QuickPickItem, Uri, WorkspaceConfiguration } from "vscode";

import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";

interface ContentSetContentState {
    usernameQp: QuickPickItem | string;
    password: string;
    username: string;
}

export async function collectContentSetContentInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    const addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get usernames
    const usernames: string[] = config.get('usernames', []);

    // define steps
    const steps: Step[] = [
        {
            stepType: StepType.quickPick,
            step: 1,
            totalSteps: 2,
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
            step: 2,
            totalSteps: 2,
            activeItemPropertyName: 'password',
            inputPrompt: 'Please enter the Tanium server password',
            password: true
        },
    ];

    const state = {} as Partial<ContentSetContentState>;
    await collectInputs('Compare Content Set to Tanium Server', state, steps);

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

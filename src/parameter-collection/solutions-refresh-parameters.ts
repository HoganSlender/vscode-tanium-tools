import { ConfigurationTarget, ExtensionContext, QuickPickItem, Uri, WorkspaceConfiguration } from "vscode";
import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";

interface SolutionsRefreshState {
    leftUsernameQp: QuickPickItem | string;
    leftPassword: string;
    leftUsername: string;
}

export async function collectSolutionsRefreshInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
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
            quickPickPlaceholder: 'Please choose the source Tanium server username or click + upper right to add new',
            activeItemPropertyName: 'leftUsernameQp',
            inputPrompt: 'Please enter the source Tanium server username',
        },
        {
            stepType: StepType.inputBox,
            step: 2,
            totalSteps: 2,
            activeItemPropertyName: 'leftPassword',
            inputPrompt: 'Please enter the source Tanium server password',
            password: true
        }
    ];

    const state = {} as Partial<SolutionsRefreshState>;
    await collectInputs('Retrieve Solutions', state, steps);

    if (typeof state.leftUsernameQp === 'string') {
        if (usernames.indexOf(state.leftUsernameQp) === -1) {
            usernames.push(state.leftUsernameQp);
            config.update('usernames', usernames, ConfigurationTarget.Global);
            }
        state.leftUsername = state.leftUsernameQp;
    } else {
        state.leftUsername = state.leftUsernameQp!.label;
    }

    // store data
    return state as SolutionsRefreshState;
}

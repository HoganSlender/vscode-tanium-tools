import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

interface ServerServerSensorState {
    leftFqdnQp: QuickPickItem | string;
    leftUsernameQp: QuickPickItem | string;
    leftPassword: string;
    rightFqdnQp: QuickPickItem | string;
    rightUsernameQp: QuickPickItem | string;
    rightPassword: string;
    extractCommentWhitespaceQp: QuickPickItem;
    leftFqdn: string;
    leftUsername: string;
    rightFqdn: string;
    rightUsername: string;
    extractCommentWhitespace: boolean;
}

export async function collectServerServerSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
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
            totalSteps: 7,
            quickPickItems: fqdns.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New FQDN',
            quickPickPlaceholder: 'Please choose the source Tanium server fqdn or click + upper right to add new',
            activeItemPropertyName: 'leftFqdnQp',
            inputPrompt: 'Please enter the source Tanium server fqdn',
        },
        {
            stepType: StepType.quickPick,
            step: 2,
            totalSteps: 7,
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
            step: 3,
            totalSteps: 7,
            activeItemPropertyName: 'leftPassword',
            inputPrompt: 'Please enter the source Tanium server password',
            password: true
        },
        {
            stepType: StepType.quickPick,
            step: 4,
            totalSteps: 7,
            quickPickItems: fqdns.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New FQDN',
            quickPickPlaceholder: 'Please choose the dest Tanium server fqdn or click + upper right to add new',
            activeItemPropertyName: 'rightFqdnQp',
            inputPrompt: 'Please enter the source Tanium server fqdn',
        },
        {
            stepType: StepType.quickPick,
            step: 5,
            totalSteps: 7,
            quickPickItems: usernames.map(label => ({ label })),
            quickPickButtons: [
                addButton
            ],
            buttonTooltip: 'Add New Username',
            quickPickPlaceholder: 'Please choose the source Tanium server username or click + upper right to add new',
            activeItemPropertyName: 'rightUsernameQp',
            inputPrompt: 'Please enter the source Tanium server username',
        },
        {
            stepType: StepType.inputBox,
            step: 6,
            totalSteps: 7,
            activeItemPropertyName: 'rightPassword',
            inputPrompt: 'Please enter the dest Tanium server password',
            password: true
        },
        {
            stepType: StepType.quickPick,
            step: 7,
            totalSteps: 7,
            quickPickItems: ['Yes', 'No'].map(label => ({ label })),
            quickPickPlaceholder: 'Extract/group sensors with only comment and whitespace differences?',
            activeItemPropertyName: 'extractCommentWhitespaceQp',
        }
    ];

    const state = {} as Partial<ServerServerSensorState>;
    await collectInputs('Compare Tanium Server Sensors to Tanium Server Sensors', state, steps);

    if (typeof state.leftFqdnQp === 'string') {
        if (fqdns.indexOf(state.leftFqdnQp) === -1) {
            fqdns.push(state.leftFqdnQp);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
        }
        state.leftFqdn = state.leftFqdnQp;
    } else {
        state.leftFqdn = state.leftFqdnQp!.label;
    }

    if (typeof state.leftUsernameQp === 'string') {
        if (usernames.indexOf(state.leftUsernameQp) === -1) {
            usernames.push(state.leftUsernameQp);
            config.update('usernames', usernames, ConfigurationTarget.Global);
            }
        state.leftUsername = state.leftUsernameQp;
    } else {
        state.leftUsername = state.leftUsernameQp!.label;
    }

    if (typeof state.rightFqdnQp === 'string') {
        if (fqdns.indexOf(state.rightFqdnQp) === -1) {
            fqdns.push(state.rightFqdnQp);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
        }
        state.rightFqdn = state.rightFqdnQp;
    } else {
        state.rightFqdn = state.rightFqdnQp!.label;
    }

    if (typeof state.rightUsernameQp === 'string') {
        if (usernames.indexOf(state.rightUsernameQp) === -1) {
            usernames.push(state.rightUsernameQp);
            config.update('usernames', usernames, ConfigurationTarget.Global);
            }
        state.rightUsername = state.rightUsernameQp;
    } else {
        state.rightUsername = state.rightUsernameQp!.label;
    }

    state.extractCommentWhitespace = state.extractCommentWhitespaceQp!.label === 'Yes';

    // store data
    return state as ServerServerSensorState;
}

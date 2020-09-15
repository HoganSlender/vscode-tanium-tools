import { collectInputs, MultiStepInput, MyButton, Step, StepType } from "../multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

interface ServerServerSensorState {
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
            activeItemPropertyName: 'leftFqdn',
        },
        {
            stepType: StepType.inputBox,
            step: 1,
            totalSteps: 7,
            activeItemPropertyName: 'leftFqdn',
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
            activeItemPropertyName: 'leftUsername',
        },
        {
            stepType: StepType.inputBox,
            step: 2,
            totalSteps: 7,
            activeItemPropertyName: 'leftUsername',
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
            activeItemPropertyName: 'rightFqdn',
        },
        {
            stepType: StepType.inputBox,
            step: 4,
            totalSteps: 7,
            activeItemPropertyName: 'rightFqdn',
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
            activeItemPropertyName: 'rightUsername',
        },
        {
            stepType: StepType.inputBox,
            step: 5,
            totalSteps: 7,
            activeItemPropertyName: 'rightUsername',
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
            stepType: StepType.inputBox,
            step: 7,
            totalSteps: 7,
            activeItemPropertyName: 'extractCommentWhitespace',
            inputPrompt: 'Extract/group sensors with only comment and whitespace differences?',
            password: true
        }
    ];

    const state = {} as Partial<ServerServerSensorState>;
    await collectInputs('Compare Content Set', state, steps);

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

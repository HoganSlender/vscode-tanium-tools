import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

interface ServerServerMissingSensorState {
    leftFqdn: QuickPickItem | string;
    leftUsername: QuickPickItem | string;
    leftPassword: string;
    leftFqdnString: string;
    leftUsernameString: string;
}

export async function collectServerServerMissingSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
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
            quickPickPlaceholder: 'Please choose the source Tanium server fqdn or click + upper right to add new',
            activeItemPropertyName: 'leftFqdn',
        },
        {
            stepType: StepType.inputBox,
            step: 1,
            totalSteps: 3,
            activeItemPropertyName: 'leftFqdn',
            inputPrompt: 'Please enter the source Tanium server fqdn',
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
            quickPickPlaceholder: 'Please choose the source Tanium server username or click + upper right to add new',
            activeItemPropertyName: 'leftUsername',
        },
        {
            stepType: StepType.inputBox,
            step: 2,
            totalSteps: 3,
            activeItemPropertyName: 'leftUsername',
            inputPrompt: 'Please enter the source Tanium server username',
        },
        {
            stepType: StepType.inputBox,
            step: 3,
            totalSteps: 3,
            activeItemPropertyName: 'leftPassword',
            password: true,
            inputPrompt: 'Please enter the source Tanium server password',
        }
    ];

    const state = {} as Partial<ServerServerMissingSensorState>;
    await collectInputs('Create Export File', state, steps);

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

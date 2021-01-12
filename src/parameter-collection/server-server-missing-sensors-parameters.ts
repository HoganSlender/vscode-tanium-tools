import { ConfigurationTarget, ExtensionContext, QuickPickItem, Uri, WorkspaceConfiguration } from "vscode";
import { FqdnSetting } from "./fqdnSetting";

import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";

interface ServerServerMissingSensorState {
    leftFqdnQp: QuickPickItem | string;
    leftUsernameQp: QuickPickItem | string;
    leftPassword: string;
    leftFqdn: FqdnSetting;
    leftUsername: string;
}

export async function collectServerServerMissingSensorInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
    const addButton = new MyButton({
        dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
        light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
    }, '');

    // get fqdns
    const fqdns: FqdnSetting[] = config.get('fqdns', []);

    // get usernames
    const usernames: string[] = config.get('usernames', []);

    // define steps
    const steps: Step[] = [
        {
            stepType: StepType.quickPick,
            step: 1,
            totalSteps: 3,
            quickPickItems: fqdns.map(fqdn => ({ label: fqdn.label })),
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
            totalSteps: 3,
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
            totalSteps: 3,
            activeItemPropertyName: 'leftPassword',
            password: true,
            inputPrompt: 'Please enter the source Tanium server password',
        }
    ];

    const state = {} as Partial<ServerServerMissingSensorState>;
    await collectInputs('Create Export File', state, steps);

    if (typeof state.leftFqdnQp === 'string') {
        // new one
        const inIndex = fqdns.filter(fqdn => (fqdn.label === state.leftFqdnQp));

        if (inIndex.length === 0) {
            const newFqdn = {
                fqdn: state.leftFqdnQp,
                label: state.leftFqdnQp
            };
            fqdns.push(newFqdn);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
            state.leftFqdn = newFqdn;
        } else {
            state.leftFqdn = inIndex[0];
        }
    } else {
        // existing one
        const target: QuickPickItem = state.leftFqdnQp!;
        state.leftFqdn = fqdns.filter(fqdn => (fqdn.label === target.label))[0];
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

    // store data
    return state as ServerServerMissingSensorState;
}

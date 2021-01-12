import { ConfigurationTarget, ExtensionContext, QuickPickItem, Uri, WorkspaceConfiguration } from "vscode";
import { FqdnSetting } from "./fqdnSetting";

import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";

interface ContentSetSensorState {
    contentSetUrl: string;
    fqdnQp: QuickPickItem | string;
    usernameQp: QuickPickItem | string;
    extractCommentWhitespaceQp: QuickPickItem;
    password: string;
    fqdn: FqdnSetting;
    username: string;
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
    const fqdns: FqdnSetting[] = config.get('fqdns', []);

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
            activeItemPropertyName: 'extractCommentWhitespaceQp',
        },
        {
            stepType: StepType.quickPick,
            step: 3,
            totalSteps: 5,
            quickPickItems: fqdns.map(fqdn => ({ label: fqdn.label })),
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
            step: 4,
            totalSteps: 5,
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
            step: 5,
            totalSteps: 5,
            activeItemPropertyName: 'password',
            inputPrompt: 'Please enter the Tanium server password',
            password: true
        },
    ];

    const state = {} as Partial<ContentSetSensorState>;
    state.contentSetUrl = lastUsedUrl;
    await collectInputs('Compare Content Set to Tanium Server Sensors', state, steps);

    context.globalState.update('hoganslender.tanium.contentset.url', state.contentSetUrl);

    if (typeof state.fqdnQp === 'string') {
        // new one
        const inIndex = fqdns.filter(fqdn => (fqdn.label === state.fqdnQp));

        if (inIndex.length === 0) {
            const newFqdn = {
                fqdn: state.fqdnQp,
                label: state.fqdnQp
            };
            fqdns.push(newFqdn);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
            state.fqdn = newFqdn;
        } else {
            state.fqdn = inIndex[0];
        }
    } else {
        // existing one
        const target: QuickPickItem = state.fqdnQp!;
        state.fqdn = fqdns.filter(fqdn => (fqdn.label === target.label))[0];
    }

    if (typeof state.usernameQp === 'string') {
        usernames.push(state.usernameQp);
        config.update('usernames', usernames, ConfigurationTarget.Global);
        state.username = state.usernameQp;
    } else {
        state.username = state.usernameQp!.label;
    }

    state.extractCommentWhitespace = state.extractCommentWhitespaceQp!.label === 'Yes';

    // store data
    return state as ContentSetSensorState;
}

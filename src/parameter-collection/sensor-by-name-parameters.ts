import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";

export interface SensorByNameState {
    fqdnQp: QuickPickItem | string;
    usernameQp: QuickPickItem | string;
    password: string;
    fqdn: string;
    username: string;
    sensorName: string;
}

export async function collectSensorByNameInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
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
            activeItemPropertyName: 'fqdnQp',
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
            activeItemPropertyName: 'usernameQp',
            inputPrompt: 'Please enter the source Tanium server username',
        },
        {
            stepType: StepType.inputBox,
            step: 3,
            totalSteps: 7,
            activeItemPropertyName: 'password',
            inputPrompt: 'Please enter the source Tanium server password',
            password: true
        },
        {
            stepType: StepType.inputBox,
            step: 6,
            totalSteps: 7,
            activeItemPropertyName: 'sensorName',
            inputPrompt: 'Please enter the sensor name'
        }
    ];

    const state = {} as Partial<SensorByNameState>;
    await collectInputs('Retrieve Sensor By Name', state, steps);

    if (typeof state.fqdnQp === 'string') {
        if (fqdns.indexOf(state.fqdnQp) === -1) {
            fqdns.push(state.fqdnQp);
            config.update('fqdns', fqdns, ConfigurationTarget.Global);
        }
        state.fqdn = state.fqdnQp;
    } else {
        state.fqdn = state.fqdnQp!.label;
    }

    if (typeof state.usernameQp === 'string') {
        if (usernames.indexOf(state.usernameQp) === -1) {
            usernames.push(state.usernameQp);
            config.update('usernames', usernames, ConfigurationTarget.Global);
            }
        state.username = state.usernameQp;
    } else {
        state.username = state.usernameQp!.label;
    }

    // store data
    return state as SensorByNameState;
}

import { collectInputs, MyButton, Step, StepType } from "./multi-step-input";
import { QuickPickItem, WorkspaceConfiguration, ExtensionContext, Uri, ConfigurationTarget } from "vscode";
import { FqdnSetting } from "./fqdnSetting";

export interface SensorByNameState {
    fqdnQp: QuickPickItem | string;
    usernameQp: QuickPickItem | string;
    password: string;
    fqdn: FqdnSetting;
    username: string;
    sensorName: string;
}

export async function collectSensorByNameInputs(config: WorkspaceConfiguration, context: ExtensionContext) {
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
            totalSteps: 7,
            quickPickItems: fqdns.map(fqdn => ({ label: fqdn.label })),
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

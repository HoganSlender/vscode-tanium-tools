import { QuickInput, QuickPickItem, QuickInputButton, Disposable, window, QuickInputButtons, Uri, OpenDialogOptions, WorkspaceConfiguration, ExtensionContext } from "vscode";

export class MyButton implements QuickInputButton {
	constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
}

export enum StepType {
	quickPick,
	inputBox,
	fileDialog,
}

export interface Step {
	stepType: StepType,
	step: number,
	totalSteps: number,
	quickPickItems: QuickPickItem[],
	quickPickButtons: QuickInputButton[],
	fileDialogButtons: QuickInputButton[],
	buttonTooltip: string,
	quickPickPlaceholder: string,
	activeItemPropertyName: string,
	inputPrompt: string,
}

export async function collectInputs(title: string, state: any, steps: Step[]) {
	await MultiStepInput.run(input => stepTypeSelector(title, input, state, steps, 0, 0));

	return state;
}

function shouldResume() {
	// Could show a notification with the option to resume.
	return new Promise<boolean>((resolve, reject) => {
		// noop
	});
}

function stepTypeSelector(title: string, input: MultiStepInput, state: any, steps: Step[], stepIndex: number, stepModifier: number): any {
	if (stepIndex < steps.length) {
		const step = steps[stepIndex];
		switch (step.stepType) {
			case StepType.quickPick:
				if (step.quickPickItems.length === 0) {
					stepIndex++;
					return (input: MultiStepInput) => stepTypeSelector(title, input, state, steps, stepIndex, 0);
				} else {
					return (input: MultiStepInput) => pickQuickPickItem(title, input, state, steps, stepIndex, 0);
				}

			case StepType.inputBox:
				return (input: MultiStepInput) => inputLabel(title, input, state, steps, stepIndex, 0);

			case StepType.fileDialog:
				return (input: MultiStepInput) => pickFileDialog(title, input, state, steps, stepIndex, 0);
		}
	}
}

async function pickQuickPickItem(title: string, input: MultiStepInput, state: any, steps: Step[], stepIndex: number, stepModifier: number) {
	const step = steps[stepIndex];
	const pick = await input.showQuickPick({
		title: title,
		step: step.step + stepModifier,
		totalSteps: step.totalSteps + stepModifier,
		placeholder: step.quickPickPlaceholder,
		items: step.quickPickItems,
		activeItem: typeof state[step.activeItemPropertyName] !== 'string' ? state[step.activeItemPropertyName] : undefined,
		buttons: step.quickPickButtons,
		shouldResume: shouldResume
	});
	if (pick instanceof MyButton) {
		stepIndex++;
		stepModifier++;
		return (input: MultiStepInput) => stepTypeSelector(title, input, state, steps, stepIndex, stepModifier);
	}
	state[step.activeItemPropertyName] = pick;

	if (step.step !== step.totalSteps) {
		stepIndex++;
		return (input: MultiStepInput) => stepTypeSelector(title, input, state, steps, stepIndex, stepModifier);
	}
}

async function inputLabel(title: string, input: MultiStepInput, state: any, steps: Step[], stepIndex: number, stepModifier: number) {
	const step = steps[stepIndex];
	state[step.activeItemPropertyName] = await input.showInputBox({
		title: title,
		step: step.step + stepModifier,
		totalSteps: step.totalSteps,
		value: typeof state[step.activeItemPropertyName] === 'string' ? state[step.activeItemPropertyName] : '',
		prompt: step.inputPrompt,
		shouldResume: shouldResume
	});

	if (step.step !== step.totalSteps) {
		stepIndex++;
		return (input: MultiStepInput) => stepTypeSelector(title, input, state, steps, stepIndex, stepModifier);
	}
}

async function pickFileDialog(title: string, input: MultiStepInput, state: any, steps: Step[], stepIndex: number, stepModifier: number) {
	const step = steps[stepIndex];
	state[step.activeItemPropertyName] = await input.showFileDialog({
		title,
		step: step.step + stepModifier,
		totalSteps: step.totalSteps + stepModifier,
		placeholder: step.quickPickPlaceholder,
		activeItem: typeof state[step.activeItemPropertyName] !== 'string' ? state[step.activeItemPropertyName] : undefined,
		buttons: step.fileDialogButtons,
		openFileDialogOptions: {
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
		},
		shouldResume: shouldResume
	});

	if (state[step.activeItemPropertyName] !== undefined) {
		if (step.step !== step.totalSteps) {
			stepIndex++;
			return (input: MultiStepInput) => stepTypeSelector(title, input, state, steps, stepIndex, stepModifier);
		}
	}
}

export class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showFileDialog<T extends QuickPickItem, P extends QuickPickFileDialogParameters<T>>({ title, step, totalSteps, activeItem, placeholder, buttons, openFileDialogOptions, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							// show file dialog
							(async () => {
								const uris = await window.showOpenDialog(openFileDialogOptions);
								const retval = uris === undefined ? undefined : uris[0].fsPath;
								resolve(<any>retval);
							})();
						}
					}),
					//input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, password, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.password = password ? password : false;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						resolve(value);
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}

class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface QuickPickFileDialogParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	openFileDialogOptions: OpenDialogOptions,
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	password?: boolean;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

import { OutputChannel, window } from "vscode";
import { RequestError } from "got";

export class OutputChannelLogging {
    private static channel: OutputChannel;

    public static initialize() {
        if (OutputChannelLogging.channel === undefined) {
            OutputChannelLogging.channel = window.createOutputChannel('tanium');
        }
    }

    public static showClear() {
        OutputChannelLogging.channel.show();
        OutputChannelLogging.clear();
    }

    public static clear() {
        OutputChannelLogging.channel.clear();
    }

    public static log(msg: string) {
        OutputChannelLogging.channel.appendLine(msg);
    }

    public static logError(msg: string, errObject: any) {
        OutputChannelLogging.log(msg);
        if (errObject instanceof TypeError) {
            OutputChannelLogging.log(`\t${errObject.message} at ${errObject.stack}`);
        } else if (errObject instanceof RequestError) {
            OutputChannelLogging.log(`\t${errObject.message} at ${errObject.stack}`);
        } else {
            OutputChannelLogging.log(`\t${JSON.stringify(errObject, null, 2)}`);
        }
    }
    }
import { OutputChannelLogging } from "./logging";

export function checkResolve(
    counter: number,
    total: number,
    label: string,
    fqdn: string,
): boolean {
    if (total === counter) {
        OutputChannelLogging.log(`processed ${total} ${label} from ${fqdn}`);
        return true;
    }

    return false;
}
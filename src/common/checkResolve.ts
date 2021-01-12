import { FqdnSetting } from "../parameter-collection/fqdnSetting";
import { OutputChannelLogging } from "./logging";

export function checkResolve(
    counter: number,
    total: number,
    label: string,
    fqdn: FqdnSetting,
): boolean {
    if (total === counter) {
        OutputChannelLogging.log(`processed ${total} ${label} from ${fqdn.label}`);
        return true;
    }

    return false;
}
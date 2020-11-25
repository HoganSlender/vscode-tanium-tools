import { OutputChannelLogging } from "../common/logging";
import { RestClient } from "../common/restClient";
import { SigningUtils } from "../common/signingUtils";
import { SigningKey } from "../types/signingKey";

export class Groups {
    static getGroupByName(groupName: string, allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`${restBase}/groups/by-name/${groupName}`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                resolve(body.data);

            } catch (err) {
                OutputChannelLogging.logError(`error retrieving group`, err);
                reject();
            }
        });

        return p;
    }

    static getGroupExportByName(groupName: string, allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.post(`${restBase}/export`, {
                    headers: {
                        session: session
                    },
                    json: {
                        groups: {
                            include: [
                                groupName
                            ]
                        }
                    },
                    responseType: 'json'
                }, allowSelfSignedCerts, httpTimeout);

                resolve(body.data);

            } catch (err) {
                OutputChannelLogging.logError(`error retrieving group`, err);
                reject();
            }
        });

        return p;
    }

    static setUpGroupInDest(
        sourceGroupName: string,
        allowSelfSignedCerts: boolean,
        httpTimeout: number,
        sourceFqdn: string,
        sourceSession: string,
        destFqdn: string,
        destSession: string,
        signingKey: SigningKey
    ): Promise<number> {
        const p = new Promise<number>(async (resolve, reject) => {
            try {
                const sourceRestBase = `https://${sourceFqdn}/api/v2`;
                const destRestBase = `https://${destFqdn}/api/v2`;

                // check for mrgroup_
                if (sourceGroupName.startsWith('mrgroup_')) {
                    // process mrgroup_
                } else {
                    // single group, see if it exists on target
                    try {
                        const targetGroup = await this.getGroupByName(sourceGroupName, allowSelfSignedCerts, httpTimeout, destRestBase, destSession);

                        // return target group's id
                        resolve(targetGroup.id);
                    } catch {
                        // doesn't exist, need to create it
                        const newTargetGroupJson = await this.getGroupExportByName(sourceGroupName, allowSelfSignedCerts, httpTimeout, sourceRestBase, sourceSession);

                        // sign content
                        const signingData = await SigningUtils.retrieveSignedContent(newTargetGroupJson, signingKey);

                        // import data
                        const res = await SigningUtils.postSignedContent(destFqdn, destSession, signingData.content, allowSelfSignedCerts, httpTimeout);

                        // resolve
                        const targetGroup = await this.getGroupByName(sourceGroupName, allowSelfSignedCerts, httpTimeout, destRestBase, destSession);

                        // return target group's id
                        resolve(targetGroup.id);
                    }
                }

                resolve(-1);
            } catch (err) {
                OutputChannelLogging.logError(`error setting up group in target server`, err);
                reject();
            }
        });

        return p;
    }

    static getGroupMap(allowSelfSignedCerts: boolean, httpTimeout: number, restBase: string, session: string): any {
        const p = new Promise(async (resolve, reject) => {
            try {
                const body = await RestClient.get(`${restBase}/groups`, {
                    headers: {
                        session: session
                    },
                    responseType: 'json',
                }, allowSelfSignedCerts, httpTimeout);


                var groups: any = {};
                for (var i = 0; i < body.data.length; i++) {
                    const groupEntity: any = body.data[i];
                    groups[groupEntity.id] = groupEntity;
                }

                resolve(groups);
            } catch (err) {
                OutputChannelLogging.logError(`error retrieving groups`, err);
                return reject();
            }
        });

        return p;
    }
}
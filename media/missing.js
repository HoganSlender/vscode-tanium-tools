const vscode = acquireVsCodeApi();

console.log('missing');

var missingAddButton = document.getElementById("missingAddButton");
var missingRemoveButton = document.getElementById("missingRemoveButton");
var processMissingButton = document.getElementById("processMissingButton");
processMissingButton.disabled = true;

var missinglItems = document.getElementById("missinglitems");
var missingrItems = document.getElementById("missingritems");

missinglItems.addEventListener("dblclick", () => openFile(missinglItems));
missingrItems.addEventListener("dblclick", () => openFile(missingrItems));

var divShowServerInfo = document.getElementById('divShowServerInfo');
var showServerInfo = divShowServerInfo.value === '1';
var serverInfo = document.getElementById('serverInfo');

var divTransferIndividual = document.getElementById('divTransferIndividual');
var transferIndividual = divTransferIndividual.value === '1';
console.log(`transferIndividual: ${transferIndividual}`);

missingAddButton.addEventListener("click", () => addButtonEvent(missinglItems, missingrItems));
missingRemoveButton.addEventListener("click", () => removeButtonEvent(missingrItems, missinglItems));
processMissingButton.addEventListener("click", processMissingItems);

var divFqdns = document.getElementById("divFqdns");
var divUsernames = document.getElementById("divUsernames");
var divSigningKeys = document.getElementById("divSigningKeys");

var divMissingSourceFqdn = document.getElementById("divMissingSourceFqdn");
var divMissingDestFqdn = document.getElementById("divMissingDestFqdn");
var divMissingUsername = document.getElementById("divMissingUsername");
var divMissingSigningKey = document.getElementById("divMissingSigningKey");

if (!showServerInfo) {
    serverInfo.style.visibility = 'hidden';
}

var fqdnsText = divFqdns.innerHTML;

var fqdns = fqdnsText.split(',');

var usernamesText = divUsernames.innerHTML;

var usernames = usernamesText.split(',');

var signingKeysText = divSigningKeys.innerHTML;

var signingKeys = signingKeysText.split(',');

processInput(fqdns, divMissingSourceFqdn, 'taniumSourceServerFqdnSelect', false);
processInput(fqdns, divMissingDestFqdn, 'taniumDestServerFqdnSelect', true);
processInput(usernames, divMissingUsername, 'taniumServerUsernameSelect', true);
processInput(signingKeys, divMissingSigningKey, 'taniumSigningKeySelect', true);

var missingTaniumServerPassword = document.getElementById("missingTaniumServerPassword");

var taniumSourceServerFqdnSelect = document.getElementById("taniumSourceServerFqdnSelect");
var taniumDestServerFqdnSelect = document.getElementById("taniumDestServerFqdnSelect");
var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");
var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");

missingTaniumServerPassword.addEventListener("input", enableProcessPackage);

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'complete':
            // remove first item
            missingrItems.options[0] = null;

            processMissingItems();
            break;
    }
});

function processInput(inputArray, targetDiv, targetId, isLast) {
    var tag = document.createElement("select");
    tag.setAttribute("id", `${targetId}`);
    targetDiv.appendChild(tag);

    for (var i = 0; i < inputArray.length; i++) {
        var item = inputArray[i];
        var option = document.createElement("option");
        option.setAttribute("value", item);
        var text = document.createTextNode(item);
        option.appendChild(text);
        tag.appendChild(option);
    }

    // set selected index
    if (isLast) {
        tag.selectedIndex = inputArray.length - 1;
    }
}

function enableProcessPackage() {
    if (showServerInfo) {
        processMissingButton.disabled = missingTaniumServerPassword.value.trim().length === 0;
    } else {
        processMissingButton.disabled = missingrItems.options.length === 0;
    }
}

function addButtonEvent(from, to) {
    moveItems(from, to);
    if (!showServerInfo) {
        enableProcessPackage();
    }
}

function removeButtonEvent(from, to) {
    moveItems(from, to);
    if (!showServerInfo) {
        enableProcessPackage();
    }
}

function moveItems(from, to) {
    if (from.selectedIndex === -1) {
        return;
    }

    for (var i = 0; i < from.options.length; i++) {
        var o = from.options[i];

        if (o.selected) {
            to.options[to.options.length] = new Option(o.text, o.value);
        }
    }

    for (var i = from.options.length - 1; i >= 0; i--) {
        var o = from.options[i];

        if (o.selected) {
            from.options[i] = null;
        }
    }
}

function openDiff(from) {
    console.log('inside openDiff');
    if (from.selectedIndex === -1) {
        return;
    }

    var o = from.options[from.selectedIndex];

    // send message
    vscode.postMessage({
        command: 'openDiff',
        name: o.text,
        path: o.value,
    });
}

function openFile(from) {
    console.log('inside openFile');
    if (from.selectedIndex === -1) {
        return;
    }

    var o = from.options[from.selectedIndex];
    console.log(`filePath: ${o.value}`);

    // send message
    vscode.postMessage({
        command: 'openFile',
        path: o.value,
    });
}

function processMissingItems() {
    processMissingButton.disabled = true;

    const sourceFqdn = taniumSourceServerFqdnSelect.value;
    const destFqdn = taniumDestServerFqdnSelect.value;
    const username = taniumServerUsernameSelect.value;
    const signingKey = taniumSigningKeySelect.value;

    if (transferIndividual) {
        // process first item
        if (missingrItems.options.length !== 0) {
            var option = missingrItems.options[0];

            // send message
            vscode.postMessage({
                command: 'transferItem',
                sourceFqdn: sourceFqdn,
                destFqdn: destFqdn,
                username: username,
                password: missingTaniumServerPassword.value,
                path: option.value,
                packageName: option.text,
                signingServerLabel: signingKey,
            });
        } else {
            vscode.postMessage({
                command: 'completeProcess'
            });
            processMissingButton.disabled = false;
        }
    } else {
        // gather all values and send
        if (missingrItems.options.length !== 0) {
            var items = [];
            for (var i = 0; i < missingrItems.options.length; i++) {
                var o = missingrItems.options[i];
                items.push({
                    path: o.value,
                    name: o.text,
                });
            }

            // send message
            vscode.postMessage({
                command: 'transferItems',
                items: items,
            });
            processMissingButton.disabled = false;
        }
    }
}
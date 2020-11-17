const vscode = acquireVsCodeApi();

console.log('created');

var createdAddButton = document.getElementById("createdAddButton");
var createdRemoveButton = document.getElementById("createdRemoveButton");
var processCreatedButton = document.getElementById("processCreatedButton");
processCreatedButton.disabled = true;

var createdlItems = document.getElementById("createdlitems");
var createdrItems = document.getElementById("createdritems");

createdlItems.addEventListener("dblclick", () => openFile(createdlItems));
createdrItems.addEventListener("dblclick", () => openFile(createdrItems));

var divShowServerInfo = document.getElementById('divShowServerInfo');
var showServerInfo = divShowServerInfo.value === '1';
var serverInfo = document.getElementById('serverInfo');

var divTransferIndividual = document.getElementById('divTransferIndividual');
var transferIndividual = divTransferIndividual.value === '1';
console.log(`transferIndividual: ${transferIndividual}`);

createdAddButton.addEventListener("click", () => addButtonEvent(createdlItems, createdrItems));
createdRemoveButton.addEventListener("click", () => removeButtonEvent(createdrItems, createdlItems));
processCreatedButton.addEventListener("click", processCreatedItems);

var divFqdns = document.getElementById("divFqdns");
var divUsernames = document.getElementById("divUsernames");
var divSigningKeys = document.getElementById("divSigningKeys");
var divTransferIndividual = document.getElementById("divTransferIndividual");
var divShowServerInfo = document.getElementById('divShowServerInfo');
var serverInfo = document.getElementById('serverInfo');

var divCreatedSourceFqdn = document.getElementById("divCreatedSourceFqdn");
var divCreatedDestFqdn = document.getElementById("divCreatedDestFqdn");
var divCreatedUsername = document.getElementById("divCreatedUsername");
var divCreatedSigningKey = document.getElementById("divCreatedSigningKey");

if (!showServerInfo) {
    serverInfo.style.visibility = 'hidden';
}

var fqdnsText = divFqdns.innerHTML;

var fqdns = fqdnsText.split(',');

var usernamesText = divUsernames.innerHTML;

var usernames = usernamesText.split(',');

var signingKeysText = divSigningKeys.innerHTML;

var signingKeys = signingKeysText.split(',');

processInput(fqdns, divCreatedSourceFqdn, 'taniumSourceServerFqdnSelect', false);
processInput(fqdns, divCreatedDestFqdn, 'taniumDestServerFqdnSelect', true);
processInput(usernames, divCreatedUsername, 'taniumServerUsernameSelect', true);
processInput(signingKeys, divCreatedSigningKey, 'taniumSigningKeySelect', true);

var createdTaniumServerPassword = document.getElementById("createdTaniumServerPassword");

var taniumSourceServerFqdnSelect = document.getElementById("taniumSourceServerFqdnSelect");
var taniumDestServerFqdnSelect = document.getElementById("taniumDestServerFqdnSelect");
var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");
var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");

createdTaniumServerPassword.addEventListener("input", enableProcessPackage);

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'complete':
            // remove first item
            createdrItems.options[0] = null;

            processCreatedItems();
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
        processModifiedButton.disabled = createdTaniumServerPassword.value.trim().length === 0;
    } else {
        processCreatedButton.disabled = createdrItems.options.length === 0;
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

function processCreatedItems() {
    processCreatedButton.disabled = true;

    const sourceFqdn = taniumSourceServerFqdnSelect.value;
    const destFqdn = taniumDestServerFqdnSelect.value;
    const username = taniumServerUsernameSelect.value;
    const signingKey = taniumSigningKeySelect.value;

    if (transferIndividual) {
        // process first item
        if (createdrItems.options.length !== 0) {
            var option = createdrItems.options[0];

            // send message
            vscode.postMessage({
                command: 'transferItem',
                sourceFqdn: sourceFqdn,
                destFqdn: destFqdn,
                username: username,
                password: createdTaniumServerPassword.value,
                path: option.value,
                packageName: option.text,
                signingServerLabel: signingKey,
            });
        } else {
            vscode.postMessage({
                command: 'completeProcess'
            });
            processCreatedButton.disabled = false;
        }
    } else {
        // gather all values and send
        if (createdrItems.options.length !== 0) {
            var items = [];
            for (var i = 0; i < creeatedrItems.options.length; i++) {
                var o = createdrItems.options[i];
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
            processModifiedButton.disabled = false;
        }
    }
}
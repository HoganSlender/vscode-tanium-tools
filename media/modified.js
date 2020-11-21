const vscode = acquireVsCodeApi();

console.log('modified');

var modifiedAddButton = document.getElementById("modifiedAddButton");
var modifiedRemoveButton = document.getElementById("modifiedRemoveButton");
var processModifiedButton = document.getElementById("processModifiedButton");
console.log('after');

if (processModifiedButton !== null) {
    console.log(`processingModifiedButton !== null`);
    processModifiedButton.disabled = true;
} else {
    console.log(`processingModifiedButton === null`);
}

var modifiedlItems = document.getElementById("modifiedlitems");
var modifiedrItems = document.getElementById("modifiedritems");

if (modifiedlItems !== null) {
    console.log(`modifiedlItems !== null`);
    modifiedlItems.addEventListener("dblclick", () => openDiff(modifiedlItems));
} else {
    console.log(`modifiedlItems === null`);
}

if (modifiedrItems !== null) {
    console.log(`modifiedrItems !== null`);
    modifiedrItems.addEventListener("dblclick", () => openDiff(modifiedrItems));
} else {
    console.log(`modifiedrItems === null`);
}

var divShowServerInfo = document.getElementById('divShowServerInfo');

if (divShowServerInfo !== null) {
    console.log(`divShowServerInfo !== null`);    
} else {
    console.log(`divShowServerInfo === null`);    
}

var showServerInfo = divShowServerInfo.innerHTML === '1';
var serverInfo = document.getElementById('serverInfo');

var divTransferIndividual = document.getElementById('divTransferIndividual');
var transferIndividual = divTransferIndividual.innerHTML === '1';
console.log(`transferIndividual: ${transferIndividual}`);

if (modifiedAddButton !== null) {
    console.log(`modifiedAddButton !== null`);
    modifiedAddButton.addEventListener("click", () => addButtonEvent(modifiedlItems, modifiedrItems));
} else {
    console.log(`modifiedAddButton === null`);
}

if (modifiedRemoveButton !== null) {
    console.log(`modifiedRemoveButton !== null`);
    modifiedRemoveButton.addEventListener("click", () => removeButtonEvent(modifiedrItems, modifiedlItems));
} else {
    console.log(`modifiedRemoveButton === null`);
}

if (processModifiedButton !== null) {
    console.log(`processModifiedButton !== null`);
    processModifiedButton.addEventListener("click", processModifiedItems);
} else {
    console.log(`processModifiedButton === null`);
}

var divFqdns = document.getElementById("divFqdns");
var divUsernames = document.getElementById("divUsernames");
var divSigningKeys = document.getElementById("divSigningKeys");

if (!showServerInfo) {
    console.log(`showServerInfo === false`);
    serverInfo.style.visibility = 'hidden';
} else {
    console.log(`showServerInfo === true`);
    var divModifiedSourceFqdn = document.getElementById("divModifiedSourceFqdn");
    var divModifiedDestFqdn = document.getElementById("divModifiedDestFqdn");
    var divModifiedUsername = document.getElementById("divModifiedUsername");
    var divModifiedSigningKey = document.getElementById("divModifiedSigningKey");

    var fqdnsText = divFqdns.innerHTML;

    var fqdns = fqdnsText.split(',');
    
    var usernamesText = divUsernames.innerHTML;
    
    var usernames = usernamesText.split(',');
    
    var signingKeysText = divSigningKeys.innerHTML;
    
    var signingKeys = signingKeysText.split(',');
    
    if (divModifiedSourceFqdn !== null) {
        processInput(fqdns, divModifiedSourceFqdn, 'taniumSourceServerFqdnSelect', false);
    }

    processInput(fqdns, divModifiedDestFqdn, 'taniumDestServerFqdnSelect', true);
    processInput(usernames, divModifiedUsername, 'taniumServerUsernameSelect', true);

    if (divMissingSigningKey !== null) {
        processInput(signingKeys, divModifiedSigningKey, 'taniumSigningKeySelect', true);
    }
    
    var modifiedTaniumServerPassword = document.getElementById("modifiedTaniumServerPassword");
    
    var taniumSourceServerFqdnSelect = document.getElementById("taniumSourceServerFqdnSelect");
    var taniumDestServerFqdnSelect = document.getElementById("taniumDestServerFqdnSelect");
    var taniumServerUsernameSelect = document.getElementById("taniumServerUsernameSelect");
    var taniumSigningKeySelect = document.getElementById("taniumSigningKeySelect");
    
    modifiedTaniumServerPassword.addEventListener("input", enableProcessPackage);
}

// handle messages from extension to webview
window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
        case 'complete':
            // remove first item
            modifiedrItems.options[0] = null;

            processModifiedItems();
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
        processModifiedButton.disabled = modifiedTaniumServerPassword.value.trim().length === 0;
    } else {
        processModifiedButton.disabled = modifiedrItems.options.length === 0;
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

function processModifiedItems() {
    console.log('inside processModifiedItems');
    processModifiedButton.disabled = true;

    const sourceFqdn = taniumSourceServerFqdnSelect?.value ?? '';
    console.log(`sourceFqdn: ${sourceFqdn}`);
    const destFqdn = taniumDestServerFqdnSelect?.value ?? '';
    console.log(`destFqdn: ${destFqdn}`);
    const username = taniumServerUsernameSelect?.value ?? '';
    console.log(`username: ${username}`);
    const signingKey = taniumSigningKeySelect?.value ?? '';
    console.log(`signingKey: ${signingKey}`);

    if (transferIndividual) {
        console.log('transfer individual');
        // process first item
        if (modifiedrItems.options.length !== 0) {
            var option = modifiedrItems.options[0];

            // send message
            vscode.postMessage({
                command: 'transferItem',
                sourceFqdn: sourceFqdn,
                destFqdn: destFqdn,
                username: username,
                password: modifiedTaniumServerPassword.value,
                path: option.value,
                name: option.text,
                signingServerLabel: signingKey,
            });
        } else {
            vscode.postMessage({
                command: 'completeProcess'
            });
            processmodifiedButton.disabled = false;
        }
    } else {
        console.log('transfer all');
        // gather all values and send
        if (modifiedrItems.options.length !== 0) {
            var items = [];
            for (var i = 0; i < modifiedrItems.options.length; i++) {
                var o = modifiedrItems.options[i];
                items.push({
                    path: o.value,
                    name: o.text,
                });
            }

            console.log(`items: ${JSON.stringify(items, null, 2)}`);

            // send message
            vscode.postMessage({
                command: 'transferItems',
                items: items,
            });
            processModifiedButton.disabled = false;
        }
    }
}